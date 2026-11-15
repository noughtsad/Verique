"""
Metrics, in plain Python (no numpy): accuracy, macro-F1, per-class P/R, ECE,
coverage, Cohen's kappa, latency percentiles and run aggregation.

`pred` entries are a class or None (abstention). Accuracy and F1 are computed over
answered items only; coverage reports the share answered next to them.
"""
import math
import statistics
from typing import Optional, Sequence

from research.eval.labels import CLASSES


def coverage(pred: Sequence[Optional[str]]) -> float:
    return sum(p is not None for p in pred) / len(pred) if pred else 0.0


def _answered(gold: Sequence[str], pred: Sequence[Optional[str]]):
    return [(g, p) for g, p in zip(gold, pred) if p is not None]


def accuracy(gold: Sequence[str], pred: Sequence[Optional[str]]) -> float:
    pairs = _answered(gold, pred)
    return sum(g == p for g, p in pairs) / len(pairs) if pairs else 0.0


def per_class_prf(gold: Sequence[str], pred: Sequence[Optional[str]]) -> dict:
    pairs = _answered(gold, pred)
    out = {}
    for c in CLASSES:
        tp = sum(g == c and p == c for g, p in pairs)
        fp = sum(g != c and p == c for g, p in pairs)
        fn = sum(g == c and p != c for g, p in pairs)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        out[c] = {"precision": precision, "recall": recall, "f1": f1}
    return out


def macro_f1(gold: Sequence[str], pred: Sequence[Optional[str]]) -> float:
    prf = per_class_prf(gold, pred)
    return sum(v["f1"] for v in prf.values()) / len(CLASSES)


def expected_calibration_error(
    gold: Sequence[str],
    pred: Sequence[Optional[str]],
    confidence: Sequence[float],
    n_bins: int = 10,
) -> float:
    """ECE of the reported confidence against correctness, over answered items."""
    items = [(c, g == p) for g, p, c in zip(gold, pred, confidence) if p is not None]
    if not items:
        return 0.0
    bins = [[] for _ in range(n_bins)]
    for conf, correct in items:
        bins[min(int(conf * n_bins), n_bins - 1)].append((conf, correct))
    total = len(items)
    ece = 0.0
    for b in bins:
        if b:
            avg_conf = sum(c for c, _ in b) / len(b)
            acc = sum(ok for _, ok in b) / len(b)
            ece += len(b) / total * abs(avg_conf - acc)
    return ece


def cohens_kappa(a: Sequence[str], b: Sequence[str]) -> float:
    """Inter-annotator agreement between two label sequences of equal length."""
    if len(a) != len(b) or not a:
        raise ValueError("annotator label lists must be non-empty and equal length")
    n = len(a)
    observed = sum(x == y for x, y in zip(a, b)) / n
    labels = set(a) | set(b)
    expected = sum((a.count(l) / n) * (b.count(l) / n) for l in labels)
    return 1.0 if expected == 1 else (observed - expected) / (1 - expected)


def percentile(values: Sequence[float], q: float) -> float:
    """Linear-interpolated percentile, q in [0, 100]."""
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * q / 100
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def summarize(
    gold: Sequence[str],
    pred: Sequence[Optional[str]],
    confidence: Sequence[float],
) -> dict:
    return {
        "accuracy": accuracy(gold, pred),
        "macro_f1": macro_f1(gold, pred),
        "ece": expected_calibration_error(gold, pred, confidence),
        "coverage": coverage(pred),
        "per_class": per_class_prf(gold, pred),
    }


def mean_std(values: Sequence[float]) -> dict:
    """Mean and sample standard deviation (0.0 when fewer than two runs)."""
    return {
        "mean": statistics.fmean(values) if values else 0.0,
        "std": statistics.stdev(values) if len(values) > 1 else 0.0,
    }
