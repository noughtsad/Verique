"""
Authentication schemas.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str | None = Field(default=None, max_length=120)
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class PublicUserResponse(BaseModel):
    """Safe public representation of a user — email is intentionally omitted."""

    id: int
    username: str
    full_name: str | None = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """Full user representation returned only to the authenticated owner (/auth/me)."""

    id: int
    email: str
    username: str
    full_name: str | None = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Returned on login/register — access_token is also set as an httpOnly cookie."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
