"""
Image uploads to Supabase Storage (post images and avatars).

Uploads go through the backend so the service-role key never reaches the browser.
The bucket must be public: the returned URL is stored on the post or user and shown
directly by the frontend.
"""
from __future__ import annotations

import uuid
from typing import Optional

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Detected from the file's first bytes, not from the client's content type or name.
_SIGNATURES: list[tuple[bytes, str, str]] = [
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
]


class StorageNotConfiguredError(RuntimeError):
    """Supabase Storage settings are missing."""


class InvalidUploadError(ValueError):
    """The upload is not an accepted image or is too large."""


def _detect_image(data: bytes) -> tuple[str, str]:
    for magic, content_type, ext in _SIGNATURES:
        if data.startswith(magic):
            return content_type, ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    raise InvalidUploadError("Only JPEG, PNG, GIF and WebP images can be uploaded")


def public_url_prefix() -> Optional[str]:
    if not settings.SUPABASE_URL:
        return None
    base = settings.SUPABASE_URL.rstrip("/")
    return f"{base}/storage/v1/object/public/{settings.SUPABASE_STORAGE_BUCKET}/"


def is_own_upload_url(url: str) -> bool:
    """True if the URL points into this app's storage bucket (so users can't attach
    arbitrary external images to posts or profiles)."""
    prefix = public_url_prefix()
    return bool(prefix) and url.startswith(prefix)


async def upload_image(data: bytes, folder: str, owner_id: int) -> str:
    """Store an image and return its public URL."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise StorageNotConfiguredError(
            "Image uploads are not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"
        )
    if not data:
        raise InvalidUploadError("The file is empty")
    if len(data) > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise InvalidUploadError(f"Images must be {limit_mb} MB or smaller")

    content_type, ext = _detect_image(data)
    path = f"{folder}/{owner_id}/{uuid.uuid4().hex}.{ext}"
    base = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{base}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}/{path}",
            content=data,
            headers={
                "Authorization": f"Bearer {key}",
                "apikey": key,
                "Content-Type": content_type,
                "x-upsert": "false",
            },
        )
    if response.status_code >= 400:
        logger.error("Image upload failed", status=response.status_code, body=response.text[:300])
        raise RuntimeError("The image could not be stored. Try again later.")

    return f"{public_url_prefix()}{path}"
