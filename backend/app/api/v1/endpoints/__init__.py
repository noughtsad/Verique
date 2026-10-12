"""
API endpoints module initialization
"""
from app.api.v1.endpoints import auth, chat, health, moderation, notifications, posts, verification

__all__ = ["auth", "chat", "notifications", "verification", "health", "posts", "moderation"]
