"""
Query Planner Agent - Generates search queries for claims
"""
from typing import List, Dict, Any
import structlog
import httpx
import json

from app.core.config import settings

logger = structlog.get_logger()


QUERY_PLANNING_PROMPT = """Generate effective search queries to verify this factual claim.

Claim: {claim_text}
Topic: {topic}
Type: {claim_type}

Generate 2-3 search queries that would help find:
1. Direct confirmation or contradiction of this claim
2. Official/authoritative sources on this topic
3. Recent information if the claim is time-sensitive

Good queries:
- Include key entities and numbers from the claim
- Use quotes for exact phrases when helpful
- Vary specificity (one broad, one specific)

Return as JSON array of strings: ["query1", "query2", "query3"]
"""


class QueryPlannerAgent:
    """
    Generates optimized search queries for each claim.
    
    Creates multiple query variations to maximize evidence retrieval.
    Uses Groq API (free) for query generation.
    """
    
    def __init__(self):
        self.groq_api_key = settings.GROQ_API_KEY
        self.model = "llama-3.1-8b-instant"  # Fast model for query generation
    
    async def plan_queries(
        self,
        claims: List[Dict[str, Any]],
        vertical: str = "general"
    ) -> Dict[str, List[str]]:
        """
        Generate search queries for each claim.
        
        Args:
            claims: List of claims to generate queries for
            vertical: Content category hint
            
        Returns:
            Dictionary mapping claim_id to list of queries
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
                    claim_type=claim.get("claim_type", "general")
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
                start = content.find('[')
                end = content.rfind(']') + 1
                if start >= 0 and end > start:
                    claim_queries = json.loads(content[start:end])
                else:
                    # Fallback: use claim text as query
                    claim_queries = [claim["text"][:100]]
                
                queries[claim["id"]] = claim_queries[:3]  # Limit to 3 queries
                
            except Exception as e:
                logger.warning(
                    "Query planning failed for claim",
                    claim_id=claim["id"],
                    error=str(e)
                )
                # Fallback query
                queries[claim["id"]] = [claim["text"][:100]]
        
        total_queries = sum(len(q) for q in queries.values())
        logger.info("Queries planned", total=total_queries)
        
        return queries
