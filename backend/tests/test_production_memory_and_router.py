import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.memory import Memory
from app.models.profile import PersonalProfile
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service
from app.services.query_router import query_router, QueryIntent

client = TestClient(app)

def test_greeting_fast_path_latency():
    """Verify greetings execute without LLM/vector calls and respond in < 500ms."""
    # Warm up client / database connections
    client.get("/api/v1/health")

    t0 = time.time()
    res = client.post("/api/v1/chat", json={
        "content": "Kaise ho?",
        "timezone": "Asia/Kolkata"
    })
    elapsed_ms = (time.time() - t0) * 1000
    assert res.status_code == 200
    data = res.json()
    assert len(data["response"]) > 0
    # Confirm greeting bypass was used
    sources = [s.get("source") for s in data.get("retrieved_sources", [])]
    assert "fast_greeting" in sources
    assert elapsed_ms < 500  # Must be fast

def test_level1_profile_fast_path():
    """Verify Level 1 Profile queries resolve directly from SQL profile without vector search."""
    # Ensure profile exists
    db = SessionLocal()
    user = db.query(User).first()
    assert user is not None

    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(
            user_id=user.id,
            name="Vikash Yadav (Jeet)",
            college="NIT Jalandhar",
            branch="Computer Science and Engineering",
            degree="B.Tech",
            skills=["Python", "FastAPI", "React", "PostgreSQL", "pgvector"]
        )
        db.add(profile)
        db.commit()
    else:
        profile.college = "NIT Jalandhar"
        profile.skills = ["Python", "FastAPI", "React", "PostgreSQL", "pgvector"]
        db.commit()
    db.close()

    # Query college
    res_college = client.post("/api/v1/chat", json={
        "content": "What is my college?",
        "timezone": "Asia/Kolkata"
    })
    assert res_college.status_code == 200
    college_data = res_college.json()
    assert "NIT Jalandhar" in college_data["response"]
    assert any(s.get("source") == "profile_memory" for s in college_data.get("retrieved_sources", []))

    # Query skills
    res_skills = client.post("/api/v1/chat", json={
        "content": "What are my skills?",
        "timezone": "Asia/Kolkata"
    })
    assert res_skills.status_code == 200
    skills_data = res_skills.json()
    assert "Python" in skills_data["response"] or "FastAPI" in skills_data["response"]
    assert any(s.get("source") == "profile_memory" for s in skills_data.get("retrieved_sources", []))

def test_level2_memory_semantic_retrieval_and_user_isolation():
    """
    Verify Level 2 Semantic Memory:
    1. Memory created by User A is retrievable by User A.
    2. Strict User Isolation: User B NEVER sees User A's private memory.
    """
    db = SessionLocal()
    # Create user 1 for isolation test
    user1 = db.query(User).filter(User.username == "user_one_isolation_test").first()
    if not user1:
        from app.security.jwt import get_password_hash
        user1 = User(
            email="user1_iso@test.com",
            username="user_one_isolation_test",
            hashed_password=get_password_hash("pass123")
        )
        db.add(user1)
        db.commit()
        db.refresh(user1)

    # Create user 2 for isolation test
    user2 = db.query(User).filter(User.username == "user_two_test").first()
    if not user2:
        from app.security.jwt import get_password_hash
        user2 = User(
            email="user2@test.com",
            username="user_two_test",
            hashed_password=get_password_hash("pass123")
        )
        db.add(user2)
        db.commit()
        db.refresh(user2)

    # User 1 memory
    u1_content = "My best friend's nickname is Niku and we grew up together"
    u1_emb = embedding_service.get_embedding(u1_content)
    mem1 = Memory(
        user_id=user1.id,
        content=u1_content,
        memory_type="personal_fact",
        importance=5,
        confidence=1.0,
        status="active",
        embedding=u1_emb,
        embedding_status="ready"
    )
    db.add(mem1)

    # User 2 memory
    u2_content = "Confidential code 889977 belongs exclusively to User Two"
    u2_emb = embedding_service.get_embedding(u2_content)
    mem2 = Memory(
        user_id=user2.id,
        content=u2_content,
        memory_type="personal_fact",
        importance=5,
        confidence=1.0,
        status="active",
        embedding=u2_emb,
        embedding_status="ready"
    )
    db.add(mem2)
    db.commit()

    # Also register to vector cache
    rag_service.add_memory(mem1.id, user1.id, mem1.content, mem1.memory_type)
    rag_service.add_memory(mem2.id, user2.id, mem2.content, mem2.memory_type)

    # Test 1: User 1 searches for best friend -> finds mem1
    u1_results = rag_service.search_memories(
        user_id=user1.id,
        query="Who is my best friend?",
        top_k=3,
        db=db
    )
    assert len(u1_results) > 0
    found_contents = [r["content"] for r in u1_results]
    assert any("Niku" in c for c in found_contents)

    # Test 2: User 1 searches for 'Confidential code' -> MUST NOT return user 2's memory!
    isolated_results = rag_service.search_memories(
        user_id=user1.id,
        query="Confidential code 889977",
        top_k=5,
        db=db
    )
    isolated_contents = [r["content"] for r in isolated_results]
    assert not any("889977" in c for c in isolated_contents), "CRITICAL LEAK: User 1 retrieved User 2's private data!"

    # Clean up test rows
    db.delete(mem1)
    db.delete(mem2)
    db.commit()
    db.close()

def test_database_persistence_across_vector_cache_failure():
    """
    Verify that even if ChromaDB is wiped / corrupt / None (e.g. Render container restart),
    the persistent database vector search immediately retrieves the memories!
    """
    db = SessionLocal()
    user = db.query(User).first()

    mem_content = "Persistent fact: User built an intelligent multi-agent system"
    mem_emb = embedding_service.get_embedding(mem_content)

    test_mem = Memory(
        user_id=user.id,
        content=mem_content,
        memory_type="project",
        importance=4,
        confidence=1.0,
        status="active",
        embedding=mem_emb,
        embedding_status="ready"
    )
    db.add(test_mem)
    db.commit()
    db.refresh(test_mem)

    # Simulate ChromaDB being completely unavailable / fresh container reset
    saved_coll = rag_service.memory_collection
    try:
        rag_service.memory_collection = None  # ChromaDB disconnected

        # Query should seamlessly fall back to DB-level persistent vector similarity!
        results = rag_service.search_memories(
            user_id=user.id,
            query="multi-agent system project",
            top_k=3,
            db=db
        )

        assert len(results) > 0
        assert any("multi-agent system" in r["content"] for r in results)
    finally:
        rag_service.memory_collection = saved_coll
        db.delete(test_mem)
        db.commit()
        db.close()

def test_startup_is_non_destructive():
    """Verify init_db() does NOT wipe or delete existing memories on reboot."""
    db = SessionLocal()
    user = db.query(User).first()

    # Record initial count of memories
    initial_count = db.query(Memory).filter(Memory.user_id == user.id).count()

    # Create a unique test memory
    unique_marker = f"Test persistence marker {time.time()}"
    m = Memory(
        user_id=user.id,
        content=unique_marker,
        memory_type="personal_fact",
        importance=3,
        confidence=1.0,
        status="active",
        embedding=embedding_service.get_embedding(unique_marker),
        embedding_status="ready"
    )
    db.add(m)
    db.commit()
    m_id = m.id
    db.close()

    # Run init_db (simulating server reboot / redeploy)
    init_db()

    # Verify our custom memory survived!
    db_after = SessionLocal()
    survived_mem = db_after.query(Memory).filter(Memory.id == m_id).first()
    assert survived_mem is not None
    assert survived_mem.content == unique_marker

    # Clean up
    db_after.delete(survived_mem)
    db_after.commit()
    db_after.close()
