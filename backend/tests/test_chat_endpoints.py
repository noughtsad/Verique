"""
Integration tests for the /chat REST endpoints, exercised through the real
FastAPI app over httpx (cookie-based auth, just like the browser).
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


async def test_create_conversation_and_send_message(client_factory):
    alice = client_factory()
    bob = client_factory()
    await _register(alice, email="alice@example.com", username="alice")
    await _register(bob, email="bob@example.com", username="bob")

    create_resp = await alice.post("/api/v1/chat/conversations/bob")
    assert create_resp.status_code == 201, create_resp.text
    conversation = create_resp.json()
    assert conversation["other_user"]["username"] == "bob"
    assert conversation["unread_count"] == 0

    send_resp = await alice.post(
        f"/api/v1/chat/conversations/{conversation['id']}/messages",
        json={"content": "hey bob"},
    )
    assert send_resp.status_code == 201, send_resp.text
    message = send_resp.json()
    assert message["content"] == "hey bob"
    assert message["sender"]["username"] == "alice"

    # Bob sees the conversation with an unread count and the last message.
    bob_list_resp = await bob.get("/api/v1/chat/conversations")
    assert bob_list_resp.status_code == 200
    bob_conversations = bob_list_resp.json()
    assert len(bob_conversations) == 1
    assert bob_conversations[0]["unread_count"] == 1
    assert bob_conversations[0]["last_message"]["content"] == "hey bob"

    # Marking read zeroes the unread count.
    read_resp = await bob.post(f"/api/v1/chat/conversations/{conversation['id']}/read")
    assert read_resp.status_code == 204

    bob_list_after = await bob.get("/api/v1/chat/conversations")
    assert bob_list_after.json()[0]["unread_count"] == 0


async def test_non_participant_gets_404(client_factory):
    alice = client_factory()
    bob = client_factory()
    carol = client_factory()
    await _register(alice, email="alice@example.com", username="alice")
    await _register(bob, email="bob@example.com", username="bob")
    await _register(carol, email="carol@example.com", username="carol")

    create_resp = await alice.post("/api/v1/chat/conversations/bob")
    conversation_id = create_resp.json()["id"]

    resp = await carol.get(f"/api/v1/chat/conversations/{conversation_id}/messages")
    assert resp.status_code == 404

    resp = await carol.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages", json={"content": "hi"}
    )
    assert resp.status_code == 404


async def test_cannot_message_self_via_api(client_factory):
    alice = client_factory()
    await _register(alice, email="alice@example.com", username="alice")

    resp = await alice.post("/api/v1/chat/conversations/alice")
    assert resp.status_code == 404


async def test_requires_authentication(client_factory):
    anonymous = client_factory()
    resp = await anonymous.get("/api/v1/chat/conversations")
    assert resp.status_code == 401
