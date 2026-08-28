from app.schemas.verification import ClaimResult, ClaimSources, ClaimType, TimeSensitivity
from app.schemas.social import Verdict, Vertical
import math
from typing import List

def calculate_page_score(claims: List[ClaimResult]) -> int:
    if not claims:
        return 50

    verdict_weights = {
        "strongly_supported": 1.0,
        "supported": 0.85,
        "mixed": 0.40,
        "weak": 0.30,
        "contradicted": 0.10,
        "outdated": 0.40,
        "not_verifiable": 0.50
    }
    
    total_supporting = 0
    total_contradicting = 0
    total_weight = 0
    weighted_sum = 0
    
    for i, claim in enumerate(claims):
        supporting_count = len(claim.sources.supporting)
        contradicting_count = len(claim.sources.contradicting)
        total_supporting += supporting_count
        total_contradicting += contradicting_count
        
        position_weight = 1.0 + (0.3 / (i + 1))
        verdict_score = verdict_weights.get(claim.verdict.value, 0.5)
        
        print(f"verdict_score: {verdict_score}")
        print(f"claim.confidence: {claim.confidence}")
        
        base_score = 0.5 + (verdict_score - 0.5) * claim.confidence
        print(f"base_score: {base_score}")
        
        total_sources = supporting_count + contradicting_count
        if total_sources > 0 and claim.verdict.value in ["strongly_supported", "supported", "not_verifiable"]:
            support_ratio = supporting_count / total_sources if total_sources > 0 else 0
            support_bonus = (support_ratio ** 0.7) * 0.15
            source_bonus = min(0.15, 0.08 * math.log(supporting_count + 1))
            final_score = base_score + support_bonus + source_bonus
            final_score = min(1.0, final_score)
        else:
            final_score = base_score
            
        print(f"final_score before strict: {final_score}")
            
        if claim.verdict.value == "mixed":
            final_score = min(0.45, final_score)
        elif claim.verdict.value == "weak":
            final_score = min(0.35, final_score)
        elif claim.verdict.value == "contradicted":
            final_score = min(0.20, final_score)
            
        print(f"final_score after strict: {final_score}")
        
        weighted_sum += final_score * position_weight
        total_weight += position_weight

    print(f"weighted_sum: {weighted_sum}")
    print(f"total_weight: {total_weight}")

    if total_weight == 0:
        return 50
    
    base_page_score = int((weighted_sum / total_weight) * 100)
    print(f"base_page_score: {base_page_score}")
    
    has_misinformation = any(c.verdict.value in ["mixed", "weak", "contradicted"] for c in claims)
    if total_supporting > 0 and not has_misinformation:
        total_sources = total_supporting + total_contradicting
        global_support_ratio = total_supporting / total_sources
        if global_support_ratio >= 0.7 and total_supporting >= 5:
            global_bonus = min(10, 2 * math.log(total_supporting))
            base_page_score += int(global_bonus)
        elif global_support_ratio >= 0.8 and total_supporting >= 3:
            global_bonus = min(8, 1.5 * math.log(total_supporting))
            base_page_score += int(global_bonus)
    
    final_page_score = min(100, max(0, base_page_score))
    return final_page_score

claim = ClaimResult(
    id="claim_1",
    span=[0, 10],
    text="Verification failed due to an error.",
    claim_type=ClaimType.FACTUAL,
    topic=Vertical.GENERAL,
    time_sensitivity=TimeSensitivity.LOW,
    verdict=Verdict.NOT_VERIFIABLE,
    confidence=0.0,
    reasoning="Verification failed due to an error.",
    sources=ClaimSources(supporting=[], contradicting=[])
)

score = calculate_page_score([claim])
print(f"FINAL SCORE IS: {score}")
