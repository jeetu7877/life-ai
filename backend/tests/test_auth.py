import uuid
import hashlib
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.services.email_service import email_service

client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "ok"]
    assert data["companion"] in ["Life", "Jeet"]

def test_otp_generation_and_hashing_unit():
    """Unit test for cryptographically secure 6-digit OTP generation and hashing."""
    raw_otp, otp_hash, expires_at = email_service.generate_otp()
    assert len(raw_otp) == 6
    assert raw_otp.isdigit()
    assert hashlib.sha256(raw_otp.encode("utf-8")).hexdigest() == otp_hash
    # Expires in roughly 10 minutes (between 9 and 11 minutes from now)
    diff = (expires_at - datetime.utcnow()).total_seconds()
    assert 540 <= diff <= 660

def test_registration_and_unverified_login_blocked():
    """User registration produces unverified account; login is strictly blocked with 403."""
    uid = uuid.uuid4().hex[:8]
    email = f"user_{uid}@example.com"
    username = f"user_{uid}"
    password = "SecurePassword123"

    reg_res = client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": "Unverified Test User"
    })
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert data["requires_otp"] is True
    assert "access_token" not in data

    # Confirm user in DB is unverified and inactive
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    assert user is not None
    assert user.is_verified is False
    assert user.is_active is False
    db.close()

    # Attempt login before OTP -> 403 Forbidden
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_res.status_code == 403
    assert "verify" in login_res.json()["detail"].lower()

def test_wrong_otp_and_attempt_limit_lockout():
    """Incorrect OTP increments attempts; 5 failures locks the OTP."""
    uid = uuid.uuid4().hex[:8]
    email = f"lock_{uid}@example.com"
    username = f"lock_{uid}"
    password = "SecurePassword123"

    client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password
    })

    # Test wrong OTP attempt 1
    res1 = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": "000000"
    })
    assert res1.status_code == 400
    assert "attempt" in res1.json()["detail"].lower()

    # Fast forward attempts to 5 in DB
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    user.otp_attempts = 5
    db.commit()
    db.close()

    # Attempt 6 should fail with max attempts exceeded
    locked_res = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": "000000"
    })
    assert locked_res.status_code == 400
    assert "maximum" in locked_res.json()["detail"].lower() or "exceeded" in locked_res.json()["detail"].lower()

def test_otp_expiry():
    """Expired OTP is rejected."""
    uid = uuid.uuid4().hex[:8]
    email = f"expire_{uid}@example.com"
    username = f"expire_{uid}"
    password = "SecurePassword123"

    client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password
    })

    # Set OTP to expired in DB
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    user.otp_expires_at = datetime.utcnow() - timedelta(minutes=5)
    db.commit()
    db.close()

    res = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": "123456"
    })
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

def test_resend_cooldown_rate_limit():
    """Immediate resend is blocked by 60s cooldown (429 Too Many Requests)."""
    uid = uuid.uuid4().hex[:8]
    email = f"rate_{uid}@example.com"
    username = f"rate_{uid}"
    password = "SecurePassword123"

    client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password
    })

    # Immediate resend should return 429
    resend_res = client.post("/api/v1/auth/resend-otp", json={"email": email})
    assert resend_res.status_code == 429
    assert "wait" in resend_res.json()["detail"].lower()

def test_successful_otp_verification_and_login():
    """Valid OTP activates account, returns token, and allows subsequent login."""
    uid = uuid.uuid4().hex[:8]
    email = f"success_{uid}@example.com"
    username = f"success_{uid}"
    password = "SecurePassword123"

    client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password
    })

    # Inject known OTP into DB
    known_otp = "842109"
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    user.otp_code_hash = hashlib.sha256(known_otp.encode("utf-8")).hexdigest()
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    user.otp_attempts = 0
    db.commit()
    db.close()

    # Verify with correct OTP
    verify_res = client.post("/api/v1/auth/verify-otp", json={
        "email": email,
        "otp": known_otp
    })
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["is_verified"] is True
    assert "access_token" in v_data
    token = v_data["access_token"]

    # Test /me with the token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # Test login with credentials succeeds now
    login_res = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

def test_email_send_failure_handled_gracefully():
    """If email service dispatch fails, API returns 500 and pending account is not made ready."""
    uid = uuid.uuid4().hex[:8]
    email = f"fail_{uid}@example.com"
    username = f"fail_{uid}"
    password = "SecurePassword123"

    with patch.object(email_service, "send_otp_email", return_value=(False, "SMTP authentication failed")):
        reg_res = client.post("/api/v1/auth/register", json={
            "email": email,
            "username": username,
            "password": password
        })
        assert reg_res.status_code == 500
        assert "SMTP authentication failed" in reg_res.json()["detail"]
