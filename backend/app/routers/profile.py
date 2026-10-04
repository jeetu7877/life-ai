import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Tuple, List

from app.database import get_db
from app.models.user import User
from app.models.profile import PersonalProfile
from app.schemas.profile import ProfileUpdate, ProfileResponse
from app.security.dependencies import get_optional_user
from app.config import settings

router = APIRouter(prefix="/profile", tags=["Personal Profile"])

def calculate_completion(profile: PersonalProfile) -> Tuple[int, List[str]]:
    """Calculates profile completion percentage and lists missing attributes."""
    checks = [
        ("Full Name", bool(profile.name)),
        ("College / Institution", bool(profile.college)),
        ("Branch / Discipline", bool(profile.branch)),
        ("Skills", bool(profile.skills and len(profile.skills) > 0)),
        ("Bio", bool(getattr(profile, "bio", None))),
        ("Profile Photo", bool(getattr(profile, "avatar_url", None))),
        ("Graduation Batch", bool(getattr(profile, "batch", None))),
    ]
    completed_count = sum(1 for _, ok in checks if ok)
    percentage = int((completed_count / len(checks)) * 100)
    missing = [label for label, ok in checks if not ok]
    return percentage, missing

def enrich_profile_response(profile: PersonalProfile, user: User) -> ProfileResponse:
    pct, missing = calculate_completion(profile)
    res = ProfileResponse.model_validate(profile)
    res.is_verified = bool(getattr(user, "is_verified", False))
    res.completion_percentage = pct
    res.missing_fields = missing
    return res

@router.get("", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(
            user_id=user.id,
            name=user.full_name or user.username,
            preferred_name=user.username,
            avatar_url=getattr(user, "avatar_url", None)
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return enrich_profile_response(profile, user)

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

    # If avatar_url was updated, sync to user model as well
    if "avatar_url" in update_data:
        user.avatar_url = update_data["avatar_url"]

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    from app.services.profile_cache import profile_cache
    profile_cache.invalidate(user.id)
    return enrich_profile_response(profile, user)

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """
    Upload and set personal profile photo with size and MIME validation.
    """
    valid_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPEG, PNG, WEBP."
        )

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5 MB max
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile photo exceeds maximum size limit of 5 MB."
        )

    avatar_dir = os.path.join(settings.UPLOAD_DIRECTORY, "avatars")
    os.makedirs(avatar_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    filename = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(avatar_dir, filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    avatar_url = f"/uploads/avatars/{filename}"

    # Update both profile and user models
    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if not profile:
        profile = PersonalProfile(user_id=user.id, name=user.full_name or user.username)
        db.add(profile)

    profile.avatar_url = avatar_url
    user.avatar_url = avatar_url
    db.commit()
    db.refresh(profile)

    from app.services.profile_cache import profile_cache
    profile_cache.invalidate(user.id)

    pct, missing = calculate_completion(profile)
    return {
        "success": True,
        "avatar_url": avatar_url,
        "completion_percentage": pct,
        "missing_fields": missing,
        "message": "Profile photo updated successfully."
    }

@router.delete("/avatar")
def remove_avatar(
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """
    Removes personal profile avatar and cleans up file if stored locally.
    """
    profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user.id).first()
    if profile and profile.avatar_url:
        # Check if local file exists
        local_path = profile.avatar_url.replace("/uploads/", "")
        disk_path = os.path.join(settings.UPLOAD_DIRECTORY, local_path)
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except Exception:
                pass
        profile.avatar_url = None

    user.avatar_url = None
    db.commit()

    from app.services.profile_cache import profile_cache
    profile_cache.invalidate(user.id)

    return {"success": True, "message": "Profile photo removed."}
