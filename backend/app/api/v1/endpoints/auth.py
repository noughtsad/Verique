"""
Authentication endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas import AuthResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()

# Cookie name used everywhere
AUTH_COOKIE = "verique_auth"

# Cookie lifetime in seconds — matches the JWT expiry
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set an httpOnly auth cookie on the response."""
    response.set_cookie(
        key=AUTH_COOKIE,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,          # Not accessible via JavaScript
        samesite="lax",         # Protects against most CSRF
        secure=settings.ENVIRONMENT != "development",  # HTTPS-only in prod
        path="/",
    )


@router.post("/register", response_model=AuthResponse)
async def register_user(
    payload: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    try:
        auth = await service.register(payload)
        _set_auth_cookie(response, auth.access_token)
        return auth
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
async def login_user(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    try:
        auth = await service.login(payload.email, payload.password)
        _set_auth_cookie(response, auth.access_token)
        return auth
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(response: Response):
    """Clear the auth cookie. Works even if the user is not authenticated."""
    response.delete_cookie(
        key=AUTH_COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT != "development",
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's full profile (including email)."""
    return current_user
