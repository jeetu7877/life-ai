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
    """Create all database tables and seed baseline user & memories if empty."""
    import app.models  # Register all models
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

    # Auto-seed core memories so they are never lost on container restarts
    try:
        db = SessionLocal()
        from app.models.user import User
        from app.models.profile import PersonalProfile
        from app.models.memory import Memory
        from app.security.jwt import get_password_hash

        user = db.query(User).first()
        if not user:
            user = User(
                email="user@jeet.ai",
                username="jeet_user",
                full_name="Vikash Yadav (Jeet)",
                hashed_password=get_password_hash("jeet123")
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
        if not profile:
            profile = PersonalProfile(
                user_id=user.id,
                name="Vikash Yadav (Jeet)",
                preferred_name="Jeet",
                college="NIT Jalandhar",
                degree="B.Tech",
                branch="Computer Science and Engineering",
                skills=["Python", "FastAPI", "React", "Node.js", "ChromaDB", "SQL RAG", "Flutter"]
            )
            db.add(profile)
            db.commit()

        if db.query(Memory).filter(Memory.user_id == user.id).count() == 0:
            core_memories = [
                ("User's name is Vikash Yadav, also known as Jeet.", "personal_fact", 5),
                ("User's best friend is named Niku.", "personal_fact", 5),
                ("User is pursuing a B.Tech in Computer Science and Engineering from NIT Jalandhar.", "education", 5),
                ("User is active in the E-Cell at NIT Jalandhar.", "activity", 4),
                ("User has technical skills in Python, FastAPI, React, Node.js, ChromaDB, and SQL RAG.", "skill", 4),
                ("User worked on a project named NeuroNote.", "project", 4),
                ("User started learning the Flutter framework.", "skill", 4),
                ("User loves playing cricket.", "interest", 4),
                ("User prefers to communicate in Hindi, Hinglish, or English naturally.", "preference", 4),
                ("User wants to practice and improve their spoken English skills.", "goal", 4),
                ("User goes to college at NIT Jalandhar.", "education", 3)
            ]
            for content, mem_type, importance in core_memories:
                m = Memory(
                    user_id=user.id,
                    content=content,
                    memory_type=mem_type,
                    importance=importance,
                    confidence=1.0,
                    status="active"
                )
                db.add(m)
            db.commit()
            logger.info("Core baseline memories successfully seeded!")
        db.close()
    except Exception as e:
        logger.warning(f"Error seeding baseline memories: {e}")

