import logging
from typing import Dict, Any, List, Optional
from app.services.query_router import QueryIntent

logger = logging.getLogger("life.context_manager")

class ContextBudget:
    """
    Enforces intelligent context filtering and strict token/character budgets.
    Never overwhelms the LLM with unnecessary collections or irrelevant data.
    """
    MAX_TOTAL_CHARS = 10000        # ~2,500 tokens
    MAX_DOC_CHARS = 4000          # ~1,000 tokens
    MAX_MEMORY_CHARS = 2500       # ~600 tokens
    MAX_CODE_CHARS = 4000         # ~1,000 tokens
    MAX_WEB_CHARS = 2000          # ~500 tokens
    MAX_CONV_MESSAGES = 10        # Recent dialogue turns

class ContextManager:
    """
    Smart Context Orchestrator:
    Filters, ranks, and budgets context sources based on detected user intent.
    """
    def filter_and_budget(
        self,
        intent: QueryIntent,
        context_docs: str = "",
        context_memories: str = "",
        context_code: str = "",
        user_profile_summary: str = "",
        chat_history: Optional[List[Dict[str, str]]] = None,
        summary_text: str = ""
    ) -> Dict[str, Any]:
        """
        Applies intent-specific context gating and truncation.
        """
        budgeted_docs = ""
        budgeted_memories = ""
        budgeted_code = ""
        budgeted_history = chat_history or []

        # 1. Intent Gating: Exclude non-relevant collections
        if intent == QueryIntent.DOCUMENT:
            # Query is about documents: exclude code snippets and extensive general memories
            budgeted_docs = context_docs[:ContextBudget.MAX_DOC_CHARS]
            # Keep only brief summary if available
            if summary_text:
                budgeted_memories = f"Session context: {summary_text[:500]}"

        elif intent == QueryIntent.GITHUB_CODE:
            # Query is about GitHub / code: focus on code snippets, exclude unrelated documents
            budgeted_code = context_code[:ContextBudget.MAX_CODE_CHARS]
            if summary_text:
                budgeted_memories = f"Session context: {summary_text[:500]}"

        elif intent in [QueryIntent.PROFILE, QueryIntent.MEMORY]:
            # Personal memory queries: include memories and profile, exclude raw doc chunks and code
            budgeted_memories = context_memories[:ContextBudget.MAX_MEMORY_CHARS]

        elif intent == QueryIntent.WEB_SEARCH:
            # Web search query: include web results (passed inside memories), exclude heavy docs
            budgeted_memories = context_memories[:ContextBudget.MAX_WEB_CHARS]

        else:
            # General / Reasoning: balanced mix
            budgeted_docs = context_docs[:ContextBudget.MAX_DOC_CHARS]
            budgeted_memories = context_memories[:ContextBudget.MAX_MEMORY_CHARS]
            budgeted_code = context_code[:ContextBudget.MAX_CODE_CHARS]

        # 2. Limit dialogue history turns to recent N turns
        if len(budgeted_history) > ContextBudget.MAX_CONV_MESSAGES:
            budgeted_history = budgeted_history[-ContextBudget.MAX_CONV_MESSAGES:]

        # 3. Combine document and code context if both present
        combined_docs = budgeted_docs
        if budgeted_code:
            combined_docs = (combined_docs + "\n\n" + budgeted_code).strip()

        # 4. Total Character Ceiling Guard
        total_chars = len(combined_docs) + len(budgeted_memories) + len(user_profile_summary)
        if total_chars > ContextBudget.MAX_TOTAL_CHARS:
            # Trim documents first if overflowing
            overflow = total_chars - ContextBudget.MAX_TOTAL_CHARS
            combined_docs = combined_docs[:-overflow] if len(combined_docs) > overflow else combined_docs[:1000]

        return {
            "context_docs": combined_docs,
            "context_memories": budgeted_memories,
            "user_profile_summary": user_profile_summary[:1500],
            "chat_history": budgeted_history
        }

context_manager = ContextManager()
