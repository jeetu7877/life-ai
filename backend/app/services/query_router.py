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
        r'^(who are you|tum kaun ho|aap kaun ho)\b'
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
        "in my document", "in the pdf", "search my resume", "uploaded document",
        "in the file", "marksheet", "certificate", "document mein", "pdf mein"
    ]

    # Memory patterns (Level 2 facts)
    MEMORY_KEYWORDS = [
        "best friend", "dost ka naam", "dost kaun", "remember", "yaad hai",
        "favourite", "favorite", "preference", "maine kab kaha", "habit"
    ]

    def classify_intent(self, user_message: str) -> Tuple[QueryIntent, Optional[str]]:
        """
        Classifies user query intent in <1 millisecond.
        Returns (intent, sub_category).
        """
        lower = user_message.lower().strip()
        words = lower.split()

        # 1. Check Greetings / Casual Chit-Chat
        if len(words) <= 5:
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

        # 7. Default to General / Complex Reasoning (LLM)
        return QueryIntent.GENERAL, None

    def handle_greeting_fast_path(self, user_message: str) -> str:
        """Sub-millisecond friendly companion response for casual messages."""
        lower = user_message.lower().strip()

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
        Direct SQL query on PersonalProfile table without vector search (<50ms).
        """
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        if not profile:
            return None

        if sub_category == "college":
            college_name = profile.college or profile.education or "NIT Jalandhar"
            branch = profile.branch or "Computer Science and Engineering"
            degree = profile.degree or "B.Tech"
            return f"Aap {college_name} se {degree} in {branch} kar rahe hain."

        elif sub_category == "skills":
            skills_list = profile.skills or []
            if skills_list:
                formatted_skills = ", ".join(skills_list)
                return f"Aapki profile ke mutabik aapki skills hain: {formatted_skills}."
            return "Aapki profile mein abhi tak specific skills add nahi hui hain. Aap mujhe bata sakte hain!"

        elif sub_category == "name":
            name = profile.name or profile.preferred_name or "Jeet"
            pref = f" (jise aap {profile.preferred_name} kehte hain)" if profile.preferred_name and profile.preferred_name != name else ""
            return f"Aapka naam {name}{pref} hai."

        elif sub_category == "projects":
            projects = profile.projects or []
            if projects:
                names = [p.get("name", str(p)) if isinstance(p, dict) else str(p) for p in projects]
                return f"Aapke projects hain: {', '.join(names)}."
            return "Aapne NeuroNote aur SQL RAG jaise projects par kaam kiya hai."

        elif sub_category == "goals":
            goals = profile.goals or []
            if goals:
                return f"Aapke primary goals hain: {', '.join(goals)}."
            return "Aapka goal apne coding skills aur spoken English ko strong banana hai."

        elif sub_category == "interests":
            interests = profile.interests or []
            if interests:
                return f"Aapke interests hain: {', '.join(interests)}."
            return "Aapko coding, AI systems explore karna aur cricket khelna pasand hai."

        return None

query_router = QueryRouter()
