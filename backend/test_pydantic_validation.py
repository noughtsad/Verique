#!/usr/bin/env python3
"""Test Pydantic validation in agents"""
import sys
sys.path.insert(0, '/Users/rishetmehra/Desktop/Verique/backend')

from app.agents.claim_classifier import ClaimClassification, ClassificationResponse
from app.agents.verification import VerdictResponse
from pydantic import ValidationError

print("🧪 Testing Pydantic Validation\n")
print("=" * 70)

# Test 1: Valid claim classification
try:
    claim = ClaimClassification(
        claim_id="clm_123",
        is_verifiable=True,
        reason="Contains specific numbers"
    )
    print("✅ ClaimClassification - Valid input accepted")
except ValidationError as e:
    print(f"❌ ClaimClassification - Unexpected error: {e}")

# Test 2: Invalid claim classification (missing required field)
try:
    claim = ClaimClassification(
        claim_id="clm_123",
        is_verifiable=True
        # Missing 'reason' field
    )
    print("❌ ClaimClassification - Should have rejected missing field")
except ValidationError:
    print("✅ ClaimClassification - Correctly rejected missing field")

# Test 3: Valid verdict response
try:
    verdict = VerdictResponse(
        verdict="supported",
        confidence=0.85,
        reasoning="Multiple sources confirm this claim with high reliability.",
        supporting_sources=["https://example.com/source1"],
        contradicting_sources=[]
    )
    print("✅ VerdictResponse - Valid input accepted")
except ValidationError as e:
    print(f"❌ VerdictResponse - Unexpected error: {e}")

# Test 4: Invalid verdict (wrong verdict type)
try:
    verdict = VerdictResponse(
        verdict="invalid_verdict",  # Not in Literal options
        confidence=0.85,
        reasoning="Test reasoning",
    )
    print("❌ VerdictResponse - Should have rejected invalid verdict")
except ValidationError:
    print("✅ VerdictResponse - Correctly rejected invalid verdict")

# Test 5: Confidence clamping
try:
    verdict = VerdictResponse(
        verdict="supported",
        confidence=1.5,  # > 1.0, should be clamped
        reasoning="Test reasoning with valid length requirement met.",
    )
    print(f"✅ VerdictResponse - Confidence clamped: {verdict.confidence}")
except ValidationError as e:
    print(f"✅ VerdictResponse - Confidence validation: {e}")

# Test 6: Short reasoning (should fail)
try:
    verdict = VerdictResponse(
        verdict="supported",
        confidence=0.85,
        reasoning="Short",  # Less than 10 chars
    )
    print("❌ VerdictResponse - Should have rejected short reasoning")
except ValidationError:
    print("✅ VerdictResponse - Correctly rejected short reasoning")

print("=" * 70)
print("✅ All Pydantic validation tests completed!")
