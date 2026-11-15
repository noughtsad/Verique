"""
Ablation variants of the app agents, by subclassing (the app code is never edited).

With default arguments both classes behave exactly like the app agents;
research/tests/test_agents_match_app.py checks that, so drift in the app is caught.
The two overridden methods are copies of the app's; keep them in sync if those change.
"""
import hashlib
import json
from typing import Any, Dict, List, Optional

import structlog
from pydantic import ValidationError

from app.agents.evidence_ranker import EvidenceRankerAgent
from app.agents.verification import VERIFICATION_PROMPT, VerificationAgent

logger = structlog.get_logger()


class ResearchRanker(EvidenceRankerAgent):
    """EvidenceRankerAgent with switchable per-domain dedup (A3, B1) and recency (A2)."""

    def __init__(self, dedup_domains: bool = True, use_recency: bool = True, relevance_calls: bool = True,
                 relevance_cache: Optional[Dict[str, float]] = None):
        super().__init__()
        self.dedup_domains = dedup_domains
        self.use_recency = use_recency
        # Relevance depends only on (claim, source), not on the configuration, so configs share
        # one cache (stored in the snapshot): each source is scored once instead of once per config.
        self.relevance_cache = relevance_cache
        # Before 2026-10-18 the app asked gpt-oss-20b for relevance with max_tokens=10; the
        # reasoning model spent all 10 tokens reasoning and returned '', so the app always fell
        # back to 0.5. relevance_calls=False reproduces that pre-fix app (constant 0.5) without
        # the calls; leave it True to measure the current app.
        self.relevance_calls = relevance_calls

    async def _get_relevance_score(self, claim, evidence_item) -> float:
        if not self.relevance_calls:
            return 0.5
        if self.relevance_cache is None:
            return await super()._get_relevance_score(claim, evidence_item)
        key = hashlib.sha256(f"{claim['text']}\n{evidence_item.get('url', '')}".encode()).hexdigest()[:20]
        if key not in self.relevance_cache:
            self.relevance_cache[key] = await super()._get_relevance_score(claim, evidence_item)
        return self.relevance_cache[key]

    def _calculate_recency_score(self, published_at, time_sensitivity: str) -> float:
        if not self.use_recency:
            return 0.5
        return super()._calculate_recency_score(published_at, time_sensitivity)

    async def rank_evidence(
        self,
        claims: List[Dict[str, Any]],
        evidence: Dict[str, List[Dict[str, Any]]],
    ) -> Dict[str, List[Dict[str, Any]]]:
        # Copy of EvidenceRankerAgent.rank_evidence; only the dedup step is switchable.
        if not claims or not evidence:
            return {}

        ranked = {}
        claims_by_id = {c["id"]: c for c in claims}
        for claim_id, evidence_items in evidence.items():
            if claim_id not in claims_by_id:
                continue
            claim = claims_by_id[claim_id]

            scored_items = []
            for item in evidence_items:
                item["combined_score"] = await self._score_evidence(claim, item)
                scored_items.append(item)
            scored_items.sort(key=lambda x: x["combined_score"], reverse=True)

            kept = []
            seen_domains = set()
            for item in scored_items:
                domain = item.get("domain")
                if not self.dedup_domains or domain not in seen_domains:
                    kept.append(item)
                    seen_domains.add(domain)
            ranked[claim_id] = kept[:self.max_evidence_per_claim]
        return ranked


class ResearchVerifier(VerificationAgent):
    """VerificationAgent with a switchable prompt (B0, B1) and reputation in the evidence lines."""

    def __init__(self, include_reputation: bool = True, prompt: str = VERIFICATION_PROMPT,
                 as_of_claim_date: bool = False):
        super().__init__()
        self.include_reputation = include_reputation
        self.prompt = prompt
        # Benchmark labels describe the claim as of its date; the evidence is today's web. This
        # tells the model to judge the claim as of that date (B2d), so "right then" is not scored
        # as "outdated now".
        self.as_of_claim_date = as_of_claim_date

    def build_prompt(self, claim: Dict[str, Any], evidence: List[Dict[str, Any]]) -> str:
        # Copy of the prompt construction in VerificationAgent._verify_single_claim.
        if not evidence:
            evidence_text = "No evidence found for this claim."
        else:
            evidence_parts = []
            for i, e in enumerate(evidence[:5], 1):  # Limit to top 5
                stance = e.get("query_stance")
                found_via = "counter-search" if stance in ("contradict", "both") else "standard search"
                reputation = (
                    f" (reputation: {e.get('domain_reputation', 0.5):.2f})"
                    if self.include_reputation else ""
                )
                evidence_parts.append(
                    f"Source {i}:\n"
                    f"  URL: {e.get('url', 'N/A')}\n"
                    f"  Found via: {found_via}\n"
                    f"  Domain: {e.get('domain', 'N/A')}{reputation}\n"
                    f"  Published: {e.get('published_at', 'Unknown')}\n"
                    f"  Content: {e.get('snippet', 'N/A')}"
                )
            evidence_text = "\n\n".join(evidence_parts)
        prompt = self.prompt.format(claim_text=claim["text"], evidence_text=evidence_text)
        if self.as_of_claim_date and claim.get("claim_date"):
            prompt = (f"DATE OF CLAIM: this claim was made on {claim['claim_date']} (day-month-year). "
                      "Judge whether it was true at that time. Do not call it outdated or false because "
                      "of developments after that date.\n\n" + prompt)
        return prompt

    async def _verify_single_claim(
        self, claim: Dict[str, Any], evidence: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        # Copy of VerificationAgent._verify_single_claim, using build_prompt.
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a fact-checking expert. Always respond with valid JSON only."},
                {"role": "user", "content": self.build_prompt(claim, evidence)},
            ],
            temperature=0,
            max_tokens=2500,
        )
        content = response.choices[0].message.content
        try:
            result = self._parse_and_validate_response(content)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            logger.error("Failed to parse verdict response", error=str(e))
            raise ValueError(f"Could not parse verdict JSON: {str(e)}")
        result["model_used"] = self.model
        return result
