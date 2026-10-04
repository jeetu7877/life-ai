import time
import re
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.profile import PersonalProfile
from app.models.conversation import Message
from app.services.llm_service import llm_service
from app.services.rag_service import rag_service
from app.services.timeline_service import timeline_service
from app.services.vault_service import vault_service
from app.services.document_service import document_service
from app.services.conversation_service import conversation_service
from app.services.query_router import query_router, QueryIntent
from app.services.tools.registry import tool_registry
from app.services.github_service import github_service

logger = logging.getLogger("life.orchestrator")

class AgentOrchestrator:
    """
    Central Autonomous Agent Orchestrator:
    - Normalizes incoming requests across text & hands-free voice.
    - Preserves sub-millisecond fast-paths (<5ms greetings, <50ms profile, <50ms vault, <5ms doc fields).
    - Modular tool dispatch & execution with audit logging via ToolRegistry.
    - Grounded synthesis across:
      * Personal Memories (Long-term & Profile)
      * Structured Documents (College ID, Marksheets, Resumes)
      * GitHub Code Repositories (CodeChunks & File Trees)
      * Public Web Information (Isolated Web Search)
      * Actions & Task Planning (Reminders & Goals)
    - Non-destructive and resilient across container restarts.
    """

    def process_request(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        chat_history: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
        timezone: str = "Asia/Kolkata"
    ) -> Dict[str, Any]:
        t0 = time.time()
        retrieved_sources: List[Dict[str, Any]] = []
        tools_executed: List[Dict[str, Any]] = []
        context_memories = ""
        context_docs = ""
        context_code = ""
        user_profile_summary = ""

        timing_metrics = {
            "router_ms": 0.0,
            "profile_ms": 0.0,
            "tools_ms": 0.0,
            "memory_ms": 0.0,
            "document_ms": 0.0,
            "github_ms": 0.0,
            "llm_ms": 0.0,
            "total_ms": 0.0
        }

        raw_msg = user_message.strip()
        lower_msg = raw_msg.lower()

        # Step 1: High-Speed Fast-Path Routing (<1ms)
        t_route_start = time.perf_counter()
        intent, sub_cat = query_router.classify_intent(raw_msg)
        timing_metrics["router_ms"] = round((time.perf_counter() - t_route_start) * 1000, 2)

        # FAST PATH 1: Casual Greetings & Chit-chat (<10ms, 0 DB, 0 Vector, 0 LLM)
        if intent == QueryIntent.GREETING:
            greeting_resp = query_router.handle_greeting_fast_path(raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            logger.info(f"[Orchestrator] intent=GREETING total_ms={total_ms}")
            return {
                "response": greeting_resp,
                "retrieved_sources": [{"source": "fast_greeting"}],
                "tools_executed": [],
                "timing": timing_metrics
            }

        # FAST PATH 2: Level 1 Profile Memory (<50ms, direct SQL lookup)
        if intent == QueryIntent.PROFILE:
            t_profile_start = time.perf_counter()
            profile_resp = query_router.handle_profile_fast_path(db, user_id, sub_cat)
            timing_metrics["profile_ms"] = round((time.perf_counter() - t_profile_start) * 1000, 2)
            if profile_resp:
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                logger.info(f"[Orchestrator] intent=PROFILE sub={sub_cat} total_ms={total_ms}")
                return {
                    "response": profile_resp,
                    "retrieved_sources": [{"source": "profile_memory", "category": sub_cat}],
                    "tools_executed": [],
                    "timing": timing_metrics
                }

        # FAST PATH 3: Secure Vault Queries (<50ms)
        if intent == QueryIntent.VAULT:
            secret_val = vault_service.query_by_type_or_name(db, user_id, raw_msg)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            if secret_val:
                return {
                    "response": f"Aapka requested document number hai: {secret_val}",
                    "retrieved_sources": [{"source": "secure_vault", "status": "authorized_retrieval"}],
                    "tools_executed": [],
                    "timing": timing_metrics
                }
            else:
                return {
                    "response": "Mujhe aapke secure vault mein yeh number nahi mila. Aap document upload kar sakte hain ya Vault section mein add kar sakte hain.",
                    "retrieved_sources": [],
                    "tools_executed": [],
                    "timing": timing_metrics
                }

        # FAST PATH 4: Document Structured Field Lookup (<5ms)
        if intent == QueryIntent.DOCUMENT:
            t_doc_field_start = time.perf_counter()
            field_res = document_service.find_structured_field_in_user_documents(db, user_id, raw_msg)
            doc_field_ms = round((time.perf_counter() - t_doc_field_start) * 1000, 2)
            timing_metrics["document_ms"] = doc_field_ms
            if field_res:
                ans = field_res.get("summary_text") if field_res.get("is_full_summary") else field_res.get("answer_text")
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                logger.info(f"[Orchestrator] DOC_FIELD_LOOKUP found=True doc_id={field_res.get('document_id')}")
                return {
                    "response": ans,
                    "retrieved_sources": [{
                        "source": "document_field",
                        "document_id": field_res.get("document_id"),
                        "document_name": field_res.get("document_name"),
                        "document_category": field_res.get("document_category"),
                        "field_name": field_res.get("field_name", "full_summary")
                    }],
                    "tools_executed": [{
                        "tool": "lookup_document_field",
                        "status": "success",
                        "field": field_res.get("field_name")
                    }],
                    "timing": timing_metrics
                }

        # Step 2: Intent-based Tool Dispatch & Context Gathering
        t_tools_start = time.perf_counter()

        # Tool Check A: Reminders & Tasks
        is_reminder_intent = any(w in lower_msg for w in ["remind me", "set a reminder", "yaad dila dena", "reminder lagao", "remind"])
        is_task_intent = any(w in lower_msg for w in ["create a task", "add task", "todo list", "task bana do", "add a task", "new task"])
        is_task_list_intent = any(w in lower_msg for w in ["my tasks", "list tasks", "show tasks", "mere tasks", "pending tasks"])

        if is_reminder_intent:
            rem_res = tool_registry.execute_tool(
                tool_name="create_reminder",
                user_id=user_id,
                args={"title": raw_msg, "remind_at": datetime.utcnow().isoformat()},
                db=db,
                conversation_id=conversation_id
            )
            if rem_res.success:
                tools_executed.append({"tool": "create_reminder", "status": "success", "title": raw_msg})
                retrieved_sources.append({"source": "reminder_service"})
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                return {
                    "response": f"Maine aapka reminder note kar liya hai: '{raw_msg}'. Sahi waqt par aapko alert mil jayega.",
                    "retrieved_sources": retrieved_sources,
                    "tools_executed": tools_executed,
                    "timing": timing_metrics
                }

        if is_task_intent:
            task_title = raw_msg
            for prefix in ["create a task to", "create a task", "add task to", "add a task to", "add task"]:
                if lower_msg.startswith(prefix):
                    task_title = raw_msg[len(prefix):].strip(" :")
                    break
            t_res = tool_registry.execute_tool(
                tool_name="create_task",
                user_id=user_id,
                args={"title": task_title, "category": "personal", "priority": "medium"},
                db=db,
                conversation_id=conversation_id
            )
            if t_res.success:
                tools_executed.append({"tool": "create_task", "status": "success", "title": task_title})
                retrieved_sources.append({"source": "task_planner"})
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                return {
                    "response": f"Task '{task_title}' aapke planner mein successfully add kar diya gaya hai.",
                    "retrieved_sources": retrieved_sources,
                    "tools_executed": tools_executed,
                    "timing": timing_metrics
                }

        if is_task_list_intent:
            list_res = tool_registry.execute_tool(
                tool_name="list_tasks",
                user_id=user_id,
                args={"limit": 10},
                db=db,
                conversation_id=conversation_id
            )
            if list_res.success and list_res.data:
                task_items = [f"• [{t['status'].upper()}] {t['title']} ({t['priority']} priority)" for t in list_res.data]
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                return {
                    "response": "Aapke current tasks:\n" + "\n".join(task_items),
                    "retrieved_sources": [{"source": "task_planner"}],
                    "tools_executed": [{"tool": "list_tasks", "status": "success", "count": len(list_res.data)}],
                    "timing": timing_metrics
                }

        # Tool Check B: GitHub Code Repository Brain
        is_github_intent = any(w in lower_msg for w in [
            "github", "repo", "repository", "codebase", "sql rag", "backend samjhao",
            "function", "class", "code dekho", "show code", "inspect repo", "mere project ka code"
        ])
        if is_github_intent:
            t_gh_start = time.perf_counter()
            gh_res = tool_registry.execute_tool(
                tool_name="search_github_code",
                user_id=user_id,
                args={"query": raw_msg, "top_k": 4},
                db=db,
                conversation_id=conversation_id
            )
            timing_metrics["github_ms"] = round((time.perf_counter() - t_gh_start) * 1000, 2)
            if gh_res.success and gh_res.data:
                snippets = []
                for item in gh_res.data:
                    snippets.append(f"[{item['repository']} - {item['file_path']} (lines {item['start_line']}-{item['end_line']})]:\n```{item['language']}\n{item['content']}\n```")
                context_code = "\n\n".join(snippets)
                retrieved_sources.append({"source": "github_code", "count": len(gh_res.data)})
                tools_executed.append({"tool": "search_github_code", "status": "success", "count": len(gh_res.data)})

        # Tool Check C: Public Web Search
        is_web_intent = any(w in lower_msg for w in [
            "search the web", "search online", "internet par dekho", "google karo",
            "latest release", "current weather", "web search"
        ])
        if is_web_intent:
            web_res = tool_registry.execute_tool(
                tool_name="search_web",
                user_id=user_id,
                args={"query": raw_msg, "max_results": 4},
                db=db,
                conversation_id=conversation_id
            )
            if web_res.success and web_res.data:
                web_snippets = [f"• [{w['title']}]({w['url']}): {w['snippet']}" for w in web_res.data]
                context_memories += "\n=== PUBLIC WEB SEARCH RESULTS ===\n" + "\n".join(web_snippets)
                retrieved_sources.append({"source": "web_search", "count": len(web_res.data)})
                tools_executed.append({"tool": "search_web", "status": "success", "count": len(web_res.data)})

        timing_metrics["tools_ms"] = round((time.perf_counter() - t_tools_start) * 1000, 2)

        # Step 3: Semantic Memory & Profile Retrieval
        now_dt = datetime.utcnow()
        current_time_str = now_dt.strftime("%A, %d %B %Y %I:%M %p UTC")

        # Fetch Structured Profile
        has_personal_intent = (intent in [QueryIntent.PROFILE, QueryIntent.MEMORY, QueryIntent.TIMELINE] or any(
            w in lower_msg for w in ["my", "mera", "meri", "mere", "about me", "who am i", "my name", "my skills", "my college"]
        )) and intent not in [QueryIntent.GENERAL, QueryIntent.DOCUMENT]
        if has_personal_intent:
            t_profile_start = time.perf_counter()
            from app.services.profile_cache import profile_cache
            profile = profile_cache.get_profile_dict(db, user_id)
            if profile:
                user_profile_summary = (
                    f"Name: {profile.get('name') or profile.get('preferred_name') or 'Friend'}\n"
                    f"Skills: {', '.join(profile.get('skills', [])) if profile.get('skills') else 'None'}\n"
                    f"College/Education: {profile.get('college') or profile.get('education') or 'None'}\n"
                    f"Branch: {profile.get('branch') or 'None'}\n"
                    f"Projects: {', '.join([str(p) for p in profile.get('projects', [])]) if profile.get('projects') else 'None'}"
                )
            timing_metrics["profile_ms"] = round((time.perf_counter() - t_profile_start) * 1000, 2)

        # Semantic Long-Term Memories (Top 3-5, strict user isolation)
        needs_memory = intent in [QueryIntent.MEMORY, QueryIntent.TIMELINE] or any(
            w in lower_msg for w in [
                "remember", "yaad", "dost", "friend", "bestie", "favourite", "favorite",
                "preference", "mera", "meri", "mere", "my", "who is my", "what is my",
                "where do i", "where did i", "what did i", "tell me about my"
            ]
        )
        if needs_memory:
            t_mem_start = time.perf_counter()
            mem_res = tool_registry.execute_tool(
                tool_name="search_memories",
                user_id=user_id,
                args={"query": raw_msg, "top_k": 4},
                db=db,
                conversation_id=conversation_id
            )
            timing_metrics["memory_ms"] = round((time.perf_counter() - t_mem_start) * 1000, 2)
            if mem_res.success and mem_res.data:
                mem_texts = [f"• {m['content']}" for m in mem_res.data]
                context_memories += "\n=== PERSONAL LONG-TERM MEMORY ===\n" + "\n".join(mem_texts)
                retrieved_sources.append({"source": "long_term_memory", "count": len(mem_res.data)})
                tools_executed.append({"tool": "search_memories", "status": "success", "count": len(mem_res.data)})

        # Document Semantic Search (Fallback if direct field was not matched)
        needs_docs = intent == QueryIntent.DOCUMENT or any(
            dk in lower_msg for dk in ["document", "pdf", "file", "resume", "marksheet", "uploaded", "in my resume", "my cv"]
        )
        if needs_docs:
            t_doc_start = time.perf_counter()
            doc_res = tool_registry.execute_tool(
                tool_name="search_documents",
                user_id=user_id,
                args={"query": raw_msg, "top_k": 3},
                db=db,
                conversation_id=conversation_id
            )
            timing_metrics["document_ms"] = round((time.perf_counter() - t_doc_start) * 1000, 2)
            if doc_res.success and doc_res.data:
                doc_texts = [f"• [Doc snippet] {d['content']}" for d in doc_res.data]
                context_docs = "\n".join(doc_texts)
                retrieved_sources.append({"source": "documents", "count": len(doc_res.data)})
                tools_executed.append({"tool": "search_documents", "status": "success", "count": len(doc_res.data)})

        # Step 4: Add rolling conversation summary if available
        if conversation_id:
            summary = conversation_service.get_or_create_summary(db, conversation_id, user_id=user_id, max_messages_trigger=15)
            if summary and summary.summary_text:
                context_memories += f"\n=== CONVERSATION SESSION SUMMARY ===\n{summary.summary_text}"

        # Combine code context with document context
        if context_code:
            context_docs += "\n\n=== RELEVANT GITHUB CODE SNIPPETS ===\n" + context_code

        # Step 5: Grounded Answer Synthesis
        t_llm_start = time.perf_counter()
        final_answer = llm_service.generate_chat_response(
            user_message=raw_msg,
            chat_history=chat_history,
            context_docs=context_docs,
            context_memories=context_memories,
            user_profile_summary=user_profile_summary,
            current_time_str=current_time_str
        )
        timing_metrics["llm_ms"] = round((time.perf_counter() - t_llm_start) * 1000, 2)

        total_ms = round((time.perf_counter() - t0) * 1000, 2)
        timing_metrics["total_ms"] = total_ms

        logger.info(
            f"[Orchestrator] total_ms={total_ms} router_ms={timing_metrics['router_ms']} "
            f"tools_ms={timing_metrics['tools_ms']} memory_ms={timing_metrics['memory_ms']} "
            f"llm_ms={timing_metrics['llm_ms']}"
        )

        return {
            "response": final_answer,
            "retrieved_sources": retrieved_sources,
            "tools_executed": tools_executed,
            "timing": timing_metrics
        }

agent_orchestrator = AgentOrchestrator()
