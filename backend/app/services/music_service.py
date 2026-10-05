"""
Backend Music Service for Life AI
Coordinates music providers, caching, rate-limiting, and search normalization.
"""

import time
import logging
from typing import List, Dict, Any, Optional

from app.services.music_provider import BaseMusicProvider, YouTubeMusicProvider
from app.services.cache_service import cache_service

logger = logging.getLogger("life.music_service")


class MusicService:
    """
    Central backend music controller and search coordinator.
    """

    def __init__(self, default_provider: Optional[BaseMusicProvider] = None):
        self.provider: BaseMusicProvider = default_provider or YouTubeMusicProvider()
        # Rate limiting: client_id -> list of timestamps
        self._rate_limits: Dict[str, List[float]] = {}
        self.RATE_LIMIT_MAX = 35
        self.RATE_LIMIT_WINDOW = 60.0

    def _is_rate_limited(self, client_id: str) -> bool:
        now = time.time()
        timestamps = self._rate_limits.get(client_id, [])
        # Keep timestamps within window
        valid = [t for t in timestamps if now - t < self.RATE_LIMIT_WINDOW]
        if len(valid) >= self.RATE_LIMIT_MAX:
            self._rate_limits[client_id] = valid
            return True
        valid.append(now)
        self._rate_limits[client_id] = valid
        return False

    async def search(self, query: str, client_id: str = "anon", limit: int = 10) -> Dict[str, Any]:
        """
        Search for songs across the active music provider with in-memory caching and rate-limiting.
        """
        clean_q = query.strip()
        if not clean_q:
            return {
                "success": True,
                "provider": self.provider.name,
                "query": "",
                "results": []
            }

        if self._is_rate_limited(client_id):
            logger.warning(f"[MUSIC_ERROR] Rate limit exceeded for client: {client_id}")
            return {
                "success": False,
                "error": "Too many music searches. Please wait a moment.",
                "provider": self.provider.name,
                "query": clean_q,
                "results": []
            }

        cache_key = f"music:search:{self.provider.name}:{clean_q.lower()}"
        cached = cache_service.l1.get(cache_key)
        if cached is not None:
            logger.info(f"[MUSIC_SEARCH] Cache HIT for query='{clean_q}' (items={len(cached)})")
            return {
                "success": True,
                "provider": self.provider.name,
                "query": clean_q,
                "results": cached
            }

        logger.info(f"[MUSIC] command received query='{clean_q}'")
        try:
            results = await self.provider.search(clean_q, limit=limit)
            logger.info(f"[MUSIC_SEARCH] provider={self.provider.name} results={len(results)}")
            # Cache results for 180 seconds
            cache_service.l1.set(cache_key, results, ttl_seconds=180)
            return {
                "success": True,
                "provider": self.provider.name,
                "query": clean_q,
                "results": results
            }
        except Exception as e:
            logger.error(f"[MUSIC_ERROR] Search failure for query '{clean_q}': {e}", exc_info=True)
            return {
                "success": False,
                "error": "Music service is temporarily unavailable.",
                "provider": self.provider.name,
                "query": clean_q,
                "results": []
            }

    async def get_track(self, track_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single track details."""
        cache_key = f"music:track:{self.provider.name}:{track_id}"
        cached = cache_service.l1.get(cache_key)
        if cached:
            return cached

        track = await self.provider.get_track_details(track_id)
        if track:
            cache_service.l1.set(cache_key, track, ttl_seconds=600)
        return track


music_backend_service = MusicService()
