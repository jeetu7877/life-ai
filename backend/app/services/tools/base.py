from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, Any, Optional, Type
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

class ToolCategory(str, Enum):
    MEMORY = "memory"
    DOCUMENT = "document"
    GITHUB = "github"
    WEB_SEARCH = "web_search"
    ACTION = "action"
    SYSTEM = "system"
    DATA_RETRIEVAL = "data_retrieval"

class RiskLevel(str, Enum):
    READ_ONLY = "read_only"
    LOW = "low"
    HIGH_DESTRUCTIVE = "high_destructive"

class ToolExecutionResult(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    requires_confirmation: bool = False
    confirmation_prompt: Optional[str] = None
    source_attribution: Optional[str] = None

class BaseTool(ABC):
    """
    Standard BaseTool interface for Life AI Agent:
    - Strongly typed Pydantic inputs and outputs
    - Deterministic execution with error boundaries
    - Audited execution logging
    - Risk classification and confirmation checks
    """
    name: str
    description: str
    category: ToolCategory
    risk_level: RiskLevel = RiskLevel.READ_ONLY
    input_schema: Type[BaseModel]

    @abstractmethod
    def execute(self, user_id: str, args: BaseModel, db: Session, **kwargs) -> ToolExecutionResult:
        """Execute the tool logic with strict user isolation and safety."""
        pass

    def get_schema_definition(self) -> Dict[str, Any]:
        """Return tool declaration compatible with Gemini function calling & OpenAPI."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.input_schema.model_json_schema()
        }
