"""
Bookmark model — posts a user has saved for later.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Bookmark(Base):
    """A single user's bookmark of a post."""

    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_bookmark_pair"),
    )

    post = relationship("Post", back_populates="bookmarks")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<Bookmark(post={self.post_id}, user={self.user_id})>"
