"""Offline tests for the research harness (no network, no LLM)."""
import asyncio

import pytest

from research.eval import credibility, metrics
from research.eval.configs import CONFIGS
from research.eval.labels import aggregate_post_label, verdict_to_class
from research.eval.prompts import NO_REPUTATION_PROMPT
from research.eval.robustness import JUNK_DOMAINS, inject
from research.eval.sba import apply_sba
from research.eval.snapshot import Snapshot, SnapshotMiss, text_key


def test_label_mapping_collapses_seven_verdicts():
    assert [verdict_to_class(v) for v in ("strongly_supported", "supported")] == ["True", "True"]
    assert [verdict_to_class(v) for v in ("contradicted", "outdated")] == ["False", "False"]
    assert [verdict_to_class(v) for v in ("mixed", "weak")] == ["Mixed", "Mixed"]
    assert verdict_to_class("not_verifiable") is None


def test_post_aggregation():
    assert aggregate_post_label([None, None]) is None
    assert aggregate_post_label(["True", None]) == "True"
    assert aggregate_post_label(["False", "False"]) == "False"
    assert aggregate_post_label(["True", "False"]) == "Mixed"


def test_accuracy_and_coverage_ignore_abstentions():
    gold = ["True", "False", "Mixed", "True"]
    pred = ["True", "False", None, "False"]
    assert metrics.coverage(pred) == 0.75
    assert metrics.accuracy(gold, pred) == pytest.approx(2 / 3)


def test_macro_f1_perfect_and_per_class():
    gold = ["True", "False", "Mixed"]
    assert metrics.macro_f1(gold, gold) == 1.0
    prf = metrics.per_class_prf(["True", "True"], ["True", "False"])
    assert prf["True"] == {"precision": 1.0, "recall": 0.5, "f1": pytest.approx(2 / 3)}


def test_ece_zero_when_calibrated_and_high_when_overconfident():
    gold = ["True"] * 10
    assert metrics.expected_calibration_error(gold, ["True"] * 10, [1.0] * 10) == 0.0
    assert metrics.expected_calibration_error(gold, ["False"] * 10, [0.95] * 10) == pytest.approx(0.95)


def test_cohens_kappa():
    assert metrics.cohens_kappa(["True", "False"], ["True", "False"]) == 1.0
    a = ["True", "True", "False", "False"]
    b = ["True", "False", "True", "False"]
    assert metrics.cohens_kappa(a, b) == pytest.approx(0.0)


def test_percentile_and_mean_std():
    assert metrics.percentile([1, 2, 3, 4], 50) == 2.5
    assert metrics.percentile([5], 95) == 5
    assert metrics.mean_std([1.0]) == {"mean": 1.0, "std": 0.0}
    assert metrics.mean_std([1.0, 3.0])["std"] == pytest.approx(1.4142135)


def test_credibility_sources_differ():
    assert credibility.score("flat", "reuters.com") == 0.5
    assert credibility.score("mbfc", "infowars.com") < 0.3
    assert credibility.score("mbfc", "no-such-domain.invalid") == 0.5
    assert credibility.score("manual", "no-such-domain.invalid") == 0.5
    assert not credibility.is_covered("flat", "reuters.com")
    assert credibility.is_covered("mbfc", "reuters.com")


def test_inject_adds_k_distinct_contradicting_items():
    assert len(set(JUNK_DOMAINS)) == 5  # distinct, so per-domain dedup keeps every one
    base = [{"url": "https://a.com/x", "domain": "a.com", "snippet": "s"}]
    out = inject("The sky is blue.", base, 3)
    assert len(out) == 4 and out[0] is base[0]
    assert all(i["query_stance"] == "contradict" and i["synthetic"] for i in out[1:])
    assert len({i["domain"] for i in out}) == 4
    assert inject("c", base, 0) == base
    with pytest.raises(ValueError):
        inject("c", base, 6)


def test_snapshot_roundtrip_and_replay_miss(tmp_path):
    path = tmp_path / "snap.json"
    snap = Snapshot(path)
    snap.prefill_evidence("claim", [{"url": "u", "domain": "d", "domain_reputation": 0.9}])
    snap.save()

    replay = Snapshot(path)
    entry = replay.data["evidence"][text_key("claim")]
    assert entry["items"] == [{"url": "u", "domain": "d"}]  # credibility-dependent fields stripped
    replay.prefill_missing("claim", [{"url": "other", "domain": "x"}])
    assert replay.data["evidence"][text_key("claim")]["items"][0]["url"] == "u"  # not overwritten
    with pytest.raises(SnapshotMiss):
        asyncio.run(replay.evidence_for({"id": "c", "text": "unseen"}, None, None, None))


def test_b1_prompt_has_no_reputation_and_configs_match_table():
    assert "reputation" not in NO_REPUTATION_PROMPT
    b1, b2, b3 = CONFIGS["B1"], CONFIGS["B2"], CONFIGS["B3"]
    assert (b1.credibility, b1.dedup_domains, b1.show_reputation) == ("flat", False, False)
    assert b2.sba is False and b3.sba is True
    assert (b2.credibility, b3.credibility, CONFIGS["B4"].credibility) == ("manual", "manual", "mbfc")
    assert CONFIGS["B2p"].credibility == "default"
    assert CONFIGS["A1"].decompose is False
    assert CONFIGS["A2"].use_recency is False
    assert CONFIGS["A3"].dedup_domains is False


def test_sba_matches_paper_worked_example():
    cites = [f"https://s{i}.org" for i in range(4)]
    evidence = [{"url": u, "domain_reputation": 0.95} for u in cites]
    evidence.append({"url": "https://blog.example", "domain_reputation": 0.5})
    verdict = {"verdict": "supported", "confidence": 0.7,
               "supporting_sources": ["https://blog.example"], "contradicting_sources": cites}
    out = apply_sba(verdict, evidence)
    assert out["verdict"] == "contradicted" and out["llm_verdict"] == "supported"
    assert out["sba_score"] == pytest.approx((0.5 - 3.8) / 4.3)
    assert out["sba_conflict"] == pytest.approx(0.5 / 3.8)
    assert out["confidence"] == 0.7


def test_sba_thresholds_and_no_cited_sources():
    ev = [{"url": "a", "domain_reputation": 0.6}, {"url": "b", "domain_reputation": 0.5}]
    mixed = apply_sba({"verdict": "supported", "supporting_sources": ["a"], "contradicting_sources": ["b"]}, ev)
    assert mixed["verdict"] == "mixed"  # V = 0.1/1.1 is inside +-0.3
    supported = apply_sba({"verdict": "weak", "supporting_sources": ["a", "b"], "contradicting_sources": []}, ev)
    assert supported["verdict"] == "supported" and supported["sba_score"] == 1.0
    assert supported["sba_conflict"] == 0.0
    untouched = apply_sba({"verdict": "weak", "supporting_sources": ["missing"], "contradicting_sources": []}, ev)
    assert untouched["verdict"] == "weak" and "sba_score" not in untouched


def test_rescore_sba_pairs_the_same_verdicts():
    from research.eval.rescore_sba import mcnemar_exact, rescore

    ev = [{"url": "good", "domain_reputation": 0.93}] + [
        {"url": f"junk{i}", "domain_reputation": 0.5} for i in range(4)]
    claim = {"verdict": "supported", "confidence": 0.9, "supporting_sources": ["good"],
             "contradicting_sources": [f"junk{i}" for i in range(4)], "evidence": ev}
    out = rescore([{"gold": "True", "claims": [claim]}])
    assert out["baseline"]["accuracy"] == 1.0
    assert out["sba"]["confusion"]["True"]["False"] == 1  # 4 unrated junk outvote 1 good source
    assert out["paired"] == {"baseline_right_sba_wrong": 1, "sba_right_baseline_wrong": 0, "mcnemar_p": 1.0}
    assert mcnemar_exact(0, 6) == pytest.approx(0.03125)


def test_simple_sample_is_mostly_clear_cut_claims():
    from research.eval.averitec import build_simple

    def row(i, label, types=("Event/Property Claim",), strategies=("Written Evidence",)):
        return {"claim": f"claim {i}", "label": label, "claim_types": list(types),
                "fact_checking_strategies": list(strategies), "claim_date": None}

    rows = ([row(i, "Supported") for i in range(30)] + [row(100 + i, "Refuted") for i in range(30)]
            + [row(200 + i, "Conflicting Evidence/Cherrypicking") for i in range(5)]
            + [row(300, "Supported", types=("Numerical Claim",))]
            + [row(301, "Refuted", strategies=("Numerical Comparison",))]
            + [row(302, "Refuted", types=("Event/Property Claim", "Causal Claim"))])
    sample = build_simple(rows, n_per_side=19, n_difficult=2, seed=0)

    labels = [r["label"] for r in sample]
    assert labels.count("True") == 19 and labels.count("False") == 19 and labels.count("Mixed") == 2
    texts = {r["text"] for r in sample}
    assert not texts & {"claim 300", "claim 301", "claim 302"}  # numeric / causal claims excluded
    assert all(r["difficulty"] == ("difficult" if r["label"] == "Mixed" else "easy") for r in sample)
    assert sample == build_simple(rows, n_per_side=19, n_difficult=2, seed=0)  # reproducible


async def test_relevance_is_scored_once_per_claim_and_source(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    from research.eval.agents import ResearchRanker

    calls = []

    async def scorer(self, claim, item):
        calls.append(item["url"])
        return 0.8

    monkeypatch.setattr("app.agents.evidence_ranker.EvidenceRankerAgent._get_relevance_score", scorer)
    cache = {}
    claim = {"id": "c", "text": "a claim"}
    items = [{"url": "u1", "domain": "a.org", "snippet": "s", "domain_reputation": 0.5},
             {"url": "u2", "domain": "b.org", "snippet": "s", "domain_reputation": 0.5}]
    first = ResearchRanker(relevance_cache=cache)
    second = ResearchRanker(dedup_domains=False, relevance_cache=cache)  # another config, same cache
    await first.rank_evidence([claim], {"c": [dict(i) for i in items]})
    await second.rank_evidence([claim], {"c": [dict(i) for i in items]})

    assert sorted(calls) == ["u1", "u2"]  # scored once, reused by the second config
    assert len(cache) == 2


async def test_quota_failure_stops_before_saving_the_failed_claim(tmp_path, monkeypatch):
    """A claim whose LLM call failed must not be checkpointed as a real answer."""
    from research.eval import run_eval
    from research.eval.datasets import Example

    class FakeSystem:
        def __init__(self, *args, **kwargs):
            self.n = 0

        async def run(self, example, inject_k=0):
            self.n += 1
            return {"id": example.id, "gold": "True", "pred": "True", "confidence": 0.9, "latency_s": 1.0,
                    "llm_calls": 1, "llm_tokens": 10, "llm_failures": 1 if self.n == 3 else 0,
                    "domains_total": 0, "domains_covered": 0, "inject_k": 0, "claims": []}

    monkeypatch.setattr(run_eval, "System", FakeSystem)
    examples = [Example(id=f"e{i}", text="t", label="True") for i in range(5)]
    snap = Snapshot(tmp_path / "s.json")

    with pytest.raises(run_eval.QuotaStop):
        await run_eval.evaluate("B2", examples, snap, runs=1, checkpoint_dir=tmp_path, batch_size=10)

    saved = (tmp_path / "B2_k0_run0.partial.jsonl").read_text().splitlines()
    assert [__import__("json").loads(l)["id"] for l in saved] == ["e0", "e1"]  # e2 failed: not saved


def test_date_aware_prompt_judges_as_of_the_claim_date(monkeypatch, tmp_path):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    from research.eval.agents import ResearchVerifier
    from research.eval.datasets import load_jsonl

    claim = {"id": "c", "text": "Fly swatters are on sale.", "claim_date": "8-10-2020"}
    dated = ResearchVerifier(as_of_claim_date=True).build_prompt(claim, [])
    assert "8-10-2020" in dated and "at that time" in dated
    assert ResearchVerifier().build_prompt(claim, []) == ResearchVerifier(as_of_claim_date=True).build_prompt(
        {**claim, "claim_date": None}, [])  # no date known: unchanged prompt
    assert CONFIGS["B2d"].as_of_claim_date and CONFIGS["B2d"].credibility == CONFIGS["B2"].credibility

    path = tmp_path / "d.jsonl"
    path.write_text('{"id": "1", "text": "t", "label": "True", "claim_date": "8-10-2020"}\n')
    assert load_jsonl(path)[0].claim_date == "8-10-2020"


async def test_robustness_checkpoints_each_k_and_derives_sba_from_b2(tmp_path, monkeypatch):
    from research.eval import run_eval
    from research.eval.datasets import Example

    class FakeSystem:
        def __init__(self, config, *args, **kwargs):
            self.name = config.name

        async def run(self, example, inject_k=0):
            # credible source supports, k junk sources contradict; the "LLM" is fooled when k >= 2
            ev = [{"url": "good", "domain_reputation": 0.9}] + [
                {"url": f"junk{i}", "domain_reputation": 0.15, "synthetic": True} for i in range(inject_k)]
            verdict = "contradicted" if inject_k >= 2 else "supported"
            claim = {"text": "t", "verdict": verdict, "confidence": 0.9, "supporting_sources": ["good"],
                     "contradicting_sources": [f"junk{i}" for i in range(inject_k)], "evidence": ev}
            pred = "False" if verdict == "contradicted" else "True"
            return {"id": example.id, "gold": "True", "pred": pred, "confidence": 0.9, "latency_s": 1.0,
                    "llm_calls": 1, "llm_tokens": 10, "llm_failures": 0, "domains_total": 0,
                    "domains_covered": 0, "inject_k": inject_k, "claims": [claim]}

    monkeypatch.setattr(run_eval, "System", FakeSystem)
    examples = [Example(id=f"e{i}", text="t", label="True") for i in range(3)]
    out = await run_eval.robustness(["B2"], examples, Snapshot(tmp_path / "s.json"), n_claims=3, ks=[0, 2],
                                    seed=0, runs=1, junk_credibility=0.15, checkpoint_dir=tmp_path,
                                    batch_size=10, derive_sba_from="B2")

    curves = out["accuracy_vs_k"]
    assert curves["B2"][0]["mean"] == 1.0 and curves["B2"][2]["mean"] == 0.0  # fooled by 2 junk sources
    assert curves["B3"][2]["mean"] == 1.0  # SBA: 0.9 credible support outweighs 2 x 0.15 junk
    assert (tmp_path / "B2_k2_run0.partial.jsonl").exists()


async def test_counting_client_retries_a_timeout(monkeypatch):
    from types import SimpleNamespace
    from research.eval import snapshot as snap_mod

    class APITimeoutError(Exception):
        pass

    attempts = []

    async def create(**kwargs):
        attempts.append(kwargs.get("timeout"))
        if len(attempts) == 1:
            raise APITimeoutError("Request timed out.")
        return SimpleNamespace(usage=SimpleNamespace(total_tokens=5))

    async def no_sleep(seconds):
        return None

    monkeypatch.setattr(snap_mod.asyncio, "sleep", no_sleep)
    meter = snap_mod.UsageMeter()
    client = snap_mod.CountingClient(SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))),
                                     meter, pacer=snap_mod.TokenPacer())
    await client.chat.completions.create(model="m", messages=[], max_tokens=10)

    assert attempts == [120, 120]          # 2-minute timeout, retried once
    assert meter.llm_failures == 0 and meter.llm_calls == 1
