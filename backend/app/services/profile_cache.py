import time
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.profile import PersonalProfile

logger = logging.getLogger("life.profile_cache")

class ProfileCache:
    """
    High-Speed In-Process Profile Cache:
    Caches structured profile data with TTL to avoid redundant SQL queries on every message turn.
    Maintains zero latency overhead while guaranteeing database is the source of truth.
    """
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get_profile_dict(self, db: Session, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve profile as dict from cache or database."""
        now = time.time()
        cached = self._cache.get(user_id)
        if cached and cached.get("expires_at", 0) > now:
            return cached.get("data")

        # Cache miss or expired: fetch from DB
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        if not profile:
            return None

        data = {
            "name": profile.name,
            "preferred_name": profile.preferred_name,
            "college": profile.college,
            "education": profile.education,
            "degree": profile.degree,
            "branch": profile.branch,
            "skills": profile.skills or [],
            "projects": profile.projects or [],
            "goals": profile.goals or [],
            "interests": profile.interests or [],
            "preferences": profile.preferences or {},
            "current_focus": profile.current_focus
        }
        self._cache[user_id] = {
            "data": data,
            "expires_at": now + self.ttl
        }
        return data

    def invalidate(self, user_id: str):
        """Immediately evict user profile from cache on update."""
        self._cache.pop(user_id, None)

profile_cache = ProfileCache(ttl_seconds=300)
