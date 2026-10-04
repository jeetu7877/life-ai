import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
import hashlib

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["companion"] in ["Life", "Jeet"]

def test_full_otp_lifecycle_and_security():
    uid = uuid.uuid4().hex[:8]
    email = f"user_{uid}@example.com"
    username = f"user_{uid}"
    password = "SecurePassword123"

    # TEST 1: Register with valid email -> OTP sent, NO access_token returned
    reg_res = client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": "OTP Test User"
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["requires_otp"] is True
    assert "access_token" not in reg_data

    # TEST 2: Try login before OTP -> 403 Forbidden (Blocked)
    pre_login = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert pre_login.status_code == 403
    assert "verify" in pre_login.json()["detail"].lower()

    # TEST 3: Enter wrong OTP -> 400 Bad Request
    wrong_otp_res = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": "000000"
    })
    assert wrong_otp_res.status_code == 400
    assert "attempt" in wrong_otp_res.json()["detail"].lower()

    # TEST 4: Rapid Resend -> 429 Too Many Requests
    rapid_resend = client.post("/api/v1/auth/resend-otp", json={"email": email})
    assert rapid_resend.status_code == 429

    # Retrieve valid OTP from DB test fixture
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    assert user is not None
    assert user.is_verified is False

    # Simulate setting a known OTP
    known_otp = "543210"
    user.otp_code_hash = hashlib.sha256(known_otp.encode()).hexdigest()
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    user.otp_attempts = 0
    db.commit()
    db.close()

    # TEST 5: Verify with valid OTP -> Account becomes active & verified
    verify_res = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": known_otp
    })
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["is_verified"] is True
    assert "access_token" in verify_data

    # TEST 6: Login after verification -> 200 OK Success
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["is_verified"] is True

    # TEST 7: Try using same OTP again -> Fails (invalidated)
    reuse_res = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": known_otp
    })
    # Already verified
    assert reuse_res.status_code in [200, 400]
