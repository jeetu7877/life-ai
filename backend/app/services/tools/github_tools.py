import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.services.github_service import github_service

logger = logging.getLogger(__name__)

class GitHubSearchInput(BaseModel):
    query: str = Field(description="Search term, function name, class, or question about connected code repositories (e.g., 'SQL RAG backend architecture' or 'authenticate_user')")
    repo_name: Optional[str] = Field(default=None, description="Optional repository name filter (e.g., 'sql-rag' or 'jeet-ai')")
    top_k: int = Field(default=4, description="Number of code snippets to return (1-8)")

class GitHubSearchTool(BaseTool):
    name = "search_github_code"
    description = "Searches code, functions, classes, and architectural implementation across the user's connected GitHub repositories."
    category = ToolCategory.GITHUB
    risk_level = RiskLevel.READ_ONLY
    input_schema = GitHubSearchInput

    def execute(self, user_id: str, args: GitHubSearchInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            results = github_service.search_code(
                db=db,
                user_id=user_id,
                query=args.query,
                repo_name=args.repo_name,
                top_k=min(args.top_k, 8)
            )
            return ToolExecutionResult(
                success=True,
                data=results,
                source_attribution="github_repository"
            )
        except Exception as e:
            logger.error(f"Error executing GitHubSearchTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                data=[]
            )

class GitHubFileReadInput(BaseModel):
    repo_name: str = Field(description="The repository name containing the file")
    file_path: str = Field(description="Relative path of the file in the repository (e.g., 'backend/app/main.py')")

class GitHubFileReadTool(BaseTool):
    name = "read_github_file"
    description = "Reads the complete stored code content of a specific file from an indexed GitHub repository."
    category = ToolCategory.GITHUB
    risk_level = RiskLevel.READ_ONLY
    input_schema = GitHubFileReadInput

    def execute(self, user_id: str, args: GitHubFileReadInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            content = github_service.read_file_content(
                db=db,
                user_id=user_id,
                repo_name=args.repo_name,
                file_path=args.file_path
            )
            if content:
                return ToolExecutionResult(
                    success=True,
                    data={"file_path": args.file_path, "content": content},
                    source_attribution=f"github:{args.repo_name}/{args.file_path}"
                )
            return ToolExecutionResult(
                success=False,
                error=f"File '{args.file_path}' not found in repository '{args.repo_name}'."
            )
        except Exception as e:
            logger.error(f"Error executing GitHubFileReadTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e)
            )
