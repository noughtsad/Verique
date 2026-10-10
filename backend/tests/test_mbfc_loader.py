"""Tests for the MBFC loader and its priority over the hand-curated dict."""
import pytest

from app.agents.domain_reputation import (
    DOMAIN_REPUTATION,
    find_mbfc_disagreements,
    get_domain_reputation,
    get_domain_score,
)
from app.agents.mbfc_loader import _score, get_mbfc_rating, normalize_domain


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("WWW.BBC.com", "bbc.com"),
        ("https://www.reuters.com/world/", "reuters.com"),
        ("bbc.com:443", "bbc.com"),
        ("example.org.", "example.org"),
        ("", ""),
    ],
)
def test_normalize_domain(raw, expected):
    assert normalize_domain(raw) == expected


def test_score_bands_follow_accuracy():
    assert _score(3, 5, "Least Biased") > _score(2, 3, "Left") > _score(1, 2, "Right")


def test_score_caps_and_unrated():
    assert _score(3, 6, "Questionable") <= 0.30
    assert _score(1, 1, "Conspiracy-Pseudoscience") <= 0.15
    assert _score(None, None, "Satire") == 0.20  # unrated accuracy, category still scores
    assert _score(None, None, "Left") is None  # nothing to score -> fall through


def test_known_sources_rated():
    reuters = get_mbfc_rating("reuters.com")
    assert reuters["score"] >= 0.85
    assert get_mbfc_rating("infowars.com")["score"] <= 0.15


def test_lookup_handles_www_and_subdomains():
    assert get_mbfc_rating("www.bbc.com") == get_mbfc_rating("bbc.com")
    assert get_mbfc_rating("news.bbc.com") == get_mbfc_rating("bbc.com")


def test_unknown_domain_and_bare_tld_not_matched():
    assert get_mbfc_rating("definitely-not-a-real-site.example") is None
    assert get_mbfc_rating("com") is None


def test_returned_rating_is_a_copy():
    get_mbfc_rating("reuters.com")["score"] = 0.0
    assert get_mbfc_rating("reuters.com")["score"] != 0.0


def test_mbfc_takes_priority_over_manual():
    info = get_domain_reputation("infowars.com")
    assert info["source"] == "mbfc"
    assert info["score"] <= 0.15

    # nytimes.com is in the manual dict (0.90) and in MBFC -> MBFC wins
    nyt = get_domain_reputation("nytimes.com")
    assert nyt["source"] == "mbfc"
    assert nyt["category"] == DOMAIN_REPUTATION["nytimes.com"]["category"]
    assert nyt["bias"]


def test_manual_fallback_when_mbfc_lacks_domain():
    manual_only = [d for d in DOMAIN_REPUTATION if get_mbfc_rating(d) is None]
    assert manual_only, "expected at least one manual domain outside MBFC"
    info = get_domain_reputation(manual_only[0])
    assert info["source"] == "manual"
    assert info["score"] == DOMAIN_REPUTATION[manual_only[0]]["score"]


def test_suffix_and_default_fallbacks():
    assert get_domain_reputation("someagency.example.gov")["source"] in {"mbfc", "suffix"}
    unknown = get_domain_reputation("zzz-unknown-site-12345.test")
    assert unknown == {"score": 0.5, "category": "unknown", "source": "default"}
    assert get_domain_score("zzz-unknown-site-12345.test") == 0.5


def test_disagreement_report_shape():
    rows = find_mbfc_disagreements(threshold=0.0)
    assert all({"domain", "manual", "mbfc", "bias", "diff"} <= r.keys() for r in rows)
    assert find_mbfc_disagreements(threshold=1.0) == []
