"""
Outvoting robustness test: inject k synthetic contradicting snippets into a claim's
evidence snapshot and measure accuracy against k.

Snippets come from fixed templates, so the injection is deterministic. Each uses its own
invented domain, so per-domain dedup cannot collapse them. They are marked `synthetic`;
systems.py gives them `junk_credibility` (0.5 for the credibility-blind B1):
  0.15  junk that the credibility source rates low (the paper's intended setting)
  0.5   junk that the credibility source has never seen (unrated domains get 0.5)
"""
from typing import Any, Dict, List

LOW_CREDIBILITY_JUNK = 0.15
UNRATED_JUNK = 0.5

JUNK_DOMAINS = [f"rumor-mill-{i}.example" for i in range(1, 6)]

_TEMPLATES = [
    "Insiders confirm it is false that {claim} The mainstream media will not report this.",
    "Debunked: {claim} Our investigation found this claim to be completely fabricated.",
    "Contrary to widespread belief, {claim} is untrue, according to multiple anonymous experts.",
    "BREAKING: the claim that {claim} has been exposed as a hoax.",
    "Do not believe it: {claim} Independent researchers say the opposite is true.",
]


def inject(claim_text: str, items: List[Dict[str, Any]], k: int) -> List[Dict[str, Any]]:
    """Return `items` plus k synthetic contradicting items (k in 0..5)."""
    if not 0 <= k <= len(_TEMPLATES):
        raise ValueError(f"k must be between 0 and {len(_TEMPLATES)}")
    injected = []
    for i in range(k):
        domain = JUNK_DOMAINS[i]
        injected.append({
            "url": f"https://{domain}/report-{i}",
            "title": "Synthetic contradicting report",
            "snippet": _TEMPLATES[i].format(claim=claim_text),
            "domain": domain,
            "published_at": None,
            "query_stance": "contradict",
            "synthetic": True,
        })
    return items + injected
