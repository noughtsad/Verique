"""
Unit tests for the domain-reputation bookkeeping wired into the
verification pipeline (SocialService._record_domain_outcome /
_get_or_create_domain / _claim_accuracy_outcome).

Scope note: these exercise the accuracy-scoring logic directly rather
than the full _persist_claims -> verify_post pipeline, which would
require standing up the entire Article/Claim/Verification schema. The
domain-reputation logic is self-contained (Domain has no FK to those
tables), so testing it in isolation covers the actual new, riskier code
without that overhead.
"""
import pytest
from sqlalchemy import select

from app.models.domain import Domain
from app.schemas.verification import Verdict
from app.services.social_service import SocialService, _claim_accuracy_outcome


@pytest.mark.parametrize(
    "verdict, expected",
    [
        (Verdict.STRONGLY_SUPPORTED, "true"),
        (Verdict.SUPPORTED, "true"),
        (Verdict.MIXED, "mixed"),
        (Verdict.WEAK, "mixed"),
        (Verdict.CONTRADICTED, "false"),
        (Verdict.OUTDATED, "false"),
        (Verdict.NOT_VERIFIABLE, None),
    ],
)
def test_claim_accuracy_outcome_mapping(verdict, expected):
    assert _claim_accuracy_outcome(verdict) == expected


async def test_supporting_source_on_true_claim_is_accurate(db_session):
    service = SocialService(db_session)
    await service._record_domain_outcome("nejm.org", "supporting", "true")

    domain = await service._get_or_create_domain("nejm.org")
    assert domain.total_claims_checked == 1
    assert domain.claims_supported == 1
    assert domain.claims_contradicted == 0
    assert domain.claims_mixed == 0
    assert domain.reputation_score == 1.0


async def test_contradicting_source_on_false_claim_is_accurate(db_session):
    """The CDC case: correctly debunking a false claim counts in the
    domain's favor, not against it."""
    service = SocialService(db_session)
    await service._record_domain_outcome("cdc.gov", "contradicting", "false")

    domain = await service._get_or_create_domain("cdc.gov")
    assert domain.claims_supported == 1
    assert domain.claims_contradicted == 0
    assert domain.reputation_score == 1.0


async def test_supporting_source_on_false_claim_is_inaccurate(db_session):
    service = SocialService(db_session)
    await service._record_domain_outcome("randomblog.com", "supporting", "false")

    domain = await service._get_or_create_domain("randomblog.com")
    assert domain.claims_supported == 0
    assert domain.claims_contradicted == 1
    assert domain.reputation_score == 0.0


async def test_contradicting_source_on_true_claim_is_inaccurate(db_session):
    service = SocialService(db_session)
    await service._record_domain_outcome("randomblog.com", "contradicting", "true")

    domain = await service._get_or_create_domain("randomblog.com")
    assert domain.claims_contradicted == 1
    assert domain.reputation_score == 0.0


async def test_mixed_verdict_counts_as_mixed_regardless_of_role(db_session):
    service = SocialService(db_session)
    await service._record_domain_outcome("example.com", "supporting", "mixed")
    await service._record_domain_outcome("example.com", "contradicting", "mixed")

    domain = await service._get_or_create_domain("example.com")
    assert domain.total_claims_checked == 2
    assert domain.claims_mixed == 2
    assert domain.reputation_score == 0.5


async def test_not_verifiable_claim_leaves_no_signal(db_session):
    service = SocialService(db_session)
    await service._record_domain_outcome("newdomain.com", "supporting", None)

    result = await db_session.execute(select(Domain).where(Domain.domain == "newdomain.com"))
    assert result.scalar_one_or_none() is None


async def test_reputation_accumulates_across_multiple_claims(db_session):
    """A domain cited across several claims builds a running average
    instead of each call overwriting the last."""
    service = SocialService(db_session)
    await service._record_domain_outcome("mixedtrack.com", "supporting", "true")  # accurate
    await service._record_domain_outcome("mixedtrack.com", "supporting", "false")  # inaccurate
    await service._record_domain_outcome("mixedtrack.com", "contradicting", "false")  # accurate

    domain = await service._get_or_create_domain("mixedtrack.com")
    assert domain.total_claims_checked == 3
    assert domain.claims_supported == 2
    assert domain.claims_contradicted == 1
    assert domain.reputation_score == pytest.approx(2 / 3)
