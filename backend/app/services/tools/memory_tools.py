import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.services.rag_service import rag_service
from app.models.memory import Memory
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

class MemorySearchInput(BaseModel):
    query: str = Field(description="Search query to locate relevant user memories, facts, or preferences")
    top_k: int = Field(default=5, description="Number of memories to return (1-10)")
    memory_type: Optional[str] = Field(default=None, description="Optional memory category filter: fact, preference, relationship, life_event, work, health, project")

class MemorySearchTool(BaseTool):
    name = "search_memories"
    description = "Searches the user's persistent personal long-term memory store for facts, preferences, relationships, and history."
    category = ToolCategory.MEMORY
    risk_level = RiskLevel.READ_ONLY
    input_schema = MemorySearchInput

    def execute(self, user_id: str, args: MemorySearchInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            results = rag_service.search_memories(
                user_id=user_id,
                query=args.query,
                top_k=min(args.top_k, 10),
                memory_type=args.memory_type,
                db=db
            )
            return ToolExecutionResult(
                success=True,
                data=results,
                source_attribution="personal_memory"
            )
        except Exception as e:
            logger.error(f"Error executing MemorySearchTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                data=[]
            )

class MemorySaveInput(BaseModel):
    content: str = Field(description="The persistent fact, preference, or life detail to remember permanently")
    memory_type: str = Field(default="fact", description="Category: fact, preference, relationship, life_event, work, health, project")
    topic: Optional[str] = Field(default=None, description="Short canonical topic key, e.g. best_friend, favorite_food, job_title")

class MemorySaveTool(BaseTool):
    name = "save_memory"
    description = "Saves a new verified personal fact or preference directly to the user's permanent memory store in PostgreSQL."
    category = ToolCategory.MEMORY
    risk_level = RiskLevel.LOW
    input_schema = MemorySaveInput

    def execute(self, user_id: str, args: MemorySaveInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            # Check for existing memory with same topic to supersede or deduplicate
            existing = None
            if args.topic:
                existing = db.query(Memory).filter(
                    Memory.user_id == user_id,
                    Memory.topic == args.topic,
                    Memory.status == "active"
                ).first()

            if existing:
                if existing.content.strip().lower() == args.content.strip().lower():
                    # Deduplicated identical fact
                    return ToolExecutionResult(
                        success=True,
                        data={"id": existing.id, "status": "already_exists", "content": existing.content},
                        source_attribution="personal_memory"
                    )
                # Supersede older memory
                existing.status = "superseded"
                db.commit()

            # Generate embedding
            vec = embedding_service.get_embedding(args.content)

            new_mem = Memory(
                user_id=user_id,
                content=args.content,
                memory_type=args.memory_type,
                topic=args.topic,
                status="active",
                embedding=vec,
                embedding_status="ready"
            )
            db.add(new_mem)
            db.commit()
            db.refresh(new_mem)

            # Sync to Chroma cache if available
            rag_service.add_memory(
                memory_id=new_mem.id,
                user_id=user_id,
                content=new_mem.content,
                memory_type=new_mem.memory_type
            )

            return ToolExecutionResult(
                success=True,
                data={"id": new_mem.id, "status": "saved", "content": new_mem.content},
                source_attribution="personal_memory"
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Error executing MemorySaveTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e)
            )
