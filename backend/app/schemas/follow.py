"""
Schemas for social follow/unfollow and user profile endpoints.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class FollowerListItem(BaseModel):
    """Compact user info shown in follower/following lists."""

    id: int
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    role: str
    is_followed_by_me: bool = False

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    """Full public profile of a user."""

    id: int
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    is_followed_by_me: bool = False

    class Config:
        from_attributes = True


class FollowResponse(BaseModel):
    """Returned after following a user."""

    follower_id: int
    followed_id: int
    created_at: datetime

    class Config:
        from_attributes = True
