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


CLASSIFICATION_PROMPT = """You are a rigorous claim classifier. Your goal is to distinguish verifiable factual claims from unverifiable statements such as personal reflections, opinions, beliefs, and emotional statements.

A claim is VERIFIABLE (is_verifiable = true) if and only if:
- It makes an objective, factual assertion that can be corroborated or disproved by external, authoritative evidence, public records, or verifiable data.
- It contains specific, measurable, or historical details (numbers, statistics, named entities, dates, locations, scientific facts, concrete events).
- It is a statement of external fact rather than an internal mental state, personal judgment, or subjective reflection.

A claim is NOT VERIFIABLE (is_verifiable = false) if:
- PERSONAL REFLECTIONS or introspections: Statements about one's personal growth, how an experience felt, personal epiphanies, inner thoughts, or lessons learned (e.g. "I realized I had changed", "Looking back, that experience defined me", "I felt overwhelmed by the project").
- SUBJECTIVE OPINIONS or value judgments: Subjective preferences, aesthetic opinions, moral stances, or recommendations (e.g. "This is the best product on the market", "In my opinion, remote work is superior", "Python is more beautiful than Java").
- PERSONAL EXPERIENCES or anecdotes: Statements describing purely subjective or private experiences not recorded in external sources (e.g. "I had a wonderful conversation yesterday", "My coffee was delicious this morning").
- PREDICTIONS or speculations: Statements about what will happen in the future (e.g. "Revenue will double next year", "AI will replace humans by 2035").
- VAGUE / RHETORICAL / MARKETING FLUFF: Non-specific claims that lack concrete criteria to evaluate truth or falsehood (e.g. "Our innovative solution unlocks human potential").

EXAMPLES:

Claim: "Tesla delivered 1.8 million vehicles in 2023."
Classification: VERIFIABLE
Reason: Contains verifiable statistics and dates checkable via public financial reports.

Claim: "I felt a profound sense of peace while walking through the forest."
Classification: NOT VERIFIABLE
Reason: Personal reflection and subjective emotional experience.

Claim: "In my opinion, this framework is the most elegant solution ever created."
Classification: NOT VERIFIABLE
Reason: Subjective opinion and personal value judgment; elegance is not objectively measurable.

Claim: "NASA launched the Artemis 1 mission on November 16, 2022."
Classification: VERIFIABLE
Reason: Historical event with a specific verifiable date and entity.

Claim: "Reflecting on my career, failure was my greatest teacher."
Classification: NOT VERIFIABLE
Reason: Personal reflection and philosophical belief.

Claim: "The company was founded in 2015 by Jane Doe and John Smith."
Classification: VERIFIABLE
Reason: Factual assertion regarding founding date and founders that can be verified in corporate registries.

Claim: "I think everyone should learn programming."
Classification: NOT VERIFIABLE
Reason: Personal opinion and normative recommendation.

Now analyze these claims:
{claims}

For each claim, return a JSON array:
[
    {{"claim_id": "clm_xxx", "is_verifiable": true, "reason": "Specific verifiable fact..."}},
    {{"claim_id": "clm_yyy", "is_verifiable": false, "reason": "Personal reflection or opinion..."}}
]

Return ONLY the JSON array, no other text.
"""


class ClaimClassifierAgent:
    """
    Filters claims to keep only verifiable ones, rejecting personal reflections and opinions.
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
                    {"role": "system", "content": "You are a precise claim classifier. Return only valid JSON array."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=2000
            )
            
            msg = response.choices[0].message
            content = msg.content or msg.reasoning or ""
            
            # Parse and validate JSON response
            classifications = self._parse_and_validate_response(content, attempt=1)
            
            if classifications is None:
                # Keep all claims if parsing fails as a conservative fallback
                logger.warning("Could not parse classifications, keeping all claims as fallback")
                return claims
            
            # Build lookup of verifiability and reasons
            classification_by_id = {c["claim_id"]: c for c in classifications}
            
            # Update verification metadata on every claim
            for c in claims:
                info = classification_by_id.get(c["id"])
                if info is not None:
                    c["is_verifiable"] = bool(info.get("is_verifiable", True))
                    c["classification_reason"] = info.get("reason", "")
                else:
                    c["is_verifiable"] = True
            
            # Filter claims to keep ONLY verifiable claims
            filtered = [c for c in claims if c.get("is_verifiable") is True]
            
            logger.info(
                "Claims classified successfully",
                total=len(claims),
                verifiable=len(filtered),
                filtered_out=len(claims) - len(filtered)
            )
            
            return filtered
            
        except Exception as e:
            logger.error("Classification failed", error=str(e))
            # On unexpected failure, return all claims (conservative fallback)
            return claims
    
    def _parse_and_validate_response(
        self,
        content: str,
        attempt: int = 1,
        max_attempts: int = 3
    ) -> List[Dict[str, Any]] | None:
        """
        Parse and validate LLM response with robust JSON extraction.
        
        Args:
            content: Raw LLM response
            attempt: Current attempt number
            max_attempts: Maximum parsing attempts
            
        Returns:
            Validated list of classifications or None if parsing fails
        """
        if not content:
            return None

        try:
            cleaned = content.strip()
            # Strip markdown fences if present
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                cleaned = "\n".join(lines).strip()

            # Attempt direct parse of cleaned string
            try:
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict):
                    parsed = parsed.get("classifications") or parsed.get("claims") or list(parsed.values())[0]
                if isinstance(parsed, list):
                    validated = [ClaimClassification(**item) for item in parsed]
                    return [v.model_dump() for v in validated]
            except Exception:
                pass

            # Find JSON array in response
            start = content.find('[')
            end = content.rfind(']') + 1
            
            if start >= 0 and end > start:
                json_str = content[start:end]
                parsed = json.loads(json_str)
                if isinstance(parsed, list):
                    validated = [ClaimClassification(**item) for item in parsed]
                    return [v.model_dump() for v in validated]

            logger.warning(
                "No valid JSON array found in classification response",
                attempt=attempt,
                content_preview=content[:150]
            )
            return None
            
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
