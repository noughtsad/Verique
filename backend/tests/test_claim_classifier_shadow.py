"""Shadow-mode tests: Jev must be logged next to Groq but never change the result."""
import json
from types import SimpleNamespace

from structlog.testing import capture_logs

from app.agents import claim_classifier
from app.agents.claim_classifier import ClaimClassifierAgent
from app.core.jev_client import JevError, JevResult

CLAIMS = [
    {"id": "c1", "text": "Nature published the study in March 2024."},
    {"id": "c2", "text": "This is the best product ever."},
]
GROQ_VERDICT = [
    {"claim_id": "c1", "is_verifiable": True, "reason": "specific"},
    {"claim_id": "c2", "is_verifiable": False, "reason": "opinion"},
]


class _FakeGroq:
    def __init__(self, content):
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))
        self._content = content

    async def _create(self, **kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self._content))])


class _FakeJev:
    model = "convaiinnovations/laya-free"

    def __init__(self, probs=None, fail=False):
        self.probs, self.fail, self.calls = probs or {}, fail, 0

    async def decide(self, state, questions, model=None):
        self.calls += 1
        if self.fail:
            raise JevError("boom")
        self.last_questions = questions
        answers = {}
        for qid, q in questions.items():
            p = next(v for k, v in self.probs.items() if k in q["instructions"])
            answers[qid] = {"type": "noul", "noul": p}
        return JevResult(answers=answers)


def _agent(jev, enabled=True, shadow=True, monkeypatch=None):
    monkeypatch.setattr(claim_classifier, "jev_enabled", lambda: enabled)
    monkeypatch.setattr(claim_classifier.settings, "JEV_SHADOW_MODE", shadow)
    agent = ClaimClassifierAgent.__new__(ClaimClassifierAgent)
    agent.client = _FakeGroq(json.dumps(GROQ_VERDICT))
    agent.model = "m"
    agent.jev = jev
    return agent


async def test_shadow_logs_comparison_and_keeps_groq_result(monkeypatch):
    jev = _FakeJev({"Nature": 0.9, "best product": 0.1})
    agent = _agent(jev, monkeypatch=monkeypatch)

    with capture_logs() as logs:
        result = await agent.filter_claims([dict(c) for c in CLAIMS])

    assert [c["id"] for c in result] == ["c1"]
    assert jev.calls == 1  # all claims in a single request
    assert set(jev.last_questions) == {"c1", "c2"}
    summary = next(e for e in logs if e["event"] == "jev_shadow_summary")
    assert summary["compared"] == 2 and summary["agreed"] == 2


async def test_shadow_disagreement_is_logged_but_ignored(monkeypatch):
    jev = _FakeJev({"Nature": 0.2, "best product": 0.8})  # opposite of Groq
    agent = _agent(jev, monkeypatch=monkeypatch)

    with capture_logs() as logs:
        result = await agent.filter_claims([dict(c) for c in CLAIMS])

    assert [c["id"] for c in result] == ["c1"]  # Groq still decides
    summary = next(e for e in logs if e["event"] == "jev_shadow_summary")
    assert summary["agreed"] == 0


async def test_jev_failure_does_not_affect_result(monkeypatch):
    agent = _agent(_FakeJev(fail=True), monkeypatch=monkeypatch)

    with capture_logs() as logs:
        result = await agent.filter_claims([dict(c) for c in CLAIMS])

    assert [c["id"] for c in result] == ["c1"]
    summary = next(e for e in logs if e["event"] == "jev_shadow_summary")
    assert summary["compared"] == 0


async def test_disabled_makes_no_jev_calls(monkeypatch):
    jev = _FakeJev({"Nature": 0.9, "best product": 0.1})
    agent = _agent(jev, enabled=False, monkeypatch=monkeypatch)

    result = await agent.filter_claims([dict(c) for c in CLAIMS])

    assert [c["id"] for c in result] == ["c1"]
    assert jev.calls == 0


async def test_large_articles_are_split_into_batches(monkeypatch):
    monkeypatch.setattr(claim_classifier, "JEV_BATCH_SIZE", 2)
    jev = _FakeJev({"claim": 0.9})
    agent = _agent(jev, monkeypatch=monkeypatch)
    claims = [{"id": f"c{i}", "text": f"claim {i}"} for i in range(5)]

    probs = await agent._jev_probs(claims)

    assert jev.calls == 3
    assert all(p == 0.9 for p in probs.values())


async def test_comparison_is_appended_to_jsonl(monkeypatch, tmp_path):
    log = tmp_path / "sub" / "shadow.jsonl"
    monkeypatch.setattr(claim_classifier.settings, "JEV_SHADOW_LOG_PATH", str(log))
    agent = _agent(_FakeJev({"Nature": 0.9, "best product": 0.8}), monkeypatch=monkeypatch)

    await agent.filter_claims([dict(c) for c in CLAIMS])

    rows = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]
    assert [r["claim_id"] for r in rows] == ["c1", "c2"]
    assert rows[0]["agree"] is True and rows[1]["agree"] is False
    assert rows[1]["groq_verifiable"] is False and rows[1]["jev_p_verifiable"] == 0.8


# ---------------------------------------------------------------------------
# Live mode: Jev decides when confident, Groq decides the rest
# ---------------------------------------------------------------------------

class _CountingGroq:
    """Records which claims Groq was asked about; says 'verifiable' for all of them."""

    def __init__(self):
        self.asked = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        prompt = kwargs["messages"][-1]["content"]
        ids = [cid for cid in ("c1", "c2", "c3") if f"ID: {cid}," in prompt]
        self.asked.append(ids)
        content = json.dumps(
            [{"claim_id": i, "is_verifiable": True, "reason": "groq"} for i in ids]
        )
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, reasoning=None))])


def _live_agent(jev, monkeypatch, confidence=0.8):
    monkeypatch.setattr(claim_classifier, "jev_enabled", lambda: True)
    monkeypatch.setattr(claim_classifier.settings, "JEV_SHADOW_MODE", False)
    monkeypatch.setattr(claim_classifier.settings, "JEV_CONFIDENCE", confidence)
    agent = ClaimClassifierAgent.__new__(ClaimClassifierAgent)
    agent.client = _CountingGroq()
    agent.model = "m"
    agent.jev = jev
    return agent


LIVE_CLAIMS = [
    {"id": "c1", "text": "fact one"},
    {"id": "c2", "text": "opinion two"},
    {"id": "c3", "text": "unsure three"},
]


async def test_live_mode_jev_decides_confident_and_groq_gets_the_rest(monkeypatch):
    jev = _FakeJev({"fact one": 0.95, "opinion two": 0.05, "unsure three": 0.55})
    agent = _live_agent(jev, monkeypatch)

    result = await agent.filter_claims([dict(c) for c in LIVE_CLAIMS])

    # c1 kept by Jev, c2 dropped by Jev, c3 sent to Groq (which keeps it)
    assert [c["id"] for c in result] == ["c1", "c3"]
    assert agent.client.asked == [["c3"]]
    assert "Jev" in result[0]["classification_reason"]
    assert result[1]["classification_reason"] == "groq"


async def test_live_mode_all_confident_never_calls_groq(monkeypatch):
    jev = _FakeJev({"fact one": 0.9, "opinion two": 0.1, "unsure three": 0.1})
    agent = _live_agent(jev, monkeypatch)

    result = await agent.filter_claims([dict(c) for c in LIVE_CLAIMS])

    assert [c["id"] for c in result] == ["c1"]
    assert agent.client.asked == []


async def test_live_mode_jev_down_falls_back_to_groq_for_everything(monkeypatch):
    agent = _live_agent(_FakeJev(fail=True), monkeypatch)

    result = await agent.filter_claims([dict(c) for c in LIVE_CLAIMS])

    assert agent.client.asked == [["c1", "c2", "c3"]]
    assert [c["id"] for c in result] == ["c1", "c2", "c3"]


async def test_live_mode_threshold_is_configurable(monkeypatch):
    jev = _FakeJev({"fact one": 0.7, "opinion two": 0.3, "unsure three": 0.5})
    agent = _live_agent(jev, monkeypatch, confidence=0.65)

    result = await agent.filter_claims([dict(c) for c in LIVE_CLAIMS])

    assert agent.client.asked == [["c3"]]
    assert [c["id"] for c in result] == ["c1", "c3"]
