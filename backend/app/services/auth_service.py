"""
Authentication service helpers.
"""
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import AuthResponse, UserCreate, UserResponse


class AuthService:
    """Handles user registration, login, and seed data."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, payload: UserCreate, role: str = "user") -> AuthResponse:
        existing = await self.db.execute(
            select(User).where(or_(User.email == payload.email, User.username == payload.username))
        )
        if existing.scalar_one_or_none():
            raise ValueError("A user with that email or username already exists")

        user = User(
            email=payload.email,
            username=payload.username,
            full_name=payload.full_name,
            password_hash=get_password_hash(payload.password),
            role=role,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return self._build_auth_response(user)

    async def login(self, email: str, password: str) -> AuthResponse:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        return self._build_auth_response(user)

    async def ensure_seed_moderator(self) -> None:
        result = await self.db.execute(select(User).where(User.email == settings.SEED_MODERATOR_EMAIL))
        if result.scalar_one_or_none() is not None:
            return

        moderator = User(
            email=settings.SEED_MODERATOR_EMAIL,
            username="moderator",
            full_name="Seed Moderator",
            password_hash=get_password_hash(settings.SEED_MODERATOR_PASSWORD),
            role="moderator",
        )
        self.db.add(moderator)
        await self.db.flush()

    def _build_auth_response(self, user: User) -> AuthResponse:
        return AuthResponse(
            access_token=create_access_token(user.email),
            user=UserResponse.model_validate(user),
        )
