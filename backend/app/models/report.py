"""
PostReport model — a user's report of a post for violating community rules.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base

# Keep in sync with REPORT_REASONS in frontend/src/lib/types.ts.
REPORT_REASONS = (
    "impersonation",
    "misinformation",
    "spam",
    "harassment",
    "scam",
    "other",
)


class PostReport(Base):
    """A single user's report of a post. One report per user per post."""

    __tablename__ = "post_reports"
    __table_args__ = (
        UniqueConstraint("post_id", "reporter_id", name="uq_post_report_pair"),
    )

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason_code = Column(String(30), nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String(20), default="open", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    post = relationship("Post", back_populates="reports")
    reporter = relationship("User")

    def __repr__(self) -> str:
        return f"<PostReport(post={self.post_id}, reporter={self.reporter_id}, reason={self.reason_code})>"
