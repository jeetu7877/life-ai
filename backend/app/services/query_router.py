import re
import time
import logging
from enum import Enum
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from app.models.profile import PersonalProfile

logger = logging.getLogger("life.router")

class QueryIntent(str, Enum):
    GREETING = "greeting"
    PROFILE = "profile"
    VAULT = "vault"
    TIMELINE = "timeline"
    MEMORY = "memory"
    DOCUMENT = "document"
    GENERAL = "general"

class QueryRouter:
    """
    High-Speed Intelligent Query & Intent Router:
    Classifies incoming user messages into 7 distinct pipelines to maximize speed,
    eliminate unnecessary expensive LLM and vector calls, and enforce strict user privacy.
    """

    # Fast greeting patterns
    GREETING_PATTERNS = [
        r'^(hi|hello|hey|heyy|heya|hola)\b',
        r'^(kaise ho|kya haal|kya haal hai|kya hal|sab theek|sab badiya)\b',
        r'^(good\s*(morning|afternoon|evening|night))\b',
        r'^(namaste|namaskar|pranam)\b',
        r'^(thanks|thank you|dhanyawad|shukriya)\b',
        r'^(bye|goodbye|alvida|tata)\b',
        r'^(ok|okay|theek hai|achha|accha|sahi hai)\b',
        r'^(bolo|sun rahe ho|kya kar rahi ho|kya kar rahe ho)\b',
        r'^(who are you|tum kaun ho|aap kaun ho)\b',
        r'(how (can you|you can) help|what can you do|kya kar sakti ho|kya kar sakte ho|help me|how to use|features|capabilities)'
    ]

    # Level 1 Profile patterns
    PROFILE_PATTERNS = {
        "college": [
            r'college', r'university', r'where do i study', r'padhai kahan',
            r'degree', r'branch', r'kahan padhta', r'kahan padhti', r'education'
        ],
        "skills": [
            r'skill', r'skills', r'tech stack', r'technologies', r'languages i know',
            r'kya aata hai', r'kya janta hoon', r'meri capabilities'
        ],
        "name": [
            r'mera naam', r'what is my name', r'who am i', r'kaun hoon main',
            r'preferred name', r'mujhe kis naam se', r'my name'
        ],
        "projects": [
            r'my projects', r'mere projects', r'projects batao', r'what projects'
        ],
        "goals": [
            r'my goals', r'mere goals', r'mera lakshya', r'future goals', r'ambitions'
        ],
        "interests": [
            r'my interests', r'meri hobbies', r'interests kya', r'mujhe kya pasand'
        ]
    }

    # Vault patterns
    VAULT_KEYWORDS = [
        "pan number", "pan card", "pan no", "aadhaar", "aadhar", "uidai",
        "passport number", "passport no", "secret vault", "vault number"
    ]

    # Timeline patterns
    TIMELINE_KEYWORDS = [
        "kya kiya", "what did i do", "what was i doing", "timeline", "activity",
        "aaj kya kiya", "kal kya kiya", "yesterday", "aaj ki activities"
    ]

    # Document patterns
    DOCUMENT_KEYWORDS = [
        "resume", "cv", "pdf", "document", "marksheet", "certificate",
        "in my document", "in the pdf", "search my resume", "uploaded document",
        "in the file", "document mein", "pdf mein", "uploaded"
    ]

    # Memory patterns (Level 2 facts & relationships)
    MEMORY_KEYWORDS = [
        "best friend", "bestfriend", "bestie", "besties", "dost ka naam", "dost kaun",
        "dost", "friend", "girlfriend", "boyfriend", "gf", "bf", "wife", "husband",
        "sister", "brother", "family", "remember", "yaad hai", "yaad", "favourite",
        "favorite", "preference", "maine kab kaha", "habit", "who is my", "what is my",
        "where do i", "where did i", "what did i tell", "what did i say", "meri bestie",
        "mera dost", "mere dost", "kaun hai mera", "kaun hai meri"
    ]

    def classify_intent(self, user_message: str) -> Tuple[QueryIntent, Optional[str]]:
        """
        Classifies user query intent in <1 millisecond.
        Returns (intent, sub_category).
        """
        lower = user_message.lower().strip()
        words = lower.split()

        # 1. Check Greetings / Casual Chit-Chat
        if len(words) <= 7:
            for pattern in self.GREETING_PATTERNS:
                if re.search(pattern, lower):
                    return QueryIntent.GREETING, None

        # 2. Check Secure Vault (PAN, Aadhaar, Passport)
        if any(vk in lower for vk in self.VAULT_KEYWORDS):
            return QueryIntent.VAULT, None

        # 3. Check Level 1 Profile Query
        for sub_cat, patterns in self.PROFILE_PATTERNS.items():
            if any(p in lower for p in patterns):
                # Ensure it's asking about user's profile, not a generic concept
                if any(w in lower for w in ["my", "mera", "meri", "mere", "i", "mein", "what is", "batao", "kaun"]):
                    return QueryIntent.PROFILE, sub_cat

        # 4. Check Timeline / Activity
        if any(tk in lower for tk in self.TIMELINE_KEYWORDS):
            return QueryIntent.TIMELINE, None

        # 5. Check Document RAG
        if any(dk in lower for dk in self.DOCUMENT_KEYWORDS):
            return QueryIntent.DOCUMENT, None

        # 6. Check Semantic Memory Query
        if any(mk in lower for mk in self.MEMORY_KEYWORDS):
            return QueryIntent.MEMORY, None

        if any(lower.startswith(prefix) for prefix in ["who is my ", "what is my ", "where do i ", "where did i "]):
            return QueryIntent.MEMORY, None

        # 7. Default to General / Complex Reasoning (LLM)
        return QueryIntent.GENERAL, None

    def handle_greeting_fast_path(self, user_message: str) -> str:
        """Sub-millisecond friendly companion response for casual messages."""
        lower = user_message.lower().strip()

        if any(w in lower for w in [
            "how you can help", "how can you help", "what can you do", 
            "kya kar sakti ho", "kya kar sakte ho", "help me", "tum kya karti ho"
        ]):
            return (
                "Main Life hoon — aapki personal AI companion! Main aapki in cheezon mein madad kar sakti hoon:\n\n"
                "1. 🧠 **Long-Term Memory**: Aapki personal baatein, preferences aur important facts hamesha yaad rakhna.\n"
                "2. 📄 **Document Search (RAG)**: Aapke uploaded PDFs, resumes aur files se accurate jankari dhoondhna.\n"
                "3. 📅 **Daily Timeline**: Din bhar ki activities aur plans track karna.\n"
                "4. 🔒 **Secure Vault**: Aadhaar, PAN aur sensitive documents securely manage karna.\n"
                "5. 💻 **Coding & General AI**: Programming, math, writing aur kisi bhi topic par ChatGPT ki tarah madad karna.\n"
                "6. 🎙️ **Voice Assistant**: Natural voice conversation aur voice commands.\n\n"
                "Aap mujhse koi bhi sawal pooch sakte hain!"
            )

        if any(w in lower for w in ["kaise ho", "kya haal", "kya hal"]):
            return "Main bilkul badhiya hoon! Aap bataiye, aaj aapka din kaisa chal raha hai?"
        if "good morning" in lower:
            return "Good morning! Aasha hai aapka din shandar aur productive rahega. Aaj hum kya karein?"
        if "good night" in lower:
            return "Good night! Achhi neend lijiye, kal milte hain naye plans ke saath."
        if any(w in lower for w in ["thanks", "thank you", "dhanyawad", "shukriya"]):
            return "Aapka swagat hai! Main hamesha aapki madad ke liye yahan hoon."
        if any(w in lower for w in ["bye", "goodbye", "alvida"]):
            return "Alvida! Apna dhyan rakhiyega, jab bhi zaroorat ho awaaz dijiyega."
        if any(w in lower for w in ["who are you", "tum kaun ho", "aap kaun ho"]):
            return "Main Life hoon, aapki intelligent aur caring personal AI companion. Main aapki baatein, documents, skills aur memories yaad rakhti hoon."
        if any(w in lower for w in ["bolo", "sun rahe ho"]):
            return "Haan, main bilkul sun rahi hoon! Boliye, main aapki kya madad karoon?"

        # Default warm greeting
        return "Hello! Main Life hoon. Boliye, aaj main aapki kya madad kar sakti hoon?"

    def handle_profile_fast_path(
        self,
        db: Session,
        user_id: str,
        sub_category: Optional[str]
    ) -> Optional[str]:
        """
        Level 1 Profile Memory Fast-Path:
        In-process profile cache or direct SQL query on PersonalProfile table (<1ms).
        """
        from app.services.profile_cache import profile_cache
        profile = profile_cache.get_profile_dict(db, user_id)
        if not profile:
            return None

        if sub_category == "college":
            college_name = profile.get("college") or profile.get("education") or "NIT Jalandhar"
            branch = profile.get("branch") or "Computer Science and Engineering"
            degree = profile.get("degree") or "B.Tech"
            return f"Aap {college_name} se {degree} in {branch} kar rahe hain."

        elif sub_category == "skills":
            skills_list = profile.get("skills") or []
            if skills_list:
                formatted_skills = ", ".join(skills_list)
                return f"Aapki profile ke mutabik aapki skills hain: {formatted_skills}."
            return "Aapki profile mein abhi tak specific skills add nahi hui hain. Aap mujhe bata sakte hain!"

        elif sub_category == "name":
            name = profile.get("name") or profile.get("preferred_name") or "Jeet"
            preferred = profile.get("preferred_name")
            pref = f" (jise aap {preferred} kehte hain)" if preferred and preferred != name else ""
            return f"Aapka naam {name}{pref} hai."

        elif sub_category == "projects":
            projects = profile.get("projects") or []
            if projects:
                names = [p.get("name", str(p)) if isinstance(p, dict) else str(p) for p in projects]
                return f"Aapke projects hain: {', '.join(names)}."
            return "Aapne NeuroNote aur SQL RAG jaise projects par kaam kiya hai."

        elif sub_category == "goals":
            goals = profile.get("goals") or []
            if goals:
                return f"Aapke primary goals hain: {', '.join(goals)}."
            return "Aapka goal apne coding skills aur spoken English ko strong banana hai."

        elif sub_category == "interests":
            interests = profile.get("interests") or []
            if interests:
                return f"Aapke interests hain: {', '.join(interests)}."
            return "Aapko coding, AI systems explore karna aur cricket khelna pasand hai."

        return None

query_router = QueryRouter()
