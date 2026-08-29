"""
In-memory WebSocket connection manager for chat.

Extension point for horizontal scaling: replace the in-process dict below
with Redis pub/sub (redis.asyncio, already wired up in app.core.cache) —
publish {"user_id": ..., "envelope": ...} on send_to_user/broadcast_to_users,
and have every instance subscribe to a shared channel and fan out to only
its own local WebSocket connections. Keep this class's public method
signatures (connect/disconnect/send_to_user/broadcast_to_users) unchanged
so app/api/v1/endpoints/chat.py doesn't need to change when this happens.
"""
from typing import Iterable

import structlog
from fastapi import WebSocket

logger = structlog.get_logger()


class ConnectionManager:
    """Tracks open chat WebSocket connections, keyed by user id."""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(user_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, envelope: dict) -> None:
        dead: list[WebSocket] = []
        for websocket in self._connections.get(user_id, set()):
            try:
                await websocket.send_json(envelope)
            except Exception:
                logger.debug("Failed to deliver chat message, dropping connection", user_id=user_id)
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(user_id, websocket)

    async def broadcast_to_users(self, user_ids: Iterable[int], envelope: dict) -> None:
        for user_id in user_ids:
            await self.send_to_user(user_id, envelope)


# Global connection manager instance
manager = ConnectionManager()
