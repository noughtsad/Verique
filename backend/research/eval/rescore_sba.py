"""
Paired SBA comparison: re-apply SBA to the verdicts of an existing run.

SBA only relabels the verdict LLM's output from the cited sources' credibility, so applying
it to the same verdicts and evidence isolates its effect exactly (no LLM or search drift).

    python -m research.eval.rescore_sba research/results/baseline/<ts>/predictions.jsonl
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from research.eval import metrics
from research.eval.labels import CLASSES, aggregate_post_label, verdict_to_class
from research.eval.sba import apply_sba


def _post(claims: List[Dict[str, Any]]) -> tuple:
    classes = [verdict_to_class(c["verdict"]) for c in claims]
    answered = [c["confidence"] for c, k in zip(claims, classes) if k is not None]
    return aggregate_post_label(classes), (sum(answered) / len(answered) if answered else 0.0)


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact McNemar p-value from the discordant counts b and c."""
    n = b + c
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(0, min(b, c) + 1)) / 2 ** n
    return min(1.0, 2 * tail)


def confusion(gold: List[str], pred: List[Optional[str]]) -> Dict[str, Dict[str, int]]:
    cols = list(CLASSES) + ["abstain"]
    table = {g: {p: 0 for p in cols} for g in CLASSES}
    for g, p in zip(gold, pred):
        table[g][p or "abstain"] += 1
    return table


def rescore(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    gold, base_pred, base_conf, sba_pred, sba_conf = [], [], [], [], []
    changes = Counter()
    for row in rows:
        claims = row["claims"]
        sba_claims = [apply_sba(c, c.get("evidence", [])) for c in claims]
        for before, after in zip(claims, sba_claims):
            changes[f"{before['verdict']} -> {after['verdict']}"] += before["verdict"] != after["verdict"]
        bp, bc = _post(claims)
        sp, sc = _post(sba_claims)
        gold.append(row["gold"]); base_pred.append(bp); base_conf.append(bc)
        sba_pred.append(sp); sba_conf.append(sc)

    # Paired correctness; an abstention counts as not correct.
    b_only = sum(b == g and s != g for g, b, s in zip(gold, base_pred, sba_pred))
    s_only = sum(s == g and b != g for g, b, s in zip(gold, base_pred, sba_pred))
    return {
        "n": len(rows),
        "baseline": {**metrics.summarize(gold, base_pred, base_conf), "confusion": confusion(gold, base_pred)},
        "sba": {**metrics.summarize(gold, sba_pred, sba_conf), "confusion": confusion(gold, sba_pred)},
        "strict_accuracy": {  # abstentions counted as wrong, over all items
            "baseline": sum(b == g for g, b in zip(gold, base_pred)) / len(gold),
            "sba": sum(s == g for g, s in zip(gold, sba_pred)) / len(gold),
        },
        "paired": {"baseline_right_sba_wrong": b_only, "sba_right_baseline_wrong": s_only,
                   "mcnemar_p": mcnemar_exact(b_only, s_only)},
        "verdict_changes": {k: v for k, v in changes.items() if v},
        "posts_changed": sum(b != s for b, s in zip(base_pred, sba_pred)),
    }


def main(argv: List[str]) -> int:
    if len(argv) != 1:
        print(__doc__)
        return 2
    rows = [json.loads(l) for l in Path(argv[0]).read_text().splitlines() if l.strip()]
    print(json.dumps(rescore(rows), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
