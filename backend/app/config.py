import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field
from cryptography.fernet import Fernet

class Settings(BaseSettings):
    PROJECT_NAME: str = "Life Personal AI Companion"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # Database: Supports PostgreSQL or SQLite fallback for instant zero-dependency run
    DATABASE_URL: str = Field(
        default="sqlite:///./jeet.db",
        description="PostgreSQL connection string or local SQLite fallback"
    )

    # Security & JWT
    JWT_SECRET: str = Field(
        default="jeet_super_secret_jwt_key_please_change_in_production_998811",
        description="JWT secret key"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Sensitive Vault Encryption Key (Fernet key - 32 url-safe base64-encoded bytes)
    # Generates a valid key dynamically if none is provided
    ENCRYPTION_KEY: str = Field(
        default_factory=lambda: Fernet.generate_key().decode(),
        description="Fernet 32-byte base64 encryption key for sensitive data vault"
    )

    # Gemini AI
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        description="Google Gemini API Key for Agent reasoning, Vision OCR & Embeddings"
    )
    GEMINI_MODEL: str = "gemini-flash-lite-latest"
    GEMINI_EMBEDDING_MODEL: str = "models/gemini-embedding-001"

    # ChromaDB Vector Storage
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"

    # Document Uploads
    UPLOAD_DIRECTORY: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 25

    # Voice & Wake Word
    WAKE_WORD: str = "Life"
    WAKE_WORD_SENSITIVITY: float = 0.5
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    SILENCE_TIMEOUT_SECONDS: int = 7
    VOICE_FEMALE_HINDI: str = "hi-IN-SwaraNeural"
    VOICE_FEMALE_ENGLISH: str = "en-IN-NeerjaNeural"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost"
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()

# Ensure critical directories exist
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
