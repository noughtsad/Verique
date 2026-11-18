"""
Publication dates reach the ranker and the verdict, so an old report can't outweigh newer ones.

Regression for the GTA 6 case: a 2023 Reuters report ("released in 2025") made a
correct 2026 claim "mixed" because no search result carried a date.
"""
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.agents.evidence_ranker import EvidenceRankerAgent
from app.agents.query_planner import QueryPlannerAgent, mark_dated_search
from app.agents.retrieval import RetrievalAgent, normalize_published_date
from app.agents.verification import VerificationAgent


# --- 1. one date format everywhere -------------------------------------------------

def test_rfc2822_date_from_tavily_news_is_normalized():
    assert normalize_published_date("Tue, 13 Oct 2026 14:01:10 GMT") == "2026-10-13"


def test_iso_and_written_dates_are_normalized():
    assert normalize_published_date("2026-11-12T20:36:14Z") == "2026-11-12"
    assert normalize_published_date("2026-11-12") == "2026-11-12"
    assert normalize_published_date("November 12, 2026") == "2026-11-12"


def test_future_and_unreadable_dates_are_dropped():
    # Tavily dated Rockstar's newswire page 2045; a date that hasn't happened is wrong data.
    assert normalize_published_date("Mon, 06 Nov 2045 12:53:32 GMT") is None
    assert normalize_published_date("sometime last year") is None
    assert normalize_published_date(None) is None


async def test_tavily_results_carry_normalized_dates_and_requested_topic(monkeypatch):
    sent = {}

    async def fake_post(self, url, *args, **kwargs):
        sent.update(kwargs.get("json", {}))
        return httpx.Response(
            200,
            json={"results": [{"url": "https://www.ign.com/a", "title": "t", "content": "c",
                               "published_date": "Tue, 13 Oct 2026 14:01:10 GMT"}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    agent = RetrievalAgent()
    agent.tavily_key = "test-key"
    results = await agent._search_tavily("gta 6 release date", topic="news")
    assert sent["topic"] == "news"
    assert results[0]["published_at"] == "2026-10-13"


# --- 2. recency takes effect once dates exist --------------------------------------

def test_recent_evidence_outranks_old_on_time_sensitive_claims():
    ranker = EvidenceRankerAgent()
    today = datetime.now(timezone.utc).date()
    recent = ranker._calculate_recency_score((today - timedelta(days=5)).isoformat(), "high")
    old = ranker._calculate_recency_score((today - timedelta(days=3 * 365)).isoformat(), "high")
    assert recent > 0.9
    assert old < 0.2


# --- 3. time-sensitive claims get a dated (news) search ----------------------------

def test_time_sensitive_claims_send_second_support_query_to_news():
    queries = [
        {"query": "gta 6 release date", "stance": "support"},
        {"query": "gta 6 release november 2026", "stance": "support"},
        {"query": "gta 6 delayed again", "stance": "contradict"},
    ]
    marked = mark_dated_search({"time_sensitivity": "high"}, queries)
    assert [q.get("topic") for q in marked] == [None, "news", None]


def test_timeless_claims_keep_general_search():
    queries = [{"query": "a", "stance": "support"}, {"query": "b", "stance": "support"}]
    assert all("topic" not in q for q in mark_dated_search({"time_sensitivity": "low"}, queries))


# --- 4. the verdict knows today's date and how to treat superseded reports --------

async def test_verdict_prompt_has_todays_date_and_superseded_rule(monkeypatch):
    captured = {}

    class FakeCompletions:
        async def create(self, **kwargs):
            captured["prompt"] = kwargs["messages"][-1]["content"]
            msg = type("M", (), {"content": json.dumps({
                "verdict": "supported", "confidence": 0.8, "reasoning": "Recent sources agree on the date.",
                "supporting_sources": [], "contradicting_sources": [], "caveats": []})})
            return type("R", (), {"choices": [type("C", (), {"message": msg})], "usage": None})

    agent = VerificationAgent()
    agent.client = type("Client", (), {"chat": type("Chat", (), {"completions": FakeCompletions()})})
    await agent._verify_single_claim({"id": "c1", "text": "gta 6 releases this month"}, [])
    prompt = captured["prompt"]
    assert datetime.now(timezone.utc).date().isoformat() in prompt
    assert "superseded" in prompt.lower()


async def test_query_planner_is_told_todays_date(monkeypatch):
    # Without it the planner wrote "GTA 6 release date March 2024" in November 2026.
    sent = {}

    async def fake_post(self, url, *args, **kwargs):
        sent.update(kwargs.get("json", {}))
        body = {"choices": [{"message": {"content": json.dumps({"support": ["a", "b"], "contradict": ["c"]})}}]}
        return httpx.Response(200, json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    await QueryPlannerAgent().plan_queries([{"id": "c1", "text": "gta 6 releases this month", "time_sensitivity": "high"}])
    prompt = sent["messages"][-1]["content"]
    assert datetime.now(timezone.utc).date().isoformat() in prompt


# --- 5. dates survive into the stored sources --------------------------------------

def test_explanation_parses_evidence_dates():
    from app.agents.explanation import ExplanationAgent

    parse = ExplanationAgent.__new__(ExplanationAgent)._parse_date
    assert parse("2026-10-13") == datetime(2026, 10, 13)
    assert parse("2026-10-13T08:00:00Z") == datetime(2026, 10, 13, 8, 0)
    assert parse("2026-10-13T08:00:00+05:30") == datetime(2026, 10, 13, 2, 30)
    assert parse(None) is None
    assert parse("n/a") is None


def test_cited_sources_keep_their_publication_date():
    from app.agents.explanation import ExplanationAgent

    agent = ExplanationAgent.__new__(ExplanationAgent)
    evidence = [{"url": "https://news.example/a", "domain": "news.example", "snippet": "x",
                 "domain_reputation": 0.8, "published_at": "2026-10-13"}]
    sources = agent._build_sources(evidence=evidence, supporting_urls=["https://news.example/a"],
                                   contradicting_urls=[])
    assert sources.supporting[0].published_at == datetime(2026, 10, 13)
