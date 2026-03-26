"""
Claim Model - Individual claims extracted from articles
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Claim(Base):
    """
    Represents a single factual claim extracted from an article.
    """
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    
    # Claim content
    text = Column(Text, nullable=False)
    span_start = Column(Integer, nullable=False)
    span_end = Column(Integer, nullable=False)
    
    # Classification
    claim_type = Column(String(50), default="general")  # numeric, entity, temporal, etc.
    topic = Column(String(50), default="general")  # saas, finance, health, etc.
    time_sensitivity = Column(String(20), default="low")  # high, medium, low
    is_verifiable = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    article = relationship("Article", back_populates="claims")
    verdicts = relationship("ClaimVerdict", back_populates="claim", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Claim(id={self.id}, text={self.text[:50]}...)>"


class ClaimVerdict(Base):
    """
    Verification verdict for a claim.
    """
    __tablename__ = "claim_verdicts"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    verification_id = Column(Integer, ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False)
    
    # Verdict details
    verdict = Column(String(30), nullable=False)  # strongly_supported, supported, etc.
    confidence = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=False)
    
    # Model information
    model_used = Column(String(50), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    claim = relationship("Claim", back_populates="verdicts")
    verification = relationship("Verification", back_populates="claim_verdicts")
    sources = relationship("VerificationSource", back_populates="claim_verdict", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ClaimVerdict(id={self.id}, verdict={self.verdict})>"
