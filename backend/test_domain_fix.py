#!/usr/bin/env python3
"""
Quick test to verify domain matching security fix
"""

def _get_domain_reputation(domain: str) -> float:
    """
    Test version of the fixed domain reputation function
    """
    # High-trust domains
    trusted_domains = [
        "wikipedia.org", "github.com", "reuters.com", "bbc.com",
        "nytimes.com", "nature.com", "science.org", "gov",
        "edu", "who.int", "cdc.gov"
    ]
    
    for trusted in trusted_domains:
        # exact match to prevent spoofing
        # (e.g., evil.wikipedia.org.fake.com should NOT match wikipedia.org)
        if domain == trusted or domain.endswith('.' + trusted):
            return 0.9
    
    # Medium trust for known platforms
    medium_domains = [
        "medium.com", "linkedin.com", "forbes.com", "techcrunch.com"
    ]
    
    for medium in medium_domains:
        # Proper suffix match
        if domain == medium or domain.endswith('.' + medium):
            return 0.7
    
    # Default score
    return 0.5


# Test cases
test_cases = [
    # (domain, expected_score, description)
    ("wikipedia.org", 0.9, "✅ Exact match"),
    ("en.wikipedia.org", 0.9, "✅ Subdomain match"),
    ("www.wikipedia.org", 0.9, "✅ WWW subdomain"),
    ("evil.wikipedia.org.fake.com", 0.5, "🔒 SPOOFING BLOCKED"),
    ("wikipedia.org.evil.com", 0.5, "🔒 SPOOFING BLOCKED"),
    ("fakewikipedia.org", 0.5, "🔒 Different domain"),
    ("github.com", 0.9, "✅ Exact match"),
    ("gist.github.com", 0.9, "✅ Subdomain match"),
    ("evil.github.com.fake.org", 0.5, "🔒 SPOOFING BLOCKED"),
]

print("🧪 Testing Domain Matching Security Fix\n")
print("=" * 60)

all_passed = True
for domain, expected, description in test_cases:
    actual = _get_domain_reputation(domain)
    status = "✅ PASS" if actual == expected else "❌ FAIL"
    
    if actual != expected:
        all_passed = False
        
    print(f"{status} | {domain:35} | {actual:.1f} | {description}")

print("=" * 60)
if all_passed:
    print("✅ All tests passed! Domain matching is secure.")
else:
    print("❌ Some tests failed!")
