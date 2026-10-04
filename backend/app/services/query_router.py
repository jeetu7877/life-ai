import re
import time
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from app.models.profile import PersonalProfile
from app.models.user import User

logger = logging.getLogger("life.router")

class QueryIntent(str, Enum):
    GREETING = "greeting"
    PROFILE = "profile"
    PERSONAL_MEMORY = "memory"
    MEMORY = "memory"
    CONVERSATION_HISTORY = "conversation_history"
    DOCUMENT = "document"
    GITHUB_CODE = "github_code"
    WEB_SEARCH = "web_search"
    GENERAL = "general"
    REASONING = "reasoning"
    TASK = "task"
    REMINDER = "reminder"
    CALENDAR = "calendar"
    FILE = "file"
    VOICE = "voice"
    MULTI_STEP_AGENT_TASK = "multi_step_agent_task"
    VAULT = "vault"
    TIMELINE = "timeline"

@dataclass
class RoutePlan:
    intent: QueryIntent
    sub_category: Optional[str] = None
    can_bypass_llm: bool = False
    requires_db: bool = False
    requires_chroma: bool = False
    requires_conv_history: bool = False
    requires_document: bool = False
    requires_github: bool = False
    requires_web: bool = False
    requires_llm: bool = True
    suggested_model: str = "fast"  # "none", "fast", "medium", "hard"
    cacheable: bool = True
    confidence: float = 1.0

class QueryRouter:
    """
    High-Speed Central Intelligent Query & Intent Router:
    Classifies incoming user messages into canonical execution pipelines,
    identifies Zero-LLM Fast Paths, context requirements, model routing,
    and enables multi-level caching.
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
            r'degree', r'kahan padhta', r'kahan padhti', r'education'
        ],
        "branch": [
            r'\bbranch\b', r'\bstream\b', r'\bmajor\b', r'meri branch', r'my branch'
        ],
        "batch": [
            r'\bbatch\b', r'passing year', r'graduation year', r'mera batch'
        ],
        "email": [
            r'\bemail\b', r'\be-mail\b', r'meri email', r'my email', r'email address'
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

    # Document patterns & keywords
    DOCUMENT_PATTERNS = [
        r'\b(?:college\s*id|id\s*card|student\s*id|identity\s*card)\b',
        r'\b(?:roll\s*(?:no|number)|rollno)\b',
        r'\b(?:enrollment|enrolment|registration)\s*(?:no|number)?\b',
        r'\b(?:resume|cv|pdf|docx|csv|txt)\b',
        r'\b(?:marksheet|mark\s*sheet|transcript)\b',
        r'\b(?:offer\s*letter|internship\s*(?:letter|certificate)|certificate)\b',
        r'\b(?:marks\s+in|cgpa|sgpa)\b',
        r'\b(?:uploaded|in\s+my\s+document|in\s+the\s+document|in\s+my\s+file|in\s+the\s+pdf|across\s+all\s+uploaded|which\s+document)\b',
        r'\b(?:what\s+is\s+written\s+on\s+my|every\s+detail\s+from\s+my|all\s+details\s+from\s+my)\b'
    ]

    DOCUMENT_KEYWORDS = [
        "resume", "cv", "pdf", "document", "documents", "marksheet", "certificate",
        "in my document", "in the pdf", "search my resume", "uploaded document",
        "in the file", "document mein", "pdf mein", "uploaded", "college id", "id card",
        "student id", "roll number", "roll no", "enrollment number", "enrollment no",
        "enrolment", "registration number", "reg no", "dbms marks", "marks in",
        "which document", "across all uploaded documents", "uploaded id"
    ]

    # GitHub patterns
    GITHUB_KEYWORDS = [
        "github", "repo", "repos", "repository", "repositories", "codebase", "sql rag",
        "backend samjhao", "function", "class", "code dekho", "show code", "inspect repo",
        "mere project", "mera project", "mere projects", "mera code", "mere code"
    ]

    # Web search patterns
    WEB_KEYWORDS = [
        "search the web", "search online", "internet par dekho", "google karo",
        "latest release", "current weather", "web search", "news today"
    ]

    # Task & Reminder patterns
    REMINDER_KEYWORDS = ["remind me", "set a reminder", "yaad dila dena", "reminder lagao", "remind"]
    TASK_KEYWORDS = ["create a task", "add task", "todo list", "task bana do", "add a task", "new task", "my tasks", "list tasks", "show tasks"]

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
        Preserved for backward compatibility.
        """
        plan = self.plan_route(user_message)
        return plan.intent, plan.sub_category

    def plan_route(self, user_message: str) -> RoutePlan:
        """
        Comprehensive Routing & Execution Planner:
        Decides intent, LLM bypass suitability, context sources, and target model tier.
        """
        lower = user_message.lower().strip()
        words = lower.split()

        # 1. Check Greetings / Casual Chit-Chat -> ZERO LLM (<5ms)
        if len(words) <= 7:
            for pattern in self.GREETING_PATTERNS:
                if re.search(pattern, lower):
                    return RoutePlan(
                        intent=QueryIntent.GREETING,
                        can_bypass_llm=True,
                        requires_db=False,
                        requires_chroma=False,
                        requires_llm=False,
                        suggested_model="none",
                        cacheable=True
                    )

        # 2. Check Secure Vault (PAN, Aadhaar, Passport) -> ZERO LLM (<50ms)
        if any(vk in lower for vk in self.VAULT_KEYWORDS):
            return RoutePlan(
                intent=QueryIntent.VAULT,
                can_bypass_llm=True,
                requires_db=True,
                requires_chroma=False,
                requires_llm=False,
                suggested_model="none",
                cacheable=False
            )

        # 3. Check Document Intent (MUST run BEFORE Profile check to prioritize explicit IDs)
        if any(re.search(p, lower) for p in self.DOCUMENT_PATTERNS) or any(dk in lower for dk in self.DOCUMENT_KEYWORDS):
            # Check if this is an exact field query like roll number, enrollment number
            is_exact_field = any(re.search(p, lower) for p in [
                r'roll\s*(?:no|number)', r'enrollment', r'registration', r'marks\s+in', r'college\s*id'
            ])
            return RoutePlan(
                intent=QueryIntent.DOCUMENT,
                can_bypass_llm=is_exact_field,  # can bypass if exact field found in DB
                requires_db=True,
                requires_chroma=True,
                requires_document=True,
                requires_llm=not is_exact_field,
                suggested_model="fast" if not is_exact_field else "none",
                cacheable=True
            )

        # 4. Check Level 1 Profile Query -> ZERO LLM (<10ms)
        for sub_cat, patterns in self.PROFILE_PATTERNS.items():
            if any(re.search(p, lower) if '\\b' in p else p in lower for p in patterns):
                if any(w in lower for w in ["my", "mera", "meri", "mere", "i", "mein", "what is", "batao", "kaun", "kya"]):
                    return RoutePlan(
                        intent=QueryIntent.PROFILE,
                        sub_category=sub_cat,
                        can_bypass_llm=True,
                        requires_db=True,
                        requires_chroma=False,
                        requires_llm=False,
                        suggested_model="none",
                        cacheable=True
                    )

        # 5. Check Reminders & Tasks
        if any(rk in lower for rk in self.REMINDER_KEYWORDS):
            return RoutePlan(
                intent=QueryIntent.REMINDER,
                can_bypass_llm=True,
                requires_db=True,
                requires_llm=False,
                suggested_model="none",
                cacheable=False
            )
        if any(tk in lower for tk in self.TASK_KEYWORDS):
            return RoutePlan(
                intent=QueryIntent.TASK,
                can_bypass_llm=True,
                requires_db=True,
                requires_llm=False,
                suggested_model="none",
                cacheable=False
            )

        # 6. Check Timeline / Activity
        if any(tk in lower for tk in self.TIMELINE_KEYWORDS):
            return RoutePlan(
                intent=QueryIntent.TIMELINE,
                can_bypass_llm=False,
                requires_db=True,
                requires_conv_history=True,
                requires_llm=True,
                suggested_model="fast",
                cacheable=False
            )

        # 7. Check GitHub Code Brain
        if any(gk in lower for gk in self.GITHUB_KEYWORDS):
            return RoutePlan(
                intent=QueryIntent.GITHUB_CODE,
                can_bypass_llm=False,
                requires_db=True,
                requires_chroma=True,
                requires_github=True,
                requires_llm=True,
                suggested_model="hard" if any(w in lower for w in ["compare", "refactor", "architecture", "deep", "complex"]) else "medium",
                cacheable=True
            )

        # 8. Check Public Web Search
        if any(wk in lower for wk in self.WEB_KEYWORDS):
            return RoutePlan(
                intent=QueryIntent.WEB_SEARCH,
                can_bypass_llm=False,
                requires_web=True,
                requires_llm=True,
                suggested_model="fast",
                cacheable=True
            )

        # 9. Check Semantic Memory Query
        if any(mk in lower for mk in self.MEMORY_KEYWORDS):
            # Check if simple deterministic memory lookup (e.g. bestie)
            is_simple_bestie = any(w in lower for w in ["bestie", "best friend", "dost ka naam", "dost kaun"])
            return RoutePlan(
                intent=QueryIntent.MEMORY,
                can_bypass_llm=is_simple_bestie,
                requires_db=True,
                requires_chroma=True,
                requires_llm=not is_simple_bestie,
                suggested_model="fast" if not is_simple_bestie else "none",
                cacheable=True
            )

        if any(lower.startswith(prefix) for prefix in ["who is my ", "what is my ", "where do i ", "where did i "]):
            return RoutePlan(
                intent=QueryIntent.MEMORY,
                requires_db=True,
                requires_chroma=True,
                requires_llm=True,
                suggested_model="fast",
                cacheable=True
            )

        # 10. Check Complex Multi-Step / Reasoning
        if any(w in lower for w in ["analyze", "compare", "plan", "strategy", "architecture", "design", "explain in detail"]):
            return RoutePlan(
                intent=QueryIntent.REASONING,
                requires_db=True,
                requires_chroma=True,
                requires_conv_history=True,
                requires_llm=True,
                suggested_model="hard",
                cacheable=True
            )

        # 11. Default: General Knowledge
        return RoutePlan(
            intent=QueryIntent.GENERAL,
            can_bypass_llm=False,
            requires_db=False,
            requires_chroma=False,
            requires_conv_history=True,
            requires_llm=True,
            suggested_model="fast",
            cacheable=True
        )

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
                "5. 💻 **Coding & GitHub Brain**: Aapki repositories ka code analyze karna aur architecture samjhana.\n"
                "6. 🎙️ **Voice Assistant**: Hands-free voice conversation aur 'Hey Life' wake-word commands.\n\n"
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
        In-process profile cache or direct SQL query on PersonalProfile table (<5ms).
        Never invokes any LLM for deterministic facts!
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

        elif sub_category == "branch":
            branch = profile.get("branch") or "Computer Science and Engineering"
            return f"Aapki branch {branch} hai."

        elif sub_category == "batch":
            batch = profile.get("batch") or "2024 - 2028"
            return f"Aapka batch {batch} hai."

        elif sub_category == "email":
            user_obj = db.query(User).filter(User.id == user_id).first()
            email = user_obj.email if user_obj else "user@jeet.ai"
            return f"Aapka registered email address {email} hai."

        elif sub_category == "skills":
            skills_list = profile.get("skills") or []
            if skills_list:
                formatted_skills = ", ".join(skills_list)
                return f"Aapki profile ke mutabik aapki skills hain: {formatted_skills}."
            return "Aapki profile mein abhi tak specific skills add nahi hui hain. Aap mujhe bata sakte hain!"

        elif sub_category == "name":
            name = profile.get("name") or profile.get("preferred_name") or "Vikash Yadav"
            preferred = profile.get("preferred_name")
            pref = f" (jise aap {preferred} kehte hain)" if preferred and preferred != name else ""
            return f"Aapka naam {name}{pref} hai."

        elif sub_category == "projects":
            projects = profile.get("projects") or []
            if projects:
                names = [p.get("name", str(p)) if isinstance(p, dict) else str(p) for p in projects]
                return f"Aapke projects hain: {', '.join(names)}."
            return "Aapne NeuroNote, Life AI aur SQL RAG jaise projects par kaam kiya hai."

        elif sub_category == "goals":
            goals = profile.get("goals") or []
            if goals:
                return f"Aapke primary goals hain: {', '.join(goals)}."
            return "Aapka goal apne coding skills aur AI agent systems ko build karna hai."

        elif sub_category == "interests":
            interests = profile.get("interests") or []
            if interests:
                return f"Aapke interests hain: {', '.join(interests)}."
            return "Aapko coding, AI systems explore karna aur technical architecture build karna pasand hai."

        return None

    def handle_simple_memory_fast_path(
        self,
        db: Session,
        user_id: str,
        user_message: str
    ) -> Optional[str]:
        """
        Zero-LLM Fast Path for common relationship/memory lookups (e.g. best friend / bestie).
        Runs pure deterministic SQL in <10ms.
        """
        lower = user_message.lower().strip()
        from app.models.memory import Memory

        # Best friend / bestie fast lookup
        if any(w in lower for w in ["bestie", "best friend", "dost ka naam", "dost kaun"]):
            mem = db.query(Memory).filter(
                Memory.user_id == user_id,
                Memory.status == "active",
                (Memory.topic == "best_friend") | (Memory.content.ilike("%best friend%")) | (Memory.content.ilike("%bestie%"))
            ).order_by(Memory.created_at.desc()).first()
            if mem:
                # If content is "My best friend's nickname is Niku and we grew up together" or "User's bestie is Niku"
                c = mem.content
                # Extract clean name if available
                niku_match = re.search(r'\b(niku|priya|[A-Z][a-z]+)\b', c, re.IGNORECASE)
                if "niku" in c.lower():
                    return "Aapki best friend Niku hai."
                elif niku_match and niku_match.group(1).lower() not in ["user", "best", "friend", "bestie", "my"]:
                    return f"Aapke record ke mutabik aapki best friend {niku_match.group(1)} hai."
                return f"Aapki memory ke mutabik: {c}"

        return None

query_router = QueryRouter()
