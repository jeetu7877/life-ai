import time
import logging
from typing import Dict, Any, Optional, List, Type
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolExecutionResult
from app.models.tool_log import AgentToolLog
from app.services.tools.memory_tools import MemorySearchTool, MemorySaveTool
from app.services.tools.document_tools import DocumentFieldLookupTool, DocumentSearchTool
from app.services.tools.conversation_tools import ConversationSearchTool
from app.services.tools.github_tools import GitHubSearchTool, GitHubFileReadTool
from app.services.tools.web_tools import WebSearchTool
from app.services.tools.action_tools import TaskCreateTool, TaskListTool, ReminderCreateTool, DestructiveActionTool
from app.services.tools.knowledge_and_coaching_tools import (
    GoalActionTool,
    StudyWeaknessTool,
    AnalyticsSummaryTool,
    TimelineQueryTool,
    KnowledgeGraphTool
)
from app.services.tools.intelligence_tools import (
    LifeTwinTool,
    WhatIfTool,
    TimeMachineTool,
    BottleneckTool,
    ProjectHealthTool,
    DecisionDebateTool,
    PatternDetectorTool
)

logger = logging.getLogger("life.tools")

class ToolRegistry:
    """
    Central Tool Registry:
    - Modular registration and dispatch
    - Automatic argument schema validation
    - Auditing into agent_tool_logs table
    - Gemini function declaration generation
    """

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_default_tools()

    def register(self, tool: BaseTool):
        """Register a tool instance."""
        self._tools[tool.name] = tool
        logger.debug(f"Registered tool: {tool.name} [{tool.category.value}]")

    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Get tool instance by name."""
        return self._tools.get(name)

    def list_tools(self) -> List[BaseTool]:
        """List all registered tools."""
        return list(self._tools.values())

    def get_declarations(self) -> List[Dict[str, Any]]:
        """Return tool definitions for Gemini function calling."""
        return [tool.get_schema_definition() for tool in self._tools.values()]

    def execute_tool(
        self,
        tool_name: str,
        user_id: str,
        args: Dict[str, Any],
        db: Session,
        conversation_id: Optional[str] = None
    ) -> ToolExecutionResult:
        """
        Safely execute a tool with input parsing, timing, error capture, and database audit logging.
        """
        tool = self.get_tool(tool_name)
        if not tool:
            return ToolExecutionResult(
                success=False,
                error=f"Tool '{tool_name}' is not registered."
            )

        start_time = time.time()
        status = "success"
        error_msg = None
        result: Optional[ToolExecutionResult] = None

        try:
            # Validate args against tool Pydantic schema
            parsed_args = tool.input_schema(**args)
            result = tool.execute(user_id=user_id, args=parsed_args, db=db, conversation_id=conversation_id)
            if not result.success:
                status = "failed"
                error_msg = result.error
        except Exception as e:
            status = "failed"
            error_msg = str(e)
            result = ToolExecutionResult(success=False, error=error_msg)
            logger.error(f"Error executing tool {tool_name}: {e}")

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Audit log into agent_tool_logs
        try:
            log_entry = AgentToolLog(
                user_id=user_id,
                conversation_id=conversation_id,
                tool_name=tool_name,
                input_params=args,
                output_result=result.data if (result and result.data) else {},
                error_message=error_msg,
                status=status,
                execution_time_ms=elapsed_ms
            )
            db.add(log_entry)
            db.commit()
        except Exception as log_ex:
            db.rollback()
            logger.warning(f"Failed to record tool log for {tool_name}: {log_ex}")

        return result

    def _register_default_tools(self):
        """Register the complete personal AI suite of tools."""
        # Memory Tools
        self.register(MemorySearchTool())
        self.register(MemorySaveTool())

        # Document Tools
        self.register(DocumentFieldLookupTool())
        self.register(DocumentSearchTool())

        # Conversation Tools
        self.register(ConversationSearchTool())

        # GitHub Code Brain Tools
        self.register(GitHubSearchTool())
        self.register(GitHubFileReadTool())

        # Web Search Tool
        self.register(WebSearchTool())

        # Action & Planning Tools
        self.register(TaskCreateTool())
        self.register(TaskListTool())
        self.register(ReminderCreateTool())
        self.register(DestructiveActionTool())

        # Goal, Coaching, Analytics & Knowledge Graph Tools
        self.register(GoalActionTool())
        self.register(StudyWeaknessTool())
        self.register(AnalyticsSummaryTool())
        self.register(TimelineQueryTool())
        self.register(KnowledgeGraphTool())

        # Life Twin & Unique Intelligence Tools
        self.register(LifeTwinTool())
        self.register(WhatIfTool())
        self.register(TimeMachineTool())
        self.register(BottleneckTool())
        self.register(ProjectHealthTool())
        self.register(DecisionDebateTool())
        self.register(PatternDetectorTool())

tool_registry = ToolRegistry()
