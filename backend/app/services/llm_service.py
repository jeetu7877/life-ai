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

# List of high-speed Gemini models to try in order of priority/quota availability
CANDIDATE_MODELS = [
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
]

def get_gemini_client():
    """
    Dynamically loads and configures Google Gemini client if API key is present.
    Supports on-the-fly key additions to backend/.env without restarting the server.
    """
    load_dotenv(override=True)
    # Check both backend/.env and root .env
    backend_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(backend_env):
        load_dotenv(backend_env, override=True)

    api_key = (
        os.getenv("GEMINI_API_KEY") or 
        os.getenv("GOOGLE_API_KEY") or 
        settings.GEMINI_API_KEY or 
        ""
    ).strip().strip('"').strip("'")
    
    if api_key and api_key != "your_google_gemini_api_key_here" and len(api_key) > 10:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            return genai
        except Exception as e:
            logger.warning(f"Google Generative AI configuration error: {e}")
    return None

class LLMService:
    def __init__(self):
        raw_model = os.getenv("GEMINI_MODEL") or settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
        self.model_name = "gemini-3.5-flash-lite" if "1.5" in raw_model or "2.5" in raw_model else raw_model
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
            "   NEVER speak raw timestamps (like '01:20 AM'), log prefixes, or repeat chat logs verbatim.\n\n"
            "Guidelines:\n"
            "- If the question is general (coding, knowledge, concepts, chit-chat): Answer freely and thoroughly using your full intelligence.\n"
            "- If the question is about the user's private personal life: Rely strictly on verified memories/profile without hallucinating personal facts.\n"
            "- Voice delivery: As a female AI companion, speak warmly, respectfully, and clearly."
        )

    def generate_chat_response(
        self,
        user_message: str,
        chat_history: List[Dict[str, str]],
        context_docs: str = "",
        context_memories: str = "",
        user_profile_summary: str = "",
        current_time_str: str = ""
    ) -> str:
        """Generate response with short-term history, retrieved RAG context, and profile."""
        full_system_context = (
            f"{self.system_prompt}\n\n"
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
                    
                    response = model.generate_content(contents)
                    if response and response.text:
                        self.model_name = candidate  # Stick to the working model
                        return response.text.strip()
                except Exception as e:
                    last_error = e
                    logger.warning(f"Gemini generation error with {candidate}: {e}")
                    continue

        # If key is present but all models hit quota / rate limit
        if genai and last_error:
            err_str = str(last_error).lower()
            if "quota" in err_str or "429" in err_str or "rate" in err_str or "resourceexhausted" in err_str:
                return (
                    "Aapka Gemini API key connect ho chuka hai, lekin Google Gemini ka free tier limit (rate limit) exceed ho gaya hai. "
                    "Kripya 1-2 minute baad dubara try karein, quota jaldi reset ho jata hai."
                )

        # Intelligent local fallback for personal timeline & profile
        lower = user_message.lower()
        if "skill" in lower or "kya skills" in lower:
            if context_memories or user_profile_summary:
                return f"Aapki profile ke mutabik: {user_profile_summary or context_memories}"
            return "Aapne abhi tak skills add nahi kiye hain. Aap mujhe bata sakte hain, main yaad rakhunga!"
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
        
        # When API key is completely missing
        return (
            "Main ChatGPT ki tarah coding, science, poems, math, advice aur duniya bhar ke har sawal ka jawab de sakta hoon! "
            "Lekin abhi aapka Gemini API Key connect nahi hai, isliye main abhi offline mode mein chal raha hoon.\n\n"
            "👉 ChatGPT jaisa dimaag unlock karne ke liye: `backend/.env` file mein apni free Google Gemini API Key add kar dijiye (GEMINI_API_KEY=\"AIzaSy...\")."
        )

    def extract_memories_and_entities(self, user_message: str, assistant_response: str) -> List[Dict[str, Any]]:
        """
        Analyze conversation turn to detect if user revealed new persistent long-term facts:
        skills, projects, preferences, goals, education, achievements, daily activities.
        """
        prompt = f"""
Analyze this conversation turn and extract any NEW long-term personal facts, activities, skills, or plans.
Do NOT extract temporary chatter (e.g. 'I am hungry', 'hello', 'good morning', 'weather is nice').
Extract ONLY persistent facts or significant activities.

User: "{user_message}"
Assistant: "{assistant_response}"

Return valid JSON list of objects with these keys:
- "content": concise statement of the fact (e.g., "User knows FastAPI and React", "User worked on SQL RAG project")
- "memory_type": one of ["skill", "project", "education", "goal", "interest", "preference", "achievement", "activity", "personal_fact"]
- "importance": integer from 1 to 5
- "confidence": float from 0.0 to 1.0
- "event_date": optional date string (YYYY-MM-DD) if referring to a specific day

If no long-term memory is present, return [].
Only return raw JSON, no markdown formatting.
"""
        genai = get_gemini_client()
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
                        return parsed
                except Exception as e:
                    logger.warning(f"Memory extraction note with {candidate}: {e}")
                    continue

        # Rule-based fallback extraction
        extracted = []
        lower = user_message.lower()
        if "my skills are" in lower or "i know " in lower or "mujhe aati hai" in lower:
            extracted.append({
                "content": user_message,
                "memory_type": "skill",
                "importance": 4,
                "confidence": 0.95
            })
        elif "working on" in lower or "kaam kar raha" in lower or "project" in lower:
            extracted.append({
                "content": user_message,
                "memory_type": "project",
                "importance": 4,
                "confidence": 0.9
            })
        elif "goal" in lower or "lakshya" in lower or "want to learn" in lower:
            extracted.append({
                "content": user_message,
                "memory_type": "goal",
                "importance": 4,
                "confidence": 0.85
            })
        return extracted

llm_service = LLMService()