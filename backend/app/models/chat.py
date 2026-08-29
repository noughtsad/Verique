"""
Chat models — 1:1 direct-message conversations and their messages.
"""
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Conversation(Base):
    """A 1:1 direct-message thread between exactly two users.

    user_a_id is always the smaller user id, user_b_id the larger — callers
    must canonicalize (min, max) before querying/creating so there is only
    ever one row per pair. See ChatService._canonical_pair().
    """

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_b_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_message_at = Column(DateTime, nullable=True)
    user_a_last_read_at = Column(DateTime, nullable=True)
    user_b_last_read_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_conversation_pair"),
        CheckConstraint("user_a_id < user_b_id", name="ck_conversation_user_order"),
    )

    user_a = relationship("User", foreign_keys=[user_a_id])
    user_b = relationship("User", foreign_keys=[user_b_id])
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, users=({self.user_a_id},{self.user_b_id}))>"


class Message(Base):
    """A single text message within a conversation."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, conversation={self.conversation_id}, sender={self.sender_id})>"
