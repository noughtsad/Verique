"""
Follow service — business logic for the social follow/unfollow system.
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.follow import UserFollow
from app.models.post import Post
from app.models.user import User
from app.models.verification import Verification
from app.schemas.follow import FollowerListItem, FollowResponse, UserProfileResponse
from app.schemas.social import PostSummary, PostVerificationSummary
from app.schemas.verification import VerificationSummary


class FollowService:
    """Handles follow relationships and user profile aggregation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Follow / Unfollow
    # ------------------------------------------------------------------

    async def follow_user(self, follower: User, username: str) -> FollowResponse:
        """Create a follow relationship. Raises ValueError on conflicts."""
        followed = await self._get_user_by_username(username)

        if followed.id == follower.id:
            raise ValueError("You cannot follow yourself")

        existing = await self.db.execute(
            select(UserFollow).where(
                UserFollow.follower_id == follower.id,
                UserFollow.followed_id == followed.id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("You are already following this user")

        follow = UserFollow(follower_id=follower.id, followed_id=followed.id)
        self.db.add(follow)
        await self.db.flush()
        await self.db.refresh(follow)
        return FollowResponse(
            follower_id=follow.follower_id,
            followed_id=follow.followed_id,
            created_at=follow.created_at,
        )

    async def unfollow_user(self, follower: User, username: str) -> None:
        """Remove a follow relationship. Raises ValueError if not following."""
        followed = await self._get_user_by_username(username)

        result = await self.db.execute(
            select(UserFollow).where(
                UserFollow.follower_id == follower.id,
                UserFollow.followed_id == followed.id,
            )
        )
        follow = result.scalar_one_or_none()
        if follow is None:
            raise ValueError("You are not following this user")

        await self.db.delete(follow)
        await self.db.flush()

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------

    async def get_profile(
        self, username: str, current_user: Optional[User] = None
    ) -> UserProfileResponse:
        """Return a public user profile with aggregated counts."""
        user = await self._get_user_by_username(username)

        followers_count = await self.db.scalar(
            select(func.count(UserFollow.follower_id)).where(
                UserFollow.followed_id == user.id
            )
        ) or 0

        following_count = await self.db.scalar(
            select(func.count(UserFollow.followed_id)).where(
                UserFollow.follower_id == user.id
            )
        ) or 0

        posts_count = await self.db.scalar(
            select(func.count(Post.id)).where(Post.author_id == user.id)
        ) or 0

        is_followed = False
        if current_user and current_user.id != user.id:
            result = await self.db.execute(
                select(UserFollow).where(
                    UserFollow.follower_id == current_user.id,
                    UserFollow.followed_id == user.id,
                )
            )
            is_followed = result.scalar_one_or_none() is not None

        return UserProfileResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            bio=getattr(user, "bio", None),
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            followers_count=followers_count,
            following_count=following_count,
            posts_count=posts_count,
            is_followed_by_me=is_followed,
        )

    async def get_user_posts(
        self, username: str, limit: int = 20, offset: int = 0
    ) -> list[PostSummary]:
        """Return paginated posts for a user."""
        from app.models.claim import ClaimVerdict
        from app.models.source import VerificationSource
        from sqlalchemy.orm import selectinload

        user = await self._get_user_by_username(username)

        result = await self.db.execute(
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.verifications)
                .selectinload(Verification.claim_verdicts)
                .selectinload(ClaimVerdict.sources)
                .selectinload(VerificationSource.source),
            )
            .where(Post.author_id == user.id)
            .order_by(Post.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        posts = result.scalars().unique().all()
        return [self._serialize_post(post) for post in posts]

    # ------------------------------------------------------------------
    # Followers / Following lists
    # ------------------------------------------------------------------

    async def list_followers(
        self,
        username: str,
        current_user: Optional[User] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[FollowerListItem]:
        """Return users who follow `username`."""
        user = await self._get_user_by_username(username)

        result = await self.db.execute(
            select(User)
            .join(UserFollow, UserFollow.follower_id == User.id)
            .where(UserFollow.followed_id == user.id)
            .order_by(UserFollow.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        followers = result.scalars().all()
        return await self._to_follower_items(followers, current_user)

    async def list_following(
        self,
        username: str,
        current_user: Optional[User] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[FollowerListItem]:
        """Return users that `username` is following."""
        user = await self._get_user_by_username(username)

        result = await self.db.execute(
            select(User)
            .join(UserFollow, UserFollow.followed_id == User.id)
            .where(UserFollow.follower_id == user.id)
            .order_by(UserFollow.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        following = result.scalars().all()
        return await self._to_follower_items(following, current_user)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_user_by_username(self, username: str) -> User:
        result = await self.db.execute(
            select(User).where(User.username == username, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise ValueError(f"User '{username}' not found")
        return user

    async def _to_follower_items(
        self, users: list[User], current_user: Optional[User]
    ) -> list[FollowerListItem]:
        """Convert User list to FollowerListItem, annotating is_followed_by_me."""
        if not users or current_user is None:
            return [
                FollowerListItem(
                    id=u.id,
                    username=u.username,
                    full_name=u.full_name,
                    bio=getattr(u, "bio", None),
                    role=u.role,
                    is_followed_by_me=False,
                )
                for u in users
            ]

        user_ids = [u.id for u in users]
        result = await self.db.execute(
            select(UserFollow.followed_id).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.followed_id.in_(user_ids),
            )
        )
        followed_ids = set(result.scalars().all())

        return [
            FollowerListItem(
                id=u.id,
                username=u.username,
                full_name=u.full_name,
                bio=getattr(u, "bio", None),
                role=u.role,
                is_followed_by_me=(u.id in followed_ids),
            )
            for u in users
        ]

    def _serialize_post(self, post: Post) -> PostSummary:
        """Serialize a Post ORM object to PostSummary schema."""
        latest = self._latest_verification(post)
        challenge_state = (latest.review_status or "none") if latest else "none"
        return PostSummary(
            id=post.id,
            author=post.author,
            content=post.content,
            source_url=post.source_url,
            created_at=post.created_at,
            updated_at=post.updated_at,
            latest_verification_summary=self._serialize_verification_summary(latest)
            if latest
            else None,
            challenge_state=challenge_state,
        )

    def _serialize_verification_summary(
        self, verification: Verification
    ) -> PostVerificationSummary:
        summary = (
            VerificationSummary.model_validate(verification.summary)
            if verification.summary and "human_summary" not in verification.summary
            else None
        )
        return PostVerificationSummary(
            id=verification.id,
            status=verification.status or "pending",
            score=int(verification.overall_score)
            if verification.overall_score is not None
            else None,
            summary=summary,
            challenge_count=verification.challenge_count or 0,
            review_status=verification.review_status or "none",
            final_decision=verification.final_decision,
            final_decision_note=verification.final_decision_note,
            is_human_final=bool(verification.is_human_final),
            created_at=verification.created_at,
        )

    def _latest_verification(self, post: Post) -> Optional[Verification]:
        if not post.verifications:
            return None
        latest = [v for v in post.verifications if v.is_latest]
        if latest:
            return sorted(latest, key=lambda v: v.created_at, reverse=True)[0]
        return sorted(post.verifications, key=lambda v: v.created_at, reverse=True)[0]
