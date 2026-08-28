"""
PostLike model — tracks which users liked which posts.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class PostLike(Base):
    """A single user's like on a post."""

    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_like_pair"),
    )

    post = relationship("Post", back_populates="likes")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<PostLike(post={self.post_id}, user={self.user_id})>"
