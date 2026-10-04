import os
import re
import json
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from app.config import settings

logger = logging.getLogger(__name__)

# Initial load of environment variables
load_dotenv()

# List of high-speed Gemini models with active free-tier quotas to try in order of priority
CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-2.5-flash",
]

_last_gemini_init_error = None
_cached_client = None
_cached_key = None

def get_gemini_init_error():
    global _last_gemini_init_error
    return _last_gemini_init_error

def get_gemini_client():
    """
    Dynamically loads and configures Google Gemini client if API key is present.
    Caches configured client to eliminate redundant setup overhead.
    """
    global _last_gemini_init_error, _cached_client, _cached_key
    
    # 1. First check environment variables already present in os.environ (Render/Docker/System)
    api_key = (
        os.environ.get("GEMINI_API_KEY") or 
        os.environ.get("GOOGLE_API_KEY") or 
        ""
    ).strip().strip('"').strip("'")

    # 2. If not found in system env, load local .env without overwriting existing vars (override=False)
    if not api_key or api_key == "your_google_gemini_api_key_here":
        backend_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(backend_env):
            load_dotenv(backend_env, override=False)
        else:
            load_dotenv(override=False)

        api_key = (
            os.getenv("GEMINI_API_KEY") or 
            os.getenv("GOOGLE_API_KEY") or 
            getattr(settings, "GEMINI_API_KEY", "") or 
            ""
        ).strip().strip('"').strip("'")
    
    if api_key and api_key != "your_google_gemini_api_key_here" and len(api_key) > 10:
        if _cached_client is not None and _cached_key == api_key:
            return _cached_client
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            _last_gemini_init_error = None
            _cached_client = genai
            _cached_key = api_key
            return genai
        except Exception as e:
            _last_gemini_init_error = f"genai.configure error: {e}"
            logger.error(f"Google Generative AI configuration error: {e}", exc_info=True)
            return None
    else:
        _last_gemini_init_error = f"Key invalid or missing: len={len(api_key)}"
        return None

class LLMService:
    def __init__(self):
        raw_model = os.getenv("GEMINI_MODEL") or settings.GEMINI_MODEL or "gemini-flash-lite-latest"
        self.model_name = "gemini-flash-lite-latest" if any(x in raw_model for x in ["1.5", "2.0", "3.1", "3.5"]) else raw_model
        self.system_prompt = (
            "You are Life, a versatile, friendly, highly intelligent, and private personal AI companion.\n"
            "You have the voice and persona of an articulate, warm, polite, and intelligent Indian woman.\n\n"
            "LANGUAGE SWITCHING & MULTILINGUAL RULES:\n"
            "1. When the user asks you to talk or speak in English (e.g. 'english me baat karo', 'speak in English', 'talk in English', 'can you speak in English?'):\n"
            "   You MUST immediately switch and respond completely in fluent, natural English from then on.\n"
            "2. When the user asks you to talk or speak in Hindi (e.g. 'hindi me baat karo', 'hindi me bolo', 'speak in Hindi'):\n"
            "   You MUST immediately switch and respond in natural Hindi or Hinglish from then on.\n"
            "3. In general conversation, naturally mirror the language the user speaks to you (English if they speak English, Hindi/Hinglish if they speak Hindi/Hinglish).\n\n"
            "TWO CORE CAPABILITIES:\n"
            "1. GENERAL AI (like ChatGPT):\n"
            "   You can answer ANY question about coding, software architecture, science, mathematics, literature, "
            "   creative writing, life advice, translations, explanations, current world knowledge, history, philosophy, or brainstorming. "
            "   Provide comprehensive, well-structured, insightful, and helpful answers just like ChatGPT.\n\n"
            "2. PERSONAL COMPANION:\n"
            "   You know the user's personal documents, skills, timeline, daily activities, and memories from the provided context. "
            "   When asked about their personal life (e.g., 'Aaj maine kya kiya?', 'Meri skills kya hain?', uploaded docs, vault), "
            "   give direct, conversational answers using the verified context. "
            "Guidelines:\n"
            "- If the question is general (coding, knowledge, concepts, chit-chat): Answer freely and thoroughly using your full intelligence.\n"
            "- If the question is about the user's private personal life: Rely strictly on verified memories/profile without hallucinating personal facts.\n"
            "- Voice delivery: As a female AI companion, speak warmly, respectfully, and clearly."
        )

        self.personality_modes = {
            "NORMAL": "Mode: Conversational companion. Warm, polite, articulate, helpful.",
            "STUDY": "Mode: Interactive Teacher. Break down concepts intuitively, check understanding, explain pitfalls.",
            "CODING": "Mode: Senior Staff Developer. Concise, provide clean, idiomatic code, address edge cases and performance.",
            "INTERVIEW": "Mode: Technical & Behavioral Interviewer. Challenge responses, evaluate trade-offs, give actionable critique.",
            "PLANNING": "Mode: Productivity Coach. Prioritize strictly by deadline and impact, keep answers structured and actionable.",
            "COACH": "Mode: Personal Growth Mentor. Encourage consistency, celebrate small wins, focus on habit adherence.",
            "RESEARCH": "Mode: Research Analyst. Be objective, synthesize data, cite sources, and compare alternatives.",
            "VOICE": "Mode: Voice Assistant. Keep answers ultra-concise (1-3 sentences), punchy, and natural for speech."
        }

    def generate_chat_response(
        self,
        user_message: str,
        chat_history: List[Dict[str, str]],
        context_docs: str = "",
        context_memories: str = "",
        user_profile_summary: str = "",
        current_time_str: str = "",
        personality_mode: str = "NORMAL"
    ) -> str:
        """Generate response with short-term history, retrieved RAG context, profile, and personality mode."""
        mode_instruction = self.personality_modes.get(personality_mode.upper(), self.personality_modes["NORMAL"])
        full_system_context = (
            f"{self.system_prompt}\n\n"
            f"=== ACTIVE PERSONA MODE ===\n{mode_instruction}\n\n"
            f"Current Local Date & Time: {current_time_str}\n\n"
            f"=== USER PROFILE & INFO ===\n{user_profile_summary or 'No profile set yet.'}\n\n"
            f"=== RETRIEVED USER MEMORIES & RECENT ACTIVITIES ===\n{context_memories or 'None retrieved.'}\n\n"
            f"=== RETRIEVED USER DOCUMENTS (RAG) ===\n{context_docs or 'None retrieved.'}\n\n"
            "REMINDER:\n"
            "- For general questions (coding, concepts, general knowledge, advice, chit-chat): Answer like ChatGPT.\n"
            "- For user's personal life queries: Use the retrieved user context above, and summarize activities concisely without timestamps."
        )

        genai = get_gemini_client()
        last_error = None
        if genai:
            # Try configured model first, followed by fallback models in order
            models_to_try = [self.model_name] + [m for m in CANDIDATE_MODELS if m != self.model_name]
            for candidate in models_to_try:
                try:
                    model = genai.GenerativeModel(
                        model_name=candidate,
                        system_instruction=full_system_context
                    )
                    
                    # Format history for Gemini
                    contents = []
                    for msg in chat_history[-10:]:
                        role = "user" if msg["role"] == "user" else "model"
                        contents.append({"role": role, "parts": [msg["content"]]})
                    
                    contents.append({"role": "user", "parts": [user_message]})
                    
                    response = model.generate_content(
                        contents,
                        generation_config={"max_output_tokens": 1024, "temperature": 0.7},
                        request_options={"timeout": 15}
                    )
                    if response and response.text:
                        self.model_name = candidate  # Stick to the working model
                        return response.text.strip()
                except Exception as e:
                    last_error = e
                    err_str = str(e).lower()
                    logger.warning(f"Gemini generation note with {candidate}: {e}")
                    # Try next candidate model (different models often have independent quotas)
                    continue

        # If key is present but all models returned an error or quota was exhausted
        if genai and last_error:
            lower = user_message.lower().strip()
            # Capability / helper questions
            if any(w in lower for w in ["help", "madad", "who are you", "tum kaun ho", "kya kar sakti", "kya kar sakte", "what can you do"]):
                return (
                    "Main Life hoon — aapki intelligent personal AI companion! Main aapki personal memories, documents, "
                    "timeline, aur daily activities yaad rakhti hoon, sath hi aapke sawalon ke jawab deti hoon.\n\n"
                    "Aap mujhse apne documents, college profile, skills ya memories ke bare mein pooch sakte hain!"
                )
            if any(w in lower for w in ["bestie", "best friend", "dost"]):
                if context_memories:
                    for line in context_memories.splitlines():
                        if any(w in line.lower() for w in ["bestie", "best friend", "dost"]):
                            clean = line.replace("•", "").strip()
                            m = re.search(r"is\s+([A-Za-z0-9_\s]+)", clean, re.IGNORECASE)
                            if m:
                                name = m.group(1).strip()
                                return f"Aapki bestie ka naam {name} hai!"
                            return f"Aapki bestie ke baare mein: {clean}"
            if "skill" in lower or "kya skills" in lower:
                if context_memories or user_profile_summary:
                    return f"Aapki profile ke mutabik: {user_profile_summary or context_memories}"
                return "Aapne abhi tak skills add nahi kiye hain. Aap mujhe bata sakte hain, main yaad rakhungi!"
            if "kaun hoon" in lower or "who am i" in lower:
                return f"Aap mere dost hain! {user_profile_summary or ''}"
            if any(w in lower for w in ["kya kiya", "what did i do", "yesterday", "today", "aaj kya"]):
                if context_memories:
                    clean_text = context_memories.strip()
                    if "User activities on" in clean_text or "Activities on" in clean_text:
                        parts = clean_text.split(":", 1)
                        if len(parts) > 1:
                            clean_text = parts[1].strip()
                    clean_text = clean_text.replace("•", "").replace("-", "").strip()
                    if clean_text:
                        return f"Aaj aapne {clean_text} par kaam kiya."
                return "Aaj ki koi specific activity mujhe note nahi mili. Aap batayein aaj aapne kya naya kiya?"

            err_str = str(last_error).lower()
            if "quota" in err_str or "429" in err_str or "rate" in err_str or "resourceexhausted" in err_str:
                return (
                    "Google Gemini API ka free-tier rate limit reach ho gaya hai. "
                    "Main offline personal context (memories, profile, timeline) ke sath active hoon. "
                    "General online questions ke liye kripya 1-2 minute baad dubara try karein, quota jaldi reset ho jata hai."
                )
            else:
                logger.error(f"Gemini generation failed for all models: {last_error}")
                return (
                    f"Google Gemini connect hai lekin response generate karte waqt error aaya: {str(last_error)[:120]}. "
                    "Kripya kuch seconds baad dubara message bhejein."
                )

        # Intelligent local fallback for personal timeline & profile
        lower = user_message.lower()
        if any(w in lower for w in ["bestie", "best friend", "dost"]):
            if context_memories:
                for line in context_memories.splitlines():
                    if any(w in line.lower() for w in ["bestie", "best friend", "dost"]):
                        clean = line.replace("•", "").strip()
                        m = re.search(r"is\s+([A-Za-z0-9_\s]+)", clean, re.IGNORECASE)
                        if m:
                            name = m.group(1).strip()
                            return f"Aapki bestie ka naam {name} hai!"
                        return f"Aapki bestie ke baare mein: {clean}"
        if "skill" in lower or "kya skills" in lower:
            if context_memories or user_profile_summary:
                return f"Aapki profile ke mutabik: {user_profile_summary or context_memories}"
            return "Aapne abhi tak skills add nahi kiye hain. Aap mujhe bata sakte hain, main yaad rakhungi!"
        if "kaun hoon" in lower or "who am i" in lower:
            return f"Aap mere dost hain! {user_profile_summary}"
        if "kya kiya" in lower or "what did i do" in lower or "yesterday" in lower or "today" in lower or "aaj kya" in lower:
            if context_memories:
                clean_text = context_memories.strip()
                if "User activities on" in clean_text or "Activities on" in clean_text:
                    parts = clean_text.split(":", 1)
                    if len(parts) > 1:
                        clean_text = parts[1].strip()
                clean_text = clean_text.replace("•", "").replace("-", "").strip()
                if clean_text:
                    return f"Aaj aapne {clean_text} par kaam kiya."
            return "Aaj ki koi specific activity mujhe note nahi mili. Aap batayein aaj aapne kya naya kiya?"
        
        # When API key is completely missing on this server instance
        return (
            "Main coding, general knowledge, advice aur sawalon ka jawab de sakti hoon! "
            "Lekin abhi is server par Google Gemini API Key configure nahi hai, isliye main offline mode mein hoon.\n\n"
            "👉 Agar aap Render Cloud use kar rahe hain: Render Dashboard -> Environment Variables mein `GEMINI_API_KEY` add karke Save karein.\n"
            "👉 Agar local computer par hain: `backend/.env` file mein `GEMINI_API_KEY` set karein."
        )

    def _extract_rule_based_facts(self, user_message: str) -> List[Dict[str, Any]]:
        """Instant sub-millisecond deterministic extractor for core facts (100% resilient to network/quota limits)."""
        extracted = []
        raw = user_message.strip()
        lower = raw.lower()

        # Guard against pure queries / questions
        if lower.endswith("?") or lower.startswith(("what is", "who is", "where is", "how is", "kya hai", "kaun hai", "kahan hai")):
            return []

        # 1. Best friend / Bestie
        bestie_patterns = [
            r"(?:my\s+bestie(?:'s\s+name)?|my\s+best\s+friend(?:'s\s+name)?)\s+(?:is|=|hai)\s+([A-Za-z0-9_\s]+)",
            r"(?:meri\s+bestie|meri\s+best\s+friend|mere\s+dost|dost)\s+(?:ka\s+naam\s+)?([A-Za-z0-9_\s]+?)\s+hai",
            r"(?:bestie|best\s+friend)\s*:\s*([A-Za-z0-9_\s]+)"
        ]
        for pat in bestie_patterns:
            m = re.search(pat, raw, re.IGNORECASE)
            if m:
                name = m.group(1).strip().rstrip(".,!")
                if len(name) >= 2 and not any(w in name.lower() for w in ["what", "who", "kya", "kaun"]):
                    extracted.append({
                        "content": f"User's bestie / best friend is {name.title()}",
                        "memory_type": "relationship",
                        "topic": "best_friend",
                        "importance": 5,
                        "confidence": 1.0
                    })
                    break

        # 2. General relationships: girlfriend, boyfriend, wife, husband, sister, brother, mother, father
        rel_pattern = r"(?:my|mera|meri)\s+(girlfriend|gf|boyfriend|bf|wife|husband|sister|brother|mother|mom|father|dad)\s+(?:ka\s+naam\s+|name\s+is\s+|is\s+)?([A-Za-z0-9_\s]+?)(?:\s+hai|[.,!]|$)"
        m_rel = re.search(rel_pattern, raw, re.IGNORECASE)
        if m_rel and not any(e.get("topic") == "best_friend" for e in extracted):
            relation_type = m_rel.group(1).lower()
            rel_name = m_rel.group(2).strip().rstrip(".,!")
            if len(rel_name) >= 2 and not any(w in rel_name.lower() for w in ["what", "who", "kya", "kaun", "is"]):
                extracted.append({
                    "content": f"User's {relation_type} is {rel_name.title()}",
                    "memory_type": "relationship",
                    "topic": f"rel_{relation_type}",
                    "importance": 4,
                    "confidence": 1.0
                })

        # 3. User's Name
        name_patterns = [
            r"(?:my\s+name\s+is|call\s+me)\s+([A-Za-z0-9_\s]+)",
            r"(?:mera\s+naam)\s+([A-Za-z0-9_\s]+?)\s+hai"
        ]
        for pat in name_patterns:
            m = re.search(pat, raw, re.IGNORECASE)
            if m:
                u_name = m.group(1).strip().rstrip(".,!")
                if len(u_name) >= 2 and not any(w in u_name.lower() for w in ["what", "who", "kya"]):
                    extracted.append({
                        "content": f"User's name is {u_name.title()}",
                        "memory_type": "profile",
                        "topic": "name",
                        "importance": 5,
                        "confidence": 1.0
                    })
                    break

        # 4. Location / City
        loc_patterns = [
            r"(?:i\s+live\s+in|i\s+am\s+from|i'm\s+from)\s+([A-Za-z0-9_\s]+)",
            r"(?:main|mein)\s+([A-Za-z0-9_\s]+?)\s+(?:mein\s+rehta|se\s+hoon)"
        ]
        for pat in loc_patterns:
            m = re.search(pat, raw, re.IGNORECASE)
            if m:
                city = m.group(1).strip().rstrip(".,!")
                if len(city) >= 2:
                    extracted.append({
                        "content": f"User lives in {city.title()}",
                        "memory_type": "personal_fact",
                        "topic": "location",
                        "importance": 4,
                        "confidence": 1.0
                    })
                    break

        # 5. Education / College
        col_patterns = [
            r"(?:my\s+college\s+is|i\s+study\s+at)\s+([A-Za-z0-9_\s]+)",
            r"(?:mera\s+college)\s+([A-Za-z0-9_\s]+?)\s+hai"
        ]
        for pat in col_patterns:
            m = re.search(pat, raw, re.IGNORECASE)
            if m:
                col = m.group(1).strip().rstrip(".,!")
                if len(col) >= 2:
                    extracted.append({
                        "content": f"User studies at {col}",
                        "memory_type": "education",
                        "topic": "college",
                        "importance": 4,
                        "confidence": 1.0
                    })
                    break

        # 6. Work / Company
        work_patterns = [
            r"(?:i\s+work\s+at|my\s+company\s+is)\s+([A-Za-z0-9_\s]+)",
            r"(?:main|mein)\s+([A-Za-z0-9_\s]+?)\s+(?:mein\s+kaam\s+karta)"
        ]
        for pat in work_patterns:
            m = re.search(pat, raw, re.IGNORECASE)
            if m:
                comp = m.group(1).strip().rstrip(".,!")
                if len(comp) >= 2:
                    extracted.append({
                        "content": f"User works at {comp}",
                        "memory_type": "personal_fact",
                        "topic": "company",
                        "importance": 4,
                        "confidence": 1.0
                    })
                    break

        # 7. Skills
        if "my skills are" in lower or "i know " in lower or "mujhe aati hai" in lower:
            extracted.append({
                "content": raw,
                "memory_type": "skill",
                "topic": "skills",
                "importance": 4,
                "confidence": 0.95
            })

        # 8. Projects
        elif "working on" in lower or "kaam kar raha" in lower or "project" in lower:
            extracted.append({
                "content": raw,
                "memory_type": "project",
                "topic": "projects",
                "importance": 4,
                "confidence": 0.9
            })

        # 9. Goals
        elif "goal" in lower or "lakshya" in lower or "want to learn" in lower:
            extracted.append({
                "content": raw,
                "memory_type": "goal",
                "topic": "goals",
                "importance": 4,
                "confidence": 0.85
            })

        # 10. Explicit "Remember that..." or "Yaad rakhna..."
        rem_m = re.search(r"(?:remember\s+that|remember\s+this|yaad\s+rakhna\s+ki)\s+(.+)", raw, re.IGNORECASE)
        if rem_m and not extracted:
            fact = rem_m.group(1).strip().rstrip(".,!")
            extracted.append({
                "content": f"User note: {fact}",
                "memory_type": "personal_fact",
                "topic": "user_instruction",
                "importance": 4,
                "confidence": 0.95
            })

        return extracted

    def extract_memories_and_entities(self, user_message: str, assistant_response: str) -> List[Dict[str, Any]]:
        """
        Analyze conversation turn to detect if user revealed new persistent long-term facts:
        skills, projects, preferences, goals, education, achievements, daily activities, relationships.
        Combines deterministic rule extraction with LLM reasoning.
        """
        # Step 1: Rule-based deterministic extraction (runs in 0.1ms, 100% reliable)
        rule_extracted = self._extract_rule_based_facts(user_message)

        # Step 2: Advanced LLM extraction for non-templated statements
        prompt = f"""
Analyze this conversation turn and extract any NEW long-term personal facts, relationships, activities, skills, or plans.
Do NOT extract temporary chatter (e.g. 'I am hungry', 'hello', 'good morning', 'weather is nice').
Extract ONLY persistent facts, relationships, or significant activities.

User: "{user_message}"
Assistant: "{assistant_response}"

Return valid JSON list of objects with these keys:
- "content": concise statement of the fact (e.g., "User's bestie is Niku", "User knows FastAPI and React", "User worked on SQL RAG project")
- "memory_type": one of ["relationship", "skill", "project", "education", "goal", "interest", "preference", "achievement", "activity", "personal_fact"]
- "topic": concise entity or topic category (e.g. "best_friend", "college", "company", "skills", "location", "projects")
- "importance": integer from 1 to 5
- "confidence": float from 0.0 to 1.0
- "event_date": optional date string (YYYY-MM-DD) if referring to a specific day

If no long-term memory is present, return [].
Only return raw JSON, no markdown formatting.
"""
        genai = get_gemini_client()
        llm_extracted = []
        if genai:
            models_to_try = [self.model_name] + [m for m in CANDIDATE_MODELS if m != self.model_name]
            for candidate in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name=candidate)
                    res = model.generate_content(prompt)
                    text = res.text.strip()
                    if text.startswith("```json"):
                        text = text[7:]
                    if text.endswith("```"):
                        text = text[:-3]
                    parsed = json.loads(text.strip())
                    if isinstance(parsed, list):
                        llm_extracted = parsed
                        break
                except Exception as e:
                    logger.warning(f"Memory extraction note with {candidate}: {e}")
                    continue

        # Merge extracted items, rule-based takes precedence for high-confidence items
        final_list = list(rule_extracted)
        seen_topics = {item.get("topic") for item in rule_extracted if item.get("topic")}
        seen_contents = {item.get("content", "").lower() for item in rule_extracted}

        for item in llm_extracted:
            content = item.get("content", "").strip()
            topic = item.get("topic")
            if not content:
                continue
            if topic and topic in seen_topics:
                continue
            if content.lower() in seen_contents:
                continue
            final_list.append(item)
            if topic:
                seen_topics.add(topic)
            seen_contents.add(content.lower())

        return final_list

llm_service = LLMService()