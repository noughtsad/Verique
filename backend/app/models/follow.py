"""
UserFollow association model for the social follow/unfollow system.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserFollow(Base):
    """
    Represents a follow relationship between two users.
    follower_id  → the user who clicked "Follow"
    followed_id  → the user being followed
    """

    __tablename__ = "user_follows"

    follower_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    followed_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("follower_id", "followed_id", name="uq_follow_pair"),
    )

    # Convenience back-references
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed = relationship("User", foreign_keys=[followed_id], back_populates="followers")

    def __repr__(self) -> str:
        return f"<UserFollow(follower={self.follower_id}, followed={self.followed_id})>"
