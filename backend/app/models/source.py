"""
Source Model - External sources used for verification
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Source(Base):
    """
    Represents an external source/webpage used for verification.
    """
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(2048), unique=True, nullable=False, index=True)
    domain = Column(String(255), nullable=False, index=True)
    
    # Source metadata
    title = Column(String(500), nullable=True)
    snippet = Column(Text, nullable=True)
    
    # Reputation
    domain_reputation_score = Column(Float, default=0.5)
    
    # Timestamps
    published_at = Column(DateTime, nullable=True)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    verification_sources = relationship("VerificationSource", back_populates="source")

    def __repr__(self):
        return f"<Source(id={self.id}, domain={self.domain})>"


class VerificationSource(Base):
    """
    Junction table linking claim verdicts to sources with role.
    """
    __tablename__ = "verification_sources"

    id = Column(Integer, primary_key=True, index=True)
    claim_verdict_id = Column(Integer, ForeignKey("claim_verdicts.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    
    # Role in verification
    role = Column(String(20), nullable=False)  # supporting, contradicting, neutral
    relevance_score = Column(Float, default=0.5)
    snippet_used = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    claim_verdict = relationship("ClaimVerdict", back_populates="sources")
    source = relationship("Source", back_populates="verification_sources")

    def __repr__(self):
        return f"<VerificationSource(verdict={self.claim_verdict_id}, source={self.source_id}, role={self.role})>"
