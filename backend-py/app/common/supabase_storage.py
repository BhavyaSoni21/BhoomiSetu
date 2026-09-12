"""Ported from backend/src/common/supabase-storage.ts.

Object storage for every generated/uploaded image this app persists
(historical-imagery snapshots, seeded parcel documents, citizen-submitted
workflow evidence). Same "unset config degrades gracefully" shape as
Groq/TextBee/email - but inverted: image storage isn't optional, so the
fallback is local disk (the old, zero-config behavior) rather than a
disabled feature. Lets `pytest`/local dev work with no setup at all, and a
real hosted deployment opt into durable storage by setting SUPABASE_URL +
SUPABASE_SECRET_KEY.
"""

import os
from pathlib import Path

from supabase import Client, create_client

# One bucket, one prefix per upload kind (mirrors the old uploads/<kind>/
# folder layout) rather than three buckets.
_BUCKET = "bhoomisetu-uploads"

_LOCAL_FALLBACK_DIR = Path.cwd() / "uploads"

_client: Client | None = None


def _is_storage_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SECRET_KEY"))


def _get_client() -> Client:
    global _client
    if _client is not None:
        return _client
    # The secret key must never reach the frontend - it bypasses Row Level
    # Security entirely. Only ever read from the backend's own process env.
    _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
    return _client


def ensure_storage_bucket_exists() -> None:
    """Idempotent - safe to call on every backend-py startup. A no-op when
    storage isn't configured (local-disk fallback needs no bucket). Bucket
    is private: every read is proxied through this app's own routes so the
    existing per-document/per-workflow access checks keep applying exactly
    as they did when these were local files.
    """
    if not _is_storage_configured():
        return
    supabase = _get_client()
    buckets = supabase.storage.list_buckets()
    if any(b.name == _BUCKET for b in buckets):
        return
    try:
        supabase.storage.create_bucket(_BUCKET, options={"public": False})
    except Exception as error:  # noqa: BLE001
        # A concurrent seed/startup racing to create the same bucket is fine
        # to ignore; any other failure (bad key, no permission) should surface.
        if "already exists" not in str(error).lower():
            raise RuntimeError(f"Failed to create Supabase Storage bucket '{_BUCKET}': {error}") from error


def _resolve_local_path(key: str) -> Path:
    """`key` is normally a relative object path, e.g.
    'cluster-snapshots/pune-cluster-1-2026.png' - stored verbatim in the
    owning entity's file_path/image_path column, same shape whether it
    resolves to a Supabase Storage object or a local file. An already-
    absolute path is read/written as-is instead of joined under
    _LOCAL_FALLBACK_DIR - some test fixtures seed a row pointing straight
    at a real file elsewhere on disk without going through upload_to_storage
    first.

    A relative key, though, can come indirectly from client-controlled
    input, so it's joined and then re-checked: a crafted '../' segment that
    walks the result back outside _LOCAL_FALLBACK_DIR is rejected rather
    than silently followed.
    """
    candidate = Path(key)
    if candidate.is_absolute():
        return candidate
    resolved = (_LOCAL_FALLBACK_DIR / key).resolve()
    fallback_resolved = _LOCAL_FALLBACK_DIR.resolve()
    if resolved != fallback_resolved and fallback_resolved not in resolved.parents:
        raise RuntimeError(f"Refusing to resolve storage key outside the local fallback directory: {key}")
    return resolved


def upload_to_storage(key: str, data: bytes, content_type: str) -> None:
    if not _is_storage_configured():
        local_path = _resolve_local_path(key)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(data)
        return
    supabase = _get_client()
    try:
        supabase.storage.from_(_BUCKET).upload(
            key, data, file_options={"content-type": content_type, "upsert": "true"}
        )
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"Failed to upload '{key}' to Supabase Storage: {error}") from error


def download_from_storage(key: str) -> bytes:
    if not _is_storage_configured():
        return _resolve_local_path(key).read_bytes()
    supabase = _get_client()
    try:
        return supabase.storage.from_(_BUCKET).download(key)
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"Failed to download '{key}' from Supabase Storage: {error}") from error
