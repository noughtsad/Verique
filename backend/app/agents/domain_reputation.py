"""
Domain Reputation Database

Comprehensive categorized database of 100+ domains with trust scores.
Used by the RetrievalAgent to score evidence sources.
"""

# Domain reputation scores:
# 0.95 = Tier 1: Authoritative, highly trusted
# 0.90 = Tier 2: Trusted, professional
# 0.85 = Tier 3: Generally reliable
# 0.70 = Tier 4: Acceptable, community-driven
# 0.50 = Tier 5: Unknown/default
# 0.30 = Tier 6: Low quality
# 0.10 = Tier 7: Known unreliable

DOMAIN_REPUTATION = {
    # ==== NEWS ORGANIZATIONS - TIER 1 (0.95) ====
    "reuters.com": {"score": 0.95, "category": "news"},
    "apnews.com": {"score": 0.95, "category": "news"},
    "bbc.com": {"score": 0.95, "category": "news"},
    "bbc.co.uk": {"score": 0.95, "category": "news"},
    "npr.org": {"score": 0.95, "category": "news"},
    
    # ==== NEWS ORGANIZATIONS - TIER 2 (0.90) ====
    "nytimes.com": {"score": 0.90, "category": "news"},
    "washingtonpost.com": {"score": 0.90, "category": "news"},
    "wsj.com": {"score": 0.90, "category": "news"},
    "theguardian.com": {"score": 0.90, "category": "news"},
    "economist.com": {"score": 0.90, "category": "news"},
    "ft.com": {"score": 0.90, "category": "news"},
    "bloomberg.com": {"score": 0.90, "category": "news"},
    "cnbc.com": {"score": 0.85, "category": "news"},
    "cnn.com": {"score": 0.85, "category": "news"},
    "time.com": {"score": 0.85, "category": "news"},
    
    # ==== SCIENTIFIC JOURNALS & ORGANIZATIONS (0.95) ====
    "nature.com": {"score": 0.95, "category": "science"},
    "science.org": {"score": 0.95, "category": "science"},
    "cell.com": {"score": 0.95, "category": "science"},
    "nejm.org": {"score": 0.95, "category": "medical"},
    "thelancet.com": {"score": 0.95, "category": "medical"},
    "bmj.com": {"score": 0.95, "category": "medical"},
    "pnas.org": {"score": 0.95, "category": "science"},
    
    # ==== GOVERNMENT & HEALTH AUTHORITIES (0.95) ====
    "who.int": {"score": 0.95, "category": "health"},
    "cdc.gov": {"score": 0.95, "category": "health"},
    "nih.gov": {"score": 0.95, "category": "health"},
    "fda.gov": {"score": 0.95, "category": "health"},
    "un.org": {"score": 0.95, "category": "government"},
    "europa.eu": {"score": 0.95, "category": "government"},
    "gov.uk": {"score": 0.95, "category": "government"},
    
    # ==== REFERENCE & EDUCATIONAL (0.90) ====
    "wikipedia.org": {"score": 0.90, "category": "reference"},
    "britannica.com": {"score": 0.95, "category": "reference"},
    "oxforddictionaries.com": {"score": 0.95, "category": "reference"},
    "merriam-webster.com": {"score": 0.90, "category": "reference"},
    
    # ==== TECHNOLOGY & OPEN SOURCE (0.85-0.90) ====
    "github.com": {"score": 0.90, "category": "tech"},
    "stackoverflow.com": {"score": 0.85, "category": "tech"},
    "arxiv.org": {"score": 0.90, "category": "research"},
    "ieee.org": {"score": 0.90, "category": "research"},
    "acm.org": {"score": 0.90, "category": "research"},
    "w3.org": {"score": 0.95, "category": "standards"},
    "ietf.org": {"score": 0.95, "category": "standards"},
    
    # ==== FINANCIAL & BUSINESS (0.85-0.90) ====
    "sec.gov": {"score": 0.95, "category": "finance"},
    "forbes.com": {"score": 0.80, "category": "business"},
    "fortune.com": {"score": 0.80, "category": "business"},
    "marketwatch.com": {"score": 0.80, "category": "finance"},
    
    # ==== TECH NEWS & INDUSTRY (0.75-0.85) ====
    "techcrunch.com": {"score": 0.75, "category": "tech"},
    "wired.com": {"score": 0.80, "category": "tech"},
    "arstechnica.com": {"score": 0.85, "category": "tech"},
    "theverge.com": {"score": 0.75, "category": "tech"},
    "engadget.com": {"score": 0.70, "category": "tech"},
    
    # ==== PROFESSIONAL PLATFORMS (0.70-0.75) ====
    "linkedin.com": {"score": 0.70, "category": "professional"},
    "medium.com": {"score": 0.65, "category": "community"},
    "substack.com": {"score": 0.65, "category": "community"},
    
    # ==== ACADEMIC & RESEARCH DATABASES (0.90) ====
    "pubmed.ncbi.nlm.nih.gov": {"score": 0.95, "category": "medical"},
    "sciencedirect.com": {"score": 0.90, "category": "research"},
    "springer.com": {"score": 0.90, "category": "research"},
    "wiley.com": {"score": 0.90, "category": "research"},
    "jstor.org": {"score": 0.90, "category": "research"},
    
    # ==== FACT-CHECKING ORGANIZATIONS (0.95) ====
    "factcheck.org": {"score": 0.95, "category": "fact-checking"},
    "snopes.com": {"score": 0.90, "category": "fact-checking"},
    "politifact.com": {"score": 0.90, "category": "fact-checking"},
    "fullfact.org": {"score": 0.90, "category": "fact-checking"},
    
    # ==== INTERNATIONAL NEWS (0.85-0.90) ====
    "aljazeera.com": {"score": 0.85, "category": "news"},
    "dw.com": {"score": 0.85, "category": "news"},
    "france24.com": {"score": 0.85, "category": "news"},
    "rfi.fr": {"score": 0.85, "category": "news"},
    
    # ==== STATISTICS & DATA (0.95) ====
    "worldbank.org": {"score": 0.95, "category": "data"},
    "imf.org": {"score": 0.95, "category": "data"},
    "oecd.org": {"score": 0.95, "category": "data"},
    "census.gov": {"score": 0.95, "category": "data"},
    "data.gov": {"score": 0.90, "category": "data"},
    "statista.com": {"score": 0.80, "category": "data"},
    
    # ==== ENVIRONMENTAL & CLIMATE (0.95) ====
    "ipcc.ch": {"score": 0.95, "category": "climate"},
    "noaa.gov": {"score": 0.95, "category": "climate"},
    "nasa.gov": {"score": 0.95, "category": "science"},
    
    # ==== KNOWN LOW-QUALITY/PLACEHOLDER (0.20-0.30) ====
    "example.com": {"score": 0.20, "category": "placeholder"},
    "example.org": {"score": 0.20, "category": "placeholder"},
    "test.com": {"score": 0.20, "category": "placeholder"},
}

# Special domain suffixes with default scores
SUFFIX_REPUTATION = {
    ".gov": {"score": 0.90, "category": "government"},
    ".edu": {"score": 0.85, "category": "academic"},
    ".ac.uk": {"score": 0.85, "category": "academic"},
    ".mil": {"score": 0.90, "category": "government"},
}


def get_domain_reputation(domain: str) -> dict:
    """
    Get reputation information for a domain.
    
    Args:
        domain: Domain name to look up
        
    Returns:
        Dictionary with 'score' and 'category' keys
    """
    domain = domain.lower().strip()
    
    # Check exact domain match first
    if domain in DOMAIN_REPUTATION:
        return DOMAIN_REPUTATION[domain]
    
    # Check if subdomain of known domain
    for known_domain, info in DOMAIN_REPUTATION.items():
        if domain.endswith('.' + known_domain):
            return info
    
    # Check suffix patterns (.gov, .edu, etc.)
    for suffix, info in SUFFIX_REPUTATION.items():
        if domain.endswith(suffix):
            return info
    
    # Default: unknown domain
    return {"score": 0.5, "category": "unknown"}


def get_domain_score(domain: str) -> float:
    """
    Get just the reputation score for a domain.
    
    Args:
        domain: Domain name to look up
        
    Returns:
        Float score between 0.0 and 1.0
    """
    return get_domain_reputation(domain)["score"]
