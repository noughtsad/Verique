"""
MBFC (Media Bias/Fact Check) rating loader.

Loads app/data/mbfc_data.json once, indexes it by normalized domain, and
converts MBFC's coded fields into a 0-1 reputation score.

Source fields:
    URL                  domain (some entries are host/path, e.g. mdpi.com/journal/x)
    Accuracy             1 = low, 2 = mixed, 3 = high ("N/A" when unrated)
    Objective Reporting  1-6, higher = more objective
    Angle                bias/category label (Left-Center, Questionable, Satire, ...)
"""
import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "mbfc_data.json"

# Base score by MBFC accuracy grade.
_ACCURACY_BASE = {3: 0.88, 2: 0.55, 1: 0.20}
_ACCURACY_LABEL = {3: "High", 2: "Mixed", 1: "Low"}
# Objective Reporting (1-6) nudges the base score by up to +/-0.05.
_OBJECTIVITY_MIDPOINT = 3.5
_OBJECTIVITY_WEIGHT = 0.02

# Angle values that cap the score regardless of accuracy grade.
_ANGLE_CAP = {
    "Questionable": 0.30,
    "Conspiracy-Pseudoscience": 0.15,
    "Satire": 0.20,
}

_MIN_SCORE, _MAX_SCORE = 0.05, 0.95

# MBFC has a typo for this label in some rows.
_ANGLE_FIXES = {"Conspiracy-Pseuscience": "Conspiracy-Pseudoscience"}

_SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.-]*://")


def normalize_domain(value: str) -> str:
    """Lowercase, strip scheme/www./port/path/trailing dot -> bare host."""
    host = _SCHEME_RE.sub("", (value or "").strip().lower())
    host = host.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    host = host.rsplit("@", 1)[-1].split(":", 1)[0].rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    return host


def _to_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _score(accuracy: Optional[int], objectivity: Optional[int], angle: str) -> Optional[float]:
    """Convert MBFC fields to a 0-1 score, or None if there is nothing to score."""
    if accuracy in _ACCURACY_BASE:
        score = _ACCURACY_BASE[accuracy]
        if objectivity is not None:
            score += (objectivity - _OBJECTIVITY_MIDPOINT) * _OBJECTIVITY_WEIGHT
    elif angle in _ANGLE_CAP:
        # Unrated accuracy, but the category itself is a signal (e.g. satire).
        score = _ANGLE_CAP[angle]
    else:
        return None

    if angle in _ANGLE_CAP:
        score = min(score, _ANGLE_CAP[angle])
    return round(max(_MIN_SCORE, min(_MAX_SCORE, score)), 2)


@lru_cache(maxsize=1)
def _load_index() -> dict[str, dict]:
    """Build {normalized_domain: rating} from the JSON file (cached)."""
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            rows = json.load(f)
    except (OSError, ValueError) as exc:
        logger.warning("MBFC dataset unavailable (%s): %s", DATA_FILE, exc)
        return {}

    index: dict[str, dict] = {}
    skipped_paths = 0
    for row in rows:
        raw_url = (row.get("URL") or "").strip().lower()
        if "/" in _SCHEME_RE.sub("", raw_url).rstrip("/"):
            # Path-scoped entry (a section/journal of a larger site); a bare
            # domain lookup must not inherit its rating.
            skipped_paths += 1
            continue
        domain = normalize_domain(raw_url)
        if not domain:
            continue

        angle = _ANGLE_FIXES.get(row.get("Angle"), row.get("Angle") or "")
        accuracy = _to_int(row.get("Accuracy"))
        score = _score(accuracy, _to_int(row.get("Objective Reporting")), angle)
        if score is None:
            continue

        rating = {
            "score": score,
            "bias": angle,
            "accuracy": _ACCURACY_LABEL.get(accuracy),
            "country": row.get("Country"),
            "rating_url": row.get("Rating URL"),
        }
        # Duplicates: keep the most conservative (lowest) score.
        existing = index.get(domain)
        if existing is None or score < existing["score"]:
            index[domain] = rating

    logger.info("MBFC index loaded: %d domains (%d path entries skipped)", len(index), skipped_paths)
    return index


def get_mbfc_rating(domain: str) -> Optional[dict]:
    """
    Look up a domain in the MBFC dataset.

    Tries the exact host, then walks up parent domains
    (news.bbc.com -> bbc.com), never matching a bare TLD.
    Returns a copy of the rating dict, or None if not covered.
    """
    host = normalize_domain(domain)
    if not host:
        return None

    index = _load_index()
    labels = host.split(".")
    for i in range(len(labels) - 1):
        rating = index.get(".".join(labels[i:]))
        if rating is not None:
            return dict(rating)
    return None
