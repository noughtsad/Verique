"""
Redis Cache Manager
"""
import json
import hashlib
from typing import Optional, Any
import redis.asyncio as redis
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class CacheManager:
    """Async Redis cache manager."""
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._enabled = hasattr(settings, 'REDIS_URL') and settings.REDIS_URL is not None
    
    async def connect(self):
        """Connect to Redis."""
        if not self._enabled:
            return
        
        if not self._redis:
            try:
                self._redis = redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
                logger.info("Connected to Redis")
            except Exception as e:
                logger.warning("Redis connection failed, caching disabled", error=str(e))
                self._enabled = False
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("Disconnected from Redis")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self._enabled:
            return None
            
        await self.connect()
        try:
            if self._redis:
                value = await self._redis.get(key)
                if value:
                    return json.loads(value)
            return None
        except Exception as e:
            logger.debug("Cache get error (Redis unavailable)", key=key)
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: int = None
    ) -> bool:
        """Set value in cache."""
        if not self._enabled:
            return False
            
        await self.connect()
        try:
            if self._redis:
                ttl = ttl or settings.CACHE_TTL_SECONDS
                await self._redis.set(
                    key, 
                    json.dumps(value), 
                    ex=ttl
                )
                return True
            return False
        except Exception as e:
            logger.debug("Cache set error (Redis unavailable)", key=key)
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        if not self._enabled:
            return False
            
        await self.connect()
        try:
            if self._redis:
                await self._redis.delete(key)
                return True
            return False
        except Exception as e:
            logger.debug("Cache delete error (Redis unavailable)", key=key)
            return False
    
    @staticmethod
    def generate_content_hash(content: str) -> str:
        """Generate SHA-256 hash of content."""
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def get_cached_verification(self, content_hash: str) -> Optional[dict]:
        """Get cached verification result by content hash."""
        key = f"verification:{content_hash}"
        return await self.get(key)
    
    async def cache_verification(
        self, 
        content_hash: str, 
        result: dict,
        ttl: int = None
    ) -> bool:
        """Cache verification result by content hash."""
        key = f"verification:{content_hash}"
        ttl = ttl or settings.CONTENT_HASH_CACHE_TTL
        return await self.set(key, result, ttl)


# Global cache instance
cache = CacheManager()
