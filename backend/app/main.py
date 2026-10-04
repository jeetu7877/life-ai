import os
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from app.config import settings
from app.database import init_db
from app.routers import (
    auth_router,
    chat_router,
    memory_router,
    documents_router,
    profile_router,
    timeline_router,
    vault_router,
    voice_router,
    health_router,
    github_router,
    tasks_router
)

# Setup structured logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("jeet.app")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-quality Personal AI Companion with Wake Word, Long-Term Memory, and Document RAG.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*|^capacitor://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database and warm up resources on startup
@app.on_event("startup")
def on_startup():
    logger.info("Initializing Life AI backend and pre-warming resources...")
    # 1. Initialize persistent database schema & indexes
    init_db()

    # 2. Warm up DB connection pool
    try:
        from app.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection pool pre-warmed.")
    except Exception as e:
        logger.debug(f"DB pool warmup note: {e}")

    # 3. Warm up ChromaDB collections (initialized once at startup)
    try:
        from app.services.rag_service import rag_service
        if rag_service.memory_collection:
            _ = rag_service.memory_collection.count()
        if rag_service.doc_collection:
            _ = rag_service.doc_collection.count()
        logger.info("ChromaDB vector store pre-warmed.")
    except Exception as e:
        logger.debug(f"ChromaDB warmup note: {e}")

    # 4. Pre-warm embedding service and LLM client
    try:
        from app.services.embedding_service import embedding_service
        _ = embedding_service.get_query_embedding("warmup")
        from app.services.llm_service import get_gemini_client
        _ = get_gemini_client()
        logger.info("AI reasoning and embedding pipelines pre-warmed.")
    except Exception as e:
        logger.debug(f"AI services warmup note: {e}")

    logger.info("Life AI backend is ready to serve!")

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please check application logs."}
    )

# Include Routers
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(chat_router, prefix=settings.API_V1_PREFIX)
app.include_router(memory_router, prefix=settings.API_V1_PREFIX)
app.include_router(documents_router, prefix=settings.API_V1_PREFIX)
app.include_router(profile_router, prefix=settings.API_V1_PREFIX)
app.include_router(timeline_router, prefix=settings.API_V1_PREFIX)
app.include_router(vault_router, prefix=settings.API_V1_PREFIX)
app.include_router(voice_router, prefix=settings.API_V1_PREFIX)
app.include_router(github_router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks_router, prefix=settings.API_V1_PREFIX)

# Also expose top-level health
@app.get("/health")
def top_health():
    from app.services.llm_service import get_gemini_client, get_gemini_init_error
    raw_env = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or getattr(settings, "GEMINI_API_KEY", "") or "").strip().strip('"').strip("'")
    key_len = len(raw_env)
    key_prefix = raw_env[:5] + "..." if key_len > 5 else (raw_env if key_len > 0 else "none")
    client = get_gemini_client()
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "gemini_connected": client is not None,
        "key_detected": key_len > 10,
        "key_prefix": key_prefix,
        "error": get_gemini_init_error()
    }

@app.get("/download-apk")
@app.get("/Life-AI.apk")
@app.get("/api/v1/download-apk")
def download_apk():
    """Serves the compiled Life AI Android APK for direct phone download."""
    apk_paths = [
        os.path.join(settings.UPLOAD_DIRECTORY, "Life-AI.apk"),
        os.path.join(os.path.dirname(__file__), "..", "..", "Life-AI.apk"),
        os.path.join(os.path.dirname(__file__), "..", "uploads", "Life-AI.apk"),
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    ]
    for p in apk_paths:
        if os.path.exists(p):
            return FileResponse(
                p,
                filename="Life-AI.apk",
                media_type="application/vnd.android.package-archive",
                headers={
                    "X-Content-Type-Options": "nosniff",
                    "Content-Disposition": 'attachment; filename="Life-AI.apk"'
                }
            )
    raise HTTPException(status_code=404, detail="APK is currently compiling or not found. Please try again in 30 seconds.")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    reload_enabled = os.environ.get("ENV", "development") != "production" and not os.environ.get("PORT")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload_enabled,
        reload_dirs=["app"] if reload_enabled else None,
        reload_excludes=["uploads", "chroma_db", "*.db*", "*.sqlite*"] if reload_enabled else None
    )
