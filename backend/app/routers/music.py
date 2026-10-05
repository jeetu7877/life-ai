"""
Music API Router for Life AI
Provides dynamic search and track metadata resolution via configured providers (e.g. YouTube Data API v3).
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_optional_user
from app.services.music_service import music_backend_service

router = APIRouter(prefix="/music", tags=["Music"])


@router.get("/search")
async def search_music(
    request: Request,
    q: str = Query(..., min_length=1, description="Song title, artist, or music query"),
    limit: int = Query(10, ge=1, le=25, description="Maximum results to return"),
    user: Optional[User] = Depends(get_optional_user)
):
    """
    Dynamically search for songs using the official YouTube Data API provider.
    Supports in-memory caching and rate-limiting to prevent quota exhaustion.
    """
    clean_query = q.strip()
    if not clean_query:
        return {
            "success": True,
            "provider": music_backend_service.provider.name,
            "query": "",
            "results": []
        }

    client_id = f"user_{user.id}" if user else (request.client.host if request.client else "anon")
    result = await music_backend_service.search(query=clean_query, client_id=client_id, limit=limit)
    return result


@router.get("/track/{track_id}")
async def get_track_details(
    track_id: str,
    user: Optional[User] = Depends(get_optional_user)
):
    """Retrieve detailed metadata for a specific track ID."""
    track = await music_backend_service.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return {
        "success": True,
        "track": track
    }
