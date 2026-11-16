"""
POST /uploads/image: images go to Supabase Storage through the backend.
"""
import httpx
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services.storage_service import public_url_prefix

API = "/api/v1"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def _register(client: AsyncClient) -> int:
    response = await client.post(
        f"{API}/auth/register",
        json={"email": "up@example.com", "username": "uploader", "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["user"]["id"]


@pytest.fixture
def storage_configured(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "service-key")
    calls = []
    real_post = httpx.AsyncClient.post

    async def fake_post(self, url, *args, **kwargs):
        if str(url).startswith("https://proj.supabase.co/storage/"):
            calls.append((str(url), kwargs.get("headers", {})))
            return httpx.Response(200, json={"Key": "ok"})
        return await real_post(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return calls


def _files(data: bytes, name: str = "pic.png"):
    return {"file": (name, data, "application/octet-stream")}


async def test_upload_requires_login(client):
    response = await client.post(f"{API}/uploads/image", files=_files(PNG))
    assert response.status_code == 401


async def test_upload_not_configured_503(client, monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
    await _register(client)
    response = await client.post(f"{API}/uploads/image", files=_files(PNG))
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


async def test_upload_rejects_non_image(client, storage_configured):
    await _register(client)
    response = await client.post(f"{API}/uploads/image", files=_files(b"hello", "pic.png"))
    assert response.status_code == 400
    assert storage_configured == []


async def test_upload_rejects_oversize(client, storage_configured, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 32)
    await _register(client)
    response = await client.post(f"{API}/uploads/image", files=_files(PNG))
    assert response.status_code == 400
    assert storage_configured == []


async def test_upload_png_returns_bucket_url(client, storage_configured):
    user_id = await _register(client)
    response = await client.post(f"{API}/uploads/image", params={"kind": "post"}, files=_files(PNG))
    assert response.status_code == 201, response.text
    url = response.json()["url"]
    assert url.startswith(public_url_prefix())
    assert f"/post/{user_id}/" in url and url.endswith(".png")
    (called_url, headers), = storage_configured
    assert headers["Content-Type"] == "image/png"
    assert headers["Authorization"] == "Bearer service-key"


async def test_upload_rejects_unknown_kind(client, storage_configured):
    await _register(client)
    response = await client.post(f"{API}/uploads/image", params={"kind": "banner"}, files=_files(PNG))
    assert response.status_code == 422
