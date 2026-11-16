"""
Feeds, search, bookmarks and deletes on /posts.
"""
from httpx import AsyncClient

API = "/api/v1"


async def _register(client: AsyncClient, *, email: str, username: str) -> int:
    response = await client.post(
        f"{API}/auth/register",
        json={"email": email, "username": username, "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["user"]["id"]


async def _post(client: AsyncClient, content: str) -> int:
    response = await client.post(f"{API}/posts/", json={"content": content})
    assert response.status_code == 200, response.text
    return response.json()["id"]


async def test_feed_paginates_newest_first(client):
    await _register(client, email="a@example.com", username="alice")
    ids = [await _post(client, f"Post number {i} for paging") for i in range(3)]
    first = (await client.get(f"{API}/posts/", params={"limit": 2})).json()
    second = (await client.get(f"{API}/posts/", params={"limit": 2, "offset": 2})).json()
    assert [p["id"] for p in first] == [ids[2], ids[1]]
    assert [p["id"] for p in second] == [ids[0]]


async def test_unknown_feed_is_422(client):
    response = await client.get(f"{API}/posts/", params={"feed": "trending"})
    assert response.status_code == 422


async def test_following_feed_shows_followed_and_own(client_factory):
    alice, bob, carol = client_factory(), client_factory(), client_factory()
    await _register(alice, email="a@example.com", username="alice")
    await _register(bob, email="b@example.com", username="bob")
    await _register(carol, email="c@example.com", username="carol")
    own = await _post(alice, "Alice writes something here")
    followed = await _post(bob, "Bob writes something here")
    await _post(carol, "Carol writes something here")
    assert (await alice.post(f"{API}/users/bob/follow")).status_code == 201

    feed = (await alice.get(f"{API}/posts/", params={"feed": "following"})).json()
    assert {p["id"] for p in feed} == {own, followed}


async def test_following_feed_empty_when_signed_out(client_factory):
    author, visitor = client_factory(), client_factory()
    await _register(author, email="a@example.com", username="alice")
    await _post(author, "A post nobody follows yet")
    response = await visitor.get(f"{API}/posts/", params={"feed": "following"})
    assert response.status_code == 200
    assert response.json() == []


async def test_popular_orders_by_engagement(client_factory):
    alice, bob = client_factory(), client_factory()
    await _register(alice, email="a@example.com", username="alice")
    await _register(bob, email="b@example.com", username="bob")
    quiet = await _post(alice, "A quiet post with no likes")
    busy = await _post(alice, "A busy post everyone likes")
    newest = await _post(alice, "The newest post, also quiet")
    await bob.post(f"{API}/posts/{busy}/like")
    await bob.post(f"{API}/posts/{busy}/comments", json={"content": "Nice"})
    await bob.post(f"{API}/posts/{quiet}/like")

    feed = (await bob.get(f"{API}/posts/", params={"feed": "popular"})).json()
    assert [p["id"] for p in feed] == [busy, quiet, newest]


async def test_search_matches_content_case_insensitively(client):
    await _register(client, email="a@example.com", username="alice")
    match = await _post(client, "The Moon landing happened in 1969")
    await _post(client, "Something about the weather today")
    found = (await client.get(f"{API}/posts/", params={"q": "moon LANDING"})).json()
    assert [p["id"] for p in found] == [match]


async def test_bookmark_roundtrip(client):
    await _register(client, email="a@example.com", username="alice")
    post_id = await _post(client, "Worth saving for later")
    assert (await client.post(f"{API}/posts/{post_id}/bookmark")).status_code == 204
    assert (await client.post(f"{API}/posts/{post_id}/bookmark")).status_code == 204  # idempotent

    detail = (await client.get(f"{API}/posts/{post_id}")).json()
    assert detail["is_bookmarked_by_me"] is True
    saved = (await client.get(f"{API}/posts/bookmarks")).json()
    assert [p["id"] for p in saved] == [post_id]

    assert (await client.delete(f"{API}/posts/{post_id}/bookmark")).status_code == 204
    assert (await client.get(f"{API}/posts/bookmarks")).json() == []


async def test_bookmarks_require_login(client):
    assert (await client.get(f"{API}/posts/bookmarks")).status_code == 401


async def test_delete_own_post_removes_related_rows(client_factory):
    alice, bob = client_factory(), client_factory()
    await _register(alice, email="a@example.com", username="alice")
    await _register(bob, email="b@example.com", username="bob")
    post_id = await _post(alice, "This post will be deleted")
    await bob.post(f"{API}/posts/{post_id}/like")  # also creates a notification
    await bob.post(f"{API}/posts/{post_id}/comments", json={"content": "Hello"})
    await bob.post(f"{API}/posts/{post_id}/bookmark")

    assert (await alice.delete(f"{API}/posts/{post_id}")).status_code == 204
    assert (await alice.get(f"{API}/posts/{post_id}")).status_code == 404
    assert (await bob.get(f"{API}/posts/bookmarks")).json() == []
    notifications = (await alice.get(f"{API}/notifications/")).json()
    items = notifications["items"] if isinstance(notifications, dict) else notifications
    assert all(n.get("post_id") != post_id for n in items)


async def test_cannot_delete_others_post(client_factory):
    alice, bob = client_factory(), client_factory()
    await _register(alice, email="a@example.com", username="alice")
    await _register(bob, email="b@example.com", username="bob")
    post_id = await _post(alice, "Alice's post, not Bob's")
    assert (await bob.delete(f"{API}/posts/{post_id}")).status_code == 403
    assert (await bob.get(f"{API}/posts/{post_id}")).status_code == 200


async def test_comment_delete_permissions(client_factory):
    alice, bob, carol = client_factory(), client_factory(), client_factory()
    await _register(alice, email="a@example.com", username="alice")
    await _register(bob, email="b@example.com", username="bob")
    await _register(carol, email="c@example.com", username="carol")
    post_id = await _post(alice, "Alice's post with comments")
    c1 = (await bob.post(f"{API}/posts/{post_id}/comments", json={"content": "Bob one"})).json()["id"]
    c2 = (await bob.post(f"{API}/posts/{post_id}/comments", json={"content": "Bob two"})).json()["id"]

    assert (await carol.delete(f"{API}/posts/{post_id}/comments/{c1}")).status_code == 403
    assert (await alice.delete(f"{API}/posts/{post_id}/comments/{c1}")).status_code == 204  # post author
    assert (await bob.delete(f"{API}/posts/{post_id}/comments/{c2}")).status_code == 204  # comment author
    assert (await alice.get(f"{API}/posts/{post_id}/comments")).json() == []
    assert (await bob.delete(f"{API}/posts/{post_id}/comments/9999")).status_code == 404


async def test_outside_image_url_is_400(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://proj.supabase.co")
    await _register(client, email="a@example.com", username="alice")
    response = await client.post(
        f"{API}/posts/",
        json={"content": "A post with someone else's image", "image_url": "https://evil.example.com/x.png"},
    )
    assert response.status_code == 400
    assert "uploaded through Verique" in response.json()["detail"]
