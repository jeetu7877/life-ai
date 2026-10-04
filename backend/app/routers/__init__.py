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
    "tasks_router"
]
