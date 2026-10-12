"""
Notification model — persists social activity events for each user.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Notification(Base):
    """
    A single notification delivered to a user.

    actor_id  — the user who triggered the event (liker, commenter, follower)
    owner_id  — the user who *receives* the notification
    type      — one of: "like" | "comment" | "follow"
    post_id   — non-null for like / comment notifications
    """

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type = Column(String(30), nullable=False)          # "like" | "comment" | "follow"
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=True,
    )
    preview = Column(Text, nullable=True)              # short content preview (comment body)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", foreign_keys=[owner_id])
    actor = relationship("User", foreign_keys=[actor_id])
    post = relationship("Post", foreign_keys=[post_id])

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, type={self.type}, owner={self.owner_id})>"
