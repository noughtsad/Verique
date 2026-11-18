"""
A write is committed before the response goes out, so a failed commit is reported as an
error instead of a success the client then can't find.
"""
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

API = "/api/v1"


async def test_failed_commit_is_an_error_not_a_success(app_with_test_db, monkeypatch):
    # Starlette re-raises after sending a 500; read the response instead of the exception.
    transport = ASGITransport(app=app_with_test_db, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await _failed_commit_case(client, monkeypatch)


async def _failed_commit_case(client, monkeypatch):
    response = await client.post(
        f"{API}/auth/register",
        json={"email": "a@example.com", "username": "alice", "password": "password123"},
    )
    assert response.status_code == 200, response.text

    async def broken_commit(self):
        raise RuntimeError("database went away")

    monkeypatch.setattr(AsyncSession, "commit", broken_commit)
    response = await client.post(f"{API}/posts/", json={"content": "The Eiffel Tower is in Paris."})

    assert response.status_code == 500


async def test_post_is_readable_as_soon_as_create_returns(client):
    await client.post(
        f"{API}/auth/register",
        json={"email": "a@example.com", "username": "alice", "password": "password123"},
    )
    created = await client.post(f"{API}/posts/", json={"content": "The Eiffel Tower is in Paris."})
    assert created.status_code == 200

    fetched = await client.get(f"{API}/posts/{created.json()['id']}")

    assert fetched.status_code == 200
