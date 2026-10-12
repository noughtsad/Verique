"""
Notifications endpoints — list, count unread, mark read.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationCountResponse, NotificationResponse
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get(
    "/",
    response_model=list[NotificationResponse],
    summary="List my notifications",
)
async def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's notifications, newest first."""
    return await NotificationService(db).list_for_user(
        current_user.id, limit=limit, offset=offset
    )


@router.get(
    "/unread-count",
    response_model=NotificationCountResponse,
    summary="Unread notification count",
)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NotificationService(db).unread_count(current_user.id)


@router.post(
    "/mark-all-read",
    status_code=204,
    summary="Mark all notifications as read",
)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await NotificationService(db).mark_all_read(current_user.id)


@router.post(
    "/{notification_id}/read",
    status_code=204,
    summary="Mark a single notification as read",
)
async def mark_one_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await NotificationService(db).mark_one_read(notification_id, current_user.id)
