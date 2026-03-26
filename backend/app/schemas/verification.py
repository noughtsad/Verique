"""
Pydantic schemas for API request/response models
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, HttpUrl


class Vertical(str, Enum):
    """Content vertical categories."""
    ECOMMERCE = "ecommerce"
    SAAS = "saas"
    TECH = "tech"
    FINANCE = "finance"
    HEALTH = "health"
    EDUCATION = "education"
    PROFESSIONAL = "professional"
    GENERAL = "general"


class TimeSensitivity(str, Enum):
    """Time sensitivity of claims."""
    HIGH = "high"      # Numbers, stats that change frequently
    MEDIUM = "medium"  # Facts that may become outdated
    LOW = "low"        # Timeless facts


class ClaimType(str, Enum):
    """Types of factual claims."""
    NUMERIC = "numeric"      # Numbers, statistics
    ENTITY = "entity"        # About a specific entity/product
    TEMPORAL = "temporal"    # Time-related facts
    COMPARATIVE = "comparative"  # Comparisons
    CAUSAL = "causal"        # Cause-effect claims
    GENERAL = "general"


class Verdict(str, Enum):
    """Verification verdict categories."""
    STRONGLY_SUPPORTED = "strongly_supported"
    SUPPORTED = "supported"
    MIXED = "mixed"
    WEAK = "weak"
    CONTRADICTED = "contradicted"
    OUTDATED = "outdated"
    NOT_VERIFIABLE = "not_verifiable"


class SourceRole(str, Enum):
    """Role of a source in verification."""
    SUPPORTING = "supporting"
    CONTRADICTING = "contradicting"
    NEUTRAL = "neutral"


# ===========================================
# Request Schemas
# ===========================================

class VerifyRequest(BaseModel):
    """Request to verify content."""
    text: str = Field(
        ..., 
        min_length=10,
        max_length=50000,
        description="The text content to verify"
    )
    url: Optional[HttpUrl] = Field(
        None, 
        description="Source URL of the content (optional)"
    )
    vertical: Optional[Vertical] = Field(
        Vertical.GENERAL,
        description="Content category for optimized verification"
    )
    language: Optional[str] = Field(
        "en",
        description="Content language (ISO 639-1 code)"
    )
    options: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional verification options"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Our product is used by over 10,000 teams worldwide and reduces costs by 50%.",
                "url": "https://example.com/product",
                "vertical": "saas",
                "language": "en"
            }
        }


class VerifyUrlRequest(BaseModel):
    """Request to verify content from a URL."""
    url: HttpUrl = Field(..., description="URL to fetch and verify")
    vertical: Optional[Vertical] = Field(Vertical.GENERAL)
    options: Optional[Dict[str, Any]] = None


# ===========================================
# Response Schemas
# ===========================================

class SourceInfo(BaseModel):
    """Information about a source."""
    url: str
    domain: str
    snippet: str
    domain_score: float = Field(..., ge=0, le=1)
    published_at: Optional[datetime] = None
    role: SourceRole = SourceRole.NEUTRAL

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://example.com/stats",
                "domain": "example.com",
                "snippet": "Used by 12,000+ teams globally",
                "domain_score": 0.85,
                "published_at": "2024-08-15T00:00:00Z",
                "role": "supporting"
            }
        }


class ClaimSources(BaseModel):
    """Sources for a claim organized by role."""
    supporting: List[SourceInfo] = []
    contradicting: List[SourceInfo] = []


class ClaimResult(BaseModel):
    """Verification result for a single claim."""
    id: str
    span: List[int] = Field(..., min_length=2, max_length=2)
    text: str
    claim_type: ClaimType = ClaimType.GENERAL
    topic: Vertical = Vertical.GENERAL
    time_sensitivity: TimeSensitivity = TimeSensitivity.LOW
    verdict: Verdict
    confidence: float = Field(..., ge=0, le=1)
    reasoning: str
    sources: ClaimSources

    class Config:
        json_schema_extra = {
            "example": {
                "id": "clm_001",
                "span": [0, 51],
                "text": "Our product is used by over 10,000 teams worldwide",
                "claim_type": "numeric",
                "topic": "saas",
                "time_sensitivity": "high",
                "verdict": "supported",
                "confidence": 0.82,
                "reasoning": "Multiple sources confirm usage figures around 10,000-12,000 teams.",
                "sources": {
                    "supporting": [
                        {
                            "url": "https://company.com/about",
                            "domain": "company.com",
                            "snippet": "Trusted by 12,000+ teams",
                            "domain_score": 0.85,
                            "role": "supporting"
                        }
                    ],
                    "contradicting": []
                }
            }
        }


class VerificationSummary(BaseModel):
    """Summary of verification results."""
    strongly_supported: int = 0
    supported: int = 0
    mixed: int = 0
    weak: int = 0
    contradicted: int = 0
    outdated: int = 0
    not_verifiable: int = 0


class VerificationMetadata(BaseModel):
    """Metadata about the verification process."""
    processing_time_ms: int
    models_used: List[str]
    sources_checked: int
    cached: bool = False


class VerificationResponse(BaseModel):
    """Complete verification response."""
    verification_id: str
    status: str = "completed"
    page_score: int = Field(..., ge=0, le=100)
    summary: VerificationSummary
    claims: List[ClaimResult]
    metadata: VerificationMetadata
    content_hash: Optional[str] = None
    blockchain_tx: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "verification_id": "ver_abc123def456",
                "status": "completed",
                "page_score": 72,
                "summary": {
                    "strongly_supported": 1,
                    "supported": 1,
                    "mixed": 0,
                    "weak": 1,
                    "contradicted": 0,
                    "outdated": 0,
                    "not_verifiable": 0
                },
                "claims": [],
                "metadata": {
                    "processing_time_ms": 8420,
                    "models_used": ["gpt-4o"],
                    "sources_checked": 24,
                    "cached": False
                }
            }
        }


class VerificationStatus(BaseModel):
    """Status of a verification job."""
    verification_id: str
    status: str  # pending, processing, completed, failed
    progress: Optional[int] = None  # 0-100
    message: Optional[str] = None
    result: Optional[VerificationResponse] = None


# ===========================================
# Agent Internal Schemas
# ===========================================

class ExtractedClaim(BaseModel):
    """Claim extracted from text (pre-verification)."""
    id: str
    span_start: int
    span_end: int
    text: str
    claim_type: ClaimType = ClaimType.GENERAL
    topic: Vertical = Vertical.GENERAL
    time_sensitivity: TimeSensitivity = TimeSensitivity.LOW
    is_verifiable: bool = True


class SearchQuery(BaseModel):
    """Search query generated for a claim."""
    claim_id: str
    queries: List[str]
    search_vertical: str = "web"


class EvidenceItem(BaseModel):
    """Raw evidence item from retrieval."""
    url: str
    title: str
    snippet: str
    domain: str
    published_at: Optional[datetime] = None
    relevance_score: float = 0.0
    domain_reputation: float = 0.5


class RankedEvidence(BaseModel):
    """Evidence ranked and scored for a claim."""
    claim_id: str
    evidence: List[EvidenceItem]
    total_found: int


class ClaimVerdict(BaseModel):
    """Verification verdict for a claim."""
    claim_id: str
    verdict: Verdict
    confidence: float
    reasoning: str
    supporting_evidence: List[EvidenceItem]
    contradicting_evidence: List[EvidenceItem]
    model_used: str


# ===========================================
# Error Schemas
# ===========================================

class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "error": "validation_error",
                "message": "Text is too short. Minimum 10 characters required.",
                "details": {"field": "text", "min_length": 10}
            }
        }
