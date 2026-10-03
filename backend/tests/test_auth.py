from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["companion"] == "Jeet"

def test_register_and_login():
    email = "testuser@jeet.ai"
    username = "testuser"
    password = "SecurePassword123"

    # Register
    reg_res = client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": "Test User"
    })
    # Either 200 or 400 if already exists from prior run
    assert reg_res.status_code in [200, 400]

    # Login
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
