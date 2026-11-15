"""
Credibility sources for the configurations in Table III.

  flat     d = 0.5 for every domain (B1: credibility-agnostic RAG)
  manual   hand-curated table + suffix rules only (what the paper calls "current code")
  default  the app's current lookup: MBFC, then hand-curated table, then suffix, then 0.5
  mbfc     MBFC only; domains it does not rate get 0.5

Scores are computed at replay time from the domain, so one snapshot serves every source.
"""
from typing import Callable

from app.agents.domain_reputation import (
    SUFFIX_REPUTATION,
    _manual_reputation,
    get_domain_reputation,
)
from app.agents.mbfc_loader import get_mbfc_rating, normalize_domain

NEUTRAL = 0.5


def _manual_lookup(domain: str):
    domain = normalize_domain(domain)
    manual = _manual_reputation(domain)
    if manual is not None:
        return manual
    for suffix, info in SUFFIX_REPUTATION.items():
        if domain.endswith(suffix):
            return info
    return None


def score(source: str, domain: str) -> float:
    if source == "flat":
        return NEUTRAL
    if source == "default":
        return get_domain_reputation(domain)["score"]
    if source == "manual":
        info = _manual_lookup(domain)
        return info["score"] if info else NEUTRAL
    if source == "mbfc":
        rating = get_mbfc_rating(normalize_domain(domain))
        return rating["score"] if rating else NEUTRAL
    raise ValueError(f"unknown credibility source: {source}")


def is_covered(source: str, domain: str) -> bool:
    """Whether the credibility source actually has an entry for this domain."""
    if source == "flat":
        return False
    if source == "default":
        return get_domain_reputation(domain)["source"] != "default"
    if source == "manual":
        return _manual_lookup(domain) is not None
    if source == "mbfc":
        return get_mbfc_rating(normalize_domain(domain)) is not None
    raise ValueError(f"unknown credibility source: {source}")


def scorer(source: str) -> Callable[[str], float]:
    return lambda domain: score(source, domain)
