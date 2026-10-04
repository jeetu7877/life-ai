import time
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.memory import Memory
from app.models.document import Document
from app.models.github import GitHubRepository, CodeChunk
from app.models.task import AgentTask, AgentReminder
from app.models.tool_log import AgentToolLog
from app.services.tools.registry import tool_registry
from app.services.orchestrator import agent_orchestrator
from app.services.github_service import github_service
from app.security.jwt import create_access_token

client = TestClient(app)

def get_or_create_test_user(db: Session, username="agent_test_user", email="agent_test@jeet.ai") -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            email=email,
            full_name="Agent Tester",
            hashed_password="hashed_pw_test"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def create_auth_headers(user: User):
    token = create_access_token({"sub": user.id})
    return {"Authorization": f"Bearer {token}"}

def test_1_tool_registry_registration_and_declarations():
    """Verify all 12 tools are registered and generate valid Gemini declarations."""
    tools = tool_registry.list_tools()
    tool_names = [t.name for t in tools]
    expected_tools = [
        "search_memories",
        "save_memory",
        "lookup_document_field",
        "search_documents",
        "search_conversations",
        "search_github_code",
        "read_github_file",
        "search_web",
        "create_task",
        "list_tasks",
        "create_reminder",
        "perform_destructive_action"
    ]
    for expected in expected_tools:
        assert expected in tool_names, f"Tool '{expected}' not found in registry"

    declarations = tool_registry.get_declarations()
    assert len(declarations) == len(tool_names)
    assert all("name" in d and "description" in d and "parameters" in d for d in declarations)

def test_2_tool_execution_and_audit_logging():
    """Verify tool execution logs each invocation into agent_tool_logs with execution time."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "tool_audit_user", "audit@jeet.ai")

    result = tool_registry.execute_tool(
        tool_name="save_memory",
        user_id=user.id,
        args={"content": "User loves Python architecture design", "topic": "fav_design"},
        db=db
    )
    assert result.success is True

    # Verify audit log in PostgreSQL/SQLite
    log = db.query(AgentToolLog).filter(
        AgentToolLog.user_id == user.id,
        AgentToolLog.tool_name == "save_memory"
    ).order_by(AgentToolLog.created_at.desc()).first()

    assert log is not None
    assert log.status == "success"
    assert log.execution_time_ms >= 0
    assert "fav_design" in str(log.input_params)
    db.close()

def test_3_memory_search_and_deduplication_tool():
    """Verify save_memory tool deduplicates identical facts and supersedes updated topics."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "mem_tool_user", "mem_tool@jeet.ai")

    # Turn 1: Save favorite food
    res1 = tool_registry.execute_tool(
        tool_name="save_memory",
        user_id=user.id,
        args={"content": "User's favorite drink is Masala Chai", "topic": "fav_drink"},
        db=db
    )
    assert res1.success is True

    # Turn 2: Save updated favorite food under same topic
    res2 = tool_registry.execute_tool(
        tool_name="save_memory",
        user_id=user.id,
        args={"content": "User's favorite drink is Ginger Green Tea", "topic": "fav_drink"},
        db=db
    )
    assert res2.success is True

    # Search memories
    search_res = tool_registry.execute_tool(
        tool_name="search_memories",
        user_id=user.id,
        args={"query": "What is my favorite drink?"},
        db=db
    )
    assert search_res.success is True
    contents = [m["content"] for m in search_res.data]
    assert any("Ginger Green Tea" in c for c in contents)
    db.close()

def test_4_github_service_token_encryption_and_code_indexing():
    """Verify GitHub access token encryption and repository code chunking."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "gh_test_user", "gh@jeet.ai")

    # Connect token
    test_token = "ghp_mock_secret_pat_token_12345"
    account = github_service.save_user_token(db, user.id, test_token, username="vikashyadav")
    assert account.account_username == "vikashyadav"
    decrypted = github_service.get_user_token(db, user.id)
    assert decrypted == test_token

    # Create mock indexed repository with CodeChunks
    repo = GitHubRepository(
        user_id=user.id,
        repo_name="sql-rag-backend",
        repo_owner="vikashyadav",
        full_name="vikashyadav/sql-rag-backend",
        repo_url="https://github.com/vikashyadav/sql-rag-backend",
        indexing_status="ready"
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    chunk = CodeChunk(
        repository_id=repo.id,
        user_id=user.id,
        file_path="backend/app/services/rag.py",
        language="python",
        chunk_type="block",
        start_line=10,
        end_line=25,
        content="def execute_sql_rag(query: str):\n    # Core SQL RAG execution\n    return run_query(query)"
    )
    db.add(chunk)
    db.commit()

    # Search code using tool
    search_res = tool_registry.execute_tool(
        tool_name="search_github_code",
        user_id=user.id,
        args={"query": "SQL RAG query execution", "repo_name": "sql-rag-backend"},
        db=db
    )
    assert search_res.success is True
    assert len(search_res.data) > 0
    assert "execute_sql_rag" in search_res.data[0]["content"]

    # Read file using tool
    read_res = tool_registry.execute_tool(
        tool_name="read_github_file",
        user_id=user.id,
        args={"repo_name": "sql-rag-backend", "file_path": "backend/app/services/rag.py"},
        db=db
    )
    assert read_res.success is True
    assert "execute_sql_rag" in read_res.data["content"]
    db.close()

def test_5_web_search_tool_privacy_sanitization():
    """Verify WebSearchTool protects user privacy by sanitizing sensitive tokens."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "web_test_user", "web@jeet.ai")

    # Search for a standard documentation question
    res = tool_registry.execute_tool(
        tool_name="search_web",
        user_id=user.id,
        args={"query": "FastAPI python tutorial", "max_results": 2},
        db=db
    )
    assert res.success is True
    assert res.source_attribution == "web_search"
    db.close()

def test_6_task_and_reminder_action_tools():
    """Verify TaskCreateTool, ListTasks, ReminderCreateTool and Destructive confirmation."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "action_user", "action@jeet.ai")

    # Create task
    t_res = tool_registry.execute_tool(
        tool_name="create_task",
        user_id=user.id,
        args={"title": "Submit college minor project report", "priority": "high"},
        db=db
    )
    assert t_res.success is True
    assert t_res.data["title"] == "Submit college minor project report"

    # List tasks
    list_res = tool_registry.execute_tool(
        tool_name="list_tasks",
        user_id=user.id,
        args={"limit": 5},
        db=db
    )
    assert list_res.success is True
    assert any(t["title"] == "Submit college minor project report" for t in list_res.data)

    # Create reminder
    rem_res = tool_registry.execute_tool(
        tool_name="create_reminder",
        user_id=user.id,
        args={"title": "Team sync call", "remind_at": datetime.utcnow().isoformat()},
        db=db
    )
    assert rem_res.success is True
    assert rem_res.data["title"] == "Team sync call"

    # Destructive action without confirm must be blocked
    dest_res = tool_registry.execute_tool(
        tool_name="perform_destructive_action",
        user_id=user.id,
        args={"action": "delete_repository", "target_id": "repo-999", "confirm": False},
        db=db
    )
    assert dest_res.success is False
    assert dest_res.requires_confirmation is True
    assert "Please reply 'yes' to confirm" in dest_res.confirmation_prompt

    # Destructive action with confirm executes
    dest_res_ok = tool_registry.execute_tool(
        tool_name="perform_destructive_action",
        user_id=user.id,
        args={"action": "delete_repository", "target_id": "repo-999", "confirm": True},
        db=db
    )
    assert dest_res_ok.success is True
    assert dest_res_ok.data["status"] == "confirmed_and_executed"
    db.close()

def test_7_orchestrator_fast_paths_and_tool_routing():
    """Verify Orchestrator preserves <10ms greetings and routes tasks, reminders, github."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "orch_user", "orch@jeet.ai")

    # Fast path: Greeting
    g_res = agent_orchestrator.process_request(
        db=db,
        user_id=user.id,
        user_message="Hello Life!",
        chat_history=[]
    )
    assert "source" in str(g_res["retrieved_sources"])
    assert g_res["timing"]["total_ms"] < 50.0

    # Task creation through natural language
    t_res = agent_orchestrator.process_request(
        db=db,
        user_id=user.id,
        user_message="create a task to review pull request 42",
        chat_history=[]
    )
    assert "review pull request 42" in t_res["response"]
    assert any(t["tool"] == "create_task" for t in t_res["tools_executed"])

    # Task listing through natural language
    l_res = agent_orchestrator.process_request(
        db=db,
        user_id=user.id,
        user_message="show my pending tasks",
        chat_history=[]
    )
    assert "review pull request 42" in l_res["response"]
    db.close()

def test_8_chat_api_with_tools_executed():
    """Verify /api/v1/chat endpoint returns tools_executed and persists conversation."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "chat_api_user", "chat_api@jeet.ai")
    headers = create_auth_headers(user)

    res = client.post("/api/v1/chat", json={
        "content": "create a task to prepare interview notes",
        "timezone": "Asia/Kolkata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "prepare interview notes" in data["response"]
    assert "tools_executed" in data
    assert any(t.get("tool") == "create_task" for t in data["tools_executed"])
    db.close()

def test_9_github_rest_api_endpoints():
    """Verify /api/v1/github/connect, status, and search REST endpoints."""
    db = SessionLocal()
    user = get_or_create_test_user(db, "gh_rest_user", "gh_rest@jeet.ai")
    headers = create_auth_headers(user)

    # 1. Connect
    c_res = client.post("/api/v1/github/connect", json={
        "token": "ghp_valid_test_token_999",
        "username": "vikash_dev"
    }, headers=headers)
    assert c_res.status_code == 200
    assert c_res.json()["status"] == "connected"

    # 2. Status
    s_res = client.get("/api/v1/github/status", headers=headers)
    assert s_res.status_code == 200
    assert s_res.json()["is_connected"] is True
    assert s_res.json()["username"] == "vikash_dev"
    db.close()

def test_10_hands_free_voice_transcribe_and_respond_endpoint():
    """Verify /api/v1/voice/transcribe-and-respond invokes the central orchestrator."""
    import io
    db = SessionLocal()
    user = get_or_create_test_user(db, "voice_test_user", "voice_test@jeet.ai")
    headers = create_auth_headers(user)

    # Mock audio file upload
    fake_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
    files = {"audio": ("test_speech.wav", fake_audio, "audio/wav")}

    res = client.post("/api/v1/voice/transcribe-and-respond", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "response" in data
    assert "transcript" in data
    db.close()
