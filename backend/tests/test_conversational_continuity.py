import time
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.memory import Memory
from app.models.conversation import Conversation, Message
from app.services.rag_service import rag_service
from app.services.memory_service import memory_service
from app.services.timeline_service import timeline_service
from app.services.query_router import query_router, QueryIntent
from app.services.embedding_service import embedding_service
from app.security.jwt import get_password_hash, create_access_token

client = TestClient(app)

def get_or_create_test_user(db, username="jeet_user", email="user@jeet.ai"):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            email=email,
            username=username,
            full_name="Vikash Yadav",
            hashed_password=get_password_hash("jeet123")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def test_1_canonical_continuity_bestie_niku():
    """
    CANONICAL TEST CASE:
    Turn 1: User says 'My bestie's name is Niku.'
    Turn 2: Later, even in a brand new conversation, user asks 'What is my bestie's name?'
    Life AI must retrieve the stored memory and answer 'Niku'.
    """
    db = SessionLocal()
    user = get_or_create_test_user(db)
    
    # Clean any prior bestie memories to start fresh
    db.query(Memory).filter(Memory.user_id == user.id, Memory.topic == "best_friend").delete()
    db.commit()

    # TURN 1: User introduces bestie in Conversation 1
    conv1_res = client.post("/api/v1/chat", json={
        "content": "My bestie's name is Niku.",
        "timezone": "Asia/Kolkata"
    })
    assert conv1_res.status_code == 200
    conv1_data = conv1_res.json()
    conv1_id = conv1_data["conversation_id"]

    # Verify memory was persisted to database
    active_bestie_mem = db.query(Memory).filter(
        Memory.user_id == user.id,
        Memory.status == "active",
        Memory.topic == "best_friend"
    ).first()
    assert active_bestie_mem is not None, "Memory was not persisted to PostgreSQL database!"
    assert "Niku" in active_bestie_mem.content

    # TURN 2: In a brand-new conversation session, user asks for bestie's name
    conv2_res = client.post("/api/v1/chat", json={
        "content": "What is my bestie's name?",
        "timezone": "Asia/Kolkata"
    })
    assert conv2_res.status_code == 200
    conv2_data = conv2_res.json()
    assert conv2_data["conversation_id"] != conv1_id, "Should be a distinct conversation session"
    
    # Response must contain Niku
    assert "Niku" in conv2_data["response"], f"Expected 'Niku' in response, got: {conv2_data['response']}"
    
    # Verify memory source was retrieved
    sources = [s.get("source") for s in conv2_data.get("retrieved_sources", [])]
    assert "long_term_memory" in sources

    # Also verify Hinglish / alternate phrasing: 'meri bestie ka name kya hai'
    conv3_res = client.post("/api/v1/chat", json={
        "content": "meri bestie ka name kya hai",
        "timezone": "Asia/Kolkata"
    })
    assert conv3_res.status_code == 200
    conv3_data = conv3_res.json()
    assert "Niku" in conv3_data["response"]

    db.close()

def test_2_backend_restart_survival():
    """
    TEST 2: Verify memories survive simulated backend restart / container redeployment.
    """
    db = SessionLocal()
    user = get_or_create_test_user(db)

    user_id = user.id
    # Clean any prior language memories to start fresh
    db.query(Memory).filter(Memory.user_id == user.id, Memory.topic == "fav_language").delete()
    db.commit()
    if rag_service.memory_collection:
        try:
            rag_service.memory_collection.delete(where={"user_id": str(user_id)})
        except Exception:
            pass

    # Ensure a known memory exists in DB
    test_fact = f"User preferred programming language is Rust_{int(time.time())}"
    mem = Memory(
        user_id=user_id,
        content=test_fact,
        memory_type="preference",
        topic="fav_language",
        status="active"
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    mem_id = mem.id
    db.close()

    # SIMULATE RESTART:
    # 1. Clear in-memory caches and re-run non-destructive init_db()
    init_db()

    # 2. Open brand new database session after reboot
    db_after = SessionLocal()
    persisted_mem = db_after.query(Memory).filter(Memory.id == mem_id).first()
    assert persisted_mem is not None, "Memory disappeared after backend init_db() restart!"
    assert persisted_mem.status == "active"
    assert persisted_mem.content == test_fact

    # 3. Query via RAG service
    results = rag_service.search_memories(
        user_id=user_id,
        query="What is my preferred programming language?",
        top_k=3,
        db=db_after
    )
    assert len(results) > 0
    contents = [r["content"] for r in results]
    assert any(test_fact in c for c in contents)

    # Clean up
    db_after.delete(persisted_mem)
    db_after.commit()
    db_after.close()

def test_3_chroma_wipe_fallback_and_resync():
    """
    TEST 3: Verify that if Chroma collection is wiped/empty/corrupted,
    the PostgreSQL database acts as persistent source of truth with 0 data loss,
    and sync_active_memories_from_db restores Chroma.
    """
    db = SessionLocal()
    user = get_or_create_test_user(db)

    # Insert test memory in DB
    unique_tag = f"SecretProjectAlpha_{int(time.time())}"
    mem = Memory(
        user_id=user.id,
        content=f"User is secretly building {unique_tag}",
        memory_type="project",
        topic="secret_project",
        status="active"
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)

    # Temporarily disable Chroma memory collection to simulate wipe / corrupt disk
    orig_collection = rag_service.memory_collection
    rag_service.memory_collection = None

    try:
        # Search must gracefully fall back to DB persistent search and find it
        db_results = rag_service.search_memories(
            user_id=user.id,
            query=f"What is {unique_tag}?",
            top_k=3,
            db=db
        )
        assert len(db_results) > 0, "Database fallback failed to retrieve memory when Chroma was unavailable!"
        assert any(unique_tag in r["content"] for r in db_results)
    finally:
        # Restore Chroma collection and test resync
        rag_service.memory_collection = orig_collection

    # Now verify Chroma resync from database
    rag_service.sync_active_memories_from_db(db)
    
    # Clean up
    db.delete(mem)
    db.commit()
    db.close()

def test_4_postgresql_source_of_truth_and_independent_write():
    """
    TEST 4: Verify independent database write:
    Database write must commit first, retaining row in PostgreSQL even before vector indexing.
    """
    db = SessionLocal()
    user = get_or_create_test_user(db)

    created_mems = memory_service.process_conversation_for_memories(
        db=db,
        user_id=user.id,
        user_message="I live in Bengaluru, Karnataka",
        assistant_response="Great, Bengaluru is the Silicon Valley of India!"
    )
    assert len(created_mems) > 0
    saved = created_mems[0]

    # Verify database properties
    assert saved.id is not None
    assert saved.user_id == user.id
    assert saved.status == "active"
    assert saved.topic == "location"
    assert "Bengaluru" in saved.content
    assert saved.created_at is not None

    # Check directly from raw SQL
    db_check = SessionLocal()
    raw_row = db_check.query(Memory).filter(Memory.id == saved.id).first()
    assert raw_row is not None
    assert raw_row.topic == "location"

    # Clean up
    db_check.delete(raw_row)
    db_check.commit()
    db_check.close()
    db.close()

def test_5_user_isolation():
    """
    TEST 5: Strict User Isolation:
    User A's memory is NEVER visible or retrievable by User B.
    """
    db = SessionLocal()
    userA = get_or_create_test_user(db, username="user_a_continuity", email="usera@test.com")
    userB = get_or_create_test_user(db, username="user_b_continuity", email="userb@test.com")

    # Create private memory for User A
    secret_code = f"CONFIDENTIAL_KEY_9944_{int(time.time())}"
    memA = Memory(
        user_id=userA.id,
        content=f"User A private secret code is {secret_code}",
        memory_type="personal_fact",
        topic="secret_code",
        status="active"
    )
    db.add(memA)
    db.commit()
    db.refresh(memA)
    rag_service.add_memory(memA.id, userA.id, memA.content, memA.memory_type)

    # User B queries for secret code -> MUST RETURN EMPTY
    userB_results = rag_service.search_memories(
        user_id=userB.id,
        query=f"What is {secret_code}?",
        top_k=5,
        db=db
    )
    assert len(userB_results) == 0, f"DATA LEAK: User B retrieved User A's private memory: {userB_results}"

    # User A queries for secret code -> MUST SUCCEED
    userA_results = rag_service.search_memories(
        user_id=userA.id,
        query=f"What is {secret_code}?",
        top_k=5,
        db=db
    )
    assert len(userA_results) > 0
    assert any(secret_code in r["content"] for r in userA_results)

    # Clean up
    db.delete(memA)
    db.commit()
    db.close()

def test_6_duplicate_deduplication_and_superseding():
    """
    TEST 6: Deduplication & Conflict Resolution:
    - Stating the same fact multiple times does NOT create duplicate active records.
    - Stating a conflicting newer fact marks the older fact as 'superseded'.
    """
    db = SessionLocal()
    user = get_or_create_test_user(db)

    # Clean up previous best_friend records
    db.query(Memory).filter(Memory.user_id == user.id, Memory.topic == "best_friend").delete()
    db.commit()

    # Fact 1: Bestie is Niku
    m1_list = memory_service.process_conversation_for_memories(
        db=db,
        user_id=user.id,
        user_message="My bestie is Niku",
        assistant_response="I'll remember Niku is your bestie!"
    )
    assert len(m1_list) == 1
    m1_id = m1_list[0].id

    # Repeat Fact 1 exactly: must deduplicate and NOT create new row
    m1_repeat = memory_service.process_conversation_for_memories(
        db=db,
        user_id=user.id,
        user_message="My bestie is Niku",
        assistant_response="Yes, I know Niku is your bestie!"
    )
    assert len(m1_repeat) == 1
    assert m1_repeat[0].id == m1_id, "Deduplication failed: created new row instead of updating existing"

    # Count active records for best_friend
    active_count = db.query(Memory).filter(
        Memory.user_id == user.id,
        Memory.topic == "best_friend",
        Memory.status == "active"
    ).count()
    assert active_count == 1

    # Conflict / Update: Bestie changed to Priya
    m2_list = memory_service.process_conversation_for_memories(
        db=db,
        user_id=user.id,
        user_message="My bestie is Priya",
        assistant_response="Got it, I'll update that Priya is now your bestie!"
    )
    assert len(m2_list) == 1
    m2_id = m2_list[0].id
    assert m2_id != m1_id

    # Verify m1 is now superseded
    db.expire_all()
    old_m1 = db.query(Memory).filter(Memory.id == m1_id).first()
    assert old_m1.status == "superseded", f"Old memory should be marked superseded, got {old_m1.status}"

    # Verify only m2 is active
    active_mems = db.query(Memory).filter(
        Memory.user_id == user.id,
        Memory.topic == "best_friend",
        Memory.status == "active"
    ).all()
    assert len(active_mems) == 1
    assert "Priya" in active_mems[0].content

    # Clean up
    db.query(Memory).filter(Memory.user_id == user.id, Memory.topic == "best_friend").delete()
    db.commit()
    db.close()

def test_7_past_conversation_cross_session_retrieval():
    """
    TEST 7: Full Conversation History & Cross-Session Retrieval:
    - Messages outside the current session's latest 10-20 window are retained in PostgreSQL.
    - Historical queries ('What did I tell you about my project?') retrieve past messages.
    """
    db = SessionLocal()
    user = get_or_create_test_user(db)

    # Create an older conversation with specific details
    old_conv = Conversation(
        user_id=user.id,
        title="Drone Project Discussion"
    )
    db.add(old_conv)
    db.commit()
    db.refresh(old_conv)

    old_user_msg = Message(
        conversation_id=old_conv.id,
        user_id=user.id,
        role="user",
        content="I am developing an autonomous quadcopter drone with thermal cameras.",
        timestamp=datetime.utcnow() - timedelta(days=7),
        local_time_str="7 days ago"
    )
    old_asst_msg = Message(
        conversation_id=old_conv.id,
        user_id=user.id,
        role="assistant",
        content="Thermal cameras on an autonomous quadcopter will be great for nighttime search and rescue.",
        timestamp=datetime.utcnow() - timedelta(days=7),
        local_time_str="7 days ago"
    )
    db.add_all([old_user_msg, old_asst_msg])
    db.commit()

    # In a NEW conversation session, query about that past discussion
    past_results = timeline_service.search_past_conversations(
        db=db,
        user_id=user.id,
        query="What did I tell you about my quadcopter drone project?",
        top_k=5
    )
    assert len(past_results) > 0, "Failed to retrieve past conversation message from PostgreSQL!"
    found_drone_msg = any("quadcopter" in m.content.lower() for m in past_results)
    assert found_drone_msg, f"Did not find expected quadcopter message in past history search: {[m.content for m in past_results]}"

    # Clean up
    db.delete(old_user_msg)
    db.delete(old_asst_msg)
    db.delete(old_conv)
    db.commit()
    db.close()
