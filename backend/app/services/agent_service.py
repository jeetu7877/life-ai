import time
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
from app.services.query_router import query_router, QueryIntent

logger = logging.getLogger("life.agent")

class AgentService:
    """
    Core Brain of Life AI:
    Implements a 3-tier memory architecture with high-speed intent routing:
    - Level 1: Profile Memory (Direct DB lookup, <50ms)
    - Level 2: Long-Term Semantic Memory (DB + vector similarity, top 3-5 memories, strict user isolation)
    - Level 3: Document Memory / RAG (User scoped chunks)
    - Fast Greetings bypass (<10ms)
    - Full timing observability without PII logging
    """

    def process_message(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        chat_history: List[Dict[str, str]],
        timezone: str = "Asia/Kolkata"
    ) -> Dict[str, Any]:
        t0 = time.time()
        retrieved_sources = []
        context_memories = ""
        context_docs = ""
        user_profile_summary = ""

        timing_metrics = {
            "router_ms": 0.0,
            "profile_ms": 0.0,
            "memory_ms": 0.0,
            "vector_ms": 0.0,
            "document_ms": 0.0,
            "llm_ms": 0.0,
            "total_ms": 0.0
        }

        # Step 1: Intelligent Intent Routing (<1ms)
        t_route_start = time.perf_counter()
        intent, sub_cat = query_router.classify_intent(user_message)
        timing_metrics["router_ms"] = round((time.perf_counter() - t_route_start) * 1000, 2)

        # FAST PATH 1: Casual Greetings & Chit-chat (<10ms, no DB, no vector, no LLM)
        if intent == QueryIntent.GREETING:
            greeting_resp = query_router.handle_greeting_fast_path(user_message)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            logger.info(f"[QueryRouter] intent=GREETING total_ms={total_ms} router_ms={timing_metrics['router_ms']}")
            return {
                "response": greeting_resp,
                "retrieved_sources": [{"source": "fast_greeting"}],
                "timing": timing_metrics
            }

        # FAST PATH 2: Level 1 Profile Memory (<50ms, direct SQL lookup, no vector search)
        if intent == QueryIntent.PROFILE:
            t_profile_start = time.perf_counter()
            profile_resp = query_router.handle_profile_fast_path(db, user_id, sub_cat)
            timing_metrics["profile_ms"] = round((time.perf_counter() - t_profile_start) * 1000, 2)
            if profile_resp:
                total_ms = round((time.perf_counter() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                logger.info(f"[QueryRouter] intent=PROFILE sub={sub_cat} total_ms={total_ms} profile_ms={timing_metrics['profile_ms']}")
                return {
                    "response": profile_resp,
                    "retrieved_sources": [{"source": "profile_memory", "category": sub_cat}],
                    "timing": timing_metrics
                }

        # FAST PATH 3: Secure Vault Queries (<50ms)
        if intent == QueryIntent.VAULT:
            t_vault_start = time.perf_counter()
            secret_val = vault_service.query_by_type_or_name(db, user_id, user_message)
            vault_ms = round((time.perf_counter() - t_vault_start) * 1000, 2)
            total_ms = round((time.perf_counter() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            logger.info(f"[QueryRouter] intent=VAULT total_ms={total_ms} vault_ms={vault_ms}")
            if secret_val:
                return {
                    "response": f"Aapka requested document number hai: {secret_val}",
                    "retrieved_sources": [{"source": "secure_vault", "status": "authorized_retrieval"}],
                    "timing": timing_metrics
                }
            else:
                return {
                    "response": "Mujhe aapke secure vault mein yeh number nahi mila. Aap document upload kar sakte hain ya Vault section mein add kar sakte hain.",
                    "retrieved_sources": [],
                    "timing": timing_metrics
                }

        # FAST PATH 4: Timeline & Activity Queries (<100ms)
        lower_msg = user_message.lower()
        now_dt = datetime.utcnow()
        current_time_str = now_dt.strftime("%A, %d %B %Y %I:%M %p UTC")

        if intent == QueryIntent.TIMELINE:
            t_timeline_start = time.perf_counter()
            detected_date = timeline_service.parse_natural_date_query(user_message)
            query_date = detected_date or now_dt.strftime("%Y-%m-%d")
            activities = timeline_service.get_activities_for_date(db, user_id, query_date)
            past_messages = timeline_service.get_conversation_history_for_date(db, user_id, query_date)

            accomplishments = []
            for act in activities:
                if act.title and act.title.strip():
                    accomplishments.append(act.title.strip())

            ignored_phrases = [
                "kya kiya", "what did", "hello", "hi", "hey", "test", "kaise ho",
                "who are you", "bolo", "life", "jeet", "sun rahe", "aaj kya", "kya kar"
            ]
            for msg in past_messages:
                if msg.role == "user":
                    clean = msg.content.strip()
                    if clean.lower() == user_message.strip().lower() or clean.endswith("?"):
                        continue
                    if any(ign in clean.lower() for ign in ignored_phrases):
                        continue
                    if len(clean) > 4:
                        accomplishments.append(clean)

            seen = set()
            unique_acc = []
            for item in accomplishments:
                low = item.lower()
                if low not in seen:
                    seen.add(low)
                    unique_acc.append(item)

            if unique_acc:
                if len(unique_acc) == 1:
                    summary_text = unique_acc[0]
                elif len(unique_acc) == 2:
                    summary_text = f"{unique_acc[0]} aur {unique_acc[1]}"
                else:
                    summary_text = f"{', '.join(unique_acc[:-1])} aur {unique_acc[-1]}"
                context_memories += f"\nUser activities on {query_date}: {summary_text}"
                retrieved_sources.append({"source": "timeline", "date": query_date, "count": len(unique_acc)})

        # Fetch Structured Profile Context for personal questions
        t_profile_start = time.perf_counter()
        has_personal_intent = intent in [QueryIntent.PROFILE, QueryIntent.MEMORY, QueryIntent.TIMELINE, QueryIntent.DOCUMENT] or any(
            w in lower_msg for w in ["my", "mera", "meri", "mere", "about me", "who am i", "my name", "my skills", "my college"]
        )
        if has_personal_intent and intent != QueryIntent.GENERAL:
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

        # RETRIEVAL: Level 3 Document Memory / RAG (Only when document query or explicitly relevant)
        needs_docs = intent == QueryIntent.DOCUMENT or any(
            dk in lower_msg for dk in ["document", "pdf", "file", "resume", "marksheet", "uploaded", "in my resume", "my cv"]
        )
        if needs_docs:
            t_doc_start = time.perf_counter()
            doc_chunks = rag_service.search_documents(
                user_id=user_id,
                query=user_message,
                top_k=3,
                db=db
            )
            timing_metrics["document_ms"] = round((time.perf_counter() - t_doc_start) * 1000, 2)
            if doc_chunks:
                doc_texts = [f"• [Doc snippet] {d['content']}" for d in doc_chunks]
                context_docs = "\n".join(doc_texts)
                retrieved_sources.append({"source": "documents", "count": len(doc_chunks)})

        # RETRIEVAL: Level 2 Long-Term Semantic Memory (Top 3-5 memories, STRICT USER ISOLATION)
        # CRITICAL OPTIMIZATION: Bypass memory vector search if this is purely a document query or general query
        t_mem_start = time.perf_counter()
        needs_memory = False
        if not needs_docs and intent != QueryIntent.GENERAL:
            needs_memory = intent in [QueryIntent.MEMORY, QueryIntent.TIMELINE] or any(
                w in lower_msg for w in ["remember", "yaad", "dost", "friend", "favourite", "favorite", "preference", "mera", "meri", "mere", "my"]
            )

        if needs_memory:
            t_vec_start = time.perf_counter()
            semantic_memories = rag_service.search_memories(
                user_id=user_id,
                query=user_message,
                top_k=4,
                db=db
            )
            timing_metrics["vector_ms"] = round((time.perf_counter() - t_vec_start) * 1000, 2)
            timing_metrics["memory_ms"] = round((time.perf_counter() - t_mem_start) * 1000, 2)
            if semantic_memories:
                mem_texts = [f"• {m['content']}" for m in semantic_memories]
                context_memories += "\n" + "\n".join(mem_texts)
                retrieved_sources.append({"source": "long_term_memory", "count": len(semantic_memories)})

        # Step 5: Answer Generation via Gemini LLM
        t_llm_start = time.perf_counter()
        final_answer = llm_service.generate_chat_response(
            user_message=user_message,
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
            f"[QueryRouter] intent={intent} total_ms={total_ms} "
            f"router_ms={timing_metrics['router_ms']} profile_ms={timing_metrics['profile_ms']} "
            f"memory_ms={timing_metrics['memory_ms']} vector_ms={timing_metrics['vector_ms']} "
            f"document_ms={timing_metrics['document_ms']} llm_ms={timing_metrics['llm_ms']}"
        )

        return {
            "response": final_answer,
            "retrieved_sources": retrieved_sources,
            "timing": timing_metrics
        }

agent_service = AgentService()