from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.security.jwt import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        # For seamless single-user local experience, check if there is an active user or create default admin
        user = db.query(User).first()
        if user:
            return user
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

def get_optional_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Returns the current user, or defaults to the first user for local voice / fast test flow."""
    import time
    t_auth_start = time.perf_counter()
    if token:
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user._auth_ms = round((time.perf_counter() - t_auth_start) * 1000, 2)
                return user
    
    # Return first active user if present, or create demo user
    user = db.query(User).first()
    if not user:
        from app.security.jwt import get_password_hash
        user = User(
            email="user@jeet.ai",
            username="jeet_user",
            full_name="Vikash Yadav",
            hashed_password=get_password_hash("jeet123")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Also create initial profile
        from app.models.profile import PersonalProfile
        profile = PersonalProfile(
            user_id=user.id,
            name="Vikash Yadav",
            preferred_name="Vikash",
            skills=["Python", "FastAPI", "React", "Node.js", "ChromaDB", "SQL RAG"]
        )
        db.add(profile)
        db.commit()

    user._auth_ms = round((time.perf_counter() - t_auth_start) * 1000, 2)
    return user
