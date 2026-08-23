"""
Social feed and moderation workflow service.
"""
from __future__ import annotations

from datetime import datetime
import uuid
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.cache import cache
from app.models.article import Article
from app.models.claim import Claim, ClaimVerdict
from app.models.moderation import Challenge, ModerationReview
from app.models.post import Post
from app.models.source import Source, VerificationSource
from app.models.user import User
from app.models.verification import Verification
from app.schemas.social import (
    ChallengeRequest,
    ChallengeResponse,
    ModerationDecisionRequest,
    ModerationReviewResponse,
    PostCreate,
    PostSummary,
    PostVerificationResponse,
    PostVerificationSummary,
)
from app.schemas.verification import (
    ClaimResult,
    ClaimSources,
    SourceInfo,
    VerificationMetadata,
    VerificationSummary,
)
from app.services.verification_service import VerificationService


class SocialService:
    """Orchestrates posts, post verifications, and moderation."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.verification_service = VerificationService(db)

    async def create_post(self, author: User, payload: PostCreate) -> PostSummary:
        post = Post(
            author_id=author.id,
            content=payload.content,
            source_url=str(payload.source_url) if payload.source_url else None,
        )
        self.db.add(post)
        await self.db.flush()
        await self.db.refresh(post)
        await self.db.refresh(post, attribute_names=["author"])
        return PostSummary(
            id=post.id,
            author=post.author,
            content=post.content,
            source_url=post.source_url,
            created_at=post.created_at,
            updated_at=post.updated_at,
            latest_verification_summary=None,
            challenge_state="none",
        )

    async def list_posts(self) -> list[PostSummary]:
        result = await self.db.execute(
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.verifications)
                .selectinload(Verification.claim_verdicts)
                .selectinload(ClaimVerdict.sources)
                .selectinload(VerificationSource.source),
            )
            .order_by(Post.created_at.desc())
        )
        posts = result.scalars().unique().all()
        return [self._serialize_post(post) for post in posts]

    async def get_post(self, post_id: int) -> PostSummary:
        post = await self._load_post(post_id)
        return self._serialize_post(post)

    async def verify_post(self, post_id: int) -> PostVerificationResponse:
        post = await self._load_post(post_id)
        await self._mark_old_verifications_not_latest(post.id)

        next_version = await self._next_version(post.id)
        verification_uid = f"postver_{uuid.uuid4().hex[:16]}"
        content_hash = cache.generate_content_hash(post.content)

        article = Article(
            post_id=post.id,
            url=post.source_url,
            content_hash=content_hash,
            title=None,
            text_content=post.content,
            language="en",
            vertical="general",
            word_count=len(post.content.split()),
        )
        self.db.add(article)
        await self.db.flush()

        verification = Verification(
            verification_uid=verification_uid,
            article_id=article.id,
            post_id=post.id,
            version_number=next_version,
            is_latest=True,
            status="processing",
            review_status="none",
            content_hash=content_hash,
        )
        self.db.add(verification)
        await self.db.flush()

        try:
            result = await self.verification_service.verify(
                text=post.content,
                url=post.source_url,
                vertical=None,
                language="en",
            )
            verification.status = "completed"
            verification.overall_score = result["page_score"]
            verification.summary = result["summary"].model_dump()
            verification.models_used = result["models_used"]
            verification.sources_checked = result["sources_checked"]
            verification.processing_time_ms = result.get("processing_time_ms")
            verification.completed_at = datetime.utcnow()

            await self._persist_claims(article, verification, result["claims"])
            await self.db.flush()
            return await self.get_verification_response(verification.id)
        except Exception:
            verification.status = "failed"
            verification.review_status = "none"
            raise

    async def get_latest_verification(self, post_id: int) -> Optional[PostVerificationResponse]:
        result = await self.db.execute(
            select(Verification.id)
            .where(Verification.post_id == post_id, Verification.is_latest.is_(True))
            .order_by(Verification.created_at.desc())
        )
        verification_id = result.scalars().first()
        if verification_id is None:
            return None
        return await self.get_verification_response(verification_id)

    async def get_verification_response(self, verification_id: int) -> PostVerificationResponse:
        verification = await self._load_verification(verification_id)
        return self._serialize_verification(verification)

    async def create_challenge(
        self,
        verification_id: int,
        user: User,
        payload: ChallengeRequest,
    ) -> ChallengeResponse:
        verification = await self._load_verification(verification_id)
        existing = await self.db.execute(
            select(Challenge).where(
                Challenge.verification_id == verification_id,
                Challenge.user_id == user.id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("You have already challenged this verification")

        challenge = Challenge(
            verification_id=verification_id,
            user_id=user.id,
            reason_code=payload.reason_code,
            comment=payload.comment,
        )
        self.db.add(challenge)
        await self.db.flush()
        await self.db.refresh(challenge)

        challenge_count = await self.db.scalar(
            select(func.count(Challenge.id)).where(Challenge.verification_id == verification_id)
        )
        verification.challenge_count = int(challenge_count or 0)
        if verification.challenge_count >= settings.CHALLENGE_THRESHOLD:
            verification.status = "under_review"
            verification.review_status = "open"
            if verification.moderation_review is None:
                self.db.add(ModerationReview(verification_id=verification.id, status="open"))

        await self.db.refresh(challenge, attribute_names=["user"])
        return ChallengeResponse(
            id=challenge.id,
            verification_id=verification_id,
            user=challenge.user,
            reason_code=challenge.reason_code,
            comment=challenge.comment,
            status=challenge.status,
            created_at=challenge.created_at,
        )

    async def list_open_reviews(self) -> list[ModerationReviewResponse]:
        result = await self.db.execute(
            select(ModerationReview)
            .options(
                selectinload(ModerationReview.moderator),
                selectinload(ModerationReview.verification)
                .selectinload(Verification.claim_verdicts)
                .selectinload(ClaimVerdict.sources)
                .selectinload(VerificationSource.source),
                selectinload(ModerationReview.verification).selectinload(Verification.post).selectinload(Post.author),
            )
            .where(ModerationReview.status == "open")
            .order_by(ModerationReview.created_at.asc())
        )
        reviews = result.scalars().unique().all()
        return [self._serialize_review(review) for review in reviews]

    async def resolve_review(
        self,
        review_id: int,
        moderator: User,
        payload: ModerationDecisionRequest,
    ) -> ModerationReviewResponse:
        result = await self.db.execute(
            select(ModerationReview)
            .options(
                selectinload(ModerationReview.verification)
                .selectinload(Verification.claim_verdicts)
                .selectinload(ClaimVerdict.sources)
                .selectinload(VerificationSource.source),
                selectinload(ModerationReview.verification).selectinload(Verification.post).selectinload(Post.author),
            )
            .where(ModerationReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if review is None:
            raise ValueError("Moderation review not found")
        if review.status != "open":
            raise ValueError("This moderation review has already been resolved")

        verification = review.verification
        review.status = "resolved"
        review.moderator_id = moderator.id
        review.decision = payload.decision
        review.note = payload.note
        review.override_score = payload.override_score
        review.override_summary = payload.override_summary
        review.decided_at = datetime.utcnow()

        verification.status = "moderated"
        verification.review_status = "resolved"
        verification.final_decision = payload.decision
        verification.final_decision_note = payload.note
        verification.is_human_final = True
        verification.reviewed_at = datetime.utcnow()
        if payload.override_score is not None:
            verification.overall_score = payload.override_score
        if payload.override_summary:
            verification.summary = {"human_summary": payload.override_summary}

        await self.db.flush()
        await self.db.refresh(review, attribute_names=["moderator"])
        return self._serialize_review(review)

    async def _persist_claims(
        self,
        article: Article,
        verification: Verification,
        claims: list[Any],
    ) -> None:
        for claim_data in claims:
            claim_result = (
                claim_data if isinstance(claim_data, ClaimResult) else ClaimResult.model_validate(claim_data)
            )
            claim = Claim(
                article_id=article.id,
                text=claim_result.text,
                span_start=claim_result.span[0],
                span_end=claim_result.span[1],
                claim_type=claim_result.claim_type.value,
                topic=claim_result.topic.value,
                time_sensitivity=claim_result.time_sensitivity.value,
                is_verifiable=True,
            )
            self.db.add(claim)
            await self.db.flush()

            verdict = ClaimVerdict(
                claim_id=claim.id,
                verification_id=verification.id,
                verdict=claim_result.verdict.value,
                confidence=claim_result.confidence,
                reasoning=claim_result.reasoning,
                model_used="human" if verification.is_human_final else "pipeline",
            )
            self.db.add(verdict)
            await self.db.flush()

            for role_name, items in (
                ("supporting", claim_result.sources.supporting),
                ("contradicting", claim_result.sources.contradicting),
            ):
                for source_info in items:
                    source = await self._get_or_create_source(source_info)
                    self.db.add(
                        VerificationSource(
                            claim_verdict_id=verdict.id,
                            source_id=source.id,
                            role=role_name,
                            relevance_score=source_info.domain_score,
                            snippet_used=source_info.snippet,
                        )
                    )

    async def _get_or_create_source(self, source_info: SourceInfo) -> Source:
        result = await self.db.execute(select(Source).where(Source.url == source_info.url))
        source = result.scalar_one_or_none()
        if source is not None:
            source.last_used_at = datetime.utcnow()
            source.snippet = source_info.snippet
            source.domain_reputation_score = source_info.domain_score
            return source

        source = Source(
            url=source_info.url,
            domain=source_info.domain,
            title=source_info.domain,
            snippet=source_info.snippet,
            domain_reputation_score=source_info.domain_score,
            published_at=source_info.published_at,
        )
        self.db.add(source)
        await self.db.flush()
        return source

    async def _next_version(self, post_id: int) -> int:
        result = await self.db.execute(
            select(func.max(Verification.version_number)).where(Verification.post_id == post_id)
        )
        current = result.scalar_one_or_none()
        return int(current or 0) + 1

    async def _mark_old_verifications_not_latest(self, post_id: int) -> None:
        result = await self.db.execute(select(Verification).where(Verification.post_id == post_id))
        for verification in result.scalars().all():
            verification.is_latest = False

    async def _load_post(self, post_id: int) -> Post:
        result = await self.db.execute(
            select(Post)
            .options(selectinload(Post.author), selectinload(Post.verifications))
            .where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        if post is None:
            raise ValueError("Post not found")
        return post

    async def _load_verification(self, verification_id: int) -> Verification:
        result = await self.db.execute(
            select(Verification)
            .options(
                selectinload(Verification.post).selectinload(Post.author),
                selectinload(Verification.claim_verdicts)
                .selectinload(ClaimVerdict.claim),
                selectinload(Verification.claim_verdicts)
                .selectinload(ClaimVerdict.sources)
                .selectinload(VerificationSource.source),
                selectinload(Verification.challenges).selectinload(Challenge.user),
                selectinload(Verification.moderation_review).selectinload(ModerationReview.moderator),
            )
            .where(Verification.id == verification_id)
        )
        verification = result.scalar_one_or_none()
        if verification is None:
            raise ValueError("Verification not found")
        return verification

    def _serialize_post(self, post: Post) -> PostSummary:
        latest = self._latest_verification(post)
        challenge_state = (latest.review_status or "none") if latest else "none"
        return PostSummary(
            id=post.id,
            author=post.author,
            content=post.content,
            source_url=post.source_url,
            created_at=post.created_at,
            updated_at=post.updated_at,
            latest_verification_summary=self._serialize_verification_summary(latest) if latest else None,
            challenge_state=challenge_state,
        )

    def _serialize_verification_summary(self, verification: Verification) -> PostVerificationSummary:
        summary = (
            VerificationSummary.model_validate(verification.summary)
            if verification.summary and "human_summary" not in verification.summary
            else None
        )
        return PostVerificationSummary(
            id=verification.id,
            status=verification.status or "pending",
            score=int(verification.overall_score) if verification.overall_score is not None else None,
            summary=summary,
            challenge_count=verification.challenge_count or 0,
            review_status=verification.review_status or "none",
            final_decision=verification.final_decision,
            final_decision_note=verification.final_decision_note,
            is_human_final=bool(verification.is_human_final),
            created_at=verification.created_at,
        )

    def _serialize_verification(self, verification: Verification) -> PostVerificationResponse:
        claim_results: list[ClaimResult] = []
        for verdict in verification.claim_verdicts:
            supporting: list[SourceInfo] = []
            contradicting: list[SourceInfo] = []
            for link in verdict.sources:
                item = SourceInfo(
                    url=link.source.url,
                    domain=link.source.domain,
                    snippet=link.snippet_used or link.source.snippet or "",
                    domain_score=link.source.domain_reputation_score,
                    published_at=link.source.published_at,
                    role=link.role,
                )
                if link.role == "supporting":
                    supporting.append(item)
                elif link.role == "contradicting":
                    contradicting.append(item)

            claim_results.append(
                ClaimResult(
                    id=f"claim_{verdict.claim_id}",
                    span=[verdict.claim.span_start, verdict.claim.span_end],
                    text=verdict.claim.text,
                    claim_type=verdict.claim.claim_type,
                    topic=verdict.claim.topic,
                    time_sensitivity=verdict.claim.time_sensitivity,
                    verdict=verdict.verdict,
                    confidence=verdict.confidence,
                    reasoning=verdict.reasoning,
                    sources=ClaimSources(supporting=supporting, contradicting=contradicting),
                )
            )

        metadata = None
        if verification.processing_time_ms is not None or verification.models_used or verification.sources_checked:
            metadata = VerificationMetadata(
                processing_time_ms=verification.processing_time_ms or 0,
                models_used=verification.models_used or [],
                sources_checked=verification.sources_checked or 0,
                cached=False,
            )

        summary = (
            VerificationSummary.model_validate(verification.summary)
            if verification.summary and "human_summary" not in verification.summary
            else None
        )

        return PostVerificationResponse(
            id=verification.id,
            verification_id=verification.verification_uid,
            post_id=verification.post_id,
            status=verification.status or "pending",
            score=int(verification.overall_score) if verification.overall_score is not None else None,
            summary=summary,
            claims=claim_results,
            metadata=metadata,
            challenge_count=verification.challenge_count or 0,
            review_status=verification.review_status or "none",
            final_decision=verification.final_decision,
            final_decision_note=verification.final_decision_note,
            is_human_final=bool(verification.is_human_final),
            created_at=verification.created_at,
            completed_at=verification.completed_at,
        )

    def _serialize_review(self, review: ModerationReview) -> ModerationReviewResponse:
        post = review.verification.post
        return ModerationReviewResponse(
            id=review.id,
            verification_id=review.verification_id,
            status=review.status,
            decision=review.decision,
            note=review.note,
            override_score=review.override_score,
            override_summary=review.override_summary,
            created_at=review.created_at,
            decided_at=review.decided_at,
            moderator=review.moderator,
            verification=self._serialize_verification(review.verification),
            post=PostSummary(
                id=post.id,
                author=post.author,
                content=post.content,
                source_url=post.source_url,
                created_at=post.created_at,
                updated_at=post.updated_at,
                latest_verification_summary=self._serialize_verification_summary(review.verification),
                challenge_state=review.verification.review_status or "none",
            ),
        )

    def _latest_verification(self, post: Post) -> Optional[Verification]:
        if not post.verifications:
            return None
        latest = [verification for verification in post.verifications if verification.is_latest]
        if latest:
            return sorted(latest, key=lambda item: item.created_at, reverse=True)[0]
        return sorted(post.verifications, key=lambda item: item.created_at, reverse=True)[0]
