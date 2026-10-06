from app.routers.auth import router as auth_router
from app.routers.chat import router as chat_router
from app.routers.memory import router as memory_router
from app.routers.documents import router as documents_router
from app.routers.profile import router as profile_router
from app.routers.timeline import router as timeline_router
from app.routers.vault import router as vault_router
from app.routers.voice import router as voice_router
from app.routers.health import router as health_router
from app.routers.github import router as github_router
from app.routers.tasks import router as tasks_router
from app.routers.knowledge_graph import router as knowledge_graph_router
from app.routers.goals import router as goals_router
from app.routers.study import router as study_router
from app.routers.analytics import router as analytics_router
from app.routers.proactive import router as proactive_router
from app.routers.life_twin import router as life_twin_router
from app.routers.simulations import router as simulations_router
from app.routers.time_machine import router as time_machine_router
from app.routers.intelligence import router as intelligence_router
from app.routers.journal import router as journal_router
from app.routers.alarms import router as alarms_router
from app.routers.music import router as music_router
from app.routers.vision import router as vision_router

__all__ = [
    "auth_router",
    "chat_router",
    "memory_router",
    "documents_router",
    "profile_router",
    "timeline_router",
    "vault_router",
    "voice_router",
    "health_router",
    "github_router",
    "tasks_router",
    "knowledge_graph_router",
    "goals_router",
    "study_router",
    "analytics_router",
    "proactive_router",
    "life_twin_router",
    "simulations_router",
    "time_machine_router",
    "intelligence_router",
    "journal_router",
    "alarms_router",
    "music_router",
    "vision_router"
]
