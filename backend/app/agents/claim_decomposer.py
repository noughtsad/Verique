"""
Claim Decomposer Agent - Extracts factual claims from text
"""
from typing import List, Dict, Any
import json
import uuid
import structlog
from groq import AsyncGroq
from pydantic import BaseModel, Field

from app.core.config import settings

logger = structlog.get_logger()


class ExtractedClaim(BaseModel):
    """Schema for extracted claims."""
    text: str = Field(description="The exact claim text from the source")
    span_start: int = Field(description="Character offset where claim starts")
    span_end: int = Field(description="Character offset where claim ends")
    claim_type: str = Field(description="Type: numeric, entity, temporal, comparative, causal, general")
    topic: str = Field(description="Topic: ecommerce, saas, tech, finance, health, education, professional, general")
    time_sensitivity: str = Field(description="Time sensitivity: high, medium, low")


CLAIM_EXTRACTION_PROMPT = """You are an expert at identifying claims in text.

Your task is to extract ALL claims and statements from the given text. Treat every single statement as a claim that needs to be verified, regardless of its nature.

Extract ALL types of statements including:
1. **Numeric claims** - Statistics, percentages, counts, measurements
2. **Entity claims** - Facts about companies, products, people
3. **Temporal claims** - Dates, timeframes, sequences
4. **Comparative claims** - Comparisons between things
5. **Causal claims** - Cause-effect statements
6. **General statements** - Any assertion or statement of fact, opinion presented as fact, or any other statement

IMPORTANT: Do NOT skip or filter out ANY statements. Extract everything. Even vague, controversial, or opinion-based statements should be extracted as claims to verify.

If the entire input is a single statement, extract it as one claim.

For each claim, provide:
- The exact text of the claim
- Character positions (span_start, span_end)
- Claim type
- Topic category
- Time sensitivity (how quickly might this become outdated)

Content vertical hint: {vertical}

TEXT TO ANALYZE:
{text}

Return your analysis as a JSON object with a "claims" array. Example format:
{{
    "claims": [
        {{
            "text": "claim text here",
            "span_start": 0,
            "span_end": 20,
            "claim_type": "general",
            "topic": "general",
            "time_sensitivity": "low"
        }}
    ]
}}

Limit to the {max_claims} most significant claims.
Return ONLY valid JSON, no other text."""


class ClaimDecomposerAgent:
    """
    Extracts factual claims from text using Groq LLM (FREE).
    
    Uses Llama 3.1 70B on Groq for reliable claim extraction.
    """
    
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.LLM_MODEL
    
    async def extract_claims(
        self,
        text: str,
        vertical: str = "general",
        max_claims: int = None
    ) -> List[Dict[str, Any]]:
        """
        Extract factual claims from text.
        
        Args:
            text: The text to analyze
            vertical: Content category hint
            max_claims: Maximum number of claims to extract
            
        Returns:
            List of extracted claims with metadata
        """
        max_claims = max_claims or settings.MAX_CLAIMS_PER_ARTICLE
        
        logger.info("Extracting claims", text_length=len(text), vertical=vertical)
        
        try:
            # Format prompt
            prompt = CLAIM_EXTRACTION_PROMPT.format(
                text=text[:12000],  # Limit text length for context window
                vertical=vertical,
                max_claims=max_claims
            )
            
            # Call Groq API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a claim extraction expert. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=4000
            )
            
            # Parse response
            content = response.choices[0].message.content
            
            # Extract JSON from response
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(content[start:end])
            else:
                raise ValueError("Could not parse claims JSON")
            
            claims = result.get("claims", [])
            
            # Add unique IDs
            for i, claim in enumerate(claims):
                claim["id"] = f"clm_{uuid.uuid4().hex[:8]}"
                claim["is_verifiable"] = True
            
            logger.info("Claims extracted", count=len(claims))
            return claims
            
        except Exception as e:
            logger.error("Claim extraction failed", error=str(e))
            # Return empty list on failure, let pipeline continue
            return []
