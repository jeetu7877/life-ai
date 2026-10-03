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
    health_router
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

# Initialize database on startup
@app.on_event("startup")
def on_startup():
    logger.info("Initializing Jeet AI backend...")
    init_db()
    logger.info("Jeet AI backend is ready to serve!")

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

# Also expose top-level health
@app.get("/health")
def top_health():
    from app.services.llm_service import get_gemini_client
    client = get_gemini_client()
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "gemini_connected": client is not None
    }

@app.get("/download-apk")
@app.get("/Life-AI.apk")
@app.get("/api/v1/download-apk")
def download_apk():
    """Serves the compiled Life AI Android APK for direct phone download."""
    apk_paths = [
        os.path.join(settings.UPLOAD_DIRECTORY, "Life-AI.apk"),
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
