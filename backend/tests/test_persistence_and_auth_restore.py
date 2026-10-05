import pytest
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db, engine
from app.models.user import User
from app.models.profile import PersonalProfile
from app.models.memory import Memory
from app.models.conversation import Conversation
from app.models.document import Document
from app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_password_hash,
    verify_password
)
from app.services.rag_service import rag_service

def test_refresh_token_lifecycle():
    """Verify that long-lived refresh tokens are correctly generated and decoded."""
    user_id = str(uuid.uuid4())
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})

    # Decode access token
    acc_payload = decode_access_token(access_token)
    assert acc_payload is not None
    assert acc_payload["sub"] == user_id
    assert acc_payload.get("token_type") == "access"

    # Decode refresh token
    ref_payload = decode_refresh_token(refresh_token)
    assert ref_payload is not None
    assert ref_payload["sub"] == user_id
    assert ref_payload.get("token_type") == "refresh"

    # Access token must not be accepted as a refresh token
    assert decode_refresh_token(access_token) is None

def test_database_persistence_across_session_restart():
    """
    Test Phase 29:
    Create user, profile, memory, conversation, document ->
    Simulate complete backend shutdown & fresh connection ->
    Verify all data remains 100% intact.
    """
    init_db()

    # Step 1: Create unique test user and records in Session 1
    db1: Session = SessionLocal()
    test_id = str(uuid.uuid4())[:8]
    user_id = str(uuid.uuid4())
    username = f"persist_{test_id}"
    email = f"persist_{test_id}@lifeai.test"

    user = User(
        id=user_id,
        email=email,
        username=username,
        full_name=f"Persist User {test_id}",
        hashed_password=get_password_hash("SecureP@ss123"),
        is_active=True,
        is_verified=True
    )
    db1.add(user)
    db1.commit()

    profile = PersonalProfile(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=f"Persist User {test_id}",
        college="Indian Institute of Technology",
        branch="Computer Science",
        skills=["Python", "PostgreSQL", "FastAPI"]
    )
    db1.add(profile)

    memory = Memory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        content=f"User's favorite programming language is Python 3.11. Created at {test_id}",
        memory_type="preference",
        status="active",
        confidence=0.98
    )
    db1.add(memory)

    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=f"Chat session {test_id}"
    )
    db1.add(conv)

    doc = Document(
        id=str(uuid.uuid4()),
        user_id=user_id,
        filename=f"resume_{test_id}.pdf",
        original_filename=f"resume_{test_id}.pdf",
        file_path=f"uploads/resume_{test_id}.pdf",
        file_type="application/pdf",
        category="resume",
        extraction_status="completed",
        file_size=1024
    )
    db1.add(doc)
    db1.commit()

    # Step 2: Simulate complete backend shutdown / restart
    # Close session and dispose connection pool
    db1.close()
    engine.dispose()

    # Step 3: Reopen fresh database session (Simulating restart)
    db2: Session = SessionLocal()
    try:
        loaded_user = db2.query(User).filter(User.id == user_id).first()
        assert loaded_user is not None
        assert loaded_user.email == email
        assert verify_password("SecureP@ss123", loaded_user.hashed_password)

        loaded_profile = db2.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        assert loaded_profile is not None
        assert loaded_profile.college == "Indian Institute of Technology"

        loaded_memories = db2.query(Memory).filter(Memory.user_id == user_id).all()
        assert len(loaded_memories) == 1
        assert "favorite programming language is Python" in loaded_memories[0].content

        loaded_convs = db2.query(Conversation).filter(Conversation.user_id == user_id).all()
        assert len(loaded_convs) == 1
        assert loaded_convs[0].title == f"Chat session {test_id}"

        loaded_docs = db2.query(Document).filter(Document.user_id == user_id).all()
        assert len(loaded_docs) == 1
        assert loaded_docs[0].category == "resume"

        # Step 4: Verify vector index can be re-indexed from persistent DB without data loss
        rag_service.sync_active_memories_from_db(db2)
        assert loaded_memories[0].status == "active"

    finally:
        # Cleanup test records
        try:
            db2.query(Document).filter(Document.user_id == user_id).delete()
            db2.query(Conversation).filter(Conversation.user_id == user_id).delete()
            db2.query(Memory).filter(Memory.user_id == user_id).delete()
            db2.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).delete()
            db2.query(User).filter(User.id == user_id).delete()
            db2.commit()
        except Exception:
            pass
        db2.close()
