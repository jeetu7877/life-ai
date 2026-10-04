import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class GitHubRepository(Base):
    """
    Connected GitHub repository metadata, synchronization status, and stats.
    """
    __tablename__ = "github_repositories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    repo_name = Column(String(100), nullable=False)
    repo_owner = Column(String(100), nullable=True)
    full_name = Column(String(200), nullable=True, index=True)  # e.g. "vikash/sql-rag"
    repo_url = Column(String(300), nullable=True)
    default_branch = Column(String(50), default="main")
    
    description = Column(Text, nullable=True)
    language = Column(String(50), nullable=True, index=True)
    is_private = Column(Boolean, default=False)
    
    is_indexed = Column(Boolean, default=False, index=True)
    indexing_status = Column(String(50), default="ready", index=True)
    last_indexed_at = Column(DateTime, nullable=True)
    file_count = Column(Integer, default=0)
    metadata_json = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="github_repositories")
    chunks = relationship("CodeChunk", back_populates="repository", cascade="all, delete-orphan")


class CodeChunk(Base):
    """
    AST & structural code chunk extracted from repository source files.
    Enables file-, function-, and class-level semantic and lexical code retrieval.
    """
    __tablename__ = "code_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String(36), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    
    file_path = Column(String(500), nullable=False, index=True)  # e.g. "backend/services/auth.py"
    function_name = Column(String(100), nullable=True, index=True)  # e.g. "login_user"
    class_name = Column(String(100), nullable=True, index=True)  # e.g. "AuthService"
    chunk_type = Column(String(50), default="block", nullable=True)
    chunk_index = Column(Integer, nullable=True, default=0)
    
    language = Column(String(50), default="python", index=True)
    content = Column(Text, nullable=False)
    start_line = Column(Integer, nullable=True)
    end_line = Column(Integer, nullable=True)
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)
    
    # Persistent Vector Embeddings stored directly in Database
    embedding = Column(JSON, nullable=True)  # List[float]
    chroma_id = Column(String(100), nullable=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("GitHubRepository", back_populates="chunks")

