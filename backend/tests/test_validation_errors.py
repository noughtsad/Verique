"""
Validation errors (422) come back with a readable string `detail`.
"""
from httpx import AsyncClient


async def _register(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "val@example.com", "username": "val", "password": "password123"},
    )
    assert response.status_code == 200, response.text


async def test_short_post_gives_readable_422(client):
    await _register(client)
    response = await client.post("/api/v1/posts/", json={"content": "short"})
    assert response.status_code == 422
    body = response.json()
    assert isinstance(body["detail"], str)
    assert "at least 10" in body["detail"]
    assert body["detail"].startswith("content")
