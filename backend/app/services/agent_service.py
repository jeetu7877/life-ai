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
            "db_ms": 0.0,
            "retrieval_ms": 0.0,
            "llm_ms": 0.0,
            "total_ms": 0.0
        }

        # Step 1: Intelligent Intent Routing (<1ms)
        t_route_start = time.time()
        intent, sub_cat = query_router.classify_intent(user_message)
        timing_metrics["router_ms"] = round((time.time() - t_route_start) * 1000, 2)

        # FAST PATH 1: Casual Greetings & Chit-chat (<10ms, no DB, no vector, no LLM)
        if intent == QueryIntent.GREETING:
            greeting_resp = query_router.handle_greeting_fast_path(user_message)
            total_ms = round((time.time() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            logger.info(f"[QueryRouter] intent=GREETING total_ms={total_ms} router_ms={timing_metrics['router_ms']}")
            return {
                "response": greeting_resp,
                "retrieved_sources": [{"source": "fast_greeting"}],
                "timing": timing_metrics
            }

        # FAST PATH 2: Level 1 Profile Memory (<50ms, direct SQL lookup, no vector search)
        if intent == QueryIntent.PROFILE:
            t_db_start = time.time()
            profile_resp = query_router.handle_profile_fast_path(db, user_id, sub_cat)
            timing_metrics["db_ms"] = round((time.time() - t_db_start) * 1000, 2)
            if profile_resp:
                total_ms = round((time.time() - t0) * 1000, 2)
                timing_metrics["total_ms"] = total_ms
                logger.info(f"[QueryRouter] intent=PROFILE sub={sub_cat} total_ms={total_ms} db_ms={timing_metrics['db_ms']}")
                return {
                    "response": profile_resp,
                    "retrieved_sources": [{"source": "profile_memory", "category": sub_cat}],
                    "timing": timing_metrics
                }

        # FAST PATH 3: Secure Vault Queries (<50ms)
        if intent == QueryIntent.VAULT:
            t_vault_start = time.time()
            secret_val = vault_service.query_by_type_or_name(db, user_id, user_message)
            timing_metrics["db_ms"] = round((time.time() - t_vault_start) * 1000, 2)
            total_ms = round((time.time() - t0) * 1000, 2)
            timing_metrics["total_ms"] = total_ms
            logger.info(f"[QueryRouter] intent=VAULT total_ms={total_ms} db_ms={timing_metrics['db_ms']}")
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
            t_timeline_start = time.time()
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

            # Deduplicate preserving order
            seen = set()
            unique_acc = []
            for item in accomplishments:
                low = item.lower()
                if low not in seen:
                    seen.add(low)
                    unique_acc.append(item)

            timing_metrics["db_ms"] = round((time.time() - t_timeline_start) * 1000, 2)

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
        t_db_start = time.time()
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        if profile:
            user_profile_summary = (
                f"Name: {profile.name or profile.preferred_name or 'Friend'}\n"
                f"Skills: {', '.join(profile.skills) if profile.skills else 'None'}\n"
                f"College/Education: {profile.college or profile.education or 'None'}\n"
                f"Branch: {profile.branch or 'None'}\n"
                f"Projects: {', '.join([str(p) for p in profile.projects]) if profile.projects else 'None'}"
            )
        timing_metrics["db_ms"] += round((time.time() - t_db_start) * 1000, 2)

        # RETRIEVAL: Level 2 Long-Term Semantic Memory (Top 3-5 memories, STRICT USER ISOLATION)
        t_retrieval_start = time.time()
        needs_memory = intent in [QueryIntent.MEMORY, QueryIntent.TIMELINE] or any(
            w in lower_msg for w in ["my", "mera", "meri", "mere", "remember", "dost", "friend", "favourite", "preference"]
        )

        if needs_memory:
            semantic_memories = rag_service.search_memories(
                user_id=user_id,
                query=user_message,
                top_k=4,
                db=db
            )
            if semantic_memories:
                mem_texts = [f"• {m['content']}" for m in semantic_memories]
                context_memories += "\n" + "\n".join(mem_texts)
                retrieved_sources.append({"source": "long_term_memory", "count": len(semantic_memories)})

        # RETRIEVAL: Level 3 Document Memory / RAG (Only when document query or explicitly relevant)
        needs_docs = intent == QueryIntent.DOCUMENT or any(
            dk in lower_msg for dk in ["document", "pdf", "file", "resume", "marksheet", "uploaded"]
        )
        if needs_docs:
            doc_chunks = rag_service.search_documents(
                user_id=user_id,
                query=user_message,
                top_k=3,
                db=db
            )
            if doc_chunks:
                doc_texts = [f"• [Doc snippet] {d['content']}" for d in doc_chunks]
                context_docs = "\n".join(doc_texts)
                retrieved_sources.append({"source": "documents", "count": len(doc_chunks)})

        timing_metrics["retrieval_ms"] = round((time.time() - t_retrieval_start) * 1000, 2)

        # Step 5: Answer Generation via Gemini LLM
        t_llm_start = time.time()
        final_answer = llm_service.generate_chat_response(
            user_message=user_message,
            chat_history=chat_history,
            context_docs=context_docs,
            context_memories=context_memories,
            user_profile_summary=user_profile_summary,
            current_time_str=current_time_str
        )
        timing_metrics["llm_ms"] = round((time.time() - t_llm_start) * 1000, 2)

        total_ms = round((time.time() - t0) * 1000, 2)
        timing_metrics["total_ms"] = total_ms

        logger.info(
            f"[QueryRouter] intent={intent} total_ms={total_ms} "
            f"router_ms={timing_metrics['router_ms']} db_ms={timing_metrics['db_ms']} "
            f"retrieval_ms={timing_metrics['retrieval_ms']} llm_ms={timing_metrics['llm_ms']}"
        )

        return {
            "response": final_answer,
            "retrieved_sources": retrieved_sources,
            "timing": timing_metrics
        }

agent_service = AgentService()