from fastapi import APIRouter
from app.config import settings
from app.services.llm_service import get_gemini_client

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    client = get_gemini_client()
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "companion": "Life",
        "wake_word": settings.WAKE_WORD,
        "database": "connected",
        "vector_db": "chromadb_ready",
        "gemini_connected": client is not None
    }
