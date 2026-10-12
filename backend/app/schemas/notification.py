"""
Schemas for the notifications system.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.auth import PublicUserResponse


class NotificationResponse(BaseModel):
    id: int
    type: str                           # "like" | "comment" | "follow"
    actor: PublicUserResponse
    post_id: Optional[int] = None
    preview: Optional[str] = None       # Short text for comment notifs
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCountResponse(BaseModel):
    unread_count: int
