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

logger = logging.getLogger(__name__)

class AgentService:
    """
    Core brain of Life:
    Intelligently routes questions between structured profile, long-term memory,
    daily activity timeline, ChromaDB documents, conversation history, and secure vault.
    """

    def process_message(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        chat_history: List[Dict[str, str]],
        timezone: str = "Asia/Kolkata"
    ) -> Dict[str, Any]:
        retrieved_sources = []
        context_memories = ""
        context_docs = ""
        user_profile_summary = ""

        # Fetch current profile
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        if profile:
            user_profile_summary = (
                f"Name: {profile.name or profile.preferred_name or 'Friend'}\n"
                f"Skills: {', '.join(profile.skills) if profile.skills else 'None'}\n"
                f"Current Focus: {profile.current_focus or 'None'}\n"
                f"College/Education: {profile.college or profile.education or 'None'}\n"
                f"Projects: {', '.join([str(p) for p in profile.projects]) if profile.projects else 'None'}"
            )

        lower_msg = user_message.lower()
        now_dt = datetime.utcnow()
        current_time_str = now_dt.strftime("%A, %d %B %Y %I:%M %p UTC")

        # 1. Check for Secure Vault Queries (e.g., PAN, Aadhaar, Passport)
        if any(term in lower_msg for term in ["pan number", "pan card", "aadhaar", "aadhar", "passport number"]):
            secret_val = vault_service.query_by_type_or_name(db, user_id, user_message)
            if secret_val:
                retrieved_sources.append({"source": "secure_vault", "status": "authorized_retrieval"})
                return {
                    "response": f"Aapka requested document number hai: {secret_val}",
                    "retrieved_sources": retrieved_sources
                }
            else:
                return {
                    "response": "Mujhe aapke secure vault mein yeh number nahi mila. Aap document upload kar sakte hain ya Vault mein add kar sakte hain.",
                    "retrieved_sources": []
                }

        # 2. Check for Date / Timeline Queries (e.g. "What did I do yesterday?", "2 October ko kya kiya?", "aaj maine kya kiya")
        detected_date = timeline_service.parse_natural_date_query(user_message)
        if detected_date or any(term in lower_msg for term in ["kya kiya", "what did i do", "what was i doing", "timeline", "activity", "aaj kya"]):
            query_date = detected_date or now_dt.strftime("%Y-%m-%d")
            activities = timeline_service.get_activities_for_date(db, user_id, query_date)
            past_messages = timeline_service.get_conversation_history_for_date(db, user_id, query_date)
            
            accomplishments = []
            for act in activities:
                if act.title and act.title.strip():
                    accomplishments.append(act.title.strip())
            
            # Extract meaningful user actions/learning from that day (filtering out greetings/questions/meta)
            ignored_phrases = [
                "kya kiya", "what did", "hello", "hi", "hey", "test", "kaise ho", 
                "who are you", "bolo", "life", "jeet", "sun rahe", "aaj kya", "kya kar"
            ]
            for msg in past_messages:
                if msg.role == "user":
                    clean = msg.content.strip()
                    if clean.lower() == user_message.strip().lower():
                        continue
                    if clean.endswith("?"):
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
            
            if unique_acc:
                if len(unique_acc) == 1:
                    summary_text = unique_acc[0]
                elif len(unique_acc) == 2:
                    summary_text = f"{unique_acc[0]} aur {unique_acc[1]}"
                else:
                    summary_text = f"{', '.join(unique_acc[:-1])} aur {unique_acc[-1]}"
                context_memories += f"\nUser activities on {query_date}: {summary_text}"
                retrieved_sources.append({"source": "timeline", "date": query_date, "count": len(unique_acc)})

        # 3. Retrieve Relevant Long-Term Memories from ChromaDB
        semantic_memories = rag_service.search_memories(user_id=user_id, query=user_message, top_k=4)
        if semantic_memories:
            mem_texts = [f"• {m['content']}" for m in semantic_memories]
            context_memories += "\n" + "\n".join(mem_texts)
            retrieved_sources.append({"source": "long_term_memory", "count": len(semantic_memories)})

        # 4. Retrieve Relevant Document chunks from ChromaDB
        doc_chunks = rag_service.search_documents(user_id=user_id, query=user_message, top_k=3)
        if doc_chunks:
            doc_texts = [f"• [Doc snippet] {d['content']}" for d in doc_chunks]
            context_docs = "\n".join(doc_texts)
            retrieved_sources.append({"source": "documents", "count": len(doc_chunks)})

        # 5. Generate Answer with LLM
        final_answer = llm_service.generate_chat_response(
            user_message=user_message,
            chat_history=chat_history,
            context_docs=context_docs,
            context_memories=context_memories,
            user_profile_summary=user_profile_summary,
            current_time_str=current_time_str
        )

        return {
            "response": final_answer,
            "retrieved_sources": retrieved_sources
        }

agent_service = AgentService()