"""
Chat endpoints — 1:1 direct messages (REST + WebSocket).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker, get_db
from app.core.security import get_current_user, get_current_user_ws
from app.core.ws_manager import manager
from app.models.user import User
from app.schemas.chat import ConversationSummary, MessageCreate, MessageResponse
from app.services.chat_service import ChatService

router = APIRouter()


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).list_conversations(current_user, limit=limit, offset=offset)


@router.post(
    "/conversations/{username}",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
)
async def get_or_create_conversation(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await ChatService(db).get_or_create_conversation(current_user, username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def list_messages(
    conversation_id: int,
    before_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await ChatService(db).list_messages(
            current_user, conversation_id, before_id=before_id, limit=limit
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """REST fallback for sending — used while the client's WebSocket is
    reconnecting. Persists through the same ChatService as the WS path and
    broadcasts through the same connection manager, so delivery is identical
    regardless of which path was used to send."""
    service = ChatService(db)
    try:
        message = await service.send_message(current_user, conversation_id, payload.content)
        other_id = await service.get_other_participant_id(current_user, conversation_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    envelope = {"type": "message", "data": message.model_dump(mode="json")}
    await manager.broadcast_to_users([current_user.id, other_id], envelope)
    return message


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await ChatService(db).mark_conversation_read(current_user, conversation_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    async with async_session_maker() as auth_session:
        user = await get_current_user_ws(websocket, auth_session)
    if user is None:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    await manager.connect(user.id, websocket)
    try:
        while True:
            raw = await websocket.receive_json()
            if raw.get("type") != "send_message":
                continue

            data = raw.get("data") or {}
            try:
                conversation_id = int(data["conversation_id"])
                content = str(data["content"])
            except (KeyError, TypeError, ValueError):
                await websocket.send_json(
                    {"type": "error", "data": {"detail": "Invalid message payload"}}
                )
                continue

            async with async_session_maker() as session:
                service = ChatService(session)
                try:
                    message = await service.send_message(user, conversation_id, content)
                    other_id = await service.get_other_participant_id(user, conversation_id)
                    await session.commit()
                except ValueError as exc:
                    await session.rollback()
                    await websocket.send_json({"type": "error", "data": {"detail": str(exc)}})
                    continue

            envelope = {"type": "message", "data": message.model_dump(mode="json")}
            await manager.broadcast_to_users([user.id, other_id], envelope)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, websocket)
