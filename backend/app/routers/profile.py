from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.schemas.profile import ProfileUpdate, ProfileResponse
from app.security.dependencies import get_optional_user

router = APIRouter(prefix="/profile", tags=["Personal Profile"])

@router.get("", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(
            user_id=user.id,
            name=user.full_name or user.username,
            preferred_name=user.username
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.patch("", response_model=ProfileResponse)
def update_profile(
    profile_in: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(user_id=user.id)
        db.add(profile)

    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile
