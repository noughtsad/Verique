"""
Query Planner Agent - Generates search queries for claims
"""
from typing import List, Dict, Any, Optional
import structlog
import httpx
import json

from app.core.config import settings

logger = structlog.get_logger()


N_SUPPORT_QUERIES = 2
N_CONTRADICT_QUERIES = 1

QUERY_PLANNING_PROMPT = """Generate effective search queries to verify this factual claim.

Claim: {claim_text}
Topic: {topic}
Type: {claim_type}

Generate two groups of queries:

"support": {n_support} standard queries that find:
1. Direct confirmation or explanation of this claim
2. Official/authoritative sources on this topic
3. Recent information if the claim is time-sensitive

"contradict": {n_contradict} adversarial query that tries to DISPROVE the claim, e.g. searches
for debunking, fact-checks, counter-evidence, or the opposite assertion.

Good queries:
- Include key entities and numbers from the claim
- Use quotes for exact phrases when helpful
- Vary specificity (one broad, one specific)

Return ONLY a JSON object:
{{"support": ["query1", "query2"], "contradict": ["query3"]}}
"""


class QueryPlannerAgent:
    """
    Generates optimized search queries for each claim.
    
    Creates multiple query variations to maximize evidence retrieval.
    Uses Groq API (free) for query generation.
    """
    
    def __init__(self):
        self.groq_api_key = settings.GROQ_API_KEY
        self.model = settings.LLM_MODEL_FAST  # Fast model for query generation
    
    async def plan_queries(
        self,
        claims: List[Dict[str, Any]],
        vertical: str = "general"
    ) -> Dict[str, List[Dict[str, str]]]:
        """
        Generate search queries for each claim, split into standard
        ("support") and adversarial ("contradict") queries.
        
        Args:
            claims: List of claims to generate queries for
            vertical: Content category hint
            
        Returns:
            Dictionary mapping claim_id to a list of
            {"query": str, "stance": "support" | "contradict"} items
        """
        if not claims:
            return {}
        
        logger.info("Planning queries", claims_count=len(claims))
        
        queries = {}
        
        for claim in claims:
            try:
                # Format prompt
                prompt = QUERY_PLANNING_PROMPT.format(
                    claim_text=claim["text"],
                    topic=claim.get("topic", vertical),
                    claim_type=claim.get("claim_type", "general"),
                    n_support=N_SUPPORT_QUERIES,
                    n_contradict=N_CONTRADICT_QUERIES,
                )
                
                # Call Groq API
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.groq_api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.model,
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.3
                        }
                    )
                    response.raise_for_status()
                    result = response.json()
                
                # Parse response
                content = result["choices"][0]["message"]["content"]
                claim_queries = self._parse_queries(content) or self._fallback_queries(claim)
                queries[claim["id"]] = claim_queries

            except Exception as e:
                logger.warning(
                    "Query planning failed for claim",
                    claim_id=claim["id"],
                    error=str(e)
                )
                # Fallback query
                queries[claim["id"]] = self._fallback_queries(claim)
        
        total_queries = sum(len(q) for q in queries.values())
        logger.info("Queries planned", total=total_queries)
        
        return queries

    @staticmethod
    def _parse_queries(content: str) -> Optional[List[Dict[str, str]]]:
        """Parse the planner's JSON into stance-tagged queries (None if unusable)."""
        start, end = content.find('{'), content.rfind('}') + 1
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(content[start:end])
        except ValueError:
            return None
        if not isinstance(data, dict):
            return None

        tagged: List[Dict[str, str]] = []
        for stance, limit in (("support", N_SUPPORT_QUERIES), ("contradict", N_CONTRADICT_QUERIES)):
            items = data.get(stance)
            if not isinstance(items, list):
                continue
            queries = [q.strip() for q in items if isinstance(q, str) and q.strip()]
            tagged.extend({"query": q, "stance": stance} for q in queries[:limit])

        # Need at least one standard query to be useful
        if not any(t["stance"] == "support" for t in tagged):
            return None
        return tagged

    @staticmethod
    def _fallback_queries(claim: Dict[str, Any]) -> List[Dict[str, str]]:
        """Used when the LLM call or parsing fails: the claim itself plus a simple counter-search."""
        text = claim["text"][:100]
        return [
            {"query": text, "stance": "support"},
            {"query": f"{text[:85]} false OR debunked", "stance": "contradict"},
        ]
