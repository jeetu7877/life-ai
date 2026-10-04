import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.services.goal_service import goal_service
from app.services.study_coach_service import study_coach_service
from app.services.analytics_service import analytics_service
from app.services.timeline_service import timeline_service
from app.services.knowledge_graph_service import knowledge_graph_service

logger = logging.getLogger("life.tools.coaching")

# 1. Goal Action Tool
class GoalActionInput(BaseModel):
    query: Optional[str] = Field(default=None, description="Contextual question about next step or today's priorities")

class GoalActionTool(BaseTool):
    name = "get_next_goal_action"
    description = "Calculates the highest-priority next actionable task or milestone for user's goals."
    category = ToolCategory.ACTION
    risk_level = RiskLevel.READ_ONLY
    input_schema = GoalActionInput

    def execute(self, user_id: str, args: GoalActionInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            rec = goal_service.get_next_recommended_step(db, user_id)
            return ToolExecutionResult(
                success=True,
                data=rec,
                source_attribution="personal_goals"
            )
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 2. Study Coach Tool
class StudyWeaknessInput(BaseModel):
    subject: Optional[str] = Field(default="JavaScript", description="Subject to check weak areas for")

class StudyWeaknessTool(BaseTool):
    name = "get_study_weak_topics"
    description = "Retrieves detected weak study topics, mistakes, and practice recommendations for a subject."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = StudyWeaknessInput

    def execute(self, user_id: str, args: StudyWeaknessInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            weaks = study_coach_service.get_weak_topics(db, user_id, args.subject)
            return ToolExecutionResult(
                success=True,
                data=weaks,
                source_attribution="study_coach"
            )
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 3. Analytics Tool
class AnalyticsSummaryInput(BaseModel):
    timeframe: Optional[str] = Field(default="week", description="Timeframe: today, week, month")

class AnalyticsSummaryTool(BaseTool):
    name = "get_productivity_summary"
    description = "Fetches genuine productivity statistics and trend analysis across study, coding, and projects."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = AnalyticsSummaryInput

    def execute(self, user_id: str, args: AnalyticsSummaryInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            metrics = analytics_service.get_aggregated_metrics(db, user_id)
            return ToolExecutionResult(
                success=True,
                data=metrics,
                source_attribution="productivity_analytics"
            )
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 4. Timeline Query Tool
class TimelineQueryInput(BaseModel):
    date_query: str = Field(description="Natural date term such as 'yesterday', 'today', or '2026-10-02'")

class TimelineQueryTool(BaseTool):
    name = "query_timeline_activities"
    description = "Retrieves chronological activity log and completed accomplishments for a specific calendar date."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = TimelineQueryInput

    def execute(self, user_id: str, args: TimelineQueryInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            detected_date = timeline_service.parse_natural_date_query(args.date_query) or args.date_query
            acts = timeline_service.get_activities_for_date(db, user_id, detected_date)
            results = [{
                "activity_time": a.activity_time,
                "title": a.title,
                "description": a.description,
                "category": a.category,
                "project_tag": a.project_tag
            } for a in acts]
            return ToolExecutionResult(
                success=True,
                data=results,
                source_attribution="timeline"
            )
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 5. Knowledge Graph Tool
class KnowledgeGraphInput(BaseModel):
    entity_name: str = Field(description="Name of the person, skill, organization, or entity to query relations for")

class KnowledgeGraphTool(BaseTool):
    name = "query_knowledge_graph"
    description = "Queries incoming and outgoing relationships for an entity in the personal knowledge graph."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = KnowledgeGraphInput

    def execute(self, user_id: str, args: KnowledgeGraphInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            rels = knowledge_graph_service.query_relationships_for_entity(db, user_id, args.entity_name)
            return ToolExecutionResult(
                success=True,
                data=rels,
                source_attribution="knowledge_graph"
            )
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))
