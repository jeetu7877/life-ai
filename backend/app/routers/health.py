from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "companion": "Jeet",
        "wake_word": settings.WAKE_WORD,
        "database": "connected",
        "vector_db": "chromadb_ready"
    }
