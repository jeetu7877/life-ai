import time
import re
import hashlib
import logging
import threading
from typing import Any, Optional, Dict, Tuple, List

logger = logging.getLogger("life.cache")

class L1MemoryCache:
    """
    High-performance thread-safe in-memory cache with per-key TTL,
    strict user isolation scoping, and LRU eviction.
    """
    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self._cache: Dict[str, Tuple[Any, float]] = {}  # key -> (value, expire_timestamp)
        self._lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            val, expire_at = entry
            if time.time() > expire_at:
                del self._cache[key]
                return None
            return val

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        with self._lock:
            # Simple eviction if cache is full
            if len(self._cache) >= self.max_size:
                now = time.time()
                # Purge expired entries first
                expired_keys = [k for k, (_, exp) in self._cache.items() if now > exp]
                for k in expired_keys:
                    del self._cache[k]
                # If still full, pop 10% oldest items
                if len(self._cache) >= self.max_size:
                    for k in list(self._cache.keys())[:int(self.max_size * 0.1)]:
                        del self._cache[k]

            self._cache[key] = (value, time.time() + ttl_seconds)

    def delete(self, key: str):
        with self._lock:
            self._cache.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Invalidate all keys matching prefix (e.g. user:{user_id}:)"""
        with self._lock:
            keys_to_del = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys_to_del:
                del self._cache[k]
            if keys_to_del:
                logger.debug(f"[Cache L1] Evicted {len(keys_to_del)} keys matching prefix: {prefix}")

    def clear(self):
        with self._lock:
            self._cache.clear()

class CacheService:
    """
    Unified 3-Level Cache & Semantic Response Cache System:
    Level 1: Fast In-process memory (thread-safe, TTL, LRU)
    Level 2: Redis (optional plug-in if redis-py and REDIS_URL present)
    Level 3: Persistent PostgreSQL / Chroma DB (source of truth)

    Enforces strict user isolation:
    Cache keys are ALWAYS prefixed with `user:{user_id}:`
    """
    def __init__(self):
        self.l1 = L1MemoryCache(max_size=5000)
        self._redis_client = None
        self._redis_available = False
        self._init_redis()

        # Semantic cache: user_id -> List[{query_norm, answer, metadata, timestamp}]
        self._semantic_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._semantic_lock = threading.RLock()

    def _init_redis(self):
        """Try connecting to Redis if configured in environment."""
        import os
        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            return
        try:
            import redis
            self._redis_client = redis.from_url(redis_url, decode_responses=True, socket_timeout=1.0)
            self._redis_client.ping()
            self._redis_available = True
            logger.info("Level 2 Redis cache connected successfully.")
        except Exception as e:
            logger.warning(f"Redis cache not available ({e}). Seamlessly using Level 1 in-process cache.")
            self._redis_available = False

    def _format_key(self, user_id: str, namespace: str, key_suffix: str) -> str:
        return f"user:{user_id}:{namespace}:{key_suffix}"

    # ---------------- Generic Get / Set ----------------
    def get(self, user_id: str, namespace: str, key_suffix: str) -> Optional[Any]:
        cache_key = self._format_key(user_id, namespace, key_suffix)
        
        # 1. L1 Memory
        val = self.l1.get(cache_key)
        if val is not None:
            return val

        # 2. L2 Redis
        if self._redis_available and self._redis_client:
            try:
                import json
                r_val = self._redis_client.get(cache_key)
                if r_val:
                    parsed = json.loads(r_val)
                    # Warm L1
                    self.l1.set(cache_key, parsed, ttl_seconds=120)
                    return parsed
            except Exception as e:
                logger.debug(f"Redis get note: {e}")

        return None

    def set(self, user_id: str, namespace: str, key_suffix: str, value: Any, ttl_seconds: int = 300):
        cache_key = self._format_key(user_id, namespace, key_suffix)
        
        # 1. Set L1
        self.l1.set(cache_key, value, ttl_seconds=ttl_seconds)

        # 2. Set L2 Redis if available
        if self._redis_available and self._redis_client:
            try:
                import json
                self._redis_client.setex(cache_key, ttl_seconds, json.dumps(value))
            except Exception as e:
                logger.debug(f"Redis set note: {e}")

    # ---------------- Invalidation ----------------
    def invalidate_user(self, user_id: str):
        prefix = f"user:{user_id}:"
        self.l1.invalidate_prefix(prefix)
        if self._redis_available and self._redis_client:
            try:
                for k in self._redis_client.scan_iter(f"{prefix}*"):
                    self._redis_client.delete(k)
            except Exception:
                pass
        with self._semantic_lock:
            self._semantic_cache.pop(user_id, None)

    def invalidate_user_profile(self, user_id: str):
        self.l1.invalidate_prefix(f"user:{user_id}:profile:")
        with self._semantic_lock:
            self._semantic_cache.pop(user_id, None)

    def invalidate_user_memories(self, user_id: str):
        self.l1.invalidate_prefix(f"user:{user_id}:memory:")
        with self._semantic_lock:
            self._semantic_cache.pop(user_id, None)

    def invalidate_user_documents(self, user_id: str):
        self.l1.invalidate_prefix(f"user:{user_id}:document:")

    # ---------------- Semantic Cache ----------------
    def normalize_query(self, query: str) -> str:
        q = query.lower().strip()
        q = re.sub(r'[^\w\s]', '', q)
        return ' '.join(q.split())

    def get_semantic_response(self, user_id: str, query: str) -> Optional[Dict[str, Any]]:
        """
        Check for an exact or high-confidence semantic match for user's previous deterministic query.
        Returns cached response dict or None.
        """
        norm_q = self.normalize_query(query)
        if not norm_q:
            return None

        with self._semantic_lock:
            user_entries = self._semantic_cache.get(user_id, [])
            now = time.time()
            for entry in user_entries:
                if now - entry["timestamp"] > 300:  # 5 min TTL
                    continue
                cached_norm = entry["query_norm"]
                # Exact normalized match
                if cached_norm == norm_q:
                    return entry["response_data"]
                # High-confidence phrase containment
                if (norm_q in cached_norm or cached_norm in norm_q) and len(norm_q) > 8 and len(cached_norm) > 8:
                    words1 = set(norm_q.split())
                    words2 = set(cached_norm.split())
                    jaccard = len(words1 & words2) / max(len(words1 | words2), 1)
                    if jaccard >= 0.85:
                        return entry["response_data"]

        return None

    def set_semantic_response(self, user_id: str, query: str, response_data: Dict[str, Any]):
        """Cache response data for deterministic safe queries."""
        norm_q = self.normalize_query(query)
        if not norm_q or len(norm_q) < 4:
            return

        with self._semantic_lock:
            if user_id not in self._semantic_cache:
                self._semantic_cache[user_id] = []
            
            # Prune oldest if over 50 items
            if len(self._semantic_cache[user_id]) >= 50:
                self._semantic_cache[user_id].pop(0)

            self._semantic_cache[user_id].append({
                "query_norm": norm_q,
                "response_data": response_data,
                "timestamp": time.time()
            })

cache_service = CacheService()
