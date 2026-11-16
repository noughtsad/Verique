"""
PATCH /auth/me, POST /auth/me/password, and engagement state on profile posts.
"""
from httpx import AsyncClient

from app.core.config import settings

API = "/api/v1"


async def _register(client: AsyncClient, *, email: str = "a@example.com", username: str = "alice") -> None:
    response = await client.post(
        f"{API}/auth/register",
        json={"email": email, "username": username, "full_name": "Alice A", "password": "password123"},
    )
    assert response.status_code == 200, response.text


async def test_update_name_and_bio(client):
    await _register(client)
    response = await client.patch(f"{API}/auth/me", json={"full_name": "  Alice B  ", "bio": "Fact fan"})
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Alice B"
    me = (await client.get(f"{API}/auth/me")).json()
    assert me["bio"] == "Fact fan"
    profile = (await client.get(f"{API}/users/alice")).json()
    assert profile["full_name"] == "Alice B" and profile["bio"] == "Fact fan"


async def test_empty_bio_clears_it(client):
    await _register(client)
    await client.patch(f"{API}/auth/me", json={"bio": "Something"})
    response = await client.patch(f"{API}/auth/me", json={"bio": "   "})
    assert response.json()["bio"] is None


async def test_absent_fields_unchanged(client):
    await _register(client)
    await client.patch(f"{API}/auth/me", json={"bio": "Keep me"})
    response = await client.patch(f"{API}/auth/me", json={"full_name": "New Name"})
    assert response.json()["bio"] == "Keep me"
    assert response.json()["full_name"] == "New Name"


async def test_external_avatar_rejected(client):
    await _register(client)
    response = await client.patch(f"{API}/auth/me", json={"avatar_url": "https://evil.example.com/x.png"})
    assert response.status_code == 400


async def test_own_bucket_avatar_accepted(client, monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://proj.supabase.co")
    await _register(client)
    url = "https://proj.supabase.co/storage/v1/object/public/media/avatar/1/abc.png"
    response = await client.patch(f"{API}/auth/me", json={"avatar_url": url})
    assert response.status_code == 200
    assert (await client.get(f"{API}/users/alice")).json()["avatar_url"] == url


async def test_password_change_then_login_with_new(client_factory):
    client = client_factory()
    await _register(client)
    response = await client.post(
        f"{API}/auth/me/password", json={"current_password": "password123", "new_password": "newpassword456"}
    )
    assert response.status_code == 204
    fresh = client_factory()
    old = await fresh.post(f"{API}/auth/login", json={"email": "a@example.com", "password": "password123"})
    assert old.status_code == 401
    new = await fresh.post(f"{API}/auth/login", json={"email": "a@example.com", "password": "newpassword456"})
    assert new.status_code == 200


async def test_password_change_wrong_current(client):
    await _register(client)
    response = await client.post(
        f"{API}/auth/me/password", json={"current_password": "wrongpass1", "new_password": "newpassword456"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


async def test_profile_posts_include_like_state(client):
    await _register(client)
    post_id = (await client.post(f"{API}/posts/", json={"content": "A post on my profile"})).json()["id"]
    await client.post(f"{API}/posts/{post_id}/like")
    posts = (await client.get(f"{API}/users/alice/posts")).json()
    assert posts[0]["likes_count"] == 1
    assert posts[0]["is_liked_by_me"] is True
