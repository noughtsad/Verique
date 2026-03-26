"""
Verification Agent - Generates verdicts for claims based on evidence
"""
from typing import List, Dict, Any, Literal
import json
import structlog
from groq import AsyncGroq
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.config import settings

logger = structlog.get_logger()


class VerdictResponse(BaseModel):
    """Verdict response structure."""
    verdict: Literal[
        "strongly_supported",
        "supported",
        "mixed",
        "weak",
        "contradicted",
        "outdated",
        "not_verifiable"
    ] = Field(..., description="Verdict classification")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    reasoning: str = Field(..., min_length=10, description="Reasoning for the verdict")
    supporting_sources: List[str] = Field(default_factory=list, description="URLs supporting the claim")
    contradicting_sources: List[str] = Field(default_factory=list, description="URLs contradicting the claim")
    
    @field_validator('confidence')
    @classmethod
    def clamp_confidence(cls, v: float) -> float:
        """Ensure confidence is between 0 and 1."""
        return max(0.0, min(1.0, v))


VERIFICATION_PROMPT = """You are an expert fact-checker. Analyze this claim against the provided evidence.

CLAIM TO VERIFY:
{claim_text}

EVIDENCE:
{evidence_text}

Based on the evidence, provide your verdict:

1. **Verdict** (choose one):
   - strongly_supported: Multiple high-quality sources confirm this claim
   - supported: Evidence generally supports this claim
   - mixed: Evidence is conflicting or partial
   - weak: Limited or unreliable evidence
   - contradicted: Evidence contradicts this claim
   - outdated: Evidence suggests information is no longer current
   - not_verifiable: Cannot find sufficient evidence to verify

2. **Confidence** (0.0 to 1.0): How confident are you in this verdict?

   CONFIDENCE CALIBRATION GUIDE:
   - 0.95+: 3+ high-reputation sources (0.9+) fully agree, claim is specific and verifiable
   - 0.85-0.94: 2+ high-reputation sources agree, claim is clear
   - 0.70-0.84: 1 high-reputation source OR 2+ medium sources (0.7+) agree
   - 0.50-0.69: Single medium-reputation source OR mixed/conflicting evidence
   - 0.30-0.49: Weak evidence, low-reputation sources, or mostly contradicting
   - Below 0.30: No credible evidence or strong contradictions

3. **Reasoning**: Brief explanation (2-3 sentences) of why you reached this verdict.
   
   WHEN EVIDENCE CONFLICTS:
   - Always mention BOTH supporting and contradicting evidence
   - Use "mixed" verdict
   - Explain the nature of the disagreement
   - Consider source quality differences (high-reputation sources weigh more)

4. **Supporting Sources**: List URLs that support the claim (if any)

5. **Contradicting Sources**: List URLs that contradict the claim (if any)

Respond in JSON format:
{{
    "verdict": "...",
    "confidence": 0.X,
    "reasoning": "...",
    "supporting_sources": ["url1", "url2"],
    "contradicting_sources": ["url1"]
}}

CRITICAL RULES:
- Base your verdict ONLY on the provided evidence
- Higher source reputation (shown in evidence) = more weight in verdict
- If evidence is insufficient, use "not_verifiable" + low confidence
- Don't assume facts not in the evidence
- Be conservative - use "mixed" or "weak" if uncertain
- When sources disagree, check their reputation scores
- Return ONLY valid JSON, no other text"""



class VerificationAgent:
    """
    Generates verdicts for claims based on retrieved evidence.
    """
    
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.LLM_MODEL
    
    async def verify_claims(
        self,
        claims: List[Dict[str, Any]],
        evidence: Dict[str, List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Generate verdicts for all claims.
        
        Args:
            claims: List of claims to verify
            evidence: Dictionary of claim_id to evidence items
            
        Returns:
            List of verdicts
        """
        if not claims:
            return []
        
        logger.info("Verifying claims", count=len(claims))
        
        verdicts = []
        
        for claim in claims:
            claim_id = claim["id"]
            claim_evidence = evidence.get(claim_id, [])
            
            try:
                verdict = await self._verify_single_claim(claim, claim_evidence)
                verdict["claim_id"] = claim_id
                verdicts.append(verdict)
                
            except Exception as e:
                logger.error(
                    "Verification failed for claim",
                    claim_id=claim_id,
                    error=str(e)
                )
                # Add fallback verdict
                verdicts.append({
                    "claim_id": claim_id,
                    "verdict": "not_verifiable",
                    "confidence": 0.0,
                    "reasoning": "Verification failed due to an error.",
                    "supporting_sources": [],
                    "contradicting_sources": [],
                    "model_used": self.model
                })
        
        logger.info("Claims verified", count=len(verdicts))
        return verdicts
    
    async def _verify_single_claim(
        self,
        claim: Dict[str, Any],
        evidence: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Verify a single claim against its evidence."""
        
        # Format evidence for prompt
        if not evidence:
            evidence_text = "No evidence found for this claim."
        else:
            evidence_parts = []
            for i, e in enumerate(evidence[:5], 1):  # Limit to top 5
                evidence_parts.append(
                    f"Source {i}:\n"
                    f"  URL: {e.get('url', 'N/A')}\n"
                    f"  Domain: {e.get('domain', 'N/A')} (reputation: {e.get('domain_reputation', 0.5):.2f})\n"
                    f"  Published: {e.get('published_at', 'Unknown')}\n"
                    f"  Content: {e.get('snippet', 'N/A')}"
                )
            evidence_text = "\n\n".join(evidence_parts)
        
        # Format prompt
        prompt = VERIFICATION_PROMPT.format(
            claim_text=claim["text"],
            evidence_text=evidence_text
        )
        
        # Call Groq API
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a fact-checking expert. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_tokens=1000
        )
        
        # Parse response
        content = response.choices[0].message.content
        
        # Parse and validate response
        try:
            result = self._parse_and_validate_response(content)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            logger.error("Failed to parse verdict response", error=str(e))
            raise ValueError(f"Could not parse verdict JSON: {str(e)}")
        
        # Validate and normalize
        result["model_used"] = self.model
        
        return result
    
    def _parse_and_validate_response(self, content: str) -> Dict[str, Any]:
        """
        Parse and validate LLM verdict response.
        
        Args:
            content: Raw LLM response
            
        Returns:
            Validated verdict dictionary
            
        Raises:
            ValueError: If JSON cannot be found or parsed
            ValidationError: If response doesn't match schema
        """
        # Extract JSON from response
        start = content.find('{')
        end = content.rfind('}') + 1
        
        if start < 0 or end <= start:
            logger.error(
                "No JSON object found in response",
                content_preview=content[:200]
            )
            raise ValueError("No JSON object found in LLM response")
        
        # Parse JSON
        json_str = content[start:end]
        parsed = json.loads(json_str)
        
        # Validate with Pydantic
        validated = VerdictResponse(**parsed)
        
        # Convert to dict
        return validated.model_dump()
