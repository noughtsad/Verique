"""
Integration tests for notifications endpoints and triggers (follow, like, comment).
"""
from httpx import AsyncClient


async def _register(client: AsyncClient, *, email: str, username: str) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "full_name": username.capitalize(),
            "password": "password123",
        },
    )
    assert response.status_code == 200, response.text


async def test_follow_creates_notification(client_factory):
    alice = client_factory()
    bob = client_factory()
    await _register(alice, email="alice@example.com", username="alice")
    await _register(bob, email="bob@example.com", username="bob")

    # Bob starts with 0 notifications
    unread = await bob.get("/api/v1/notifications/unread-count")
    assert unread.status_code == 200
    assert unread.json()["unread_count"] == 0

    # Alice follows Bob
    follow_resp = await alice.post("/api/v1/users/bob/follow")
    assert follow_resp.status_code == 201

    # Bob should now have 1 unread notification
    unread = await bob.get("/api/v1/notifications/unread-count")
    assert unread.status_code == 200
    assert unread.json()["unread_count"] == 1

    # Bob lists notifications
    list_resp = await bob.get("/api/v1/notifications/")
    assert list_resp.status_code == 200
    notifs = list_resp.json()
    assert len(notifs) == 1
    assert notifs[0]["type"] == "follow"
    assert notifs[0]["actor"]["username"] == "alice"
    assert notifs[0]["is_read"] is False

    # Mark single notification as read
    notif_id = notifs[0]["id"]
    mark_resp = await bob.post(f"/api/v1/notifications/{notif_id}/read")
    assert mark_resp.status_code == 204

    # Unread count should now be 0
    unread = await bob.get("/api/v1/notifications/unread-count")
    assert unread.json()["unread_count"] == 0


async def test_like_and_comment_create_notifications(client_factory):
    author = client_factory()
    reactor = client_factory()
    await _register(author, email="author@example.com", username="author")
    await _register(reactor, email="reactor@example.com", username="reactor")

    # Author creates a post
    post_resp = await author.post(
        "/api/v1/posts/",
        json={"content": "Hello world from author!"},
    )
    assert post_resp.status_code == 200
    post_id = post_resp.json()["id"]

    # Author liking their own post should NOT generate notification
    await author.post(f"/api/v1/posts/{post_id}/like")
    author_unread = await author.get("/api/v1/notifications/unread-count")
    assert author_unread.json()["unread_count"] == 0

    # Reactor likes the post
    like_resp = await reactor.post(f"/api/v1/posts/{post_id}/like")
    assert like_resp.status_code == 204

    # Reactor comments on the post
    comment_resp = await reactor.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Great post! Really enjoyed this."},
    )
    assert comment_resp.status_code == 201

    # Author should have 2 notifications (like and comment)
    notifs_resp = await author.get("/api/v1/notifications/")
    assert notifs_resp.status_code == 200
    notifs = notifs_resp.json()
    assert len(notifs) == 2

    # Newest is comment
    assert notifs[0]["type"] == "comment"
    assert notifs[0]["actor"]["username"] == "reactor"
    assert notifs[0]["post_id"] == post_id
    assert "Great post!" in notifs[0]["preview"]

    # Next is like
    assert notifs[1]["type"] == "like"
    assert notifs[1]["actor"]["username"] == "reactor"
    assert notifs[1]["post_id"] == post_id

    # Author marks all as read
    mark_all = await author.post("/api/v1/notifications/mark-all-read")
    assert mark_all.status_code == 204

    author_unread = await author.get("/api/v1/notifications/unread-count")
    assert author_unread.json()["unread_count"] == 0
