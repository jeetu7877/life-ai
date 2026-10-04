import pytest
from fastapi.testclient import TestClient
import io
import time

from app.main import app
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.profile import PersonalProfile
from app.models.conversation import Conversation
from app.services.email_service import email_service

client = TestClient(app)

@pytest.fixture
def auth_client():
    """Register, verify, and login a clean user for complete product system tests."""
    username = f"prod_user_{int(time.time() * 1000)}"
    email = f"{username}@example.com"
    password = "StrongPassword123!"

    reg_resp = client.post("/api/v1/auth/register", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": "Product Test User"
    })
    assert reg_resp.status_code == 200

    # Activate user in DB
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    assert u is not None
    u.is_verified = True
    u.is_active = True
    db.commit()
    db.close()

    # Login to acquire token
    login_resp = client.post("/api/v1/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    return {
        "client": client,
        "headers": headers,
        "username": username,
        "email": email,
        "password": password
    }

def test_registration_and_email_verification():
    """Verify email verification token generation, resend rate limit, and verification."""
    unique_user = f"verify_{int(time.time() * 1000)}"
    email = f"{unique_user}@example.com"
    password = "SecurePassword123!"

    # 1. Register user
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": email,
        "username": unique_user,
        "password": password,
        "full_name": "Verification User"
    })
    assert reg_resp.status_code == 200

    # Retrieve user from DB to obtain token and check initial unverified status
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.is_verified is False
        assert user.verification_token_hash is not None

        # 2. Test invalid token
        invalid_resp = client.post("/api/v1/auth/verify-email", json={"token": "invalid_token_12345"})
        assert invalid_resp.status_code == 400

        # 3. Test resend verification with 60s rate limit
        resend_resp1 = client.post("/api/v1/auth/resend-verification", json={"email": email})
        assert resend_resp1.status_code == 200

        # Immediate second resend should hit 429 rate limit
        resend_resp2 = client.post("/api/v1/auth/resend-verification", json={"email": email})
        assert resend_resp2.status_code == 429

        # Generate a test raw token for this user and hash it into user
        raw_token, token_hash, expires_at = email_service.generate_verification_token()
        user.verification_token_hash = token_hash
        user.verification_token_expires_at = expires_at
        db.commit()

        # 4. Verify with valid token
        verify_resp = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
        assert verify_resp.status_code == 200
        assert verify_resp.json()["user"]["is_verified"] is True

        # Refresh from DB
        db.refresh(user)
        assert user.is_verified is True
        assert user.verification_token_hash is None
    finally:
        db.close()

def test_password_change_flow(auth_client):
    """Verify password change route with current password verification."""
    headers = auth_client["headers"]
    old_pw = auth_client["password"]
    new_pw = "BrandNewPassword456!"

    # 1. Wrong current password -> 400
    fail_resp = client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": "WrongPassword!",
        "new_password": new_pw
    })
    assert fail_resp.status_code == 400

    # 2. Correct current password -> 200
    ok_resp = client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": old_pw,
        "new_password": new_pw
    })
    assert ok_resp.status_code == 200

    # 3. Login with new password
    login_resp = client.post("/api/v1/auth/login", json={
        "username_or_email": auth_client["username"],
        "password": new_pw
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

def test_profile_completion_and_avatar(auth_client):
    """Verify profile retrieval, dynamic completion calculation, avatar upload and deletion."""
    headers = auth_client["headers"]

    # 1. Get profile and verify completion percentage calculation
    p_resp = client.get("/api/v1/profile", headers=headers)
    assert p_resp.status_code == 200
    p_data = p_resp.json()
    assert "completion_percentage" in p_data
    assert "missing_fields" in p_data
    assert isinstance(p_data["completion_percentage"], int)

    # 2. Update extended profile fields
    update_resp = client.patch("/api/v1/profile", headers=headers, json={
        "bio": "AI engineer and full-stack developer",
        "batch": "2024-2028",
        "college": "NIT Jalandhar",
        "branch": "CSE",
        "timezone": "Asia/Kolkata",
        "skills": ["Python", "FastAPI", "React", "TypeScript"]
    })
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["bio"] == "AI engineer and full-stack developer"
    assert updated_data["batch"] == "2024-2028"
    assert updated_data["college"] == "NIT Jalandhar"

    # 3. Avatar upload test
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    avatar_file = io.BytesIO(fake_png)
    upload_resp = client.post(
        "/api/v1/profile/avatar",
        headers=headers,
        files={"file": ("avatar.png", avatar_file, "image/png")}
    )
    assert upload_resp.status_code == 200
    avatar_url = upload_resp.json()["avatar_url"]
    assert avatar_url.startswith("/uploads/avatars/")

    # 4. Avatar removal test
    del_avatar_resp = client.delete("/api/v1/profile/avatar", headers=headers)
    assert del_avatar_resp.status_code == 200
    assert "removed" in del_avatar_resp.json()["message"].lower()

def test_conversation_renaming(auth_client):
    """Verify renaming existing conversation."""
    headers = auth_client["headers"]

    # 1. Start a conversation by sending a message
    chat_resp = client.post("/api/v1/chat", headers=headers, json={
        "content": "Hello Life AI, let's test conversation renaming"
    })
    assert chat_resp.status_code == 200
    conv_id = chat_resp.json()["conversation_id"]

    # 2. Rename conversation
    new_title = "Renamed System Architecture Chat"
    rename_resp = client.patch(f"/api/v1/chat/conversations/{conv_id}", headers=headers, json={
        "title": new_title
    })
    assert rename_resp.status_code == 200
    assert rename_resp.json()["title"] == new_title

    # 3. Verify in conversation list
    list_resp = client.get("/api/v1/chat/conversations", headers=headers)
    assert list_resp.status_code == 200
    matching = [c for c in list_resp.json() if c["id"] == conv_id]
    assert len(matching) == 1
    assert matching[0]["title"] == new_title

def test_data_export_and_account_deletion(auth_client):
    """Verify full data export archive and cascading account wipe."""
    headers = auth_client["headers"]
    password = auth_client["password"]

    # 1. Export Data Archive
    export_resp = client.get("/api/v1/auth/export-data", headers=headers)
    assert export_resp.status_code == 200
    data = export_resp.json()
    assert "user" in data
    assert "profile" in data
    assert "conversations" in data
    assert "memories" in data
    assert "documents" in data

    # 2. Attempt account deletion with incorrect password -> 400
    wrong_del_resp = client.post("/api/v1/auth/account", headers=headers, json={
        "password": "IncorrectPassword!"
    })
    assert wrong_del_resp.status_code == 400

    # 3. Successful account deletion -> 200
    correct_del_resp = client.post("/api/v1/auth/account", headers=headers, json={
        "password": password
    })
    assert correct_del_resp.status_code == 200

    # 4. Confirm user no longer exists
    login_resp = client.post("/api/v1/auth/login", json={
        "username_or_email": auth_client["username"],
        "password": password
    })
    assert login_resp.status_code == 401
