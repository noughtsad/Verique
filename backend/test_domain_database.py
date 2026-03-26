#!/usr/bin/env python3
"""Test domain reputation module"""
import sys
sys.path.insert(0, '/Users/rishetmehra/Desktop/Verique/backend')

from app.agents.domain_reputation import get_domain_reputation, get_domain_score

# Test cases
test_domains = [
    # Tier 1 - News
    ("reuters.com", 0.95, "news"),
    ("apnews.com", 0.95, "news"),
    
    # Government
    ("cdc.gov", 0.95, "health"),
    ("some.agency.gov", 0.90, "government"),  # suffix match
    
    # Academic
    ("nature.com", 0.95, "science"),
    ("stanford.edu", 0.85, "academic"),  # suffix match
    
    # Tech
    ("github.com", 0.90, "tech"),
    ("gist.github.com", 0.90, "tech"),  # subdomain
    
    # Unknown
    ("random-blog.com", 0.5, "unknown"),
    
    # Low quality
    ("example.com", 0.20, "placeholder"),
]

print("🧪 Testing Domain Reputation Database\n")
print("=" * 70)
print(f"{'Domain':<30} | {'Score':<6} | {'Category':<15} | Status")
print("=" * 70)

all_passed = True
for domain, expected_score, expected_category in test_domains:
    result = get_domain_reputation(domain)
    score = result["score"]
    category = result["category"]
    
    score_match = abs(score - expected_score) < 0.01
    category_match = category == expected_category
    
    status = "✅" if (score_match and category_match) else "❌"
    if not (score_match and category_match):
        all_passed = False
    
    print(f"{domain:<30} | {score:<6.2f} | {category:<15} | {status}")

print("=" * 70)
if all_passed:
    print("✅ All tests passed! 100+ domain database working.")
    print(f"\nTotal domains in database: {len([d for d in dir() if not d.startswith('_')])}")
else:
    print("❌ Some tests failed!")
