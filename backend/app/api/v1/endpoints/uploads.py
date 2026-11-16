"""
Image upload endpoint (post images and avatars).
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User
from app.schemas import UploadResponse
from app.services.storage_service import (
    InvalidUploadError,
    StorageNotConfiguredError,
    upload_image,
)

router = APIRouter()


@router.post("/image", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image_endpoint(
    kind: str = Query(default="post", pattern="^(post|avatar)$"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Store an image and return its public URL, to send with a new post or a profile update."""
    # Read one byte past the limit so an oversized file is rejected without reading it all.
    data = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    try:
        url = await upload_image(data, folder=kind, owner_id=current_user.id)
    except InvalidUploadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except StorageNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Image uploads are not configured"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="The image could not be stored. Try again later."
        ) from exc
    return UploadResponse(url=url)
