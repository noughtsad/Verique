"""
Tests for Claim Classifier Agent and Pipeline Integration
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.claim_classifier import ClaimClassifierAgent
from app.agents.pipeline import VerificationPipeline
from app.core.config import settings


@pytest.fixture
def classifier_agent():
    return ClaimClassifierAgent()


@pytest.mark.asyncio
async def test_claim_classifier_filters_reflections_and_opinions():
    """Verify classifier filters out reflections and opinions, keeping factual claims."""
    claims = [
        {
            "id": "clm_fact_1",
            "text": "Microsoft acquired GitHub for $7.5 billion in 2018.",
            "claim_type": "numeric"
        },
        {
            "id": "clm_reflection_1",
            "text": "Looking back on my years as a founder, I felt constantly overwhelmed and humbled by the journey.",
            "claim_type": "general"
        },
        {
            "id": "clm_opinion_1",
            "text": "In my opinion, vim is infinitely superior to any modern IDE.",
            "claim_type": "general"
        },
        {
            "id": "clm_fact_2",
            "text": "The Eiffel Tower is located in Paris, France.",
            "claim_type": "entity"
        },
        {
            "id": "clm_reflection_2",
            "text": "I personally realized that meditation is the true key to happiness.",
            "claim_type": "general"
        }
    ]

    agent = ClaimClassifierAgent()
    filtered = await agent.filter_claims(claims)

    filtered_ids = {c["id"] for c in filtered}
    assert "clm_fact_1" in filtered_ids
    assert "clm_fact_2" in filtered_ids
    assert "clm_reflection_1" not in filtered_ids
    assert "clm_opinion_1" not in filtered_ids
    assert "clm_reflection_2" not in filtered_ids


@pytest.mark.asyncio
async def test_claim_classifier_robust_json_parsing():
    """Ensure parser can handle markdown-wrapped json and missing fields gracefully."""
    agent = ClaimClassifierAgent()
    
    # 1. Clean markdown code block
    raw_markdown = """```json
    [
        {"claim_id": "c1", "is_verifiable": true, "reason": "Specific date and entity"},
        {"claim_id": "c2", "is_verifiable": false, "reason": "Personal reflection"}
    ]
    ```"""
    parsed = agent._parse_and_validate_response(raw_markdown)
    assert parsed is not None
    assert len(parsed) == 2
    assert parsed[0]["claim_id"] == "c1"
    assert parsed[0]["is_verifiable"] is True
    assert parsed[1]["claim_id"] == "c2"
    assert parsed[1]["is_verifiable"] is False

    # 2. Text with embedded array
    raw_embedded = """Here is your analysis:
    [
        {"claim_id": "c3", "is_verifiable": true, "reason": "Verifiable revenue stat"}
    ]
    Hope this helps!"""
    parsed_embedded = agent._parse_and_validate_response(raw_embedded)
    assert parsed_embedded is not None
    assert len(parsed_embedded) == 1
    assert parsed_embedded[0]["claim_id"] == "c3"


@pytest.mark.asyncio
async def test_pipeline_runs_claim_classification():
    """Verify that the verification pipeline executes the claim classifier node."""
    pipeline = VerificationPipeline()
    
    # Mock decomposer to return a mix of factual and opinion claims
    mock_extracted = [
        {"id": "c1", "text": "Google was founded in 1998.", "claim_type": "temporal", "topic": "tech", "time_sensitivity": "low"},
        {"id": "c2", "text": "I think Google is the greatest search engine of all time.", "claim_type": "general", "topic": "tech", "time_sensitivity": "low"}
    ]

    # Mock classifier to classify c1 as verifiable and c2 as not verifiable
    mock_filtered = [
        {"id": "c1", "text": "Google was founded in 1998.", "claim_type": "temporal", "topic": "tech", "time_sensitivity": "low", "is_verifiable": True}
    ]

    with patch.object(pipeline.claim_decomposer, "extract_claims", new=AsyncMock(return_value=mock_extracted)), \
         patch.object(pipeline.claim_classifier, "filter_claims", new=AsyncMock(return_value=mock_filtered)), \
         patch.object(pipeline.query_planner, "plan_queries", new=AsyncMock(return_value={"c1": [{"query": "Google founded 1998", "stance": "support"}]})), \
         patch.object(pipeline.retrieval, "fetch_evidence", new=AsyncMock(return_value={"c1": []})), \
         patch.object(pipeline.evidence_ranker, "rank_evidence", new=AsyncMock(return_value={"c1": []})), \
         patch.object(pipeline.verification, "verify_claims", new=AsyncMock(return_value=[{
             "claim_id": "c1",
             "verdict": "strongly_supported",
             "confidence": 0.95,
             "reasoning": "Historical fact",
             "supporting_sources": [],
             "contradicting_sources": [],
             "caveats": []
         }])):
        
        result = await pipeline.run(text="Google was founded in 1998. I think Google is the greatest search engine of all time.")
        
        # Verify only c1 made it to final verified claims
        verified_claims = result["claims"]
        assert len(verified_claims) == 1
        assert verified_claims[0].id == "c1"
        assert verified_claims[0].text == "Google was founded in 1998."
