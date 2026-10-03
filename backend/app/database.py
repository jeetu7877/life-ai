from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings
import logging

logger = logging.getLogger(__name__)

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}

try:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        echo=False
    )
except Exception as e:
    logger.warning(f"Failed to connect using DATABASE_URL: {e}. Falling back to SQLite.")
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

def init_db():
    """Create all database tables automatically on startup."""
    import app.models  # Register all models
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
