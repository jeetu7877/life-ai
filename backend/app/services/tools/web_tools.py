import asyncio
import concurrent.futures
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.services.web_search_service import web_search_service

logger = logging.getLogger(__name__)

class WebSearchInput(BaseModel):
    query: str = Field(description="Public query to search on the web (e.g., 'FastAPI 0.115 release notes' or 'current weather in Delhi')")
    max_results: int = Field(default=5, description="Number of web search results to retrieve (1-8)")

class WebSearchTool(BaseTool):
    name = "search_web"
    description = "Searches the public web for real-time information, technical documentation, external facts, and news. STRICT PRIVACY: Never searches private user data or credentials."
    category = ToolCategory.WEB_SEARCH
    risk_level = RiskLevel.READ_ONLY
    input_schema = WebSearchInput

    def execute(self, user_id: str, args: WebSearchInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    results = executor.submit(
                        asyncio.run,
                        web_search_service.search(args.query, args.max_results)
                    ).result(timeout=12.0)
            else:
                results = asyncio.run(web_search_service.search(args.query, args.max_results))

            return ToolExecutionResult(
                success=True,
                data=results,
                source_attribution="web_search"
            )
        except Exception as e:
            logger.error(f"Error executing WebSearchTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                data=[]
            )
