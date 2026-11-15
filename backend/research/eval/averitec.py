"""
Build a labelled sample from the AVeriTeC dev split (CC BY-NC 4.0; Schlichtkrull et al., 2023).

    python -m research.eval.averitec research/data/raw/averitec_dev.json research/data/averitec_sample.jsonl \
        --per-class True=20 False=20 Mixed=10 --seed 0

Labels map to the eval classes: Supported -> True, Refuted -> False,
Conflicting Evidence/Cherrypicking -> Mixed. "Not Enough Evidence" has no class and is dropped.
Claims are verified as one atomic claim each (no decomposition), with live search.
"""
import argparse
import json
import random
import sys
from pathlib import Path
from typing import Dict, List

LABEL_MAP = {
    "Supported": "True",
    "Refuted": "False",
    "Conflicting Evidence/Cherrypicking": "Mixed",
}


def build(rows: List[dict], per_class: Dict[str, int], seed: int) -> List[dict]:
    by_class: Dict[str, List[dict]] = {}
    for i, row in enumerate(rows):
        cls = LABEL_MAP.get(row["label"])
        if cls:
            by_class.setdefault(cls, []).append({
                "id": f"averitec-dev-{i}", "text": row["claim"], "label": cls,
                "claim_date": row.get("claim_date"), "source_label": row["label"],
            })
    rng = random.Random(seed)
    sample = []
    for cls, n in per_class.items():
        pool = by_class.get(cls, [])
        if len(pool) < n:
            raise ValueError(f"only {len(pool)} {cls} claims available, wanted {n}")
        sample.extend(rng.sample(pool, n))
    rng.shuffle(sample)
    return sample


EASY_TYPES = ["Event/Property Claim"]
DIFFICULT_LABEL = "Conflicting Evidence/Cherrypicking"


def _is_easy(row: dict) -> bool:
    """Clear-cut: Supported/Refuted, a single Event/Property claim type, no numeric comparison.
    Excludes numeric, causal, quote and position claims (borderline cases like the Iowa one)."""
    return (row["label"] in ("Supported", "Refuted")
            and list(row.get("claim_types") or []) == EASY_TYPES
            and "Numerical Comparison" not in (row.get("fact_checking_strategies") or []))


def build_simple(rows: List[dict], n_per_side: int, n_difficult: int, seed: int) -> List[dict]:
    """Mostly clear-cut sample: n_per_side easy True and easy False claims, plus n_difficult
    Conflicting/Cherrypicking (Mixed) claims. Reproducible for a given seed."""
    def example(i: int, row: dict, difficulty: str) -> dict:
        return {"id": f"averitec-dev-{i}", "text": row["claim"], "label": LABEL_MAP[row["label"]],
                "claim_date": row.get("claim_date"), "source_label": row["label"], "difficulty": difficulty}

    easy_true = [example(i, r, "easy") for i, r in enumerate(rows) if _is_easy(r) and r["label"] == "Supported"]
    easy_false = [example(i, r, "easy") for i, r in enumerate(rows) if _is_easy(r) and r["label"] == "Refuted"]
    difficult = [example(i, r, "difficult") for i, r in enumerate(rows) if r["label"] == DIFFICULT_LABEL]
    rng = random.Random(seed)
    for pool, n in ((easy_true, n_per_side), (easy_false, n_per_side), (difficult, n_difficult)):
        if len(pool) < n:
            raise ValueError(f"pool has {len(pool)} claims, wanted {n}")
    sample = rng.sample(easy_true, n_per_side) + rng.sample(easy_false, n_per_side) + rng.sample(difficult, n_difficult)
    rng.shuffle(sample)
    return sample


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("src", type=Path)
    parser.add_argument("dst", type=Path)
    parser.add_argument("--per-class", nargs="+", default=["True=20", "False=20", "Mixed=10"])
    parser.add_argument("--simple", nargs=2, type=int, metavar=("PER_SIDE", "DIFFICULT"),
                        help="mostly clear-cut sample instead: PER_SIDE easy True + False claims, plus DIFFICULT Mixed")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    rows = json.loads(args.src.read_text())
    if args.simple:
        sample = build_simple(rows, n_per_side=args.simple[0], n_difficult=args.simple[1], seed=args.seed)
    else:
        per_class = {k: int(v) for k, v in (item.split("=") for item in args.per_class)}
        sample = build(rows, per_class, args.seed)
    args.dst.parent.mkdir(parents=True, exist_ok=True)
    args.dst.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in sample))
    print(f"wrote {len(sample)} claims to {args.dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
