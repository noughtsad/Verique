"""
Evidence Ranker Agent - Scores and ranks evidence by relevance
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta
import structlog
from groq import AsyncGroq

from app.core.config import settings

logger = structlog.get_logger()


RELEVANCE_PROMPT = """Rate how relevant this evidence is to verifying the claim.

Claim: {claim_text}

Evidence:
Title: {title}
Snippet: {snippet}
Domain: {domain}

Rate relevance from 0.0 to 1.0 where:
- 1.0 = Directly addresses the claim with specific information
- 0.7 = Related and provides useful context
- 0.4 = Tangentially related
- 0.0 = Not relevant

Respond with just the number (e.g., 0.8)
"""


class EvidenceRankerAgent:
    """
    Ranks evidence by relevance, recency, and source reputation.
    """
    
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.LLM_MODEL_FAST
        self.max_evidence_per_claim = settings.MAX_EVIDENCE_PER_CLAIM
    
    async def rank_evidence(
        self,
        claims: List[Dict[str, Any]],
        evidence: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Rank and filter evidence for each claim.
        
        Args:
            claims: List of claims
            evidence: Dictionary of claim_id to evidence items
            
        Returns:
            Dictionary of claim_id to top-ranked evidence items
        """
        if not claims or not evidence:
            return {}
        
        logger.info("Ranking evidence", claims_count=len(claims))
        
        ranked = {}
        claims_by_id = {c["id"]: c for c in claims}
        
        for claim_id, evidence_items in evidence.items():
            if claim_id not in claims_by_id:
                continue
            
            claim = claims_by_id[claim_id]
            
            # Score each evidence item
            scored_items = []
            for item in evidence_items:
                score = await self._score_evidence(claim, item)
                item["combined_score"] = score
                scored_items.append(item)
            
            # Sort by score and take top K
            scored_items.sort(key=lambda x: x["combined_score"], reverse=True)
            ranked[claim_id] = scored_items[:self.max_evidence_per_claim]
        
        total_ranked = sum(len(e) for e in ranked.values())
        logger.info("Evidence ranked", total=total_ranked)
        
        return ranked
    
    async def _score_evidence(
        self,
        claim: Dict[str, Any],
        evidence_item: Dict[str, Any]
    ) -> float:
        """
        Calculate combined score for an evidence item.
        
        Combines:
        - Relevance (LLM-scored)
        - Domain reputation
        - Recency
        """
        # Get LLM relevance score
        relevance = await self._get_relevance_score(claim, evidence_item)
        
        # Domain reputation
        domain_score = evidence_item.get("domain_reputation", 0.5)
        
        # Recency score (for time-sensitive claims)
        recency = self._calculate_recency_score(
            evidence_item.get("published_at"),
            claim.get("time_sensitivity", "low")
        )
        
        # Weighted combination
        # Relevance is most important, then domain, then recency
        combined = (
            relevance * 0.5 +
            domain_score * 0.3 +
            recency * 0.2
        )
        
        # Update the evidence item
        evidence_item["relevance_score"] = relevance
        
        return combined
    
    async def _get_relevance_score(
        self,
        claim: Dict[str, Any],
        evidence_item: Dict[str, Any]
    ) -> float:
        """Get LLM-based relevance score using Groq."""
        try:
            prompt = RELEVANCE_PROMPT.format(
                claim_text=claim["text"],
                title=evidence_item.get("title", ""),
                snippet=evidence_item.get("snippet", ""),
                domain=evidence_item.get("domain", "")
            )
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=10
            )
            
            # Parse score
            score_text = response.choices[0].message.content.strip()
            score = float(score_text)
            return max(0.0, min(1.0, score))
            
        except Exception as e:
            logger.warning("Relevance scoring failed", error=str(e))
            return 0.5  # Default score
    
    def _calculate_recency_score(
        self,
        published_at: str | None,
        time_sensitivity: str
    ) -> float:
        """
        Calculate recency score based on publication date.
        
        More recent = higher score, especially for time-sensitive claims.
        """
        if not published_at:
            return 0.5  # Unknown date gets neutral score
        
        try:
            # Parse date (handle various formats)
            if isinstance(published_at, str):
                # Try common formats
                for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%B %d, %Y"]:
                    try:
                        pub_date = datetime.strptime(published_at[:10], fmt[:len(published_at)])
                        break
                    except ValueError:
                        continue
                else:
                    return 0.5
            else:
                pub_date = published_at
            
            # Calculate age in days
            age_days = (datetime.utcnow() - pub_date).days
            
            # Apply decay based on time sensitivity
            if time_sensitivity == "high":
                # High sensitivity: decay to 0.5 over 90 days
                decay_rate = 90
            elif time_sensitivity == "medium":
                # Medium: decay over 365 days
                decay_rate = 365
            else:
                # Low: decay over 1000 days
                decay_rate = 1000
            
            # Exponential decay
            score = 1.0 * (0.5 ** (age_days / decay_rate))
            return max(0.1, min(1.0, score))
            
        except Exception:
            return 0.5
