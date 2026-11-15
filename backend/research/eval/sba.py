"""
Source Background Augmentation (SBA), paper draft Section IV-D. Research-only: not used by the app.

The verdict LLM cites sources as supporting (S) or contradicting (R). With d(e) the
credibility of a source's domain:

    V = (sum_S d - sum_R d) / (sum_S d + sum_R d)     in [-1, 1]
    I = min(sum_S d, sum_R d) / max(sum_S d, sum_R d)  in [0, 1]  (1 = balanced conflict)

V > tau maps to supported, V < -tau to contradicted, otherwise mixed (tau = 0.3).

Left open by the spec, decided here:
- With no cited source found in the evidence (or zero total credibility) the LLM verdict
  is kept unchanged and no V / I are recorded.
- The LLM's confidence is kept; SBA only replaces the verdict label.
- SBA maps to supported / contradicted / mixed only, so an LLM `outdated` or
  `not_verifiable` is overridden whenever cited sources exist.
"""
from typing import Any, Dict, List

SBA_TAU = 0.3


def apply_sba(
    verdict: Dict[str, Any], evidence: List[Dict[str, Any]], tau: float = SBA_TAU
) -> Dict[str, Any]:
    """Return a copy of `verdict` with its label recomputed from the cited sources' credibility."""
    by_url = {e["url"]: e for e in evidence}

    def weight(urls: List[str]) -> float:
        return sum(
            by_url[url].get("domain_reputation", 0.5)
            for url in dict.fromkeys(urls)  # dedupe, keep order
            if url in by_url
        )

    support = weight(verdict.get("supporting_sources", []))
    contradict = weight(verdict.get("contradicting_sources", []))
    total = support + contradict
    if total <= 0:
        return dict(verdict)

    v = (support - contradict) / total
    conflict = min(support, contradict) / max(support, contradict)
    if v > tau:
        label = "supported"
    elif v < -tau:
        label = "contradicted"
    else:
        label = "mixed"
    return {**verdict, "verdict": label, "llm_verdict": verdict.get("verdict"),
            "sba_score": v, "sba_conflict": conflict}
