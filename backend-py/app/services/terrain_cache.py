"""Redis caching for terrain profiles and tile responses."""

import json
import hashlib
from typing import Optional, Any, Dict
from functools import wraps

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

from app.config import get_settings


class TerrainCache:
    """Redis-based cache for terrain data with versioned keys."""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._enabled = False
    
    def _get_client(self) -> Optional[redis.Redis]:
        if not REDIS_AVAILABLE:
            return None
        if self._client is None:
            try:
                settings = get_settings()
                if settings.redis_url:
                    self._client = redis.from_url(
                        settings.redis_url,
                        decode_responses=True,
                        socket_connect_timeout=2,
                        socket_timeout=2,
                    )
                    # Test connection
                    self._client.ping()
                    self._enabled = True
            except Exception:
                self._enabled = False
                self._client = None
        return self._client if self._enabled else None
    
    def _make_key(self, prefix: str, *parts, version: str = "v1") -> str:
        """Create a versioned cache key."""
        key_data = ":".join(str(p) for p in parts)
        # Hash long keys
        if len(key_data) > 100:
            key_data = hashlib.sha256(key_data.encode()).hexdigest()[:32]
        return f"terrain:{version}:{prefix}:{key_data}"
    
    def get(self, prefix: str, *parts, version: str = "v1") -> Optional[Any]:
        """Get value from cache."""
        client = self._get_client()
        if not client:
            return None
        try:
            key = self._make_key(prefix, *parts, version=version)
            data = client.get(key)
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None
    
    def set(self, prefix: str, value: Any, *parts, version: str = "v1", ttl: int = 3600) -> bool:
        """Set value in cache with TTL."""
        client = self._get_client()
        if not client:
            return False
        try:
            key = self._make_key(prefix, *parts, version=version)
            client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception:
            return False
    
    def delete(self, prefix: str, *parts, version: str = "v1") -> bool:
        """Delete cache key."""
        client = self._get_client()
        if not client:
            return False
        try:
            key = self._make_key(prefix, *parts, version=version)
            client.delete(key)
            return True
        except Exception:
            return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern."""
        client = self._get_client()
        if not client:
            return 0
        try:
            full_pattern = f"terrain:*{pattern}*"
            keys = client.keys(full_pattern)
            if keys:
                return client.delete(*keys)
        except Exception:
            pass
        return 0


# Global cache instance
terrain_cache = TerrainCache()


def cached_terrain(prefix: str, ttl: int = 3600, version: str = "v1"):
    """Decorator to cache function results."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function arguments
            key_parts = list(args) + [f"{k}={v}" for k, v in sorted(kwargs.items())]
            
            # Try cache first
            cached = terrain_cache.get(prefix, *key_parts, version=version)
            if cached is not None:
                return cached
            
            # Compute and cache
            result = func(*args, **kwargs)
            terrain_cache.set(prefix, result, *key_parts, version=version, ttl=ttl)
            return result
        return wrapper
    return decorator


# Specific cache helpers
def get_parcel_profile_cache(parcel_id: str, data_version: str = "v1") -> Optional[Dict]:
    """Get cached parcel terrain profile."""
    return terrain_cache.get("parcel_profile", parcel_id, version=data_version)


def set_parcel_profile_cache(parcel_id: str, profile: Dict, data_version: str = "v1", ttl: int = 86400) -> bool:
    """Cache parcel terrain profile."""
    return terrain_cache.set("parcel_profile", profile, parcel_id, version=data_version, ttl=ttl)


def get_district_terrain_cache(state_code: str, district: str, dataset: str, data_version: str = "v1") -> Optional[Dict]:
    """Get cached district terrain data."""
    return terrain_cache.get(f"district_{dataset}", state_code, district, version=data_version)


def set_district_terrain_cache(state_code: str, district: str, dataset: str, data: Dict, data_version: str = "v1", ttl: int = 86400) -> bool:
    """Cache district terrain data."""
    return terrain_cache.set(f"district_{dataset}", data, state_code, district, version=data_version, ttl=ttl)


def get_tile_cache(layer: str, z: int, x: int, y: int, params: Dict, data_version: str = "v1") -> Optional[bytes]:
    """Get cached MVT tile."""
    # Tiles are binary, so we use a different approach
    client = terrain_cache._get_client()
    if not client:
        return None
    try:
        param_str = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
        key = terrain_cache._make_key(f"tile_{layer}", z, x, y, param_str, version=data_version)
        return client.get(key)
    except Exception:
        return None


def set_tile_cache(layer: str, z: int, x: int, y: int, params: Dict, data: bytes, data_version: str = "v1", ttl: int = 86400) -> bool:
    """Cache MVT tile."""
    client = terrain_cache._get_client()
    if not client:
        return False
    try:
        param_str = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
        key = terrain_cache._make_key(f"tile_{layer}", z, x, y, param_str, version=data_version)
        client.setex(key, ttl, data)
        return True
    except Exception:
        return False


def invalidate_parcel_profile(parcel_id: str, data_version: str = "v1") -> bool:
    """Invalidate parcel profile cache."""
    return terrain_cache.delete("parcel_profile", parcel_id, version=data_version)


def invalidate_district_terrain(state_code: str, district: str, data_version: str = "v1") -> int:
    """Invalidate all district terrain caches."""
    count = 0
    for dataset in ["roads", "buildings", "landcover", "elevation"]:
        count += terrain_cache.delete(f"district_{dataset}", state_code, district, version=data_version)
    count += terrain_cache.invalidate_pattern(f"tile_*:{state_code}:{district}")
    return count