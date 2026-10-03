from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_memory_creation_and_search():
    # Create memory
    res = client.post("/api/v1/memories", json={
        "content": "I am working on SQL RAG architecture",
        "memory_type": "project",
        "importance": 4,
        "confidence": 0.95
    })
    assert res.status_code == 200
    data = res.json()
    assert data["content"] == "I am working on SQL RAG architecture"
    mem_id = data["id"]

    # Search memory
    search_res = client.post("/api/v1/memories/search", json={
        "query": "SQL RAG",
        "limit": 3
    })
    assert search_res.status_code == 200

    # Delete memory
    del_res = client.delete(f"/api/v1/memories/{mem_id}")
    assert del_res.status_code == 200
