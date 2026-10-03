import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger(__name__)

# Normalize PostgreSQL URL if injected by Render (render sometimes uses postgres:// instead of postgresql://)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Production PostgreSQL connection pool tuning
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_recycle"] = 300

try:
    engine = create_engine(db_url, **engine_kwargs)
    logger.info(f"Database engine initialized (dialect: {'sqlite' if is_sqlite else 'postgresql'}).")
except Exception as e:
    logger.warning(f"Failed to connect using primary DATABASE_URL ({e}). Falling back to SQLite.")
    engine = create_engine(
        "sqlite:///./jeet.db",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _ensure_sqlite_columns(engine):
    """Safe idempotent column migrations for existing SQLite databases."""
    try:
        with engine.connect() as conn:
            # Check memories table columns
            result = conn.execute(text("PRAGMA table_info(memories)"))
            cols = [row[1] for row in result.fetchall()]
            if cols:
                if "embedding" not in cols:
                    conn.execute(text("ALTER TABLE memories ADD COLUMN embedding JSON"))
                    logger.info("Migrated memories table: added embedding column")
                if "embedding_status" not in cols:
                    conn.execute(text("ALTER TABLE memories ADD COLUMN embedding_status VARCHAR(50) DEFAULT 'ready'"))
                    logger.info("Migrated memories table: added embedding_status column")
                conn.commit()
    except Exception as e:
        logger.debug(f"SQLite column migration note: {e}")

def init_db():
    """
    Idempotent non-destructive database initialization:
    - Creates tables if they do not exist
    - NEVER wipes, truncates, or overwrites existing user data or memories
    - The persistent database is the definitive source of truth across all restarts/redeployments
    - Idempotently syncs active memories to vector store if fresh container startup occurred
    """
    import app.models  # Register all models
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema verified and ready.")

    if is_sqlite:
        _ensure_sqlite_columns(engine)

    # Idempotent startup sync: if vector store is clean (e.g. ephemeral container start on Render),
    # sync active memories from the persistent database into the vector index
    try:
        from app.services.rag_service import rag_service
        db = SessionLocal()
        rag_service.sync_active_memories_from_db(db)
        db.close()
    except Exception as e:
        logger.debug(f"Startup vector store sync note: {e}")
