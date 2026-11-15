"""Configurations compared (Table III of the paper draft)."""
from dataclasses import dataclass, replace
from typing import Dict


@dataclass(frozen=True)
class Config:
    name: str
    description: str
    retrieve: bool = True            # False: LLM-only, no evidence
    credibility: str = "manual"      # flat | manual | default | mbfc (see credibility.py)
    show_reputation: bool = True     # reputation in the verdict prompt
    dedup_domains: bool = True       # one item per domain in the ranker
    use_recency: bool = True         # False: recency term fixed at 0.5
    sba: bool = False                # deterministic SBA after the verdict LLM
    decompose: bool = True           # False: whole post verified as one claim
    as_of_claim_date: bool = False   # True: verdict model judges the claim as of its date


B0 = Config("B0", "LLM-only: same verdict model, no retrieval", retrieve=False)
B1 = Config(
    "B1", "Vanilla RAG: d=0.5 for every domain, no per-domain dedup, no reputation in prompt",
    credibility="flat", show_reputation=False, dedup_domains=False,
)
B2 = Config(
    "B2", "Verique (prompt): source-aware ranking, hand-curated credibility, reputation shown to the verdict LLM"
)
B3 = replace(B2, name="B3", description="B2 plus the deterministic SBA node", sba=True)
B4 = replace(B3, name="B4", description="B3 with MBFC-derived credibility", credibility="mbfc")
A1 = replace(B3, name="A1", description="B3 without decomposition", decompose=False)
A2 = replace(B3, name="A2", description="B3 without recency (t fixed at 0.5)", use_recency=False)
A3 = replace(B3, name="A3", description="B3 without domain dedup", dedup_domains=False)
# Not in Table III: B2 with the app's current lookup (MBFC first, then the hand-curated table).
# The paper draft predates MBFC in the code; this is what the app does today.
B2P = replace(B2, name="B2p", description="B2 with the app's current lookup (MBFC, then table)",
              credibility="default")

# Not in Table III: B2 judged as of each claim's date, matching how benchmark labels were made.
B2D = replace(B2, name="B2d", description="B2 judged as of each claim's date", as_of_claim_date=True)

CONFIGS: Dict[str, Config] = {c.name: c for c in (B0, B1, B2, B3, B4, A1, A2, A3, B2P, B2D)}
