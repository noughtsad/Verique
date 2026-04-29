"""
Schemas for social posts, challenges, and moderation.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.auth import UserResponse
from app.schemas.verification import ClaimResult, VerificationMetadata, VerificationSummary


class PostCreate(BaseModel):
    content: str = Field(..., min_length=10, max_length=5000)
    source_url: Optional[HttpUrl] = None


class ChallengeRequest(BaseModel):
    reason_code: str = Field(..., min_length=3, max_length=50)
    comment: Optional[str] = Field(default=None, max_length=500)


class ModerationDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(uphold|revise|remove_verdict)$")
    note: str = Field(..., min_length=5, max_length=1000)
    override_score: Optional[int] = Field(default=None, ge=0, le=100)
    override_summary: Optional[str] = Field(default=None, max_length=1000)


class PostVerificationSummary(BaseModel):
    id: int
    status: str
    score: Optional[int] = None
    summary: Optional[VerificationSummary] = None
    challenge_count: int = 0
    review_status: str = "none"
    final_decision: Optional[str] = None
    final_decision_note: Optional[str] = None
    is_human_final: bool = False
    created_at: datetime


class PostSummary(BaseModel):
    id: int
    author: UserResponse
    content: str
    source_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    latest_verification_summary: Optional[PostVerificationSummary] = None
    challenge_state: str = "none"


class PostVerificationResponse(BaseModel):
    id: int
    verification_id: str
    post_id: int
    status: str
    score: Optional[int] = None
    summary: Optional[VerificationSummary] = None
    claims: list[ClaimResult] = Field(default_factory=list)
    metadata: Optional[VerificationMetadata] = None
    challenge_count: int = 0
    review_status: str = "none"
    final_decision: Optional[str] = None
    final_decision_note: Optional[str] = None
    is_human_final: bool = False
    created_at: datetime
    completed_at: Optional[datetime] = None


class ChallengeResponse(BaseModel):
    id: int
    verification_id: int
    user: UserResponse
    reason_code: str
    comment: Optional[str] = None
    status: str
    created_at: datetime


class ModerationReviewResponse(BaseModel):
    id: int
    verification_id: int
    status: str
    decision: Optional[str] = None
    note: Optional[str] = None
    override_score: Optional[int] = None
    override_summary: Optional[str] = None
    created_at: datetime
    decided_at: Optional[datetime] = None
    moderator: Optional[UserResponse] = None
    verification: PostVerificationResponse
    post: PostSummary
