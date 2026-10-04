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
                if "topic" not in cols:
                    conn.execute(text("ALTER TABLE memories ADD COLUMN topic VARCHAR(100)"))
                    logger.info("Migrated memories table: added topic column")
                if "source_message_id" not in cols:
                    conn.execute(text("ALTER TABLE memories ADD COLUMN source_message_id VARCHAR(36)"))
                    logger.info("Migrated memories table: added source_message_id column")

            # Check documents table columns
            doc_result = conn.execute(text("PRAGMA table_info(documents)"))
            doc_cols = [row[1] for row in doc_result.fetchall()]
            if doc_cols and "file_hash" not in doc_cols:
                conn.execute(text("ALTER TABLE documents ADD COLUMN file_hash VARCHAR(64)"))
                logger.info("Migrated documents table: added file_hash column")

            # Check document_chunks table columns
            chunk_result = conn.execute(text("PRAGMA table_info(document_chunks)"))
            chunk_cols = [row[1] for row in chunk_result.fetchall()]
            if chunk_cols:
                if "user_id" not in chunk_cols:
                    conn.execute(text("ALTER TABLE document_chunks ADD COLUMN user_id VARCHAR(36)"))
                    logger.info("Migrated document_chunks table: added user_id column")
                if "embedding" not in chunk_cols:
                    conn.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding JSON"))
                    logger.info("Migrated document_chunks table: added embedding column")
            # Check github_repositories table columns
            gh_result = conn.execute(text("PRAGMA table_info(github_repositories)"))
            gh_cols = [row[1] for row in gh_result.fetchall()]
            if gh_cols:
                if "repo_owner" not in gh_cols:
                    conn.execute(text("ALTER TABLE github_repositories ADD COLUMN repo_owner VARCHAR(100)"))
                    logger.info("Migrated github_repositories table: added repo_owner column")
                if "indexing_status" not in gh_cols:
                    conn.execute(text("ALTER TABLE github_repositories ADD COLUMN indexing_status VARCHAR(50) DEFAULT 'ready'"))
                    logger.info("Migrated github_repositories table: added indexing_status column")

            # Check code_chunks table columns
            cc_result = conn.execute(text("PRAGMA table_info(code_chunks)"))
            cc_cols = [row[1] for row in cc_result.fetchall()]
            if cc_cols:
                if "chunk_type" not in cc_cols:
                    conn.execute(text("ALTER TABLE code_chunks ADD COLUMN chunk_type VARCHAR(50) DEFAULT 'block'"))
                    logger.info("Migrated code_chunks table: added chunk_type column")
                if "start_line" not in cc_cols:
                    conn.execute(text("ALTER TABLE code_chunks ADD COLUMN start_line INTEGER"))
                    logger.info("Migrated code_chunks table: added start_line column")
                if "end_line" not in cc_cols:
                    conn.execute(text("ALTER TABLE code_chunks ADD COLUMN end_line INTEGER"))
                    logger.info("Migrated code_chunks table: added end_line column")

            conn.commit()
    except Exception as e:
        logger.debug(f"SQLite column migration note: {e}")

def _ensure_indexes(engine):
    """Ensure high-performance composite indexes exist idempotently for PostgreSQL & SQLite."""
    index_statements = [
        "CREATE INDEX IF NOT EXISTS ix_memories_user_status ON memories (user_id, status);",
        "CREATE INDEX IF NOT EXISTS ix_memories_user_type ON memories (user_id, memory_type);",
        "CREATE INDEX IF NOT EXISTS ix_memories_topic ON memories (user_id, topic);",
        "CREATE INDEX IF NOT EXISTS ix_messages_conv_timestamp ON messages (conversation_id, timestamp);",
        "CREATE INDEX IF NOT EXISTS ix_messages_user_timestamp ON messages (user_id, timestamp);",
        "CREATE INDEX IF NOT EXISTS ix_documents_user_cat ON documents (user_id, category);",
        "CREATE INDEX IF NOT EXISTS ix_documents_file_hash ON documents (user_id, file_hash);",
        "CREATE INDEX IF NOT EXISTS ix_docchunks_doc_chunk ON document_chunks (document_id, chunk_index);",
        "CREATE INDEX IF NOT EXISTS ix_docchunks_user ON document_chunks (user_id);",
        "CREATE INDEX IF NOT EXISTS ix_connected_accounts_user_provider ON connected_accounts (user_id, provider);",
        "CREATE INDEX IF NOT EXISTS ix_github_repos_user ON github_repositories (user_id, repo_name);",
        "CREATE INDEX IF NOT EXISTS ix_code_chunks_repo_file ON code_chunks (repository_id, file_path);",
        "CREATE INDEX IF NOT EXISTS ix_agent_tasks_user_status ON agent_tasks (user_id, status);",
        "CREATE INDEX IF NOT EXISTS ix_agent_reminders_remind ON agent_reminders (user_id, is_triggered, remind_at);",
        "CREATE INDEX IF NOT EXISTS ix_tool_logs_user_tool ON agent_tool_logs (user_id, tool_name);",
        "CREATE INDEX IF NOT EXISTS ix_conv_summary_conv ON conversation_summaries (conversation_id);"
    ]
    try:
        with engine.connect() as conn:
            for stmt in index_statements:
                try:
                    conn.execute(text(stmt))
                except Exception as ex:
                    logger.debug(f"Index creation note ({stmt}): {ex}")
            conn.commit()
            logger.info("High-speed database composite indexes verified.")
    except Exception as e:
        logger.debug(f"Index verification note: {e}")

def _ensure_default_user(db: Session):
    """Safely seed default user and profile once at boot time to prevent concurrent request race conditions."""
    from app.models.user import User
    from app.models.profile import PersonalProfile
    from app.security.jwt import get_password_hash
    try:
        user = db.query(User).filter(
            (User.username == "jeet_user") | (User.email == "user@jeet.ai")
        ).first()
        if not user:
            user = User(
                email="user@jeet.ai",
                username="jeet_user",
                full_name="Vikash Yadav",
                hashed_password=get_password_hash("jeet123")
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
        if not profile:
            profile = PersonalProfile(
                user_id=user.id,
                name="Vikash Yadav",
                preferred_name="Vikash",
                skills=["Python", "FastAPI", "React", "Node.js", "ChromaDB", "SQL RAG"]
            )
            db.add(profile)
            db.commit()
    except Exception as e:
        db.rollback()
        logger.debug(f"Default user initialization note: {e}")

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

    _ensure_indexes(engine)

    # Ensure default user exists before any HTTP requests arrive
    try:
        db = SessionLocal()
        _ensure_default_user(db)
        db.close()
    except Exception as e:
        logger.debug(f"Startup user seed note: {e}")

    # Idempotent startup sync: if vector store is clean (e.g. ephemeral container start on Render),
    # sync active memories and documents from the persistent database into the vector index
    try:
        from app.services.rag_service import rag_service
        db = SessionLocal()
        rag_service.sync_active_memories_from_db(db)
        rag_service.sync_documents_from_db(db)
        db.close()
    except Exception as e:
        logger.debug(f"Startup vector store sync note: {e}")
