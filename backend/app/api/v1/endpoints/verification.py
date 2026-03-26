"""
Verification API Endpoints
"""
import time
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.core.database import get_db
from app.core.cache import cache
from app.schemas import (
    VerifyRequest,
    VerifyUrlRequest,
    VerificationResponse,
    VerificationStatus,
    ErrorResponse,
)
from app.services.verification_service import VerificationService
from app.services.content_fetcher import ContentFetcher

logger = structlog.get_logger()
router = APIRouter()


@router.post(
    "/",
    response_model=VerificationResponse,
    responses={
        400: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Verify text content",
    description="""
    Analyze text content and verify factual claims.
    
    This endpoint:
    1. Extracts factual claims from the provided text
    2. Retrieves evidence from authoritative sources
    3. Rates each claim with a verdict and confidence score
    4. Returns highlighted claims with supporting/contradicting sources
    
    **Note:** Processing may take 15-30 seconds for typical articles.
    """
)
async def verify_content(
    request: VerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify factual claims in text content."""
    start_time = time.time()
    verification_id = f"ver_{uuid.uuid4().hex[:16]}"
    
    logger.info(
        "Starting verification",
        verification_id=verification_id,
        text_length=len(request.text),
        vertical=request.vertical
    )
    
    try:
        # Check cache first
        content_hash = cache.generate_content_hash(request.text)
        cached_result = await cache.get_cached_verification(content_hash)
        
        if cached_result:
            logger.info("Returning cached result", verification_id=verification_id)
            cached_result["verification_id"] = verification_id
            cached_result["metadata"]["cached"] = True
            return VerificationResponse(**cached_result)
        
        # Run verification pipeline
        service = VerificationService(db)
        result = await service.verify(
            text=request.text,
            url=str(request.url) if request.url else None,
            vertical=request.vertical,
            language=request.language
        )
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Build response
        response = VerificationResponse(
            verification_id=verification_id,
            status="completed",
            page_score=result["page_score"],
            summary=result["summary"],
            claims=result["claims"],
            metadata={
                "processing_time_ms": processing_time_ms,
                "models_used": result["models_used"],
                "sources_checked": result["sources_checked"],
                "cached": False
            },
            content_hash=content_hash
        )
        
        # Cache the result
        await cache.cache_verification(content_hash, response.model_dump())
        
        logger.info(
            "Verification completed",
            verification_id=verification_id,
            page_score=result["page_score"],
            claims_count=len(result["claims"]),
            processing_time_ms=processing_time_ms
        )
        
        return response
        
    except Exception as e:
        logger.error(
            "Verification failed",
            verification_id=verification_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error": "verification_failed",
                "message": f"Failed to verify content: {str(e)}"
            }
        )


@router.post(
    "/url",
    response_model=VerificationResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Verify content from URL",
    description="Fetch content from a URL and verify its factual claims."
)
async def verify_url(
    request: VerifyUrlRequest,
    db: AsyncSession = Depends(get_db)
):
    """Fetch content from URL and verify claims."""
    logger.info("Fetching content from URL", url=str(request.url))
    
    try:
        # Fetch content from URL
        fetcher = ContentFetcher()
        content = await fetcher.fetch(str(request.url))
        
        if not content or not content.get("text"):
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "fetch_failed",
                    "message": "Could not extract text content from URL"
                }
            )
        
        # Create verify request with fetched content
        verify_request = VerifyRequest(
            text=content["text"],
            url=request.url,
            vertical=request.vertical
        )
        
        return await verify_content(verify_request, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("URL verification failed", url=str(request.url), error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error": "url_verification_failed",
                "message": f"Failed to verify URL: {str(e)}"
            }
        )


@router.get(
    "/{verification_id}",
    response_model=VerificationStatus,
    responses={
        404: {"model": ErrorResponse},
    },
    summary="Get verification status",
    description="Get the status and results of a verification job."
)
async def get_verification(
    verification_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get verification status and results."""
    # TODO: Implement database lookup for async jobs
    # For now, verifications are synchronous
    raise HTTPException(
        status_code=404,
        detail={
            "error": "not_found",
            "message": f"Verification {verification_id} not found"
        }
    )


@router.post(
    "/async",
    response_model=VerificationStatus,
    summary="Start async verification",
    description="Start an asynchronous verification job for large content."
)
async def verify_async(
    request: VerifyRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Start asynchronous verification for large content."""
    verification_id = f"ver_{uuid.uuid4().hex[:16]}"
    
    # TODO: Implement async job queue with Celery
    # For now, return pending status
    
    return VerificationStatus(
        verification_id=verification_id,
        status="pending",
        progress=0,
        message="Verification job queued"
    )
