"""
NotificationService — creates and retrieves activity notifications.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.notification import Notification
from app.schemas.notification import NotificationCountResponse, NotificationResponse


class NotificationService:
    """CRUD helper for notifications."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Write helpers (called from social / follow services)
    # ------------------------------------------------------------------

    async def create(
        self,
        owner_id: int,
        actor_id: int,
        type: str,
        post_id: Optional[int] = None,
        preview: Optional[str] = None,
    ) -> None:
        """Persist a notification.  Silently skips self-notifications."""
        if owner_id == actor_id:
            return
        notif = Notification(
            owner_id=owner_id,
            actor_id=actor_id,
            type=type,
            post_id=post_id,
            preview=preview,
        )
        self.db.add(notif)
        await self.db.flush()

    # ------------------------------------------------------------------
    # Read helpers (called from the API endpoint)
    # ------------------------------------------------------------------

    async def list_for_user(
        self,
        owner_id: int,
        limit: int = 30,
        offset: int = 0,
    ) -> list[NotificationResponse]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.owner_id == owner_id)
            .options(
                selectinload(Notification.actor),
                selectinload(Notification.post),
            )
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = result.scalars().all()
        return [self._to_response(n) for n in rows]

    async def unread_count(self, owner_id: int) -> NotificationCountResponse:
        result = await self.db.execute(
            select(Notification).where(
                Notification.owner_id == owner_id,
                Notification.is_read.is_(False),
            )
        )
        count = len(result.scalars().all())
        return NotificationCountResponse(unread_count=count)

    async def mark_all_read(self, owner_id: int) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.owner_id == owner_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )

    async def mark_one_read(self, notification_id: int, owner_id: int) -> None:
        await self.db.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.owner_id == owner_id,
            )
            .values(is_read=True)
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_response(n: Notification) -> NotificationResponse:
        from app.schemas.auth import PublicUserResponse  # avoid circular at module level

        actor_resp = PublicUserResponse(
            id=n.actor.id,
            username=n.actor.username,
            full_name=n.actor.full_name,
            role=n.actor.role,
            is_active=n.actor.is_active,
            created_at=n.actor.created_at,
        )
        return NotificationResponse(
            id=n.id,
            type=n.type,
            actor=actor_resp,
            post_id=n.post_id,
            preview=n.preview,
            is_read=n.is_read,
            created_at=n.created_at,
        )
