"""
Ingestion Agent - Cleans and prepares text for analysis
"""
from typing import Dict, Any
import re
import structlog

logger = structlog.get_logger()


class IngestionAgent:
    """
    Cleans and prepares raw text content for claim extraction.
    
    Responsibilities:
    - Remove HTML artifacts if present
    - Normalize whitespace
    - Handle special characters
    - Count words
    """
    
    async def process(self, text: str) -> Dict[str, Any]:
        """
        Process raw text and return cleaned version.
        
        Args:
            text: Raw text content
            
        Returns:
            Dictionary with cleaned text and metadata
        """
        logger.debug("Processing text", length=len(text))
        
        # Remove any remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Normalize unicode
        text = text.encode('utf-8', errors='ignore').decode('utf-8')
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        
        # Remove special characters that might interfere
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        
        # Trim
        text = text.strip()
        
        # Count words
        word_count = len(text.split())
        
        logger.info("Text processed", word_count=word_count)
        
        return {
            "text": text,
            "word_count": word_count
        }
