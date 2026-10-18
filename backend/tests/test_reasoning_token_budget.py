"""
gpt-oss models reason before answering, and the hidden reasoning is billed against
max_tokens. A budget too small for the reasoning leaves the answer empty or cut off.

Measured on Groq (2026-10-18): a relevance call reasons for ~60-75 tokens; a verdict call
for ~600-1000 tokens before writing its JSON. These tests use a fake client that behaves
the same way, so they fail whenever an agent's budget is too small for real reasoning.
"""
import json
from types import SimpleNamespace

import pytest

from app.agents.evidence_ranker import EvidenceRankerAgent
from app.agents.verification import VerificationAgent


class ReasoningModel:
    """Spends `reasoning_tokens` of max_tokens first, then emits as much of `answer` as fits."""

    def __init__(self, answer: str, reasoning_tokens: int):
        self.answer = answer
        self.reasoning_tokens = reasoning_tokens
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        left = kwargs["max_tokens"] - self.reasoning_tokens
        answer_tokens = max(1, len(self.answer) // 4)
        if left <= 0:
            content, finish = "", "length"
        elif left < answer_tokens:
            content, finish = self.answer[: left * 4], "length"
        else:
            content, finish = self.answer, "stop"
        return SimpleNamespace(choices=[SimpleNamespace(
            message=SimpleNamespace(content=content), finish_reason=finish)])


@pytest.fixture(autouse=True)
def _groq_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")


async def test_relevance_score_survives_typical_reasoning():
    ranker = EvidenceRankerAgent()
    ranker.client = ReasoningModel("0.9", reasoning_tokens=80)
    score = await ranker._get_relevance_score(
        {"text": "Nigeria's population exceeds 200 million."},
        {"title": "", "snippet": "Nigeria has about 227 million people.", "domain": "worldbank.org"},
    )
    assert score == 0.9  # not the 0.5 fallback for an empty answer


async def test_verdict_json_survives_long_reasoning():
    verdict = {"verdict": "contradicted", "confidence": 0.8,
               "reasoning": "Official figures put renewables well below forty percent.",
               "supporting_sources": [], "contradicting_sources": ["https://eia.gov/x"], "caveats": []}
    verifier = VerificationAgent()
    verifier.client = ReasoningModel(json.dumps(verdict), reasoning_tokens=1000)
    result = await verifier._verify_single_claim(
        {"text": "Forty percent of Iowa's energy resources are from renewables."},
        [{"url": "https://eia.gov/x", "domain": "eia.gov", "snippet": "...", "domain_reputation": 0.9}],
    )
    assert result["verdict"] == "contradicted"
