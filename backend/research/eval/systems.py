"""
Runs one configuration on one example, reusing the app agents (unmodified, or subclassed
in research/eval/agents.py).

Stage order (as in app/agents/pipeline.py): decompose -> retrieve -> credibility ->
rank -> verdict -> [SBA] (paper Section IV-D: after the verdict LLM).
The claim classifier is skipped: the eval scores every claim, and abstention is measured
through the `not_verifiable` verdict instead. Decomposition and retrieval come from the
snapshot (snapshot.py).
"""
import time
from typing import Any, Dict, List

from app.agents.claim_decomposer import ClaimDecomposerAgent
from app.agents.query_planner import QueryPlannerAgent
from app.agents.retrieval import RetrievalAgent

from research.eval import credibility
from research.eval.agents import ResearchRanker, ResearchVerifier
from research.eval.configs import Config
from research.eval.datasets import Example
from research.eval.labels import aggregate_post_label, verdict_to_class
from research.eval.prompts import LLM_ONLY_PROMPT, NO_REPUTATION_PROMPT
from research.eval.robustness import LOW_CREDIBILITY_JUNK, inject
from research.eval.sba import apply_sba
from research.eval.snapshot import CountingClient, Snapshot, UsageMeter

_NOT_VERIFIABLE = {
    "verdict": "not_verifiable",
    "confidence": 0.0,
    "reasoning": "Verification failed due to an error.",
}


def _atomic_claim(text: str) -> Dict[str, Any]:
    return {
        "id": "c0", "text": text, "span_start": 0, "span_end": len(text),
        "claim_type": "general", "topic": "general", "time_sensitivity": "low",
        "is_verifiable": True,
    }


class System:
    def __init__(self, config: Config, snapshot: Snapshot, junk_credibility: float = LOW_CREDIBILITY_JUNK,
                 relevance_calls: bool = True):
        self.config = config
        self.snapshot = snapshot
        self.junk_credibility = junk_credibility
        self.capture_meter = UsageMeter()  # stages that may be captured into the snapshot
        self.run_meter = UsageMeter()      # stages that always run live (rank, verdict)

        self.decomposer = ClaimDecomposerAgent()
        self.decomposer.client = CountingClient(self.decomposer.client, self.capture_meter)
        self.planner = QueryPlannerAgent()   # calls Groq over httpx, so its tokens are not counted
        self.retriever = RetrievalAgent()

        self.ranker = ResearchRanker(dedup_domains=config.dedup_domains, use_recency=config.use_recency,
                                     relevance_calls=relevance_calls,
                                     relevance_cache=snapshot.data.setdefault("relevance", {}))
        self.ranker.client = CountingClient(self.ranker.client, self.run_meter)

        if not config.retrieve:
            self.verifier = ResearchVerifier(include_reputation=False, prompt=LLM_ONLY_PROMPT)
        elif not config.show_reputation:
            self.verifier = ResearchVerifier(include_reputation=False, prompt=NO_REPUTATION_PROMPT)
        else:
            self.verifier = ResearchVerifier(as_of_claim_date=config.as_of_claim_date)
        self.verifier.client = CountingClient(self.verifier.client, self.run_meter)

    def _credibility(self, item: Dict[str, Any]) -> float:
        if item.get("synthetic"):
            # Injected junk; only the credibility-blind B1 sees the neutral score.
            return credibility.NEUTRAL if self.config.credibility == "flat" else self.junk_credibility
        return credibility.score(self.config.credibility, item.get("domain", ""))

    async def run(self, example: Example, inject_k: int = 0) -> Dict[str, Any]:
        cfg = self.config
        start = time.perf_counter()
        before = self.run_meter.snapshot()
        captured = {"llm_calls": 0, "llm_tokens": 0, "llm_failures": 0, "latency_s": 0.0}

        def add_captured(cost: Dict[str, Any]) -> None:
            for key in captured:
                captured[key] += cost.get(key, 0)

        if example.evidence is not None:
            self.snapshot.prefill_missing(example.text, example.evidence)

        if cfg.decompose and example.decompose:
            claims, cost = await self.snapshot.claims_for(example.text, self.decomposer, self.capture_meter)
            add_captured(cost)
        else:
            claims = [_atomic_claim(example.text)]

        results: List[Dict[str, Any]] = []
        domains: List[str] = []
        for claim in claims:
            claim.setdefault("claim_date", example.claim_date)
            evidence: List[Dict[str, Any]] = []
            if cfg.retrieve:
                items, cost = await self.snapshot.evidence_for(
                    claim, self.planner, self.retriever, self.capture_meter
                )
                add_captured(cost)
                if inject_k:
                    items = inject(claim["text"], items, inject_k)
                for item in items:
                    item["domain_reputation"] = self._credibility(item)
                    if not item.get("synthetic"):
                        domains.append(item.get("domain", ""))
                ranked = await self.ranker.rank_evidence([claim], {claim["id"]: items})
                evidence = ranked.get(claim["id"], [])
            verdict = await self._verdict(claim, evidence)
            if cfg.sba:
                verdict = apply_sba(verdict, evidence)
            # Ranked evidence as the verdict LLM saw it, so SBA can be re-applied offline
            # to exactly these verdicts (research/eval/rescore_sba.py).
            seen = [{k: e.get(k) for k in ("url", "domain", "domain_reputation", "query_stance", "synthetic")}
                    for e in evidence]
            results.append({"text": claim["text"], **verdict, "evidence": seen})

        classes = [verdict_to_class(r["verdict"]) for r in results]
        answered = [r["confidence"] for r, c in zip(results, classes) if c is not None]
        unique_domains = set(domains)
        used = {k: self.run_meter.snapshot()[k] - before[k] for k in before}
        return {
            "id": example.id,
            "gold": example.label,
            "pred": aggregate_post_label(classes),
            "confidence": sum(answered) / len(answered) if answered else 0.0,
            "latency_s": time.perf_counter() - start + captured["latency_s"],
            "llm_calls": used["llm_calls"] + captured["llm_calls"],
            "llm_tokens": used["llm_tokens"] + captured["llm_tokens"],
            "llm_failures": used["llm_failures"] + captured.get("llm_failures", 0),
            "domains_total": len(unique_domains),
            "domains_covered": sum(credibility.is_covered(cfg.credibility, d) for d in unique_domains),
            "inject_k": inject_k,
            "claims": results,
        }

    async def _verdict(self, claim: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
        try:
            return await self.verifier._verify_single_claim(claim, evidence)
        except Exception:
            return dict(_NOT_VERIFIABLE)
