"""
Content Fetcher - Extracts clean text from URLs
"""
from typing import Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
import structlog

logger = structlog.get_logger()


class ContentFetcher:
    """
    Fetches and cleans content from web URLs.
    """
    
    def __init__(self):
        self.headers = {
            "User-Agent": "TrustLens/1.0 (Content Verification Bot)"
        }
    
    async def fetch(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Fetch content from URL and extract clean text.
        
        Args:
            url: The URL to fetch
            
        Returns:
            Dictionary with title, text, and metadata
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers, follow_redirects=True)
                response.raise_for_status()
                
                html = response.text
                return self._extract_content(html, url)
                
        except httpx.TimeoutException:
            logger.error("Timeout fetching URL", url=url)
            return None
        except httpx.HTTPError as e:
            logger.error("HTTP error fetching URL", url=url, error=str(e))
            return None
        except Exception as e:
            logger.error("Error fetching URL", url=url, error=str(e))
            return None
    
    def _extract_content(self, html: str, url: str) -> Dict[str, Any]:
        """Extract clean text content from HTML."""
        soup = BeautifulSoup(html, "lxml")
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()
        
        # Get title
        title = None
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text().strip()
        
        # Try to find main content
        main_content = (
            soup.find("article") or 
            soup.find("main") or 
            soup.find(class_=["content", "post-content", "article-content", "entry-content"]) or
            soup.find("body")
        )
        
        if main_content:
            # Get text with paragraph breaks
            paragraphs = main_content.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"])
            text = "\n\n".join(p.get_text().strip() for p in paragraphs if p.get_text().strip())
        else:
            text = soup.get_text(separator="\n", strip=True)
        
        # Clean up whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        text = "\n".join(lines)
        
        # Word count
        word_count = len(text.split())
        
        logger.info("Extracted content", url=url, word_count=word_count, title=title)
        
        return {
            "url": url,
            "title": title,
            "text": text,
            "word_count": word_count
        }
