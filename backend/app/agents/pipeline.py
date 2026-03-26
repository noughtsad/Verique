"""
LangGraph Multi-Agent Verification Pipeline

This module implements the core multi-agent system for content verification
using LangGraph for orchestration.

Agent Flow:
1. Ingestion Agent - Clean and prepare text
2. Claim Decomposer - Extract factual claims
3. Claim Classifier - Filter verifiable claims
4. Query Planner - Generate search queries
5. Retrieval Workers - Fetch evidence (parallel)
6. Evidence Ranker - Score and rank evidence
7. Verification Agent - Generate verdicts
8. Cross-Verification Agent - Reconcile multi-model results (optional)
9. Explanation Agent - Generate user-friendly output
"""
from typing import Dict, Any, List, TypedDict, Annotated
import operator
import structlog
from langgraph.graph import StateGraph, END

from app.agents.ingestion import IngestionAgent
from app.agents.claim_decomposer import ClaimDecomposerAgent
from app.agents.claim_classifier import ClaimClassifierAgent
from app.agents.query_planner import QueryPlannerAgent
from app.agents.retrieval import RetrievalAgent
from app.agents.evidence_ranker import EvidenceRankerAgent
from app.agents.verification import VerificationAgent
from app.agents.explanation import ExplanationAgent
from app.core.config import settings

logger = structlog.get_logger()


class PipelineState(TypedDict):
    """State passed through the pipeline."""
    # Input
    raw_text: str
    url: str | None
    vertical: str
    language: str
    
    # After ingestion
    clean_text: str
    word_count: int
    
    # After claim extraction
    extracted_claims: List[Dict[str, Any]]
    
    # After classification
    verifiable_claims: List[Dict[str, Any]]
    
    # After query planning
    search_queries: Dict[str, List[str]]  # claim_id -> queries
    
    # After retrieval
    raw_evidence: Dict[str, List[Dict[str, Any]]]  # claim_id -> evidence items
    
    # After ranking
    ranked_evidence: Dict[str, List[Dict[str, Any]]]  # claim_id -> top evidence
    
    # After verification
    verdicts: List[Dict[str, Any]]
    
    # Final output
    claims: List[Dict[str, Any]]
    models_used: List[str]
    sources_checked: int
    
    # Error handling
    errors: Annotated[List[str], operator.add]


class VerificationPipeline:
    """
    Main verification pipeline using LangGraph.
    Orchestrates multiple agents to verify factual claims.
    """
    
    def __init__(self):
        self.ingestion = IngestionAgent()
        self.claim_decomposer = ClaimDecomposerAgent()
        self.claim_classifier = ClaimClassifierAgent()
        self.query_planner = QueryPlannerAgent()
        self.retrieval = RetrievalAgent()
        self.evidence_ranker = EvidenceRankerAgent()
        self.verification = VerificationAgent()
        self.explanation = ExplanationAgent()
        
        # Build the graph
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state machine."""
        workflow = StateGraph(PipelineState)
        
        # Add nodes
        workflow.add_node("ingestion", self._run_ingestion)
        workflow.add_node("claim_decomposition", self._run_claim_decomposition)
        workflow.add_node("claim_classification", self._run_claim_classification)
        workflow.add_node("query_planning", self._run_query_planning)
        workflow.add_node("retrieval", self._run_retrieval)
        workflow.add_node("evidence_ranking", self._run_evidence_ranking)
        workflow.add_node("verification", self._run_verification)
        workflow.add_node("explanation", self._run_explanation)
        
        # Add edges (linear flow for MVP)
        workflow.set_entry_point("ingestion")
        workflow.add_edge("ingestion", "claim_decomposition")
        workflow.add_edge("claim_decomposition", "claim_classification")
        workflow.add_edge("claim_classification", "query_planning")
        workflow.add_edge("query_planning", "retrieval")
        workflow.add_edge("retrieval", "evidence_ranking")
        workflow.add_edge("evidence_ranking", "verification")
        workflow.add_edge("verification", "explanation")
        workflow.add_edge("explanation", END)
        
        return workflow.compile()
    
    async def run(
        self,
        text: str,
        url: str | None = None,
        vertical: str = "general",
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Run the full verification pipeline.
        
        Args:
            text: Raw text content to verify
            url: Optional source URL
            vertical: Content category
            language: Content language
            
        Returns:
            Verification results with claims and verdicts
        """
        logger.info("Starting verification pipeline")
        
        # Initialize state
        initial_state: PipelineState = {
            "raw_text": text,
            "url": url,
            "vertical": vertical,
            "language": language,
            "clean_text": "",
            "word_count": 0,
            "extracted_claims": [],
            "verifiable_claims": [],
            "search_queries": {},
            "raw_evidence": {},
            "ranked_evidence": {},
            "verdicts": [],
            "claims": [],
            "models_used": [],
            "sources_checked": 0,
            "errors": []
        }
        
        # Run the graph
        final_state = await self.graph.ainvoke(initial_state)
        
        logger.info(
            "Pipeline completed",
            claims_count=len(final_state["claims"]),
            errors=final_state.get("errors", [])
        )
        
        return {
            "claims": final_state["claims"],
            "models_used": final_state["models_used"],
            "sources_checked": final_state["sources_checked"]
        }
    
    async def _run_ingestion(self, state: PipelineState) -> PipelineState:
        """Clean and prepare text."""
        try:
            result = await self.ingestion.process(state["raw_text"])
            state["clean_text"] = result["text"]
            state["word_count"] = result["word_count"]
        except Exception as e:
            state["errors"].append(f"Ingestion error: {str(e)}")
            state["clean_text"] = state["raw_text"]
        return state
    
    async def _run_claim_decomposition(self, state: PipelineState) -> PipelineState:
        """Extract factual claims from text."""
        try:
            claims = await self.claim_decomposer.extract_claims(
                state["clean_text"],
                vertical=state["vertical"]
            )
            state["extracted_claims"] = claims
            state["models_used"].append(settings.LLM_MODEL)
        except Exception as e:
            state["errors"].append(f"Claim decomposition error: {str(e)}")
            state["extracted_claims"] = []
        return state
    
    async def _run_claim_classification(self, state: PipelineState) -> PipelineState:
        """Skip classification — treat all extracted claims as verifiable."""
        # Bypass classifier: pass all claims through directly
        state["verifiable_claims"] = state["extracted_claims"]
        for c in state["verifiable_claims"]:
            c["is_verifiable"] = True
        logger.info("Classification bypassed, treating all claims as verifiable", count=len(state["verifiable_claims"]))
        return state
    
    async def _run_query_planning(self, state: PipelineState) -> PipelineState:
        """Generate search queries for each claim."""
        try:
            queries = await self.query_planner.plan_queries(
                state["verifiable_claims"],
                vertical=state["vertical"]
            )
            state["search_queries"] = queries
        except Exception as e:
            state["errors"].append(f"Query planning error: {str(e)}")
        return state
    
    async def _run_retrieval(self, state: PipelineState) -> PipelineState:
        """Fetch evidence for claims."""
        try:
            evidence = await self.retrieval.fetch_evidence(
                state["search_queries"]
            )
            state["raw_evidence"] = evidence
            
            # Count sources
            total_sources = sum(len(e) for e in evidence.values())
            state["sources_checked"] = total_sources
        except Exception as e:
            state["errors"].append(f"Retrieval error: {str(e)}")
        return state
    
    async def _run_evidence_ranking(self, state: PipelineState) -> PipelineState:
        """Rank and filter evidence."""
        try:
            ranked = await self.evidence_ranker.rank_evidence(
                claims=state["verifiable_claims"],
                evidence=state["raw_evidence"]
            )
            state["ranked_evidence"] = ranked
        except Exception as e:
            state["errors"].append(f"Ranking error: {str(e)}")
            state["ranked_evidence"] = state["raw_evidence"]
        return state
    
    async def _run_verification(self, state: PipelineState) -> PipelineState:
        """Generate verdicts for each claim."""
        try:
            verdicts = await self.verification.verify_claims(
                claims=state["verifiable_claims"],
                evidence=state["ranked_evidence"]
            )
            state["verdicts"] = verdicts
        except Exception as e:
            state["errors"].append(f"Verification error: {str(e)}")
        return state
    
    async def _run_explanation(self, state: PipelineState) -> PipelineState:
        """Generate user-friendly output."""
        try:
            claims = await self.explanation.format_results(
                claims=state["verifiable_claims"],
                verdicts=state["verdicts"],
                evidence=state["ranked_evidence"]
            )
            state["claims"] = claims
        except Exception as e:
            state["errors"].append(f"Explanation error: {str(e)}")
            state["claims"] = []
        return state
