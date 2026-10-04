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
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str
    is_verified: bool = False
    message: Optional[str] = None

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

class ResendVerificationRequest(BaseModel):
    email: str

class ChangePasswordRequest(BaseModel):
    old_password: Optional[str] = None
    current_password: Optional[str] = None
    new_password: str

class DeleteAccountRequest(BaseModel):
    password: str
    confirmation_text: Optional[str] = "CONFIRM"