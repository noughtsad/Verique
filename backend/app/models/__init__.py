"""
Models module initialization
"""
from app.models.article import Article
from app.models.claim import Claim, ClaimVerdict
from app.models.comment import Comment
from app.models.follow import UserFollow
from app.models.like import PostLike
from app.models.moderation import Challenge, ModerationReview
from app.models.post import Post
from app.models.verification import Verification
from app.models.source import Source, VerificationSource
from app.models.domain import Domain
from app.models.user import User

__all__ = [
    "Article",
    "Claim",
    "ClaimVerdict",
    "Challenge",
    "Comment",
    "UserFollow",
    "PostLike",
    "Verification",
    "ModerationReview",
    "Post",
    "Source",
    "VerificationSource",
    "Domain",
    "User",
]
