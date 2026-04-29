"""
Verification Model - Represents a verification session
"""
from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Float, JSON, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Verification(Base):
    """
    Represents a complete verification session for an article.
    """
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, index=True)
    verification_uid = Column(String(50), unique=True, index=True, nullable=False)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    is_latest = Column(Boolean, default=True, nullable=False)
    
    # Status
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, under_review, moderated
    
    # Results
    overall_score = Column(Float, nullable=True)
    summary = Column(JSON, nullable=True)  # Verdict counts
    
    # Metadata
    processing_time_ms = Column(Integer, nullable=True)
    models_used = Column(JSON, default=list)
    sources_checked = Column(Integer, default=0)
    
    # Blockchain anchoring (optional)
    content_hash = Column(String(64), nullable=True)
    verification_hash = Column(String(64), nullable=True)
    blockchain_tx = Column(String(100), nullable=True)

    # Social workflow
    challenge_count = Column(Integer, default=0, nullable=False)
    review_status = Column(String(20), default="none", nullable=False)
    final_decision = Column(String(30), nullable=True)
    final_decision_note = Column(Text, nullable=True)
    is_human_final = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    # Relationships
    post = relationship("Post", back_populates="verifications")
    article = relationship("Article", back_populates="verifications")
    claim_verdicts = relationship("ClaimVerdict", back_populates="verification", cascade="all, delete-orphan")
    challenges = relationship("Challenge", back_populates="verification", cascade="all, delete-orphan")
    moderation_review = relationship("ModerationReview", back_populates="verification", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Verification(id={self.id}, uid={self.verification_uid}, status={self.status})>"
