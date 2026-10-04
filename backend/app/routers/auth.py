import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.models.document import Document
from app.models.memory import Memory
from app.models.conversation import Conversation
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    RegisterResponse,
    VerifyOtpRequest,
    ResendOtpRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    ChangePasswordRequest,
    DeleteAccountRequest
)
from app.security.jwt import get_password_hash, verify_password, create_access_token
from app.security.dependencies import get_current_user
from app.services.email_service import email_service
from app.services.rag_service import rag_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=RegisterResponse)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    clean_email = user_in.email.strip().lower()
    clean_username = user_in.username.strip()

    # Check existing user
    existing_user = db.query(User).filter(
        (User.email == clean_email) | (User.username == clean_username)
    ).first()

    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email or username already exists"
            )
        # Unverified existing registration: refresh OTP
        raw_otp, otp_hash, expires_at = email_service.generate_otp()
        sent, send_msg = email_service.send_otp_email(
            to_email=existing_user.email,
            username=existing_user.username,
            raw_otp=raw_otp
        )
        if not sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=send_msg
            )
        existing_user.otp_code_hash = otp_hash
        existing_user.otp_expires_at = expires_at
        existing_user.otp_attempts = 0
        existing_user.last_otp_sent_at = datetime.utcnow()
        if user_in.password:
            existing_user.hashed_password = get_password_hash(user_in.password)
        db.commit()

        return RegisterResponse(
            success=True,
            message="Verification OTP has been sent to your email. Please verify to activate your account.",
            email=existing_user.email,
            requires_otp=True,
            expires_in_seconds=600,
            resend_cooldown_seconds=60
        )

    # Generate 6-digit numeric OTP and link token
    raw_otp, otp_hash, expires_at = email_service.generate_otp()
    raw_token, token_hash, _ = email_service.generate_verification_token()

    # Attempt to send OTP email first
    sent, send_msg = email_service.send_otp_email(
        to_email=clean_email,
        username=clean_username,
        raw_otp=raw_otp
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=send_msg
        )

    # Create unverified pending user
    new_user = User(
        email=clean_email,
        username=clean_username,
        full_name=user_in.full_name or clean_username,
        hashed_password=get_password_hash(user_in.password),
        is_active=False,
        is_verified=False,
        otp_code_hash=otp_hash,
        otp_expires_at=expires_at,
        otp_attempts=0,
        last_otp_sent_at=datetime.utcnow(),
        verification_token_hash=token_hash,
        verification_token_expires_at=expires_at
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Initialize personal profile
    profile = PersonalProfile(
        user_id=new_user.id,
        name=new_user.full_name,
        preferred_name=new_user.full_name.split()[0] if new_user.full_name else new_user.username
    )
    db.add(profile)
    db.commit()

    return RegisterResponse(
        success=True,
        message="Verification code sent to your email. Please verify OTP to activate your account.",
        email=new_user.email,
        requires_otp=True,
        expires_in_seconds=600,
        resend_cooldown_seconds=60
    )

@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    """
    Verifies 6-digit numeric OTP and activates the account.
    Only after successful OTP verification is a session token issued.
    """
    success, message, user = email_service.verify_otp(
        email=payload.email,
        entered_otp=payload.otp,
        db=db
    )
    if not success or not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
        is_verified=True,
        message="Account verified successfully! Welcome to Life AI."
    )

@router.post("/resend-otp")
def resend_otp(payload: ResendOtpRequest, db: Session = Depends(get_db)):
    """
    Resends 6-digit verification OTP with 60-second rate limiting cooldown.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user:
        # Prevent email enumeration with standard message
        return {
            "success": True,
            "message": "If this email is registered, a new OTP code has been dispatched.",
            "resend_cooldown_seconds": 60
        }

    if user.is_verified:
        return {
            "success": True,
            "message": "Your account is already verified. Please sign in.",
            "is_verified": True
        }

    # Check 60-second cooldown rate limit
    allowed, wait_sec = email_service.check_resend_rate_limit(
        email=user.email,
        last_sent_at=user.last_otp_sent_at
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {wait_sec} seconds before requesting a new OTP."
        )

    raw_otp, otp_hash, expires_at = email_service.generate_otp()
    sent, send_msg = email_service.send_otp_email(
        to_email=user.email,
        username=user.username,
        raw_otp=raw_otp
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=send_msg
        )

    user.otp_code_hash = otp_hash
    user.otp_expires_at = expires_at
    user.otp_attempts = 0
    user.last_otp_sent_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "A new 6-digit verification code has been dispatched to your email.",
        "expires_in_seconds": 600,
        "resend_cooldown_seconds": 60
    }

@router.post("/login", response_model=TokenResponse)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    clean_identifier = login_in.username_or_email.strip()
    user = db.query(User).filter(
        (User.username == clean_identifier) | (User.email == clean_identifier.lower())
    ).first()

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password"
        )

    # Enforce email verification: Unverified users cannot login
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in."
        )

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
        is_verified=True,
        message="Welcome back!"
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    """
    Verifies user email using the token received in the verification link.
    """
    success, message, user = email_service.verify_token(payload.token, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    return {
        "success": True,
        "message": message,
        "user_id": user.id if user else None,
        "email": user.email if user else None,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "is_verified": user.is_verified
        } if user else None
    }

@router.post("/resend-verification")
def resend_verification(
    payload: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resends account verification link with 60-second rate limiting.
    """
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user:
        # Prevent email enumeration by returning a generic success response
        return {"success": True, "message": "If this email is registered, a verification link has been dispatched."}

    if user.is_verified:
        return {"success": True, "message": "Your email address is already verified."}

    allowed, seconds_left = email_service.check_resend_rate_limit(user.email)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {seconds_left} seconds before requesting another verification email."
        )

    raw_token, token_hash, expires_at = email_service.generate_verification_token()
    user.verification_token_hash = token_hash
    user.verification_token_expires_at = expires_at
    db.commit()

    background_tasks.add_task(
        email_service.send_verification_email,
        to_email=user.email,
        username=user.username,
        raw_token=raw_token
    )

    return {"success": True, "message": "Verification link dispatched to your email."}

@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Changes account password with old password verification.
    """
    pwd_to_check = payload.current_password or payload.old_password
    if not pwd_to_check:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required"
        )

    if not verify_password(pwd_to_check, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Password changed successfully."}

@router.delete("/account")
@router.post("/account")
def delete_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently deletes user account and all personal data:
    - Files from filesystem (uploads)
    - Vector embeddings from ChromaDB
    - Relational data across all tables via database cascades
    """
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Account deletion aborted."
        )

    confirm_str = (payload.confirmation_text or "CONFIRM").strip().upper()
    if confirm_str not in ["DELETE MY ACCOUNT", "CONFIRM", "DELETE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text must match 'DELETE MY ACCOUNT' or 'CONFIRM'"
        )

    user_id = current_user.id

    # 1. Delete user files from filesystem
    user_docs = db.query(Document).filter(Document.user_id == user_id).all()
    for doc in user_docs:
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception:
                pass
        # Delete from ChromaDB
        try:
            rag_service.delete_document(doc.id)
        except Exception:
            pass

    # 2. Delete user memories from ChromaDB
    user_memories = db.query(Memory).filter(Memory.user_id == user_id).all()
    for mem in user_memories:
        try:
            rag_service.delete_memory(mem.id)
        except Exception:
            pass

    # 3. Delete user avatar file if present
    if current_user.avatar_url and os.path.exists(current_user.avatar_url):
        try:
            os.remove(current_user.avatar_url)
        except Exception:
            pass

    # 4. Delete user record (cascades to all relational tables)
    db.delete(current_user)
    db.commit()

    return {"success": True, "message": "Account and all associated personal data permanently deleted."}

@router.get("/export-data")
def export_user_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports a comprehensive JSON package of all authenticated user data for portability.
    """
    user_id = current_user.id
    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
    memories = db.query(Memory).filter(Memory.user_id == user_id).all()
    docs = db.query(Document).filter(Document.user_id == user_id).all()

    from app.services.life_twin_service import life_twin_service
    twin_state = life_twin_service.compute_current_state(db, user_id)

    export_payload = {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_verified": current_user.is_verified,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "profile": {
            "name": profile.name if profile else None,
            "college": profile.college if profile else None,
            "branch": profile.branch if profile else None,
            "skills": profile.skills if profile else [],
            "interests": profile.interests if profile else [],
            "preferences": profile.preferences if profile else {}
        } if profile else {},
        "memories": [
            {
                "id": m.id,
                "content": m.content,
                "category": m.memory_type,
                "importance": m.importance,
                "confidence": m.confidence,
                "created_at": m.created_at.isoformat() if m.created_at else None
            } for m in memories
        ],
        "documents": [
            {
                "id": d.id,
                "filename": d.original_filename,
                "category": d.category,
                "file_size": d.file_size,
                "extracted_fields": d.structured_fields,
                "created_at": d.created_at.isoformat() if d.created_at else None
            } for d in docs
        ],
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "created_at": c.created_at.isoformat() if c.created_at else None
            } for c in db.query(Conversation).filter(Conversation.user_id == user_id).all()
        ],
        "life_twin_analytical_model": twin_state,
        "exported_at": datetime.utcnow().isoformat()
    }

    return export_payload
