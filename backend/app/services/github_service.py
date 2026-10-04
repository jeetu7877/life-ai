import os
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
import httpx
from sqlalchemy.orm import Session

from app.models.connected_account import ConnectedAccount
from app.models.github import GitHubRepository, CodeChunk
from app.security.crypto import encrypt_value, decrypt_value
from app.services.embedding_service import embedding_service
from app.services.rag_service import rag_service

logger = logging.getLogger("life.github")

SUPPORTED_CODE_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".go": "go",
    ".rs": "rust",
    ".html": "html",
    ".css": "css",
    ".json": "json",
    ".md": "markdown",
    ".sql": "sql",
    ".sh": "bash",
    ".yaml": "yaml",
    ".yml": "yaml",
}

class GitHubService:
    """
    Production GitHub Repository Intelligence Brain:
    - Encrypted token persistence in connected_accounts
    - Repository tree discovery & fetching
    - Code-aware chunking (functions, classes, modules)
    - Persistent CodeChunk storage with vector embeddings in PostgreSQL & ChromaDB
    - Semantic & lexical code retrieval
    """

    def get_user_token(self, db: Session, user_id: str) -> Optional[str]:
        """Retrieve and decrypt the user's GitHub access token."""
        account = db.query(ConnectedAccount).filter(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider == "github",
            ConnectedAccount.is_active == True
        ).first()
        if not account or not account.encrypted_access_token:
            return None
        return decrypt_value(account.encrypted_access_token)

    def save_user_token(self, db: Session, user_id: str, token: str, username: Optional[str] = None) -> ConnectedAccount:
        """Encrypt and save the user's GitHub personal access token."""
        account = db.query(ConnectedAccount).filter(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider == "github"
        ).first()

        encrypted = encrypt_value(token)
        if not account:
            account = ConnectedAccount(
                user_id=user_id,
                provider="github",
                account_username=username or "github_user",
                encrypted_access_token=encrypted,
                is_active=True
            )
            db.add(account)
        else:
            account.encrypted_access_token = encrypted
            account.is_active = True
            if username:
                account.account_username = username
        db.commit()
        db.refresh(account)
        return account

    async def list_remote_repositories(self, token: str) -> List[Dict[str, Any]]:
        """Fetch list of accessible repositories for the user from GitHub API."""
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Life-Personal-AI-Companion"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://api.github.com/user/repos?sort=updated&per_page=50", headers=headers)
            if resp.status_code != 200:
                logger.error(f"GitHub API error {resp.status_code}: {resp.text}")
                return []
            repos = resp.json()
            return [{
                "id": r.get("id"),
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "description": r.get("description"),
                "html_url": r.get("html_url"),
                "default_branch": r.get("default_branch", "main"),
                "is_private": r.get("private", False),
                "language": r.get("language")
            } for r in repos]

    async def index_repository(
        self,
        db: Session,
        user_id: str,
        repo_name: str,
        owner: Optional[str] = None,
        branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full index pipeline:
        1. Fetch file tree
        2. Filter code files
        3. Parse & chunk code
        4. Generate embeddings and persist CodeChunk rows
        """
        token = self.get_user_token(db, user_id)
        if not token:
            return {"success": False, "error": "No connected GitHub account found for this user."}

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Life-Personal-AI-Companion"
        }

        # Resolve owner if not specified
        if not owner or "/" in repo_name:
            if "/" in repo_name:
                parts = repo_name.split("/")
                owner = parts[0]
                repo_name = parts[1]
            else:
                # Get current authenticated user's login
                async with httpx.AsyncClient(timeout=10.0) as client:
                    u_resp = await client.get("https://api.github.com/user", headers=headers)
                    if u_resp.status_code == 200:
                        owner = u_resp.json().get("login")
                    else:
                        return {"success": False, "error": "Could not determine GitHub repository owner."}

        # Check or create repo record in DB
        repo = db.query(GitHubRepository).filter(
            GitHubRepository.user_id == user_id,
            GitHubRepository.repo_name == repo_name
        ).first()

        if not repo:
            repo = GitHubRepository(
                user_id=user_id,
                repo_name=repo_name,
                repo_owner=owner,
                default_branch=branch or "main",
                indexing_status="indexing"
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)
        else:
            repo.indexing_status = "indexing"
            db.commit()

        try:
            target_branch = branch or repo.default_branch or "main"
            # Fetch tree recursively
            tree_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{target_branch}?recursive=1"
            async with httpx.AsyncClient(timeout=25.0) as client:
                tree_resp = await client.get(tree_url, headers=headers)
                if tree_resp.status_code != 200:
                    repo.indexing_status = "failed"
                    db.commit()
                    return {"success": False, "error": f"Failed to fetch repository tree: {tree_resp.text}"}
                tree_data = tree_resp.json()

            tree_items = tree_data.get("tree", [])
            file_tree = [item["path"] for item in tree_items if item.get("type") == "blob"]
            repo.file_tree = file_tree

            # Filter relevant code files (exclude tests, vendor, assets, node_modules, .git)
            relevant_files = []
            for item in tree_items:
                if item.get("type") == "blob":
                    path = item.get("path", "")
                    if any(ignored in path for ignored in ["node_modules/", "venv/", ".git/", "dist/", "build/", "__pycache__/"]):
                        continue
                    ext = os.path.splitext(path)[1].lower()
                    if ext in SUPPORTED_CODE_EXTENSIONS and item.get("size", 0) < 200_000:
                        relevant_files.append((path, item.get("url"), ext))

            # Fetch file contents and generate chunks (limit to 60 most relevant files for fast latency)
            indexed_chunks_count = 0
            # Remove previous chunks for this repo before fresh index
            db.query(CodeChunk).filter(CodeChunk.repository_id == repo.id).delete()
            db.commit()

            async with httpx.AsyncClient(timeout=15.0) as client:
                for file_path, blob_url, ext in relevant_files[:60]:
                    try:
                        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo_name}/{target_branch}/{file_path}"
                        content_resp = await client.get(raw_url, headers=headers)
                        if content_resp.status_code != 200:
                            continue
                        content = content_resp.text
                        chunks = self._chunk_code(content, file_path, SUPPORTED_CODE_EXTENSIONS[ext])
                        for c in chunks:
                            vec = embedding_service.get_embedding(f"File: {file_path}\n{c['content']}")
                            code_chunk = CodeChunk(
                                repository_id=repo.id,
                                user_id=repo.user_id,
                                file_path=file_path,
                                language=SUPPORTED_CODE_EXTENSIONS[ext],
                                chunk_type=c.get("type", "code_block"),
                                start_line=c.get("start_line", 1),
                                end_line=c.get("end_line", 1),
                                content=c["content"],
                                embedding=vec
                            )
                            db.add(code_chunk)
                            indexed_chunks_count += 1
                    except Exception as fe:
                        logger.warning(f"Error indexing file {file_path}: {fe}")

            repo.indexing_status = "ready"
            db.commit()
            return {
                "success": True,
                "repository": f"{owner}/{repo_name}",
                "files_count": len(file_tree),
                "chunks_indexed": indexed_chunks_count
            }
        except Exception as e:
            db.rollback()
            repo.indexing_status = "failed"
            db.commit()
            logger.error(f"Error indexing repository {repo_name}: {e}")
            return {"success": False, "error": str(e)}

    def _chunk_code(self, content: str, file_path: str, language: str) -> List[Dict[str, Any]]:
        """Smart code-aware chunking by functions, classes, or block boundaries."""
        lines = content.splitlines()
        if len(lines) <= 40:
            return [{
                "type": "full_file",
                "start_line": 1,
                "end_line": len(lines),
                "content": content
            }]

        chunks = []
        current_chunk = []
        current_start = 1

        for idx, line in enumerate(lines, 1):
            # Detect function/class definition boundaries
            is_boundary = False
            if language == "python" and re.match(r'^(def |class |async def )\w+', line):
                is_boundary = True
            elif language in ["javascript", "typescript"] and re.match(r'^(function |class |export default |export const |const \w+ = )', line):
                is_boundary = True

            if is_boundary and len(current_chunk) >= 20:
                chunks.append({
                    "type": "block",
                    "start_line": current_start,
                    "end_line": idx - 1,
                    "content": "\n".join(current_chunk)
                })
                current_chunk = [line]
                current_start = idx
            else:
                current_chunk.append(line)
                if len(current_chunk) >= 50:
                    chunks.append({
                        "type": "block",
                        "start_line": current_start,
                        "end_line": idx,
                        "content": "\n".join(current_chunk)
                    })
                    current_chunk = []
                    current_start = idx + 1

        if current_chunk:
            chunks.append({
                "type": "block",
                "start_line": current_start,
                "end_line": len(lines),
                "content": "\n".join(current_chunk)
            })
        return chunks

    def search_code(
        self,
        db: Session,
        user_id: str,
        query: str,
        repo_name: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Hybrid semantic + lexical code search:
        - Filters by user_id and optionally repo_name
        - Computes cosine similarity with CodeChunk embeddings
        - Scores keyword overlap on symbols, file paths, and function names
        """
        q_filter = db.query(CodeChunk, GitHubRepository).join(
            GitHubRepository, CodeChunk.repository_id == GitHubRepository.id
        ).filter(
            GitHubRepository.user_id == user_id,
            GitHubRepository.indexing_status == "ready"
        )

        if repo_name:
            q_filter = q_filter.filter(GitHubRepository.repo_name.ilike(f"%{repo_name}%"))

        chunks = q_filter.all()
        if not chunks:
            return []

        query_vec = embedding_service.get_query_embedding(query)
        scored = []
        q_lower = query.lower()
        q_words = set(re.findall(r'\b[a-zA-Z0-9_]{3,}\b', q_lower))

        for chunk, repo in chunks:
            vec = chunk.embedding
            if not vec:
                vec = embedding_service.get_embedding(chunk.content)
                chunk.embedding = vec
                try:
                    db.commit()
                except Exception:
                    pass
            sim = embedding_service.cosine_similarity(query_vec, vec)

            # Lexical keyword matching
            c_lower = chunk.content.lower()
            path_lower = chunk.file_path.lower()
            overlap = sum(1 for w in q_words if w in c_lower or w in path_lower)

            # Path match bonus
            path_bonus = 1.0 if any(w in path_lower for w in q_words) else 0.0

            composite_score = sim + (0.3 * overlap) + (0.8 * path_bonus)
            scored.append((composite_score, chunk, repo))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, chunk, repo in scored[:top_k]:
            results.append({
                "repository": f"{repo.repo_owner}/{repo.repo_name}",
                "file_path": chunk.file_path,
                "language": chunk.language,
                "chunk_type": chunk.chunk_type,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "content": chunk.content,
                "score": round(float(score), 4)
            })
        return results

    def read_file_content(
        self,
        db: Session,
        user_id: str,
        repo_name: str,
        file_path: str
    ) -> Optional[str]:
        """Retrieve stored code content for a specific file path."""
        chunks = db.query(CodeChunk).join(GitHubRepository).filter(
            GitHubRepository.user_id == user_id,
            GitHubRepository.repo_name.ilike(f"%{repo_name}%"),
            CodeChunk.file_path == file_path
        ).order_by(CodeChunk.start_line).all()

        if not chunks:
            return None
        return "\n".join(c.content for c in chunks)

    async def index_all_repositories(
        self,
        db: Session,
        user_id: str,
        max_repos: int = 15
    ) -> Dict[str, Any]:
        """Automatically index all remote repositories accessible by the user."""
        token = self.get_user_token(db, user_id)
        if not token:
            return {"success": False, "error": "No connected GitHub account found."}

        remote_repos = await self.list_remote_repositories(token)
        if not remote_repos:
            return {"success": False, "error": "No repositories found on GitHub account."}

        indexed_count = 0
        total_chunks = 0
        repo_results = []

        for r in remote_repos[:max_repos]:
            repo_name = r["name"]
            try:
                res = await self.index_repository(db, user_id, repo_name)
                if res.get("success"):
                    indexed_count += 1
                    total_chunks += res.get("chunks_indexed", 0)
                    repo_results.append({"repo": repo_name, "status": "success", "chunks": res.get("chunks_indexed", 0)})
                else:
                    repo_results.append({"repo": repo_name, "status": "failed", "error": res.get("error")})
            except Exception as e:
                repo_results.append({"repo": repo_name, "status": "error", "error": str(e)})

        return {
            "success": True,
            "total_repos_found": len(remote_repos),
            "repos_indexed": indexed_count,
            "total_chunks_indexed": total_chunks,
            "details": repo_results
        }

    async def auto_index_matching_repo_for_query(
        self,
        db: Session,
        user_id: str,
        query: str
    ) -> Optional[str]:
        """
        Dynamically finds if any remote repo matches the query, indexes it if not yet indexed,
        and returns the repo_name.
        """
        token = self.get_user_token(db, user_id)
        if not token:
            return None

        remote_repos = await self.list_remote_repositories(token)
        if not remote_repos:
            return None

        q_lower = query.lower()
        matched_repo = None
        for r in remote_repos:
            r_name_clean = r["name"].lower().replace("-", " ").replace("_", " ")
            r_tokens = [t for t in re.split(r'[-_\s]+', r["name"].lower()) if len(t) > 2]
            if r["name"].lower() in q_lower or r_name_clean in q_lower:
                matched_repo = r["name"]
                break
            if any(t in q_lower for t in r_tokens if t not in ["app", "web", "system", "clone"]):
                matched_repo = r["name"]
                break

        if not matched_repo:
            return None

        existing = db.query(GitHubRepository).filter(
            GitHubRepository.user_id == user_id,
            GitHubRepository.repo_name.ilike(matched_repo),
            GitHubRepository.indexing_status == "ready"
        ).first()

        if existing:
            return existing.repo_name

        res = await self.index_repository(db, user_id, matched_repo)
        if res.get("success"):
            return matched_repo
        return None

    def explain_code_architecture_or_flow(
        self,
        db: Session,
        user_id: str,
        query: str,
        repo_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cross-file architectural understanding:
        Traces relationships such as auth_controller.py -> auth_service.py -> database.py.
        """
        code_chunks = self.search_code(db, user_id, query=query, repo_name=repo_name, top_k=6)
        if not code_chunks:
            return {
                "success": False,
                "message": "Is query se related koi indexed code chunks nahi mile. Kripya pehle repository sync karein."
            }

        files_involved = list(set(c["file_path"] for c in code_chunks))
        snippets = []
        for c in code_chunks:
            snippets.append(f"[{c['file_path']} L{c['start_line']}-{c['end_line']}]:\n{c['content']}")

        # Trace dependencies from import statements in content
        dependencies = {}
        for c in code_chunks:
            imports = re.findall(r'(?:from\s+([a-zA-Z0-9_\.]+)\s+import|import\s+([a-zA-Z0-9_\.]+))', c["content"])
            deps = [imp[0] or imp[1] for imp in imports]
            if deps:
                dependencies[c["file_path"]] = deps[:5]

        return {
            "success": True,
            "query": query,
            "files_involved": files_involved,
            "dependency_graph": dependencies,
            "code_context": "\n\n".join(snippets[:4]),
            "summary": f"Identified {len(files_involved)} related source files with active imports: {', '.join(files_involved)}"
        }

    def propose_code_change_safely(
        self,
        file_path: str,
        proposed_change: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Safe Code Modification Workflow (Rule 9):
        1. Inspects
        2. Explains proposed change
        3. Requests explicit user confirmation
        4. Shows diff preview
        """
        return {
            "file_path": file_path,
            "reason": reason,
            "proposed_diff": proposed_change,
            "requires_user_confirmation": True,
            "safety_status": "Awaiting user confirmation before write operation."
        }

github_service = GitHubService()

