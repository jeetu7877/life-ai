from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db
from app.services.llm_service import get_gemini_client, get_gemini_init_error
from app.services.rag_service import rag_service

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Detailed component health diagnostic:
    Verifies API, Relational Database, Vector Cache, and LLM readiness.
    """
    # 1. Probe database
    db_status = "connected"
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        db_ok = False

    # 2. Probe Vector DB
    vector_status = "ready"
    try:
        if rag_service.memory_collection is None and rag_service.doc_collection is None:
            vector_status = "fallback_relational"
    except Exception:
        vector_status = "fallback_relational"

    # 3. Probe Gemini AI
    gemini_client = get_gemini_client()
    gemini_connected = gemini_client is not None

    overall_status = "healthy" if (db_ok and gemini_connected) else ("degraded" if db_ok else "unhealthy")

    return {
        "status": overall_status,
        "app_name": settings.PROJECT_NAME,
        "companion": "Life",
        "wake_word": settings.WAKE_WORD,
        "database": db_status,
        "vector_db": vector_status,
        "gemini_connected": gemini_connected,
        "gemini_error": get_gemini_init_error() if not gemini_connected else None
    }
