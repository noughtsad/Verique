"""Label mapping: Verique's seven verdicts collapse to three scored classes."""
from typing import Iterable, Optional

CLASSES = ("True", "False", "Mixed")

VERDICT_TO_CLASS = {
    "strongly_supported": "True",
    "supported": "True",
    "contradicted": "False",
    "outdated": "False",
    "mixed": "Mixed",
    "weak": "Mixed",
    # not_verifiable is an abstention, scored via coverage rather than as a class.
    "not_verifiable": None,
}


def verdict_to_class(verdict: str) -> Optional[str]:
    """Map a Verique verdict to True / False / Mixed, or None for an abstention."""
    return VERDICT_TO_CLASS[verdict]


def aggregate_post_label(claim_classes: Iterable[Optional[str]]) -> Optional[str]:
    """
    Collapse per-claim classes into one post-level class (None if every claim abstained).

    Assumption, not from the paper: all True is True, all False is False, anything else
    (a mix of classes, or any Mixed) is Mixed. Replace if the paper defines a rule.
    """
    answered = [c for c in claim_classes if c is not None]
    if not answered:
        return None
    present = set(answered)
    if present == {"True"}:
        return "True"
    if present == {"False"}:
        return "False"
    return "Mixed"
