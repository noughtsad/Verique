"""
Explanation Agent - Formats results for user-friendly output
"""
from typing import List, Dict, Any
import structlog

from app.schemas import (
    ClaimResult,
    ClaimSources,
    SourceInfo,
    Verdict,
    ClaimType,
    Vertical,
    TimeSensitivity,
    SourceRole
)

logger = structlog.get_logger()


class ExplanationAgent:
    """
    Formats raw verification results into user-friendly output.
    
    Converts internal data structures to API response format.
    """
    
    async def format_results(
        self,
        claims: List[Dict[str, Any]],
        verdicts: List[Dict[str, Any]],
        evidence: Dict[str, List[Dict[str, Any]]]
    ) -> List[ClaimResult]:
        """
        Format verification results for API response.
        
        Args:
            claims: Original extracted claims
            verdicts: Verification verdicts
            evidence: Ranked evidence per claim
            
        Returns:
            List of formatted ClaimResult objects
        """
        if not claims:
            return []
        
        logger.info("Formatting results", claims_count=len(claims))
        
        # Build verdict lookup
        verdicts_by_claim = {v["claim_id"]: v for v in verdicts}
        
        results = []
        
        for claim in claims:
            claim_id = claim["id"]
            verdict_data = verdicts_by_claim.get(claim_id, {})
            claim_evidence = evidence.get(claim_id, [])
            
            # Build sources
            sources = self._build_sources(
                evidence=claim_evidence,
                supporting_urls=verdict_data.get("supporting_sources", []),
                contradicting_urls=verdict_data.get("contradicting_sources", [])
            )
            
            # Create result
            result = ClaimResult(
                id=claim_id,
                span=[claim.get("span_start", 0), claim.get("span_end", 0)],
                text=claim["text"],
                claim_type=self._parse_enum(ClaimType, claim.get("claim_type", "general")),
                topic=self._parse_enum(Vertical, claim.get("topic", "general")),
                time_sensitivity=self._parse_enum(TimeSensitivity, claim.get("time_sensitivity", "low")),
                verdict=self._parse_enum(Verdict, verdict_data.get("verdict", "not_verifiable")),
                confidence=verdict_data.get("confidence", 0.0),
                reasoning=verdict_data.get("reasoning", "Unable to verify this claim."),
                sources=sources
            )
            
            results.append(result)
        
        logger.info("Results formatted", count=len(results))
        return results
    
    def _build_sources(
        self,
        evidence: List[Dict[str, Any]],
        supporting_urls: List[str],
        contradicting_urls: List[str]
    ) -> ClaimSources:
        """Build sources object from evidence and verdict data."""
        
        # Create lookup by URL
        evidence_by_url = {e["url"]: e for e in evidence}
        
        supporting = []
        contradicting = []
        
        # Add supporting sources
        for url in supporting_urls[:5]:
            if url in evidence_by_url:
                e = evidence_by_url[url]
                supporting.append(SourceInfo(
                    url=e["url"],
                    domain=e.get("domain", ""),
                    snippet=e.get("snippet", ""),
                    domain_score=e.get("domain_reputation", 0.5),
                    published_at=self._parse_date(e.get("published_at")),
                    role=SourceRole.SUPPORTING
                ))
        
        # Add contradicting sources
        for url in contradicting_urls[:3]:
            if url in evidence_by_url:
                e = evidence_by_url[url]
                contradicting.append(SourceInfo(
                    url=e["url"],
                    domain=e.get("domain", ""),
                    snippet=e.get("snippet", ""),
                    domain_score=e.get("domain_reputation", 0.5),
                    published_at=self._parse_date(e.get("published_at")),
                    role=SourceRole.CONTRADICTING
                ))
        
        # If no sources explicitly marked, use top evidence
        if not supporting and not contradicting and evidence:
            for e in evidence[:3]:
                supporting.append(SourceInfo(
                    url=e["url"],
                    domain=e.get("domain", ""),
                    snippet=e.get("snippet", ""),
                    domain_score=e.get("domain_reputation", 0.5),
                    published_at=self._parse_date(e.get("published_at")),
                    role=SourceRole.NEUTRAL
                ))
        
        return ClaimSources(
            supporting=supporting,
            contradicting=contradicting
        )
    
    def _parse_enum(self, enum_class, value: str):
        """Safely parse enum value."""
        try:
            return enum_class(value.lower())
        except (ValueError, AttributeError):
            # Return first value as default
            return list(enum_class)[0]
    
    def _parse_date(self, date_str):
        """Parse date string to datetime."""
        if not date_str:
            return None
        
        from datetime import datetime
        
        try:
            # Try common formats
            for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"]:
                try:
                    return datetime.strptime(str(date_str)[:len(fmt.replace('%', ''))], fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None
