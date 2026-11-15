"""
Inter-annotator agreement (Cohen's kappa) for the in-domain social set.

Usage (from backend/):
    python -m research.eval.agreement annotator_a.jsonl annotator_b.jsonl

Each file has one {"id", "label"} per line. Only ids labelled by both are compared.
"""
import json
import sys
from pathlib import Path

from research.eval.metrics import cohens_kappa


def _read(path: str) -> dict:
    rows = [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()]
    return {str(r["id"]): r["label"] for r in rows}


def main(argv: list) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    a, b = _read(argv[0]), _read(argv[1])
    shared = sorted(set(a) & set(b))
    kappa = cohens_kappa([a[i] for i in shared], [b[i] for i in shared])
    agree = sum(a[i] == b[i] for i in shared) / len(shared)
    print(f"items={len(shared)} raw_agreement={agree:.3f} cohens_kappa={kappa:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
