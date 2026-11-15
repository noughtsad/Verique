"""A Groq 429 must surface as a retryable failure, not a saved "not_verifiable" verdict."""
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from groq import RateLimitError
from sqlalchemy import select

from app.agents.claim_decomposer import ClaimDecomposerAgent
from app.agents.pipeline import VerificationPipeline
from app.agents.verification import VerificationAgent
from app.core.errors import LLMRateLimitError, parse_retry_after
from app.models.verification import Verification

CLAIM = {"id": "c1", "text": "Google was founded in 1998."}
GROQ_MSG = (
    "Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): "
    "Limit 200000, Used 198100, Requested 3066. Please try again in 8m23.712s."
)


def _groq_429() -> RateLimitError:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(429, request=request)
    return RateLimitError(GROQ_MSG, response=response, body=None)


def _raising_client():
    class _Completions:
        async def create(self, **kwargs):
            raise _groq_429()

    return type("Client", (), {"chat": type("Chat", (), {"completions": _Completions()})})


@pytest.mark.parametrize(
    "message,expected",
    [
        ("Please try again in 8m23.712s.", 504),
        ("Please try again in 1m49.728s.", 110),
        ("Please try again in 45s.", 45),
        ("Please try again in 1h2m3s.", 3723),
        ("Please try again in 350ms.", None),
        ("no hint here", None),
    ],
)
def test_parse_retry_after(message, expected):
    assert parse_retry_after(message) == expected


async def test_verification_agent_raises_on_rate_limit_instead_of_fallback_verdict():
    agent = VerificationAgent()
    agent.client = _raising_client()
    with pytest.raises(LLMRateLimitError) as exc_info:
        await agent.verify_claims([CLAIM], {"c1": []})
    assert exc_info.value.retry_after_seconds == 504


async def test_decomposer_raises_on_rate_limit_instead_of_returning_no_claims():
    agent = ClaimDecomposerAgent()
    agent.client = _raising_client()
    with pytest.raises(LLMRateLimitError):
        await agent.extract_claims("Google was founded in 1998.")


async def test_pipeline_propagates_rate_limit():
    pipeline = VerificationPipeline()
    extracted = [{"id": "c1", "text": CLAIM["text"], "claim_type": "temporal", "topic": "tech", "time_sensitivity": "low"}]
    with patch.object(pipeline.claim_decomposer, "extract_claims", new=AsyncMock(return_value=extracted)), \
         patch.object(pipeline.claim_classifier, "filter_claims", new=AsyncMock(return_value=extracted)), \
         patch.object(pipeline.query_planner, "plan_queries", new=AsyncMock(return_value={"c1": []})), \
         patch.object(pipeline.retrieval, "fetch_evidence", new=AsyncMock(return_value={"c1": []})), \
         patch.object(pipeline.evidence_ranker, "rank_evidence", new=AsyncMock(return_value={"c1": []})), \
         patch.object(pipeline.verification, "verify_claims", new=AsyncMock(side_effect=LLMRateLimitError("quota", 60))):
        with pytest.raises(LLMRateLimitError):
            await pipeline.run(text=CLAIM["text"])


async def test_verify_endpoint_returns_429_and_leaves_no_failed_row(client_factory, session_maker):
    client = client_factory()
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "username": "alice", "full_name": "Alice", "password": "password123"},
    )
    assert reg.status_code == 200, reg.text
    post = await client.post("/api/v1/posts/", json={"content": "Google was founded in 1998."})
    post_id = post.json()["id"]

    with patch(
        "app.services.verification_service.VerificationService.verify",
        new=AsyncMock(side_effect=LLMRateLimitError("quota", 504)),
    ):
        resp = await client.post(f"/api/v1/posts/{post_id}/verify")

    assert resp.status_code == 429
    assert resp.headers["retry-after"] == "504"
    assert "usage limit" in resp.json()["detail"]
    assert "9 minutes" in resp.json()["detail"]

    async with session_maker() as session:
        rows = (await session.execute(select(Verification).where(Verification.post_id == post_id))).scalars().all()
    assert rows == []
