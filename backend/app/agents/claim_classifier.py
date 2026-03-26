"""
Claim Classifier Agent - Filters and classifies claims
"""
from typing import List, Dict, Any
import json
import structlog
from groq import AsyncGroq
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings

logger = structlog.get_logger()


class ClaimClassification(BaseModel):
    """Classification result for a single claim."""
    claim_id: str = Field(..., description="ID of the claim")
    is_verifiable: bool = Field(..., description="Whether the claim is verifiable")
    reason: str = Field(..., description="Reason for the classification")


class ClassificationResponse(BaseModel):
    """Array of classification results."""
    classifications: List[ClaimClassification] = Field(..., description="List of classifications")


CLASSIFICATION_PROMPT = """Analyze these claims and determine if each is objectively verifiable.

A claim is VERIFIABLE if:
- It makes a factual assertion that can be checked against external sources
- It contains specific, measurable details (numbers, names, dates)
- It could theoretically be proven true or false

A claim is NOT VERIFIABLE if:
- It's a pure opinion or subjective preference
- It's too vague to check
- It's about personal experiences
- It's a prediction about the future
- It's rhetorical or promotional fluff

EXAMPLES:

Example 1:
Claim: "We have over 10,000 active users worldwide."
Classification: VERIFIABLE
Reason: Contains specific number that can be verified through company records or independent verification

Example 2:
Claim: "I think this is the best product on the market."
Classification: NOT VERIFIABLE
Reason: Pure subjective opinion; "best" is not objectively measurable

Example 3:
Claim: "Revenue will increase by 200% next year."
Classification: NOT VERIFIABLE
Reason: Prediction about future; cannot be verified until it happens

Example 4:
Claim: "The study was published in Nature journal in March 2024."
Classification: VERIFIABLE
Reason: Specific publication details can be checked against journal archives

Example 5:
Claim: "Our innovative solution transforms the industry."
Classification: NOT VERIFIABLE
Reason: Vague marketing language; no specific metrics or claims to verify

Now analyze these claims:
{claims}

For each claim, respond with JSON array:
[
    {{"claim_id": "clm_xxx", "is_verifiable": true, "reason": "contains specific numbers"}},
    {{"claim_id": "clm_yyy", "is_verifiable": false, "reason": "subjective opinion"}}
]

Return ONLY the JSON array, no other text.
"""


class ClaimClassifierAgent:
    """
    Filters claims to keep only verifiable ones.
    """
    
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.LLM_MODEL_FAST
    
    async def filter_claims(
        self,
        claims: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Filter claims to keep only verifiable ones.
        
        Args:
            claims: List of extracted claims
            
        Returns:
            Filtered list of verifiable claims
        """
        if not claims:
            return []
        
        logger.info("Classifying claims", count=len(claims))
        
        try:
            # Format claims for prompt
            claims_text = "\n".join([
                f"- ID: {c['id']}, Text: {c['text']}"
                for c in claims
            ])
            
            prompt = CLASSIFICATION_PROMPT.format(claims=claims_text)
            
            # Call Groq API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a claim classifier. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            
            # Parse and validate JSON response with retry logic
            classifications = self._parse_and_validate_response(content, attempt=1)
            
            if classifications is None:
                # Keep all claims if parsing fails
                logger.warning("Could not parse classifications after retries, keeping all claims")
                return claims
            
            # Build lookup of verifiability
            verifiable_ids = set()
            for c in classifications:
                if c.get("is_verifiable", True):
                    verifiable_ids.add(c.get("claim_id"))
            
            # Filter claims
            filtered = [c for c in claims if c["id"] in verifiable_ids]
            
            # Mark remaining as not verifiable for reference
            for c in claims:
                c["is_verifiable"] = c["id"] in verifiable_ids
            
            logger.info(
                "Claims classified",
                total=len(claims),
                verifiable=len(filtered)
            )
            
            return filtered
            
        except Exception as e:
            logger.error("Classification failed", error=str(e))
            # On failure, return all claims (conservative approach)
            return claims
    
    def _parse_and_validate_response(
        self,
        content: str,
        attempt: int,
        max_attempts: int = 3
    ) -> List[Dict[str, Any]] | None:
        """
        Parse and validate LLM response with retry logic.
        
        Args:
            content: Raw LLM response
            attempt: Current attempt number
            max_attempts: Maximum parsing attempts
            
        Returns:
            Validated list of classifications or None if parsing fails
        """
        try:
            # Find JSON array in response
            start = content.find('[')
            end = content.rfind(']') + 1
            
            if start < 0 or end <= start:
                logger.warning(
                    "No JSON array found in response",
                    attempt=attempt,
                    content_preview=content[:100]
                )
                return None
            
            # Extract and parse JSON
            json_str = content[start:end]
            parsed = json.loads(json_str)
            
            # Validate with Pydantic
            validated = [ClaimClassification(**item) for item in parsed]
            
            # Convert back to dict format
            return [v.model_dump() for v in validated]
            
        except json.JSONDecodeError as e:
            logger.warning(
                "JSON parsing failed",
                attempt=attempt,
                error=str(e),
                content_preview=content[:200]
            )
            return None
            
        except ValidationError as e:
            logger.warning(
                "Pydantic validation failed",
                attempt=attempt,
                error=str(e),
                content_preview=content[:200]
            )
            return None
            
        except Exception as e:
            logger.error(
                "Unexpected error parsing response",
                attempt=attempt,
                error=str(e)
            )
            return None
