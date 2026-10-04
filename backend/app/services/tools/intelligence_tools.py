import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.services.life_twin_service import life_twin_service
from app.services.what_if_simulator import what_if_simulator
from app.services.time_machine_service import time_machine_service
from app.services.bottleneck_engine import bottleneck_engine
from app.services.project_health_service import project_health_service
from app.services.decision_debate_service import decision_debate_service
from app.services.pattern_detector_service import pattern_detector_service

logger = logging.getLogger("life.tools.intelligence")

# 1. Life Twin Tool
class LifeTwinInput(BaseModel):
    query: Optional[str] = Field(default=None, description="Query regarding user's current situation or Life Twin model")

class LifeTwinTool(BaseTool):
    name = "query_life_twin_state"
    description = "Retrieves the structured Life Twin analytical model of the user's current verified situation."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = LifeTwinInput

    def execute(self, user_id: str, args: LifeTwinInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            state = life_twin_service.compute_current_state(db, user_id)
            return ToolExecutionResult(success=True, data=state, source_attribution="life_twin")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 2. What-If Tool
class WhatIfInput(BaseModel):
    scenario_query: str = Field(description="Hypothetical scenario, e.g., 'What if I study DSA 2 hours daily for 30 days?'")

class WhatIfTool(BaseTool):
    name = "run_what_if_simulation"
    description = "Simulates counterfactual future scenarios with assumptions, trade-offs, and estimated outcomes."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = WhatIfInput

    def execute(self, user_id: str, args: WhatIfInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            res = what_if_simulator.simulate(db, user_id, args.scenario_query)
            return ToolExecutionResult(success=True, data=res, source_attribution="what_if_simulator")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 3. Time Machine Tool
class TimeMachineInput(BaseModel):
    date_query: str = Field(description="Target past date or phrase, e.g., 'one month ago', 'September 1'")

class TimeMachineTool(BaseTool):
    name = "replay_time_machine"
    description = "Reconstructs historical activities, goals, and memories for a past date or period."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = TimeMachineInput

    def execute(self, user_id: str, args: TimeMachineInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            res = time_machine_service.reconstruct_time_period(db, user_id, args.date_query)
            return ToolExecutionResult(success=True, data=res, source_attribution="time_machine")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 4. Bottleneck Tool
class BottleneckInput(BaseModel):
    area: Optional[str] = Field(default=None, description="Domain to check bottleneck for (e.g., 'dsa', 'project', 'progress')")

class BottleneckTool(BaseTool):
    name = "diagnose_stuck_bottleneck"
    description = "Diagnoses execution roadblocks ('Why am I stuck?') using observable activity and study logs."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = BottleneckInput

    def execute(self, user_id: str, args: BottleneckInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            res = bottleneck_engine.analyze_bottleneck(db, user_id, args.area)
            return ToolExecutionResult(success=True, data=res, source_attribution="bottleneck_engine")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 5. Project Health Tool
class ProjectHealthInput(BaseModel):
    repo_name: Optional[str] = Field(default="Life AI", description="Repository name to analyze health for")

class ProjectHealthTool(BaseTool):
    name = "analyze_project_health"
    description = "Scores code repository health across code activity, testing, documentation, security, and deployment."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = ProjectHealthInput

    def execute(self, user_id: str, args: ProjectHealthInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            res = project_health_service.analyze_repo_health(db, user_id, args.repo_name)
            return ToolExecutionResult(success=True, data=res, source_attribution="project_health")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 6. Decision Debate Tool
class DecisionDebateInput(BaseModel):
    decision_query: str = Field(description="Decision options to evaluate, e.g., 'Should I focus on DSA or projects?'")

class DecisionDebateTool(BaseTool):
    name = "debate_decision_options"
    description = "Evaluates competing choices with dual-perspective pros/cons and personalized recommendations."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = DecisionDebateInput

    def execute(self, user_id: str, args: DecisionDebateInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            res = decision_debate_service.debate(db, user_id, args.decision_query)
            return ToolExecutionResult(success=True, data=res, source_attribution="decision_debate")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))


# 7. Pattern Detector Tool
class PatternDetectorInput(BaseModel):
    query: Optional[str] = Field(default=None, description="Optional focus area for pattern discovery")

class PatternDetectorTool(BaseTool):
    name = "detect_personal_patterns"
    description = "Discovers observable recurring behavioral, coding, and study patterns from activity history."
    category = ToolCategory.DATA_RETRIEVAL
    risk_level = RiskLevel.READ_ONLY
    input_schema = PatternDetectorInput

    def execute(self, user_id: str, args: PatternDetectorInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            res = pattern_detector_service.detect_patterns(db, user_id)
            return ToolExecutionResult(success=True, data=res, source_attribution="pattern_detector")
        except Exception as e:
            return ToolExecutionResult(success=False, error=str(e))
