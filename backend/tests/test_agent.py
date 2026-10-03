from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_agent_chat_and_tools():
    # Chat message asking skills
    chat_res = client.post("/api/v1/chat", json={
        "content": "What are my skills?",
        "timezone": "Asia/Kolkata"
    })
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "response" in data
    assert "conversation_id" in data

    # Daily activity query
    timeline_res = client.post("/api/v1/chat", json={
        "content": "What did I do today?",
        "conversation_id": data["conversation_id"],
        "timezone": "Asia/Kolkata"
    })
    assert timeline_res.status_code == 200
