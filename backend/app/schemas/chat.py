"""
Schemas for 1:1 direct-message chat.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.auth import PublicUserResponse


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender: PublicUserResponse
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    id: int
    other_user: PublicUserResponse
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    created_at: datetime
    last_message_at: Optional[datetime] = None
