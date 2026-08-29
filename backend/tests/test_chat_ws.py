"""
WebSocket tests for the chat feature.

Uses FastAPI's TestClient, which runs the ASGI app in its own thread/event
loop to give full sync + WebSocket support. The chat WS handler opens its own
DB sessions via `async_session_maker` (not the overridable `get_db` FastAPI
dependency, since it's a long-lived connection rather than a per-request
one) — so it's patched directly on the `chat` endpoints module.
"""
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import app.api.v1.endpoints.chat as chat_module


def _register(client: TestClient, *, email: str, username: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "full_name": username.capitalize(),
            "password": "password123",
        },
    )
    assert response.status_code == 200, response.text


@pytest.fixture(autouse=True)
def _patch_chat_session_maker(session_maker, monkeypatch):
    monkeypatch.setattr(chat_module, "async_session_maker", session_maker)


def test_ws_rejects_connection_without_auth_cookie(app_with_test_db):
    client = TestClient(app_with_test_db)

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/v1/chat/ws"):
            pass
    assert exc_info.value.code == 4401


def test_ws_delivers_message_to_both_participants(app_with_test_db):
    alice = TestClient(app_with_test_db)
    bob = TestClient(app_with_test_db)
    _register(alice, email="alice@example.com", username="alice")
    _register(bob, email="bob@example.com", username="bob")

    create_resp = alice.post("/api/v1/chat/conversations/bob")
    assert create_resp.status_code == 201, create_resp.text
    conversation_id = create_resp.json()["id"]

    with alice.websocket_connect("/api/v1/chat/ws") as alice_ws:
        with bob.websocket_connect("/api/v1/chat/ws") as bob_ws:
            alice_ws.send_json(
                {
                    "type": "send_message",
                    "data": {"conversation_id": conversation_id, "content": "hi bob"},
                }
            )

            # Self-fan-out: the sender's own connection also receives it
            # (useful when the same user has multiple tabs open).
            alice_echo = alice_ws.receive_json()
            assert alice_echo["type"] == "message"
            assert alice_echo["data"]["content"] == "hi bob"
            assert alice_echo["data"]["sender"]["username"] == "alice"

            bob_incoming = bob_ws.receive_json()
            assert bob_incoming["type"] == "message"
            assert bob_incoming["data"]["content"] == "hi bob"
            assert bob_incoming["data"]["sender"]["username"] == "alice"


def test_ws_send_to_nonexistent_conversation_returns_error(app_with_test_db):
    alice = TestClient(app_with_test_db)
    _register(alice, email="alice@example.com", username="alice")

    with alice.websocket_connect("/api/v1/chat/ws") as alice_ws:
        alice_ws.send_json(
            {"type": "send_message", "data": {"conversation_id": 999999, "content": "hello?"}}
        )
        response = alice_ws.receive_json()
        assert response["type"] == "error"
