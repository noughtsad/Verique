"""
Chat service — business logic for 1:1 direct-message conversations.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import Conversation, Message
from app.models.user import User
from app.schemas.chat import ConversationSummary, MessageResponse


class ChatService:
    """Handles 1:1 conversations, messages, and unread-count bookkeeping."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Conversations
    # ------------------------------------------------------------------

    async def get_or_create_conversation(
        self, current_user: User, other_username: str
    ) -> ConversationSummary:
        other = await self._get_user_by_username(other_username)
        if other.id == current_user.id:
            raise ValueError("You cannot message yourself")

        user_a_id, user_b_id = self._canonical_pair(current_user.id, other.id)
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.user_a), selectinload(Conversation.user_b))
            .where(Conversation.user_a_id == user_a_id, Conversation.user_b_id == user_b_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            conversation = Conversation(user_a_id=user_a_id, user_b_id=user_b_id)
            self.db.add(conversation)
            await self.db.flush()
            await self.db.refresh(conversation)
            await self.db.refresh(conversation, attribute_names=["user_a", "user_b"])

        summaries = await self._annotate_conversations([conversation], current_user)
        return summaries[0]

    async def list_conversations(
        self, current_user: User, limit: int = 50, offset: int = 0
    ) -> list[ConversationSummary]:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.user_a), selectinload(Conversation.user_b))
            .where(
                or_(
                    Conversation.user_a_id == current_user.id,
                    Conversation.user_b_id == current_user.id,
                )
            )
            .order_by(func.coalesce(Conversation.last_message_at, Conversation.created_at).desc())
            .limit(limit)
            .offset(offset)
        )
        conversations = list(result.scalars().all())
        return await self._annotate_conversations(conversations, current_user)

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    async def list_messages(
        self,
        current_user: User,
        conversation_id: int,
        before_id: Optional[int] = None,
        limit: int = 50,
    ) -> list[MessageResponse]:
        """Return up to `limit` messages, oldest-first. `before_id` (a
        previously-seen message id) pages backwards in time. Cursoring on
        `id` rather than `created_at` avoids ties when messages are created
        in rapid succession and the underlying clock's resolution is coarse.
        """
        await self._load_conversation_for_user(current_user, conversation_id)

        stmt = (
            select(Message)
            .options(selectinload(Message.sender))
            .where(Message.conversation_id == conversation_id)
        )
        if before_id is not None:
            stmt = stmt.where(Message.id < before_id)
        stmt = stmt.order_by(Message.id.desc()).limit(limit)

        result = await self.db.execute(stmt)
        messages = list(reversed(result.scalars().all()))
        return [self._serialize_message(message) for message in messages]

    async def send_message(
        self, current_user: User, conversation_id: int, content: str
    ) -> MessageResponse:
        conversation = await self._load_conversation_for_user(current_user, conversation_id)

        message = Message(conversation_id=conversation.id, sender_id=current_user.id, content=content)
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        await self.db.refresh(message, attribute_names=["sender"])

        conversation.last_message_at = message.created_at
        await self.db.flush()

        return self._serialize_message(message)

    async def get_other_participant_id(self, current_user: User, conversation_id: int) -> int:
        conversation = await self._load_conversation_for_user(current_user, conversation_id)
        return (
            conversation.user_b_id
            if conversation.user_a_id == current_user.id
            else conversation.user_a_id
        )

    async def mark_conversation_read(self, current_user: User, conversation_id: int) -> None:
        conversation = await self._load_conversation_for_user(current_user, conversation_id)
        now = datetime.utcnow()
        if conversation.user_a_id == current_user.id:
            conversation.user_a_last_read_at = now
        else:
            conversation.user_b_last_read_at = now
        await self.db.flush()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _canonical_pair(self, id_a: int, id_b: int) -> tuple[int, int]:
        return (id_a, id_b) if id_a < id_b else (id_b, id_a)

    async def _get_user_by_username(self, username: str) -> User:
        result = await self.db.execute(
            select(User).where(User.username == username, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise ValueError(f"User '{username}' not found")
        return user

    async def _load_conversation_for_user(
        self, current_user: User, conversation_id: int
    ) -> Conversation:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.user_a), selectinload(Conversation.user_b))
            .where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation is None or current_user.id not in (
            conversation.user_a_id,
            conversation.user_b_id,
        ):
            raise ValueError("Conversation not found")
        return conversation

    async def _annotate_conversations(
        self, conversations: list[Conversation], current_user: User
    ) -> list[ConversationSummary]:
        if not conversations:
            return []
        conversation_ids = [c.id for c in conversations]
        last_messages = await self._last_messages_for(conversation_ids)
        unread_counts = await self._unread_counts_for(conversation_ids, current_user)

        return [
            self._serialize_conversation(
                conversation,
                current_user,
                last_messages.get(conversation.id),
                unread_counts.get(conversation.id, 0),
            )
            for conversation in conversations
        ]

    async def _last_messages_for(self, conversation_ids: list[int]) -> dict[int, Message]:
        if not conversation_ids:
            return {}
        max_at_subq = (
            select(Message.conversation_id, func.max(Message.created_at).label("max_created_at"))
            .where(Message.conversation_id.in_(conversation_ids))
            .group_by(Message.conversation_id)
            .subquery()
        )
        result = await self.db.execute(
            select(Message)
            .options(selectinload(Message.sender))
            .join(
                max_at_subq,
                (Message.conversation_id == max_at_subq.c.conversation_id)
                & (Message.created_at == max_at_subq.c.max_created_at),
            )
        )
        return {message.conversation_id: message for message in result.scalars().all()}

    async def _unread_counts_for(
        self, conversation_ids: list[int], current_user: User
    ) -> dict[int, int]:
        if not conversation_ids:
            return {}
        my_last_read_at = case(
            (Conversation.user_a_id == current_user.id, Conversation.user_a_last_read_at),
            else_=Conversation.user_b_last_read_at,
        )
        result = await self.db.execute(
            select(Message.conversation_id, func.count(Message.id))
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
                Conversation.id.in_(conversation_ids),
                Message.sender_id != current_user.id,
                or_(my_last_read_at.is_(None), Message.created_at > my_last_read_at),
            )
            .group_by(Message.conversation_id)
        )
        return {conversation_id: int(count) for conversation_id, count in result.all()}

    def _serialize_message(self, message: Message) -> MessageResponse:
        return MessageResponse(
            id=message.id,
            conversation_id=message.conversation_id,
            sender=message.sender,
            content=message.content,
            created_at=message.created_at,
        )

    def _serialize_conversation(
        self,
        conversation: Conversation,
        current_user: User,
        last_message: Optional[Message],
        unread_count: int,
    ) -> ConversationSummary:
        other_user = (
            conversation.user_b if conversation.user_a_id == current_user.id else conversation.user_a
        )
        return ConversationSummary(
            id=conversation.id,
            other_user=other_user,
            last_message=self._serialize_message(last_message) if last_message else None,
            unread_count=unread_count,
            created_at=conversation.created_at,
            last_message_at=conversation.last_message_at,
        )
