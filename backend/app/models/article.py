"""
Article Model - Stores verified content
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class Article(Base):
    """
    Represents a piece of content that has been verified.
    """
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(2048), nullable=True, index=True)
    content_hash = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=True)
    text_content = Column(Text, nullable=False)
    language = Column(String(10), default="en")
    vertical = Column(String(50), default="general")
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    claims = relationship("Claim", back_populates="article", cascade="all, delete-orphan")
    verifications = relationship("Verification", back_populates="article", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("ix_articles_content_hash_created", "content_hash", "created_at"),
    )

    def __repr__(self):
        return f"<Article(id={self.id}, hash={self.content_hash[:8]}...)>"
