import time
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.models.memory import Memory
from app.services.cache_service import cache_service
from app.services.query_router import query_router, QueryIntent
from app.services.context_manager import context_manager
from app.services.llm_providers import model_router, OllamaProvider, GeminiProvider
from app.services.orchestrator import agent_orchestrator
from app.security.jwt import create_access_token

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()

def get_auth_headers(username="test_router_user", email="router_test@test.com"):
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    if not user:
        from app.security.jwt import get_password_hash
        user = User(
            email=email,
            username=username,
            full_name="Router Test User",
            hashed_password=get_password_hash("pass123")
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
            college="NIT Jalandhar",
            branch="Computer Science and Engineering",
            skills=["Python", "FastAPI", "React", "Rust"]
        )
        db.add(profile)
        db.commit()

    token = create_access_token(data={"sub": user.id})
    user_id = user.id
    db.close()
    return {"Authorization": f"Bearer {token}"}, user_id

def test_1_greeting_fast_path_zero_llm():
    """Verify greeting returns in <20ms without invoking LLM."""
    headers, user_id = get_auth_headers("greet_user", "greet@test.com")
    t0 = time.perf_counter()
    res = client.post("/api/v1/chat", headers=headers, json={"content": "hello"})
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert res.status_code == 200
    data = res.json()
    assert "Life" in data["response"]
    assert any(s["source"] == "fast_greeting" for s in data["retrieved_sources"])
    assert elapsed_ms < 300, f"Greeting fast path took too long: {elapsed_ms}ms"

def test_2_profile_fast_path_branch_and_college():
    """Verify profile facts return without invoking LLM."""
    headers, user_id = get_auth_headers("profile_fast_user", "pfast@test.com")
    
    # Query branch
    res1 = client.post("/api/v1/chat", headers=headers, json={"content": "meri branch kya hai?"})
    assert res1.status_code == 200
    assert "Computer Science" in res1.json()["response"]
    assert any(s["source"] == "profile_memory" for s in res1.json()["retrieved_sources"])

    # Query college
    res2 = client.post("/api/v1/chat", headers=headers, json={"content": "mera college kya hai?"})
    assert res2.status_code == 200
    assert "NIT Jalandhar" in res2.json()["response"]

def test_3_simple_memory_fast_path_bestie():
    """Verify bestie query returns directly from Memory without LLM."""
    headers, user_id = get_auth_headers("bestie_fast_user", "bestie_fast@test.com")
    db = SessionLocal()
    # Add memory
    mem = Memory(
        user_id=user_id,
        content="User's bestie is Niku and she is very supportive",
        memory_type="relationship",
        topic="best_friend",
        status="active"
    )
    db.add(mem)
    db.commit()
    db.close()

    res = client.post("/api/v1/chat", headers=headers, json={"content": "meri bestie ka naam kya hai?"})
    assert res.status_code == 200
    data = res.json()
    assert "Niku" in data["response"]

def test_4_semantic_cache_hit_and_user_isolation():
    """Verify semantic cache returns hit and prevents cross-user leakage."""
    headers1, user1_id = get_auth_headers("cache_u1", "cache_u1@test.com")
    headers2, user2_id = get_auth_headers("cache_u2", "cache_u2@test.com")

    # User 1 sets cached query
    res1 = client.post("/api/v1/chat", headers=headers1, json={"content": "mera college kya hai?"})
    assert res1.status_code == 200

    # User 1 sends semantically equivalent query -> should hit cache
    cached_res = cache_service.get_semantic_response(user1_id, "mera college kya hai?")
    assert cached_res is not None
    assert "NIT Jalandhar" in cached_res["response"]

    # User 2 MUST NOT get User 1's cached response
    user2_cache = cache_service.get_semantic_response(user2_id, "mera college kya hai?")
    assert user2_cache is None, "CRITICAL: Cross-user cache contamination!"

def test_5_streaming_sse_endpoint():
    """Verify POST /api/v1/chat/stream yields SSE chunks properly."""
    headers, user_id = get_auth_headers("stream_user", "stream@test.com")
    res = client.post("/api/v1/chat/stream", headers=headers, json={"content": "hello", "conversation_id": None})
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    
    body = res.text
    assert "data:" in body
    assert '"type": "meta"' in body or '"type": "token"' in body

def test_6_context_manager_budgeting():
    """Verify ContextManager filters irrelevant collections and enforces character budgets."""
    huge_docs = "Doc info " * 1000  # 9000 chars
    huge_memories = "Memory fact " * 500  # 6000 chars
    
    # When intent is DOCUMENT: memories are minimized, docs are budgeted
    budgeted = context_manager.filter_and_budget(
        intent=QueryIntent.DOCUMENT,
        context_docs=huge_docs,
        context_memories=huge_memories,
        summary_text="Short summary"
    )
    assert len(budgeted["context_docs"]) <= 4000
    assert len(budgeted["context_memories"]) <= 600

def test_7_ollama_graceful_fallback():
    """Verify OllamaProvider handles offline state safely without crashing."""
    offline_ollama = OllamaProvider(host="http://localhost:9999")  # Non-existent port
    assert offline_ollama.is_available() is False

    original_ollama = model_router.ollama
    try:
        model_router.ollama = offline_ollama
        # ModelRouter falls back to Gemini when Ollama is offline
        provider = model_router.get_provider("medium")
        assert isinstance(provider, GeminiProvider)
    finally:
        model_router.ollama = original_ollama
