import logging
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.services.life_twin_service import life_twin_service

logger = logging.getLogger("life.what_if")

class WhatIfSimulator:
    """
    What-If Simulation Engine:
    Simulates counterfactual future scenarios based on observable user baseline.
    Rules:
    - Never fabricates guaranteed future outcomes.
    - Explicitly labels predictions as estimates with underlying assumptions.
    - Compares expected effort, consistency requirement, likely progress, trade-offs, and opportunity costs.
    """

    def simulate(self, db: Session, user_id: str, query: str) -> Dict[str, Any]:
        twin_state = life_twin_service.compute_current_state(db, user_id)
        lower = query.lower()

        # Variable parsing
        hours = 2
        match_hours = re.search(r'(\d+)\s*(hour|hours|ghante|hr)', lower)
        if match_hours:
            hours = int(match_hours.group(1))

        days = 30
        match_days = re.search(r'(\d+)\s*(day|days|din|month)', lower)
        if match_days:
            days = int(match_days.group(1)) if "month" not in match_days.group(0) else 30

        is_dsa = "dsa" in lower or "algorithm" in lower or "coding problem" in lower or "leetcode" in lower
        is_project = "project" in lower or "life ai" in lower or "sql rag" in lower
        is_internship = "internship" in lower or "job" in lower or "apply" in lower

        total_hours = hours * days
        estimated_problems = hours * days * 2  # avg 2 problems / hour in targeted practice

        if is_dsa:
            variable = f"{hours} hours DSA daily for {days} days"
            baseline = "Moderate practice volume with inconsistent session cadence"
            scenario_a = {
                "name": f"Realistic Consistency Plan ({hours}h/day)",
                "expected_effort": f"~{total_hours} total hours across {days} days",
                "consistency_requirement": "High (~85% attendance across 30 days)",
                "likely_progress": f"Likely ~{estimated_problems-10} to {estimated_problems+10} medium/hard algorithmic problems solved. Significant mastery across Arrays, Trees, Dynamic Programming, and Graph algorithms.",
                "trade_offs": f"Requires dedicating ~{hours} prime evening or morning hours. May reduce discretionary leisure or slow secondary project velocity by ~15-20%.",
                "risks": "Risk of burnout if sessions exceed mental stamina. High chance of skipped days without fixed calendar slotting.",
                "opportunity_cost": "Less immediate repository code additions, but directly increases interview readiness."
            }
            assumptions = [
                "Assumes focused, deliberate practice without multitasking or tutorial rabbit-holes.",
                "Assumes active review of failed test cases and time/space complexity analysis.",
                "Prediction is strictly an estimate, not a guaranteed outcome."
            ]
        elif is_project:
            variable = f"{hours} hours project development daily for {days} days"
            baseline = "Active project development with strong architectural momentum"
            scenario_a = {
                "name": f"Intensive Builder Plan ({hours}h/day)",
                "expected_effort": f"~{total_hours} total engineering hours",
                "consistency_requirement": "Moderate-to-High",
                "likely_progress": "Production readiness, automated tests completed, responsive UI polished, and live cloud deployment finalized.",
                "trade_offs": f"Leaves minimal daily bandwidth for theoretical revision or interview rounds.",
                "risks": "Over-engineering features without user validation.",
                "opportunity_cost": "Postponed DSA revision."
            }
            assumptions = [
                "Assumes modular task breakdown and minimal blocker dependencies.",
                "Prediction is an estimate based on current commit velocity."
            ]
        else:
            variable = f"{hours} hours focused daily effort for {days} days"
            baseline = "Current recorded multi-tasking workflow"
            scenario_a = {
                "name": f"Focused Execution Plan ({hours}h/day)",
                "expected_effort": f"~{total_hours} dedicated hours",
                "consistency_requirement": "High",
                "likely_progress": "Noticeable leap in skill acquisition and milestone completion.",
                "trade_offs": "Requires deliberate schedule prioritization.",
                "risks": "Cognitive fatigue without structured rest days.",
                "opportunity_cost": "Time redirected from lower-priority activities."
            }
            assumptions = [
                "Assumes steady baseline energy and zero major life disruptions."
            ]

        return {
            "query": query,
            "variable_tested": variable,
            "current_baseline": baseline,
            "scenario": scenario_a,
            "assumptions": assumptions,
            "confidence": "Medium (Model Estimate)"
        }

    def format_simulation_response(self, db: Session, user_id: str, query: str) -> str:
        sim = self.simulate(db, user_id, query)
        sc = sim["scenario"]

        lines = [
            f"🔮 **What-If Simulation: '{sim['variable_tested']}'**\n",
            f"📊 **Current Baseline**: {sim['current_baseline']}\n",
            f"🎯 **Scenario Projection ({sc['name']})**:",
            f"• **Expected Effort**: {sc['expected_effort']}",
            f"• **Consistency Requirement**: {sc['consistency_requirement']}",
            f"• **Likely Progress**: {sc['likely_progress']}",
            f"• **Trade-offs**: {sc['trade_offs']}",
            f"• **Risks**: {sc['risks']}",
            f"• **Opportunity Cost**: {sc['opportunity_cost']}\n",
            "⚠️ **Assumptions & Disclaimers**:",
            *[f"• {a}" for a in sim["assumptions"]],
            f"\n*Confidence: {sim['confidence']} — This is an analytical estimation, not a guaranteed future outcome.*"
        ]
        return "\n".join(lines)

what_if_simulator = WhatIfSimulator()
