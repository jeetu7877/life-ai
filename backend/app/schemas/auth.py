from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str
    is_verified: bool = False
    message: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    is_verified: bool = False
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class VerifyEmailRequest(BaseModel):
    token: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResendOtpRequest(BaseModel):
    email: str

class RegisterResponse(BaseModel):
    success: bool = True
    message: str
    email: str
    requires_otp: bool = True
    expires_in_seconds: int = 600
    resend_cooldown_seconds: int = 60

class ResendVerificationRequest(BaseModel):
    email: str

class ChangePasswordRequest(BaseModel):
    old_password: Optional[str] = None
    current_password: Optional[str] = None
    new_password: str

class DeleteAccountRequest(BaseModel):
    password: str
    confirmation_text: Optional[str] = "CONFIRM"

class TestEmailRequest(BaseModel):
    recipient_email: str