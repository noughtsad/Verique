"""
Retrieval Agent - Fetches evidence from web sources
"""
from typing import List, Dict, Any
import asyncio
import httpx
from urllib.parse import urlparse, quote_plus
import structlog

from app.core.config import settings
from app.agents.domain_reputation import get_domain_score

logger = structlog.get_logger()


class RetrievalAgent:
    """
    Fetches evidence from web sources for claim verification.
    
    Uses DuckDuckGo as primary search, falls back to SerpAPI or Google CSE.
    """
    
    def __init__(self):
        self.serpapi_key = settings.SERPAPI_API_KEY
        self.google_api_key = settings.GOOGLE_API_KEY
        self.google_cse_id = settings.GOOGLE_CSE_ID
        self.use_free_search = settings.USE_FREE_SEARCH
        self.max_results_per_query = 5
    
    async def fetch_evidence(
        self,
        queries: Dict[str, List[str]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch evidence for all claims in parallel.
        
        Args:
            queries: Dictionary mapping claim_id to list of search queries
            
        Returns:
            Dictionary mapping claim_id to list of evidence items
        """
        if not queries:
            return {}
        
        logger.info("Fetching evidence", claims_count=len(queries))
        
        # Collect all search tasks
        tasks = []
        claim_query_map = []  # Track which task belongs to which claim
        
        for claim_id, claim_queries in queries.items():
            for query in claim_queries:
                tasks.append(self._search(query))
                claim_query_map.append(claim_id)
        
        # Execute searches in parallel (with some concurrency limit)
        semaphore = asyncio.Semaphore(3)  # Limit concurrent requests
        
        async def limited_search(query_task):
            async with semaphore:
                return await query_task
        
        results = await asyncio.gather(
            *[limited_search(task) for task in tasks],
            return_exceptions=True
        )
        
        # Aggregate results by claim
        evidence: Dict[str, List[Dict[str, Any]]] = {}
        
        for claim_id, result in zip(claim_query_map, results):
            if claim_id not in evidence:
                evidence[claim_id] = []
            
            if isinstance(result, Exception):
                logger.warning("Search failed", claim_id=claim_id, error=str(result))
                continue
            
            # Add results, avoiding duplicates
            existing_urls = {e["url"] for e in evidence[claim_id]}
            for item in result:
                if item["url"] not in existing_urls:
                    evidence[claim_id].append(item)
                    existing_urls.add(item["url"])
        
        total_evidence = sum(len(e) for e in evidence.values())
        logger.info("Evidence fetched", total=total_evidence)
        
        return evidence
    
    async def _search(self, query: str) -> List[Dict[str, Any]]:
        """
        Perform a single search query.
        
        Args:
            query: Search query string
            
        Returns:
            List of evidence items
        """
        # Priority: DuckDuckGo (free) -> SerpAPI -> Google CSE -> Mock
        if self.use_free_search:
            return await self._search_duckduckgo(query)
        elif self.serpapi_key:
            return await self._search_serpapi(query)
        elif self.google_api_key and self.google_cse_id:
            return await self._search_google(query)
        else:
            return await self._search_duckduckgo(query)
    
    async def _search_duckduckgo(self, query: str) -> List[Dict[str, Any]]:
        """Search using DuckDuckGo via duckduckgo-search library."""
        try:
            from ddgs import DDGS
            import asyncio
            
            # Run sync DDGS in a thread to avoid blocking the event loop
            def _do_search():
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=self.max_results_per_query))
            
            ddg_results = await asyncio.to_thread(_do_search)
            
            results = []
            for item in ddg_results:
                url = item.get("href", "")
                domain = urlparse(url).netloc if url else ""
                results.append({
                    "url": url,
                    "title": item.get("title", ""),
                    "snippet": item.get("body", ""),
                    "domain": domain,
                    "published_at": None,
                    "relevance_score": 0.5,
                    "domain_reputation": self._get_domain_reputation(domain)
                })
            
            if results:
                logger.info("DuckDuckGo search returned results", query=query[:50], count=len(results))
                return results
            else:
                logger.warning("DuckDuckGo returned no results", query=query[:50])
                return []
                
        except Exception as e:
            logger.error("DuckDuckGo search failed", error=str(e), query=query[:50])
            return []
    
    async def _search_serpapi(self, query: str) -> List[Dict[str, Any]]:
        """Search using SerpAPI."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    "https://serpapi.com/search",
                    params={
                        "api_key": self.serpapi_key,
                        "q": query,
                        "num": self.max_results_per_query,
                        "engine": "google"
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                results = []
                for item in data.get("organic_results", [])[:self.max_results_per_query]:
                    domain = urlparse(item.get("link", "")).netloc
                    results.append({
                        "url": item.get("link", ""),
                        "title": item.get("title", ""),
                        "snippet": item.get("snippet", ""),
                        "domain": domain,
                        "published_at": item.get("date"),
                        "relevance_score": 0.5,
                        "domain_reputation": self._get_domain_reputation(domain)
                    })
                
                return results
                
        except Exception as e:
            logger.error("SerpAPI search failed", error=str(e))
            return []
    
    async def _search_google(self, query: str) -> List[Dict[str, Any]]:
        """Search using Google Custom Search API."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "key": self.google_api_key,
                        "cx": self.google_cse_id,
                        "q": query,
                        "num": min(self.max_results_per_query, 10)
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                results = []
                for item in data.get("items", [])[:self.max_results_per_query]:
                    domain = urlparse(item.get("link", "")).netloc
                    results.append({
                        "url": item.get("link", ""),
                        "title": item.get("title", ""),
                        "snippet": item.get("snippet", ""),
                        "domain": domain,
                        "published_at": None,
                        "relevance_score": 0.5,
                        "domain_reputation": self._get_domain_reputation(domain)
                    })
                
                return results
                
        except Exception as e:
            logger.error("Google search failed", error=str(e))
            return []
    

    def _get_domain_reputation(self, domain: str) -> float:
        """
        Get reputation score for a domain using comprehensive database.
        
        Now uses domain_reputation.py with 100+ categorized domains
        instead of hardcoded lists.
        """
        return get_domain_score(domain)
