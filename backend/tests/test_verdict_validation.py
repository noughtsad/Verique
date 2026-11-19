"""
Schema validation for LLM output models (VerdictResponse, ClaimClassification).
These models are the guard between raw model output and the pipeline, so
malformed output must be rejected rather than silently accepted.
"""
import pytest
from pydantic import ValidationError

from app.agents.claim_classifier import ClaimClassification
from app.agents.verification import VerdictResponse

VALID = {
    "verdict": "supported",
    "confidence": 0.85,
    "reasoning": "Multiple sources confirm this claim with high reliability.",
    "supporting_sources": ["https://example.com/source1"],
    "contradicting_sources": [],
}


def test_valid_verdict_is_accepted():
    v = VerdictResponse(**VALID)
    assert v.verdict == "supported"
    assert v.confidence == 0.85


def test_unknown_verdict_is_rejected():
    with pytest.raises(ValidationError):
        VerdictResponse(**{**VALID, "verdict": "invalid_verdict"})


def test_short_reasoning_is_rejected():
    with pytest.raises(ValidationError):
        VerdictResponse(**{**VALID, "reasoning": "Short"})


@pytest.mark.parametrize("confidence", [1.5, -0.1])
def test_out_of_range_confidence_is_rejected(confidence):
    # Documents current behaviour: the Field bounds reject the value before
    # the clamp_confidence validator can clamp it.
    with pytest.raises(ValidationError):
        VerdictResponse(**{**VALID, "confidence": confidence})


def test_valid_claim_classification_is_accepted():
    c = ClaimClassification(claim_id="clm_123", is_verifiable=True, reason="Contains specific numbers")
    assert c.is_verifiable is True


def test_claim_classification_requires_reason():
    with pytest.raises(ValidationError):
        ClaimClassification(claim_id="clm_123", is_verifiable=True)
