"""
When an LLM call fails (e.g. Groq's rate limit), a post must be marked as a failed
verification with a clear note, never shown as an opinion / unverifiable claim.
"""
import os
import tempfile
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.agents.pipeline import VerificationPipeline
from app.core.database import Base
from app.models.post import Post
from app.models.user import User
from app.schemas.verification import VerificationSummary
from app.services.social_service import SocialService

RATE_LIMIT = (
    "Error code: 429 - {'error': {'message': 'Rate limit reached for model `openai/gpt-oss-120b` "
    "on tokens per day (TPD): Limit 200000, Used 199271, Requested 2285.', 'code': 'rate_limit_exceeded'}}"
)


class FailingClient:
    """Stands in for AsyncGroq: every chat completion raises."""

    def __init__(self, message: str = RATE_LIMIT):
        async def create(**kwargs):
            raise RuntimeError(message)
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))


@pytest.fixture(autouse=True)
def _groq_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")


async def _identity(claims, *args, **kwargs):
    return claims


async def _empty(*args, **kwargs):
    return {}


def _pipeline_with_one_claim() -> VerificationPipeline:
    pipeline = VerificationPipeline()

    async def one_claim(text, vertical="general", max_claims=None):
        return [{"id": "clm_1", "text": text, "span_start": 0, "span_end": len(text),
                 "claim_type": "numeric", "topic": "general", "time_sensitivity": "low",
                 "is_verifiable": True}]

    pipeline.claim_decomposer.extract_claims = one_claim
    pipeline.claim_classifier.filter_claims = _identity
    pipeline.query_planner.plan_queries = _empty
    pipeline.retrieval.fetch_evidence = _empty
    return pipeline


async def test_rate_limited_verdict_is_reported_as_an_error():
    pipeline = _pipeline_with_one_claim()
    pipeline.verification.client = FailingClient()

    result = await pipeline.run("Forty percent of Iowa's energy is renewable.")

    assert result["verification_errors"] == ["the AI provider's rate limit was reached"]


async def test_failed_claim_extraction_is_reported_as_an_error():
    pipeline = VerificationPipeline()
    pipeline.claim_decomposer.client = FailingClient()

    result = await pipeline.run("Forty percent of Iowa's energy is renewable.")

    assert result["claims"] == []
    assert result["verification_errors"] == ["the AI provider's rate limit was reached"]


async def test_successful_run_reports_no_errors():
    pipeline = _pipeline_with_one_claim()

    async def verdict(claim, evidence):
        return {"verdict": "supported", "confidence": 0.9, "reasoning": "Sources agree on it.",
                "supporting_sources": [], "contradicting_sources": [], "caveats": []}

    pipeline.verification._verify_single_claim = verdict
    result = await pipeline.run("Forty percent of Iowa's energy is renewable.")

    assert result["verification_errors"] == []


# --- post verification status ------------------------------------------------

@pytest_asyncio.fixture
async def full_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()
    os.unlink(path)


async def _post(session: AsyncSession) -> Post:
    user = User(email="a@example.com", username="alice", password_hash="x", role="user", is_active=True)
    session.add(user)
    await session.flush()
    post = Post(author_id=user.id, content="Forty percent of Iowa's energy is renewable.")
    session.add(post)
    await session.flush()
    return post


def _service_returning(session, **result):
    service = SocialService(session)

    async def verify(**kwargs):
        return {"claims": [], "page_score": 50, "summary": VerificationSummary(),
                "models_used": [], "sources_checked": 0, "verification_errors": [], **result}

    service.verification_service.verify = verify
    return service


async def test_post_with_llm_error_is_marked_failed_not_unverifiable(full_db):
    post = await _post(full_db)
    service = _service_returning(full_db, verification_errors=["the AI provider's rate limit was reached"])

    response = await service.verify_post(post.id)

    assert response.status == "failed"
    assert response.score is None
    assert response.final_decision_note.startswith("Verification failed due to an error")
    assert "rate limit" in response.final_decision_note


async def test_post_with_no_claims_and_no_error_is_still_unverifiable(full_db):
    post = await _post(full_db)

    response = await _service_returning(full_db).verify_post(post.id)

    assert response.status == "unverifiable"


# --- standalone /verify endpoint -----------------------------------------------

async def test_verify_endpoint_does_not_cache_a_failed_result(client, monkeypatch):
    from app.api.v1.endpoints import verification as endpoint
    from app.services.verification_service import VerificationService

    async def failed_verify(self, **kwargs):
        return {"claims": [], "page_score": 50, "summary": VerificationSummary(), "models_used": [],
                "sources_checked": 0, "verification_errors": ["the AI provider's rate limit was reached"]}

    cached = []

    async def no_cache_hit(content_hash):
        return None

    async def record_cache(content_hash, result, ttl=None):
        cached.append(result)
        return True

    monkeypatch.setattr(VerificationService, "verify", failed_verify)
    monkeypatch.setattr(endpoint.cache, "get_cached_verification", no_cache_hit)
    monkeypatch.setattr(endpoint.cache, "cache_verification", record_cache)

    response = await client.post("/api/v1/verify/", json={"text": "Forty percent of Iowa's energy is renewable."})

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "failed"
    assert cached == []  # a rate-limited result must not be served from cache for 24 h
