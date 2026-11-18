"""
Re-verifying a post must never hide a good or human verdict, and verdict bookkeeping
(sources, domain reputation, moderation) must stay consistent across versions.
"""
import os
import tempfile

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.agents.pipeline import VerificationPipeline
from app.core.database import Base
from app.models.domain import Domain
from app.models.moderation import ModerationReview
from app.models.post import Post
from app.models.user import User
from app.models.verification import Verification
from app.models.source import VerificationSource
from app.schemas.social import ChallengeRequest, ModerationDecisionRequest
from app.schemas.verification import (
    ClaimResult, ClaimSources, SourceInfo, SourceRole, Verdict, VerificationSummary,
)
from app.services.social_service import SocialService, VerificationLocked


@pytest.fixture(autouse=True)
def _groq_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")


@pytest_asyncio.fixture
async def db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()
    os.unlink(path)


async def _user(db, name: str, role: str = "user") -> User:
    user = User(email=f"{name}@example.com", username=name, password_hash="x", role=role, is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _post(db, author: User) -> Post:
    post = Post(author_id=author.id, content="Forty percent of Iowa's energy is renewable.")
    db.add(post)
    await db.flush()
    return post


def _source(url: str, role: SourceRole) -> SourceInfo:
    return SourceInfo(url=url, domain=url.split("/")[2], snippet="x", domain_score=0.8, role=role)


def _claim(verdict=Verdict.SUPPORTED, supporting=("https://good.example/a",), neutral=()) -> ClaimResult:
    return ClaimResult(
        id="clm_1", span=[0, 10], text="Forty percent of Iowa's energy is renewable.",
        verdict=verdict, confidence=0.9, reasoning="Sources agree.",
        sources=ClaimSources(
            supporting=[_source(u, SourceRole.SUPPORTING) for u in supporting],
            neutral=[_source(u, SourceRole.NEUTRAL) for u in neutral],
        ),
    )


def _service(db, *, claims=None, errors=None, page_score=90) -> SocialService:
    service = SocialService(db)

    async def verify(**kwargs):
        return {"claims": claims if claims is not None else [_claim()], "page_score": page_score,
                "summary": VerificationSummary(supported=1), "models_used": [], "sources_checked": 1,
                "verification_errors": errors or []}

    service.verification_service.verify = verify
    return service


async def _latest(db, post_id: int) -> list[Verification]:
    result = await db.execute(
        select(Verification).where(Verification.post_id == post_id, Verification.is_latest.is_(True))
    )
    return list(result.scalars().all())


async def _domain(db, name: str):
    return await db.scalar(select(Domain).where(Domain.domain == name))


# --- failed runs keep the good verdict --------------------------------------------

async def test_failed_reverify_keeps_previous_verdict_as_latest(db):
    author = await _user(db, "alice")
    post = await _post(db, author)
    good = await _service(db).verify_post(post.id, author)

    failed = await _service(db, errors=["the AI provider's rate limit was reached"]).verify_post(post.id, author)

    assert failed.status == "failed"  # the caller still learns it failed
    latest = await _latest(db, post.id)
    assert [v.id for v in latest] == [good.id]
    assert latest[0].overall_score == 90


async def test_first_ever_run_that_fails_is_latest_so_the_post_can_retry(db):
    author = await _user(db, "alice")
    post = await _post(db, author)

    failed = await _service(db, errors=["boom"]).verify_post(post.id, author)

    assert [v.id for v in await _latest(db, post.id)] == [failed.id]


async def test_successful_reverify_replaces_previous_verdict(db):
    author = await _user(db, "alice")
    post = await _post(db, author)
    await _service(db).verify_post(post.id, author)

    second = await _service(db, page_score=40).verify_post(post.id, author)

    assert [v.id for v in await _latest(db, post.id)] == [second.id]


async def test_explanation_crash_is_a_failure_not_an_opinion():
    pipeline = VerificationPipeline()

    async def one_claim(text, vertical="general", max_claims=None):
        return [{"id": "clm_1", "text": text, "span_start": 0, "span_end": len(text),
                 "claim_type": "numeric", "topic": "general", "time_sensitivity": "low", "is_verifiable": True}]

    async def identity(claims, *a, **k):
        return claims

    async def empty(*a, **k):
        return {}

    async def verdicts(claims, evidence):
        return [{"claim_id": "clm_1", "verdict": "supported", "confidence": 0.9, "reasoning": "ok",
                 "supporting_sources": [], "contradicting_sources": [], "caveats": []}]

    async def crash(**kwargs):
        raise KeyError("url")

    pipeline.claim_decomposer.extract_claims = one_claim
    pipeline.claim_classifier.filter_claims = identity
    pipeline.query_planner.plan_queries = empty
    pipeline.retrieval.fetch_evidence = empty
    pipeline.verification.verify_claims = verdicts
    pipeline.explanation.format_results = crash

    result = await pipeline.run("Forty percent of Iowa's energy is renewable.")

    assert result["claims"] == []
    assert result["verification_errors"] != []


# --- a human verdict is not replaced by a machine run -------------------------------

async def _moderated_post(db):
    author = await _user(db, "alice")
    challenger = await _user(db, "bob")
    moderator = await _user(db, "mod", role="moderator")
    post = await _post(db, author)
    first = await _service(db).verify_post(post.id, author)
    service = SocialService(db)
    await service.create_challenge(first.id, challenger, ChallengeRequest(reason_code="wrong_source"))
    review = await db.scalar(select(ModerationReview).where(ModerationReview.verification_id == first.id))
    return author, challenger, moderator, post, first, review


async def test_author_cannot_rerun_a_verdict_under_moderation(db):
    author, _, _, post, first, _ = await _moderated_post(db)

    with pytest.raises(VerificationLocked):
        await _service(db).verify_post(post.id, author)
    assert [v.id for v in await _latest(db, post.id)] == [first.id]


async def test_author_cannot_rerun_a_resolved_verdict(db):
    author, _, moderator, post, first, review = await _moderated_post(db)
    await SocialService(db).resolve_review(
        review.id, moderator, ModerationDecisionRequest(decision="uphold", note="Checked the sources."))

    with pytest.raises(VerificationLocked):
        await _service(db).verify_post(post.id, author)


async def test_moderator_can_rerun_a_verdict_under_moderation(db):
    _, _, moderator, post, _, _ = await _moderated_post(db)

    rerun = await _service(db).verify_post(post.id, moderator)

    assert [v.id for v in await _latest(db, post.id)] == [rerun.id]


# --- sources and domain reputation ---------------------------------------------------

async def test_neutral_sources_are_stored_but_never_counted_in_reputation(db):
    author = await _user(db, "alice")
    post = await _post(db, author)
    claim = _claim(verdict=Verdict.NOT_VERIFIABLE, supporting=(), neutral=("https://related.example/a",))

    await _service(db, claims=[claim]).verify_post(post.id, author)

    roles = (await db.execute(select(VerificationSource.role))).scalars().all()
    assert roles == ["neutral"]
    assert await _domain(db, "related.example") is None


async def test_reverifying_the_same_post_does_not_recount_domains(db):
    author = await _user(db, "alice")
    post = await _post(db, author)
    await _service(db).verify_post(post.id, author)
    checked_once = (await _domain(db, "good.example")).total_claims_checked

    await _service(db).verify_post(post.id, author)

    await db.refresh(await _domain(db, "good.example"))
    assert (await _domain(db, "good.example")).total_claims_checked == checked_once == 1


# --- moderation state ----------------------------------------------------------------

async def test_new_challenge_after_resolution_reopens_the_review(db):
    _, _, moderator, post, first, review = await _moderated_post(db)
    service = SocialService(db)
    await service.resolve_review(
        review.id, moderator, ModerationDecisionRequest(decision="uphold", note="Checked the sources."))
    carol = await _user(db, "carol")

    await service.create_challenge(first.id, carol, ChallengeRequest(reason_code="outdated_source"))

    open_ids = [r.id for r in await service.list_open_reviews()]
    assert open_ids == [review.id]


async def test_challenging_an_old_version_is_refused(db):
    author = await _user(db, "alice")
    bob = await _user(db, "bob")
    post = await _post(db, author)
    old = await _service(db).verify_post(post.id, author)
    await _service(db).verify_post(post.id, author)

    with pytest.raises(ValueError):
        await SocialService(db).create_challenge(old.id, bob, ChallengeRequest(reason_code="wrong_source"))


async def test_resolved_verdict_keeps_machine_summary_and_shows_moderator_summary(db):
    _, _, moderator, post, first, review = await _moderated_post(db)
    service = SocialService(db)

    await service.resolve_review(review.id, moderator, ModerationDecisionRequest(
        decision="revise", note="One source was outdated.", override_score=60,
        override_summary="Mostly right, but the figure is from 2019."))

    response = await service.get_verification_response(first.id)
    assert response.summary is not None and response.summary.supported == 1
    assert response.human_summary == "Mostly right, but the figure is from 2019."
    feed_summary = service._serialize_verification_summary(await service._load_verification(first.id))
    assert feed_summary.summary is not None
    assert feed_summary.human_summary == "Mostly right, but the figure is from 2019."
