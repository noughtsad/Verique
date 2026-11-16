"""
Tests for VerificationService._calculate_page_score.

The method only reads its argument, so the service is built without
__init__ (which would construct the whole LLM pipeline and need API keys).
"""
import pytest

from app.schemas.verification import ClaimResult, ClaimSources, Verdict
from app.services.verification_service import VerificationService


@pytest.fixture
def score():
    service = VerificationService.__new__(VerificationService)
    return service._calculate_page_score


def _claim(verdict, confidence=0.9, supporting=0, contradicting=0, idx=1):
    # model_construct skips Source validation: only the list lengths matter here.
    sources = ClaimSources.model_construct(
        supporting=["s"] * supporting, contradicting=["c"] * contradicting
    )
    return ClaimResult(
        id=f"clm_{idx}",
        span=[0, 10],
        text="A claim.",
        verdict=verdict,
        confidence=confidence,
        reasoning="Reasoning text.",
        sources=sources,
    )


def test_no_claims_is_neutral(score):
    assert score([]) == 50


def test_failed_verification_is_neutral(score):
    """A claim that could not be verified (confidence 0) must not move the score."""
    assert score([_claim(Verdict.NOT_VERIFIABLE, confidence=0.0)]) == 50


def test_scores_stay_within_bounds(score):
    best = score([_claim(Verdict.STRONGLY_SUPPORTED, 1.0, supporting=10)])
    worst = score([_claim(Verdict.CONTRADICTED, 1.0, contradicting=10)])
    assert 0 <= worst < 50 < best <= 100


def test_verdict_ordering(score):
    results = [
        score([_claim(v, 0.9)])
        for v in (Verdict.STRONGLY_SUPPORTED, Verdict.SUPPORTED, Verdict.MIXED, Verdict.CONTRADICTED)
    ]
    assert results == sorted(results, reverse=True)
    assert results[0] > results[-1]


def test_low_confidence_pulls_score_toward_neutral(score):
    confident = score([_claim(Verdict.SUPPORTED, 0.95)])
    unsure = score([_claim(Verdict.SUPPORTED, 0.2)])
    assert 50 <= unsure < confident


def test_mixed_claim_cannot_pass_even_with_many_sources(score):
    """The strict penalty caps mixed/contradicted claims regardless of source count."""
    assert score([_claim(Verdict.MIXED, 1.0, supporting=20)]) <= 45
    assert score([_claim(Verdict.CONTRADICTED, 1.0, supporting=20)]) <= 20


def test_global_bonus_not_applied_when_page_has_misinformation(score):
    clean = [_claim(Verdict.SUPPORTED, 0.9, supporting=6, idx=i) for i in range(3)]
    tainted = clean + [_claim(Verdict.CONTRADICTED, 0.9, supporting=0, contradicting=2, idx=9)]
    assert score(tainted) < score(clean)
