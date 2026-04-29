"""
Social post endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas import PostCreate, PostSummary, PostVerificationResponse
from app.services.social_service import SocialService

router = APIRouter()


@router.get("/", response_model=list[PostSummary])
async def list_posts(db: AsyncSession = Depends(get_db)):
    return await SocialService(db).list_posts()


@router.post("/", response_model=PostSummary)
async def create_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SocialService(db).create_post(current_user, payload)


@router.get("/{post_id}", response_model=PostSummary)
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    service = SocialService(db)
    try:
        return await service.get_post(post_id)
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
