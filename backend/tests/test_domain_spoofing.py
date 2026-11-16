"""
Domain matching must not be fooled by look-alike hostnames.

A trusted name appearing inside a longer, attacker-controlled hostname
(wikipedia.org.evil.com, fakewikipedia.org, ...) must fall through to the
neutral default instead of inheriting the trusted domain's score.
"""
import pytest

from app.agents.domain_reputation import get_domain_reputation

NEUTRAL = {"score": 0.5, "category": "unknown", "source": "default"}


@pytest.mark.parametrize(
    "domain",
    [
        "evil.wikipedia.org.fake.com",
        "wikipedia.org.evil.com",
        "fakewikipedia.org",
        "evil.github.com.fake.org",
        "reuters.com.evil.com",
        "notreuters.com",
        "evil.gov.fake.com",
        "fakegov",
    ],
)
def test_lookalike_domains_get_neutral_default(domain):
    assert get_domain_reputation(domain) == NEUTRAL


@pytest.mark.parametrize("domain", ["github.com", "gist.github.com"])
def test_genuine_domain_and_subdomain_keep_trusted_score(domain):
    info = get_domain_reputation(domain)
    assert info["score"] >= 0.9
    assert info["source"] != "default"


@pytest.mark.parametrize("domain", ["stanford.edu", "some.agency.gov"])
def test_government_and_academic_suffixes_match_real_tlds(domain):
    info = get_domain_reputation(domain)
    assert info["source"] in {"suffix", "mbfc", "manual"}
    assert info["score"] > 0.5
