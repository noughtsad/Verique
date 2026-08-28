"""
API V1 Router - Main router for API version 1
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, moderation, posts, users, verification

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    verification.router,
    prefix="/verify",
    tags=["Verification"]
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Auth"]
)

api_router.include_router(
    posts.router,
    prefix="/posts",
    tags=["Posts"]
)

api_router.include_router(
    moderation.router,
    tags=["Moderation"]
)

api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"]
)
