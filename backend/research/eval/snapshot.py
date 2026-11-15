"""
Snapshot/replay of the non-deterministic stages.

Live search results and LLM decomposition drift between runs, so each is captured once
and replayed for every configuration; systems then differ only in the component under
test. Snapshots are credibility-agnostic: raw search items are stored without a
reputation score, which is attached at replay time.

Layout of the JSON file:
  claims:   sha(text) -> {"claims": [...], "cost": {...}}   (decomposition of a post)
  evidence: sha(claim) -> {"items": [...], "cost": {...}}   (queries + search results)
"cost" holds llm_calls / llm_tokens / latency_s of the captured stage, so end-to-end
latency and token counts can still be reported when a stage is replayed.
"""
import asyncio
import copy
import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List


def text_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


@dataclass
class UsageMeter:
    llm_calls: int = 0
    llm_tokens: int = 0
    llm_failures: int = 0  # calls that still failed after retries (the app then falls back silently)

    def snapshot(self) -> Dict[str, int]:
        return {"llm_calls": self.llm_calls, "llm_tokens": self.llm_tokens,
                "llm_failures": self.llm_failures}


class TokenPacer:
    """
    Keeps estimated Groq usage under a tokens-per-minute budget, per model.

    Groq's free tier allows 8000 TPM per model. The app's agents swallow rate-limit errors
    (relevance falls back to 0.5, the verdict to not_verifiable), which would silently
    degrade an evaluation, so calls are paced instead of allowed to fail.
    """

    def __init__(self, tokens_per_minute: int = 6500):
        self.budget = tokens_per_minute
        self._sent: Dict[str, List[tuple]] = {}
        self._lock = asyncio.Lock()

    async def wait(self, model: str, estimate: int) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                window = [(t, n) for t, n in self._sent.get(model, []) if now - t < 60]
                if sum(n for _, n in window) + estimate <= self.budget or not window:
                    window.append((now, estimate))
                    self._sent[model] = window
                    return
                await asyncio.sleep(60 - (now - window[0][0]) + 0.1)


PACER = TokenPacer()


def _estimate_tokens(kwargs: Dict[str, Any]) -> int:
    chars = sum(len(m.get("content", "")) for m in kwargs.get("messages", []))
    return chars // 3 + (kwargs.get("max_tokens") or 500)


class _CountingCompletions:
    def __init__(self, inner, meter: UsageMeter, pacer: TokenPacer, retries: int = 6):
        self._inner, self._meter, self._pacer, self._retries = inner, meter, pacer, retries

    async def create(self, **kwargs):
        # The Groq client waits up to 10 minutes on an unanswered request; experiments time out
        # after 2 minutes instead and retry (normal calls finish in seconds).
        kwargs.setdefault("timeout", 120)
        for attempt in range(self._retries + 1):
            await self._pacer.wait(kwargs.get("model", ""), _estimate_tokens(kwargs))
            try:
                response = await self._inner.create(**kwargs)
                break
            except Exception as e:
                name = type(e).__name__.lower()
                retryable = "rate" in name or "429" in str(e) or "timeout" in name or "timed out" in str(e).lower()
                if not retryable:
                    self._meter.llm_failures += 1
                    raise
                if attempt == self._retries:
                    self._meter.llm_failures += 1
                    raise
                await asyncio.sleep(min(60, 10 * (attempt + 1)))
        self._meter.llm_calls += 1
        usage = getattr(response, "usage", None)
        self._meter.llm_tokens += getattr(usage, "total_tokens", 0) or 0
        return response


class _CountingChat:
    def __init__(self, inner, meter: UsageMeter, pacer: TokenPacer):
        self.completions = _CountingCompletions(inner.completions, meter, pacer)


class CountingClient:
    """Wraps an AsyncGroq client: paces to the TPM budget, retries 429s, counts calls / tokens."""

    def __init__(self, inner, meter: UsageMeter, pacer: TokenPacer = PACER):
        self.chat = _CountingChat(inner.chat, meter, pacer)


class SnapshotMiss(KeyError):
    pass


class Snapshot:
    def __init__(self, path: Path, capture: bool = False):
        self.path = Path(path)
        self.capture = capture
        self.data: Dict[str, Dict[str, Any]] = {"claims": {}, "evidence": {}}
        if self.path.exists():
            self.data = json.loads(self.path.read_text())

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=1, ensure_ascii=False))

    def _miss(self, kind: str, text: str) -> SnapshotMiss:
        return SnapshotMiss(
            f"{kind} snapshot missing for {text[:60]!r}; rerun with --capture to record it"
        )

    # -- claims (decomposition) ---------------------------------------------

    async def claims_for(self, text: str, decomposer, meter: UsageMeter) -> tuple:
        """Return (claims, cost). `cost` is the captured stage cost to add to the run."""
        key = text_key(text)
        entry = self.data["claims"].get(key)
        if entry is None:
            if not self.capture:
                raise self._miss("claims", text)
            before, start = meter.snapshot(), time.perf_counter()
            claims = await decomposer.extract_claims(text)
            entry = {"claims": claims, "cost": _cost(meter, before, start)}
            self.data["claims"][key] = entry
        return copy.deepcopy(entry["claims"]), entry["cost"]

    # -- evidence (queries + search) ----------------------------------------

    def prefill_evidence(self, claim_text: str, items: List[Dict[str, Any]]) -> None:
        """Seed evidence supplied by a dataset (e.g. CONFACT) so nothing is searched live."""
        self.data["evidence"][text_key(claim_text)] = {
            "items": [_strip(i) for i in items],
            "cost": {"llm_calls": 0, "llm_tokens": 0, "latency_s": 0.0},
        }

    def prefill_missing(self, claim_text: str, items: List[Dict[str, Any]]) -> None:
        """prefill_evidence, but never overwrites an entry that is already recorded."""
        if text_key(claim_text) not in self.data["evidence"]:
            self.prefill_evidence(claim_text, items)

    async def evidence_for(
        self, claim: Dict[str, Any], planner, retriever, meter: UsageMeter
    ) -> tuple:
        """Return (items, cost). `cost` is the captured stage cost to add to the run."""
        key = text_key(claim["text"])
        entry = self.data["evidence"].get(key)
        if entry is None:
            if not self.capture:
                raise self._miss("evidence", claim["text"])
            before, start = meter.snapshot(), time.perf_counter()
            # The planner calls Groq over httpx and silently falls back to the claim text on
            # any error (e.g. a 429), so retry a fallback a few times before accepting it.
            fallback = planner._fallback_queries(claim)
            for attempt in range(4):
                await PACER.wait(planner.model, 900)
                queries = await planner.plan_queries([claim])
                if queries.get(claim["id"]) != fallback:
                    break
                await asyncio.sleep(15 * (attempt + 1))
            planner_fallback = queries.get(claim["id"]) == fallback
            found = await retriever.fetch_evidence(queries)
            items = [_strip(i) for i in found.get(claim["id"], [])]
            entry = {"items": items, "queries": queries.get(claim["id"], []),
                     "planner_fallback": planner_fallback, "cost": _cost(meter, before, start)}
            self.data["evidence"][key] = entry
        return copy.deepcopy(entry["items"]), entry["cost"]


def _strip(item: Dict[str, Any]) -> Dict[str, Any]:
    """Drop fields that depend on the credibility source or on ranking."""
    drop = {"domain_reputation", "combined_score", "relevance_score"}
    return {k: v for k, v in item.items() if k not in drop}


def _cost(meter: UsageMeter, before: Dict[str, int], start: float) -> Dict[str, Any]:
    # Latency includes pacing waits when captured under the free-tier rate limit.
    return {
        "llm_calls": meter.llm_calls - before["llm_calls"],
        "llm_tokens": meter.llm_tokens - before["llm_tokens"],
        "llm_failures": meter.llm_failures - before["llm_failures"],
        "latency_s": time.perf_counter() - start,
    }
