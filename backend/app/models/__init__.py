"""
Models module initialization
"""
from app.models.article import Article
from app.models.claim import Claim, ClaimVerdict
from app.models.verification import Verification
from app.models.source import Source, VerificationSource
from app.models.domain import Domain

__all__ = [
    "Article",
    "Claim",
    "ClaimVerdict",
    "Verification",
    "Source",
    "VerificationSource",
    "Domain",
]
