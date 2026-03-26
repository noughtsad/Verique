"""Test search with ddgs library"""
import asyncio
from ddgs import DDGS

async def test():
    query = "Python programming language Wikipedia"
    print(f"Searching: {query}")
    
    def _do_search():
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=5))
    
    results = await asyncio.to_thread(_do_search)
    
    print(f"Got {len(results)} results:")
    for i, r in enumerate(results):
        print(f"  {i+1}. {r.get('title', 'N/A')[:60]}")
        print(f"     URL: {r.get('href', 'N/A')[:80]}")
        print(f"     Snippet: {r.get('body', 'N/A')[:80]}")
        print()

asyncio.run(test())
