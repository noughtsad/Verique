"""
Challenge and moderation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas import (
    ChallengeRequest,
    ChallengeResponse,
    ModerationDecisionRequest,
    ModerationReviewResponse,
)
from app.services.social_service import SocialService

router = APIRouter()


@router.post("/verifications/{verification_id}/challenges", response_model=ChallengeResponse)
async def challenge_verification(
    verification_id: int,
    payload: ChallengeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SocialService(db)
    try:
        return await service.create_challenge(verification_id, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/moderation/reviews", response_model=list[ModerationReviewResponse])
async def list_reviews(
    current_user: User = Depends(require_roles("moderator", "admin")),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    return await SocialService(db).list_open_reviews()


@router.post("/moderation/reviews/{review_id}/resolve", response_model=ModerationReviewResponse)
async def resolve_review(
    review_id: int,
    payload: ModerationDecisionRequest,
    current_user: User = Depends(require_roles("moderator", "admin")),
    db: AsyncSession = Depends(get_db),
):
    service = SocialService(db)
    try:
        return await service.resolve_review(review_id, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
