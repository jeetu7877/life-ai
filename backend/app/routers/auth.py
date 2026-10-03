from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse
from app.security.jwt import get_password_hash, verify_password, create_access_token
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # Check existing email/username
    if db.query(User).filter((User.email == user_in.email) | (User.username == user_in.username)).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    new_user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name or user_in.username,
        hashed_password=get_password_hash(user_in.password)
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

    token = create_access_token({"sub": new_user.id})
    return TokenResponse(
        access_token=token,
        user_id=new_user.id,
        username=new_user.username,
        email=new_user.email
    )

@router.post("/login", response_model=TokenResponse)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == login_in.username_or_email) | (User.email == login_in.username_or_email)
    ).first()

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password"
        )

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
