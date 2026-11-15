"""
The research subclasses must behave exactly like the app agents with default switches.
If one of these fails, the app agent changed: update research/eval/agents.py to match.
"""
import copy
import json
from types import SimpleNamespace

import pytest

from app.agents.evidence_ranker import EvidenceRankerAgent
from app.agents.verification import VerificationAgent
from research.eval.agents import ResearchRanker, ResearchVerifier
from research.eval.prompts import NO_REPUTATION_PROMPT

CLAIM = {"id": "c1", "text": "Water boils at 100 C at sea level.", "time_sensitivity": "medium"}
EVIDENCE = [
    {"url": "https://a.org/1", "domain": "a.org", "title": "A", "snippet": "yes",
     "published_at": "2025-01-01", "domain_reputation": 0.9, "query_stance": "support"},
    {"url": "https://a.org/2", "domain": "a.org", "title": "A2", "snippet": "yes too",
     "published_at": None, "domain_reputation": 0.9, "query_stance": "both"},
    {"url": "https://b.com/1", "domain": "b.com", "title": "B", "snippet": "no",
     "published_at": "2010-06-01", "domain_reputation": 0.4, "query_stance": "contradict"},
]
VERDICT_JSON = json.dumps({"verdict": "supported", "confidence": 0.8, "reasoning": "Two sources agree on it.",
                           "supporting_sources": [], "contradicting_sources": [], "caveats": []})


@pytest.fixture(autouse=True)
def _groq_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")  # constructing AsyncGroq needs a key


class _RecordingClient:
    """Stands in for AsyncGroq: records the prompt, returns a fixed verdict."""

    def __init__(self):
        self.prompts = []
        self.calls = []  # every argument except the messages (model, temperature, max_tokens, ...)
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.prompts.append(kwargs["messages"][-1]["content"])
        self.calls.append({k: v for k, v in kwargs.items() if k != "messages"})
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=VERDICT_JSON))])


def _fixed_relevance(agent):
    async def relevance(claim, item):
        return {"a.org": 0.8, "b.com": 0.6}[item["domain"]]
    agent._get_relevance_score = relevance


async def _rank(agent):
    _fixed_relevance(agent)
    out = await agent.rank_evidence([CLAIM], {"c1": copy.deepcopy(EVIDENCE)})
    return [(i["url"], round(i["combined_score"], 6)) for i in out["c1"]]


async def test_ranker_defaults_match_app():
    assert await _rank(ResearchRanker()) == await _rank(EvidenceRankerAgent())


async def test_ranker_switches():
    no_dedup = await _rank(ResearchRanker(dedup_domains=False))
    assert len(no_dedup) == 3  # both a.org items kept
    no_recency = ResearchRanker(use_recency=False)
    assert no_recency._calculate_recency_score("2025-01-01", "high") == 0.5


async def test_verifier_default_prompt_matches_app():
    app, research = VerificationAgent(), ResearchVerifier()
    app.client, research.client = _RecordingClient(), _RecordingClient()
    for evidence in (EVIDENCE, []):  # with evidence, and the "No evidence found" path
        assert await app._verify_single_claim(CLAIM, evidence) == await research._verify_single_claim(CLAIM, evidence)
    assert app.client.prompts == research.client.prompts
    assert app.client.calls == research.client.calls


def test_verifier_without_reputation():
    prompt = ResearchVerifier(include_reputation=False, prompt=NO_REPUTATION_PROMPT).build_prompt(CLAIM, EVIDENCE)
    assert "reputation" not in prompt
    assert "Found via: counter-search" in prompt
