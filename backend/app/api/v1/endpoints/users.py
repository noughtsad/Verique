"""
User profile & social follow endpoints.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import OAuth2CookieBearer, get_current_user
from app.models.user import User
from app.schemas.follow import FollowerListItem, FollowResponse, UserProfileResponse
from app.schemas.social import PostSummary
from app.services.follow_service import FollowService

router = APIRouter()

# Optional Bearer token — does NOT raise 401 when missing
_optional_oauth2 = OAuth2CookieBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/login", auto_error=False
)


async def get_optional_user(
    token: Optional[str] = Depends(_optional_oauth2),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated user if a valid token is supplied, else None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.email == subject, User.is_active.is_(True)))
    return result.scalar_one_or_none()


# -----------------------------------------------------------------------
# Search & Suggestions
# -----------------------------------------------------------------------


@router.get(
    "/search",
    response_model=list[FollowerListItem],
    summary="Search users by username or full name",
)
async def search_users(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    return await FollowService(db).search_users(q, current_user=current_user, limit=limit)


@router.get(
    "/suggestions/for-me",
    response_model=list[FollowerListItem],
    summary="Suggest people to follow",
)
async def get_follow_suggestions(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated: suggest active users not already followed."""
    return await FollowService(db).suggest_users(current_user, limit=limit)


# -----------------------------------------------------------------------
# Profile endpoints
# -----------------------------------------------------------------------


@router.get("/{username}", response_model=UserProfileResponse, summary="Get user profile")
async def get_user_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        return await FollowService(db).get_profile(username, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{username}/posts", response_model=list[PostSummary], summary="Get user's posts")
async def get_user_posts(
    username: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of posts by this user, newest first."""
    try:
        return await FollowService(db).get_user_posts(username, limit=limit, offset=offset)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/{username}/followers",
    response_model=list[FollowerListItem],
    summary="List followers",
)
async def get_followers(
    username: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        return await FollowService(db).list_followers(
            username, current_user=current_user, limit=limit, offset=offset
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/{username}/following",
    response_model=list[FollowerListItem],
    summary="List following",
)
async def get_following(
    username: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        return await FollowService(db).list_following(
            username, current_user=current_user, limit=limit, offset=offset
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# -----------------------------------------------------------------------
# Follow / Unfollow
# -----------------------------------------------------------------------


@router.post(
    "/{username}/follow",
    response_model=FollowResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Follow a user",
)
async def follow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated: follow the given user."""
    try:
        return await FollowService(db).follow_user(current_user, username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete(
    "/{username}/follow",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unfollow a user",
)
async def unfollow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated: unfollow the given user."""
    try:
        await FollowService(db).unfollow_user(current_user, username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
