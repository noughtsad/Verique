"""
Social post endpoints.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.users import get_optional_user
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas import CommentCreate, CommentResponse, PostCreate, PostSummary, PostVerificationResponse
from app.services.social_service import SocialService

router = APIRouter()


@router.get("/", response_model=list[PostSummary])
async def list_posts(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    return await SocialService(db).list_posts(current_user)


@router.post("/", response_model=PostSummary)
async def create_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SocialService(db).create_post(current_user, payload)


@router.get("/{post_id}", response_model=PostSummary)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    service = SocialService(db)
    try:
        return await service.get_post(post_id, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await SocialService(db).like_post(current_user, post_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await SocialService(db).unlike_post(current_user, post_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{post_id}/comments", response_model=list[CommentResponse])
async def list_comments(post_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return await SocialService(db).list_comments(post_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    post_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await SocialService(db).add_comment(current_user, post_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{post_id}/verify", response_model=PostVerificationResponse)
async def verify_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = SocialService(db)
    try:
        return await service.verify_post(post_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{post_id}/verifications/latest", response_model=PostVerificationResponse | None)
async def get_latest_verification(post_id: int, db: AsyncSession = Depends(get_db)):
    return await SocialService(db).get_latest_verification(post_id)
