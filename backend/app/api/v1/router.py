"""
API V1 Router - Main router for API version 1
"""
from fastapi import APIRouter

from app.api.v1.endpoints import verification, health

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    verification.router,
    prefix="/verify",
    tags=["Verification"]
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"]
)
