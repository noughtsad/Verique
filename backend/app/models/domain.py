"""
Domain Model - Domain reputation tracking
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float

from app.core.database import Base


class Domain(Base):
    """
    Tracks reputation and statistics for domains.
    """
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), unique=True, nullable=False, index=True)
    
    # Reputation metrics
    reputation_score = Column(Float, default=0.5)  # 0-1 scale
    
    # Statistics
    total_claims_checked = Column(Integer, default=0)
    claims_supported = Column(Integer, default=0)
    claims_contradicted = Column(Integer, default=0)
    claims_mixed = Column(Integer, default=0)
    
    # Category
    category = Column(String(50), nullable=True)  # news, official, blog, social, etc.
    is_official = Column(Integer, default=0)  # 1 if official/authoritative source
    
    # Timestamps
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Domain(domain={self.domain}, score={self.reputation_score})>"
    
    def update_reputation(self):
        """Recalculate reputation based on claim statistics."""
        total = self.total_claims_checked
        if total == 0:
            self.reputation_score = 0.5
            return
        
        # Weighted calculation
        supported_weight = 1.0
        mixed_weight = 0.5
        contradicted_weight = 0.0
        
        weighted_sum = (
            self.claims_supported * supported_weight +
            self.claims_mixed * mixed_weight +
            self.claims_contradicted * contradicted_weight
        )
        
        self.reputation_score = weighted_sum / total
