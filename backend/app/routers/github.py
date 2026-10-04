import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.connected_account import ConnectedAccount
from app.models.github import GitHubRepository
from app.security.dependencies import get_optional_user
from app.services.github_service import github_service

logger = logging.getLogger("life.router.github")
router = APIRouter(prefix="/github", tags=["github"])

class GitHubConnectRequest(BaseModel):
    token: str = Field(description="GitHub Personal Access Token (classic or fine-grained)")
    username: Optional[str] = Field(default=None, description="GitHub username")

class GitHubIndexRequest(BaseModel):
    repo_name: str = Field(description="Repository name or owner/repo format")
    owner: Optional[str] = Field(default=None, description="Repository owner")
    branch: Optional[str] = Field(default=None, description="Branch to index (default: main/master)")

class GitHubSearchRequest(BaseModel):
    query: str = Field(description="Search term or code query")
    repo_name: Optional[str] = Field(default=None, description="Optional repo filter")
    top_k: int = Field(default=5, description="Number of results")

@router.post("/connect")
def connect_github_account(
    payload: GitHubConnectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Securely store and encrypt the user's GitHub access token."""
    account = github_service.save_user_token(
        db=db,
        user_id=user.id,
        token=payload.token,
        username=payload.username
    )
    return {
        "status": "connected",
        "provider": "github",
        "username": account.account_username,
        "is_active": account.is_active
    }

@router.get("/status")
def get_github_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Check if GitHub is connected for the current user and list indexed repos."""
    token = github_service.get_user_token(db, user.id)
    account = db.query(ConnectedAccount).filter(
        ConnectedAccount.user_id == user.id,
        ConnectedAccount.provider == "github"
    ).first()

    indexed_repos = db.query(GitHubRepository).filter(
        GitHubRepository.user_id == user.id
    ).all()

    return {
        "is_connected": token is not None,
        "username": account.account_username if account else None,
        "indexed_repositories_count": len(indexed_repos),
        "indexed_repositories": [{
            "id": r.id,
            "repo_name": r.repo_name,
            "owner": r.repo_owner,
            "status": r.indexing_status,
            "files_count": getattr(r, "file_count", 0) or len((getattr(r, "metadata_json", {}) or {}).get("file_tree", [])),
            "last_indexed": r.last_indexed_at.isoformat() if r.last_indexed_at else None
        } for r in indexed_repos]
    }

@router.get("/repos")
async def list_remote_repositories(
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """List accessible repositories from GitHub for the authenticated user."""
    token = github_service.get_user_token(db, user.id)
    if not token:
        raise HTTPException(status_code=400, detail="GitHub account is not connected.")
    repos = await github_service.list_remote_repositories(token)
    return {"repositories": repos}

@router.post("/index")
async def index_repository(
    payload: GitHubIndexRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Index a repository's code, building function and class chunks with vector embeddings."""
    res = await github_service.index_repository(
        db=db,
        user_id=user.id,
        repo_name=payload.repo_name,
        owner=payload.owner,
        branch=payload.branch
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Indexing failed"))
    return res

@router.post("/search")
def search_repository_code(
    payload: GitHubSearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Search code across user's indexed GitHub repositories."""
    results = github_service.search_code(
        db=db,
        user_id=user.id,
        query=payload.query,
        repo_name=payload.repo_name,
        top_k=payload.top_k
    )
    return {"results": results, "count": len(results)}
