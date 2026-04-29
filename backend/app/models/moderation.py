"""
Challenge and moderation workflow models.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Challenge(Base):
    """User challenge against a verification."""

    __tablename__ = "challenges"
    __table_args__ = (
        UniqueConstraint("verification_id", "user_id", name="uq_challenges_verification_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    verification_id = Column(Integer, ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason_code = Column(String(50), nullable=False)
    comment = Column(Text, nullable=True)
    status = Column(String(20), default="submitted", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    verification = relationship("Verification", back_populates="challenges")
    user = relationship("User", back_populates="challenges")

    def __repr__(self):
        return f"<Challenge(id={self.id}, verification_id={self.verification_id}, user_id={self.user_id})>"


class ModerationReview(Base):
    """Moderator review record for escalated fact-checks."""

    __tablename__ = "moderation_reviews"

    id = Column(Integer, primary_key=True, index=True)
    verification_id = Column(Integer, ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    moderator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(20), default="open", nullable=False)
    decision = Column(String(30), nullable=True)
    note = Column(Text, nullable=True)
    override_score = Column(Integer, nullable=True)
    override_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)

    verification = relationship("Verification", back_populates="moderation_review")
    moderator = relationship("User", back_populates="assigned_reviews")

    def __repr__(self):
        return f"<ModerationReview(id={self.id}, verification_id={self.verification_id}, status={self.status})>"
