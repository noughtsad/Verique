"""Tests for the support/contradict query split (planner -> retrieval -> verification)."""
import json

import httpx

from app.agents.query_planner import QueryPlannerAgent
from app.agents.retrieval import RetrievalAgent
from app.agents.verification import VerificationAgent


class _FakeResponse:
    def __init__(self, content):
        self._content = content

    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


def _plan_with(monkeypatch, content, claims):
    async def fake_post(self, url, **kwargs):
        if isinstance(content, Exception):
            raise content
        return _FakeResponse(content)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return QueryPlannerAgent()


CLAIM = {"id": "c1", "text": "The sun rises in the east"}


async def test_planner_returns_two_support_one_contradict(monkeypatch):
    payload = json.dumps({
        "support": ["sun rises east", "sunrise direction NASA", "extra ignored"],
        "contradict": ["sun rises west debunked", "extra ignored"],
    })
    planner = _plan_with(monkeypatch, payload, [CLAIM])
    result = await planner.plan_queries([CLAIM])

    stances = [q["stance"] for q in result["c1"]]
    assert stances == ["support", "support", "contradict"]
    assert result["c1"][2]["query"] == "sun rises west debunked"


async def test_planner_tolerates_wrapped_json(monkeypatch):
    payload = 'Sure!\n```json\n{"support": ["a"], "contradict": ["b"]}\n```'
    planner = _plan_with(monkeypatch, payload, [CLAIM])
    result = await planner.plan_queries([CLAIM])
    assert result["c1"] == [
        {"query": "a", "stance": "support"},
        {"query": "b", "stance": "contradict"},
    ]


async def test_planner_falls_back_on_bad_output_and_errors(monkeypatch):
    for bad in ["not json at all", '["old", "array", "format"]', '{"contradict": ["only adversarial"]}',
                RuntimeError("groq down")]:
        planner = _plan_with(monkeypatch, bad, [CLAIM])
        result = await planner.plan_queries([CLAIM])
        stances = [q["stance"] for q in result["c1"]]
        assert stances == ["support", "contradict"], bad
        assert result["c1"][0]["query"] == CLAIM["text"]


def _item(url):
    return {"url": url, "title": "t", "snippet": "s", "domain": "example.org"}


async def test_retrieval_tags_evidence_with_query_stance():
    agent = RetrievalAgent()

    async def fake_search(query):
        return {
            "q-support": [_item("https://a.org/1"), _item("https://shared.org/x")],
            "q-contradict": [_item("https://b.org/1"), _item("https://shared.org/x")],
        }[query]

    agent._search = fake_search
    evidence = await agent.fetch_evidence({
        "c1": [
            {"query": "q-support", "stance": "support"},
            {"query": "q-contradict", "stance": "contradict"},
        ]
    })
    stance_by_url = {e["url"]: e["query_stance"] for e in evidence["c1"]}
    assert stance_by_url == {
        "https://a.org/1": "support",
        "https://b.org/1": "contradict",
        "https://shared.org/x": "both",
    }


async def test_retrieval_still_accepts_plain_string_queries():
    agent = RetrievalAgent()

    async def fake_search(query):
        return [_item("https://a.org/1")]

    agent._search = fake_search
    evidence = await agent.fetch_evidence({"c1": ["plain query"]})
    assert evidence["c1"][0]["query_stance"] == "support"


async def test_verification_prompt_marks_counter_search_sources(monkeypatch):
    agent = VerificationAgent()
    captured = {}

    class _Completions:
        async def create(self, **kwargs):
            captured["prompt"] = kwargs["messages"][-1]["content"]
            message = type("M", (), {"content": json.dumps({
                "verdict": "supported", "confidence": 0.9, "reasoning": "Sources agree with the claim.",
                "supporting_sources": [], "contradicting_sources": [],
            })})
            return type("R", (), {"choices": [type("C", (), {"message": message})]})

    agent.client = type("Client", (), {"chat": type("Chat", (), {"completions": _Completions()})})
    evidence = [
        {**_item("https://a.org/1"), "query_stance": "support"},
        {**_item("https://b.org/1"), "query_stance": "contradict"},
        {**_item("https://c.org/1")},
    ]
    await agent._verify_single_claim(CLAIM, evidence)

    prompt = captured["prompt"]
    assert prompt.count("Found via: counter-search") == 1
    assert prompt.count("Found via: standard search") == 2
    assert "adversarial searches" in prompt


# ---- caveats ----

from app.agents.verification import VerdictResponse


def _verdict(**extra):
    return {"verdict": "supported", "confidence": 0.8,
            "reasoning": "Sources agree with the claim.", **extra}


def test_caveats_default_to_empty_and_tolerate_bad_input():
    assert VerdictResponse(**_verdict()).caveats == []
    assert VerdictResponse(**_verdict(caveats=None)).caveats == []
    assert VerdictResponse(**_verdict(caveats="not a list")).caveats == []


def test_caveats_are_cleaned_and_capped():
    caveats = ["  rising point shifts seasonally ", "", 5, "b", "c", "d"]
    result = VerdictResponse(**_verdict(caveats=caveats)).caveats
    assert result == ["rising point shifts seasonally", "b", "c"]
    long = VerdictResponse(**_verdict(caveats=["x" * 1000])).caveats
    assert len(long[0]) == 300


async def test_caveats_reach_claim_result():
    from app.agents.explanation import ExplanationAgent

    claim = {"id": "c1", "text": "The sun rises in the east", "span_start": 0, "span_end": 25}
    verdicts = [{"claim_id": "c1", "verdict": "supported", "confidence": 0.8,
                 "reasoning": "Sources agree with the claim.", "supporting_sources": [],
                 "contradicting_sources": [], "caveats": ["Due east only at equinoxes"]}]
    results = await ExplanationAgent().format_results([claim], verdicts, {"c1": []})
    assert results[0].caveats == ["Due east only at equinoxes"]

    # A verdict without caveats (e.g. the failure fallback) yields an empty list
    del verdicts[0]["caveats"]
    results = await ExplanationAgent().format_results([claim], verdicts, {"c1": []})
    assert results[0].caveats == []
