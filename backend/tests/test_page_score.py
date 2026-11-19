"""
The page score must only reward claims that evidence actually supports. Evidence that a
verdict did not cite (shown as related reading) is neutral and earns no bonus.
"""
from app.agents.explanation import ExplanationAgent
from app.schemas.verification import ClaimResult, ClaimSources, SourceInfo, SourceRole, Verdict
from app.services.verification_service import VerificationService


def _score(claims):
    service = VerificationService.__new__(VerificationService)  # no pipeline/LLM client needed
    return service._calculate_page_score(claims)


def _source(i: int, role: SourceRole) -> SourceInfo:
    return SourceInfo(url=f"https://s{i}.example/a", domain=f"s{i}.example", snippet="x",
                      domain_score=0.8, role=role)


def _claim(verdict: Verdict, confidence=0.9, supporting=0, neutral=0, contradicting=0) -> ClaimResult:
    return ClaimResult(
        id="c", span=[0, 1], text="claim", verdict=verdict, confidence=confidence, reasoning="r",
        sources=ClaimSources(
            supporting=[_source(i, SourceRole.SUPPORTING) for i in range(supporting)],
            contradicting=[_source(i, SourceRole.CONTRADICTING) for i in range(contradicting)],
            neutral=[_source(i, SourceRole.NEUTRAL) for i in range(neutral)],
        ),
    )


def test_unverifiable_claim_with_uncited_evidence_is_neutral():
    assert _score([_claim(Verdict.NOT_VERIFIABLE, neutral=3)]) == 50


def test_several_unverifiable_claims_stay_neutral():
    assert _score([_claim(Verdict.NOT_VERIFIABLE, neutral=3) for _ in range(3)]) == 50


def test_unverifiable_claim_gets_no_bonus_even_if_sources_were_listed_as_supporting():
    assert _score([_claim(Verdict.NOT_VERIFIABLE, supporting=3)]) == 50


def test_no_claims_is_neutral():
    assert _score([]) == 50


def test_outdated_claim_is_capped_below_the_middle_tier():
    assert _score([_claim(Verdict.OUTDATED, confidence=0.2, supporting=5)]) <= 45


def test_supported_claim_with_sources_still_scores_high():
    assert _score([_claim(Verdict.SUPPORTED, confidence=0.9, supporting=3)]) >= 85


def test_score_stays_in_range():
    for verdict in Verdict:
        for confidence in (0.0, 0.5, 1.0):
            for n in (0, 1, 8):
                score = _score([_claim(verdict, confidence, supporting=n, contradicting=n)])
                assert 0 <= score <= 100


def test_uncited_evidence_is_listed_as_neutral_not_supporting():
    agent = ExplanationAgent.__new__(ExplanationAgent)
    evidence = [{"url": f"https://s{i}.example/a", "domain": f"s{i}.example", "snippet": "x",
                 "domain_reputation": 0.7} for i in range(4)]
    sources = agent._build_sources(evidence=evidence, supporting_urls=[], contradicting_urls=[])
    assert sources.supporting == []
    assert [s.url for s in sources.neutral] == [e["url"] for e in evidence[:3]]


def test_failed_verification_is_neutral():
    """A claim that could not be verified (confidence 0) must not move the score."""
    assert _score([_claim(Verdict.NOT_VERIFIABLE, confidence=0.0)]) == 50


def test_best_and_worst_pages_land_on_either_side_of_neutral():
    best = _score([_claim(Verdict.STRONGLY_SUPPORTED, 1.0, supporting=10)])
    worst = _score([_claim(Verdict.CONTRADICTED, 1.0, contradicting=10)])
    assert 0 <= worst < 50 < best <= 100


def test_verdict_ordering():
    results = [
        _score([_claim(v, 0.9)])
        for v in (Verdict.STRONGLY_SUPPORTED, Verdict.SUPPORTED, Verdict.MIXED, Verdict.CONTRADICTED)
    ]
    assert results == sorted(results, reverse=True)
    assert results[0] > results[-1]


def test_low_confidence_pulls_score_toward_neutral():
    confident = _score([_claim(Verdict.SUPPORTED, 0.95)])
    unsure = _score([_claim(Verdict.SUPPORTED, 0.2)])
    assert 50 <= unsure < confident


def test_mixed_claim_cannot_pass_even_with_many_sources():
    """The strict penalty caps mixed/contradicted claims regardless of source count."""
    assert _score([_claim(Verdict.MIXED, 1.0, supporting=20)]) <= 45
    assert _score([_claim(Verdict.CONTRADICTED, 1.0, supporting=20)]) <= 20


def test_global_bonus_not_applied_when_page_has_misinformation():
    clean = [_claim(Verdict.SUPPORTED, 0.9, supporting=6) for _ in range(3)]
    tainted = clean + [_claim(Verdict.CONTRADICTED, 0.9, contradicting=2)]
    assert _score(tainted) < _score(clean)
