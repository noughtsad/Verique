"""
Run the evaluation. From backend/:

    # 1. record decomposition + search results once (needs GROQ_API_KEY and network)
    python -m research.eval.run_eval --dataset research/data/social.jsonl \
        --snapshot research/snapshots/social.json --configs B2 --runs 1 --capture
    # 2. replay the snapshot for every configuration, 3 runs each
    python -m research.eval.run_eval --dataset research/data/social.jsonl \
        --snapshot research/snapshots/social.json --configs B0 B1 B2 B3 B4 A1 A2 A3 --runs 3
    # 3. outvoting robustness (accuracy vs k injected contradicting snippets)
    python -m research.eval.run_eval --dataset research/data/confact.jsonl \
        --snapshot research/snapshots/confact.json --robustness --configs B1 B2 B3
    #    same, with junk the credibility source has never rated (d = 0.5)
    ...  --robustness --configs B1 B2 B3 --junk-credibility 0.5

Results go to research/results/<timestamp>/ as results.json plus predictions.jsonl.
"""
import argparse
import asyncio
import json
import random
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from research.eval import metrics
from research.eval.configs import CONFIGS
from research.eval.datasets import Example, load_jsonl
from research.eval.robustness import LOW_CREDIBILITY_JUNK
from research.eval.snapshot import Snapshot
from research.eval.systems import System

SCORE_KEYS = ("accuracy", "macro_f1", "ece", "coverage")
QUOTA_EXIT_CODE = 3


class QuotaStop(RuntimeError):
    """An LLM call failed after retries; the run stops so no fallback answer is saved."""


def _score_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    gold = [r["gold"] for r in rows]
    pred = [r["pred"] for r in rows]
    return metrics.summarize(gold, pred, [r["confidence"] for r in rows])


def _system_stats(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    latencies = [r["latency_s"] for r in rows]
    total = sum(r["domains_total"] for r in rows)
    return {
        "latency_cold_p50_s": metrics.percentile(latencies, 50),
        "latency_cold_p95_s": metrics.percentile(latencies, 95),
        "llm_calls_per_verification": sum(r["llm_calls"] for r in rows) / len(rows),
        "llm_tokens_per_verification": sum(r["llm_tokens"] for r in rows) / len(rows),
        "domain_coverage": sum(r["domains_covered"] for r in rows) / total if total else 0.0,
    }


async def evaluate(
    config_name: str, examples: List[Example], snapshot: Snapshot, runs: int,
    inject_k: int = 0, junk_credibility: float = LOW_CREDIBILITY_JUNK, relevance_calls: bool = True,
    checkpoint_dir: Optional[Path] = None, batch_size: int = 10,
) -> Dict[str, Any]:
    system = System(CONFIGS[config_name], snapshot, junk_credibility=junk_credibility,
                    relevance_calls=relevance_calls)
    per_run, all_rows = [], []
    for run in range(runs):
        # Rows are appended to a checkpoint after every batch; rerunning with the same
        # --name resumes and skips examples already done.
        done: Dict[str, Dict[str, Any]] = {}
        checkpoint = None
        if checkpoint_dir is not None:
            checkpoint = checkpoint_dir / f"{config_name}_k{inject_k}_run{run}.partial.jsonl"
            if checkpoint.exists():
                done = {r["id"]: r for r in map(json.loads, checkpoint.read_text().splitlines()) if r}
        todo = [e for e in examples if e.id not in done]
        for start in range(0, len(todo), batch_size):
            batch, failed = [], None
            for example in todo[start:start + batch_size]:
                row = await system.run(example, inject_k=inject_k)
                if row.get("llm_failures"):
                    failed = example.id  # don't record a fallback answer as a real one
                    break
                batch.append(row)
            for row in batch:
                done[row["id"]] = row
            if checkpoint is not None:
                with checkpoint.open("a") as f:
                    f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in batch)
            snapshot.save()  # keep captures even if a later batch fails
            print(f"{config_name} run {run}: {len(done)}/{len(examples)} done", file=sys.stderr, flush=True)
            if failed is not None:
                raise QuotaStop(f"{config_name}: an LLM call failed on {failed} (likely Groq's daily cap); "
                                f"rerun the same command later to resume from {len(done)}/{len(examples)}")
        rows = [done[e.id] for e in examples]
        per_run.append(_score_rows(rows))
        all_rows.extend({**r, "config": config_name, "run": run} for r in rows)
    return {
        "config": config_name,
        "description": CONFIGS[config_name].description,
        "runs": runs,
        "n_examples": len(examples),
        "scores": {k: metrics.mean_std([r[k] for r in per_run]) for k in SCORE_KEYS},
        "per_class": {
            c: {m: metrics.mean_std([r["per_class"][c][m] for r in per_run])
                for m in ("precision", "recall", "f1")}
            for c in ("True", "False", "Mixed")
        },
        "system": _system_stats(all_rows),
        "rows": all_rows,
    }


async def robustness(
    config_names: List[str], examples: List[Example], snapshot: Snapshot,
    n_claims: int, ks: List[int], seed: int, runs: int, junk_credibility: float,
    checkpoint_dir: Optional[Path] = None, batch_size: int = 10, derive_sba_from: Optional[str] = None,
) -> Dict[str, Any]:
    true_examples = [e for e in examples if e.label == "True"]
    random.Random(seed).shuffle(true_examples)
    chosen = true_examples[:n_claims]
    if len(chosen) < n_claims:
        print(f"warning: only {len(chosen)} True examples available (wanted {n_claims})", file=sys.stderr)
    curves: Dict[str, Dict[int, Dict[str, float]]] = {}
    for name in config_names:
        curves[name] = {}
        for k in ks:
            result = await evaluate(name, chosen, snapshot, runs, inject_k=k, junk_credibility=junk_credibility,
                                    checkpoint_dir=checkpoint_dir, batch_size=batch_size)
            curves[name][k] = result["scores"]["accuracy"]
            if name == derive_sba_from:
                # B3 = SBA applied to these exact verdicts: no extra LLM calls.
                curves.setdefault("B3", {})[k] = _sba_accuracy(result["rows"], runs)
    return {"n_claims": len(chosen), "seed": seed, "junk_credibility": junk_credibility,
            "accuracy_vs_k": curves}


def _sba_accuracy(rows: List[Dict[str, Any]], runs: int) -> Dict[str, float]:
    from research.eval.labels import aggregate_post_label, verdict_to_class
    from research.eval.sba import apply_sba

    per_run = []
    for run in range(runs):
        run_rows = [r for r in rows if r.get("run", 0) == run]
        gold = [r["gold"] for r in run_rows]
        pred = [aggregate_post_label([verdict_to_class(apply_sba(c, c.get("evidence", []))["verdict"])
                                      for c in r["claims"]]) for r in run_rows]
        per_run.append(metrics.accuracy(gold, pred))
    return metrics.mean_std(per_run)


def _plot(curves: Dict[str, Dict[int, Dict[str, float]]], path: Path) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed; skipping plot", file=sys.stderr)
        return
    fig, ax = plt.subplots(figsize=(5, 3.5))
    for name, by_k in curves.items():
        ks = sorted(by_k)
        ax.errorbar(ks, [by_k[k]["mean"] for k in ks], yerr=[by_k[k]["std"] for k in ks],
                    marker="o", capsize=3, label=name)
    ax.set_xlabel("injected contradicting snippets (k)")
    ax.set_ylabel("accuracy on True claims")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=200)


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--configs", nargs="+", default=["B0", "B1", "B2"], choices=sorted(CONFIGS))
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--limit", type=int, help="use only the first N examples (smoke tests)")
    parser.add_argument("--capture", action="store_true",
                        help="record missing decomposition/search results into the snapshot (live calls)")
    parser.add_argument("--robustness", action="store_true")
    parser.add_argument("--n-claims", type=int, default=50)
    parser.add_argument("--ks", type=int, nargs="+", default=[0, 1, 2, 3, 4, 5])
    parser.add_argument("--junk-credibility", type=float, default=LOW_CREDIBILITY_JUNK,
                        help="credibility given to injected snippets (0.15 rated-low, 0.5 unrated)")
    parser.add_argument("--no-relevance-calls", action="store_true",
                        help="use the app's constant 0.5 relevance without calling the LLM (see agents.py)")
    parser.add_argument("--derive-sba-from", help="robustness: also report B3 by applying SBA to this config's verdicts")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path, default=Path("research/results"))
    parser.add_argument("--name", help="results folder name; reuse it to resume an interrupted run")
    parser.add_argument("--batch-size", type=int, default=10, help="examples per saved checkpoint batch")
    args = parser.parse_args(argv)

    examples = load_jsonl(args.dataset)[: args.limit]
    snapshot = Snapshot(args.snapshot, capture=args.capture)
    out_dir = args.out / (args.name or time.strftime("%Y%m%d-%H%M%S"))
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        if args.robustness:
            result = asyncio.run(robustness(
                args.configs, examples, snapshot, args.n_claims, args.ks, args.seed, args.runs,
                args.junk_credibility, checkpoint_dir=out_dir, batch_size=args.batch_size,
                derive_sba_from=args.derive_sba_from))
            _plot(result["accuracy_vs_k"], out_dir / "robustness.png")
            (out_dir / "robustness.json").write_text(json.dumps(result, indent=1))
        else:
            results = [asyncio.run(evaluate(name, examples, snapshot, args.runs,
                                            relevance_calls=not args.no_relevance_calls,
                                            checkpoint_dir=out_dir, batch_size=args.batch_size))
                       for name in args.configs]
            with (out_dir / "predictions.jsonl").open("w") as f:
                for r in results:
                    for row in r.pop("rows"):
                        f.write(json.dumps(row, ensure_ascii=False) + "\n")
            (out_dir / "results.json").write_text(json.dumps(results, indent=1))
            for r in results:
                s = r["scores"]
                print(f"{r['config']:4} acc={s['accuracy']['mean']:.3f}±{s['accuracy']['std']:.3f} "
                      f"macroF1={s['macro_f1']['mean']:.3f} ECE={s['ece']['mean']:.3f} "
                      f"cov={s['coverage']['mean']:.3f} p50={r['system']['latency_cold_p50_s']:.1f}s")
    except QuotaStop as e:
        print(f"stopped: {e}", file=sys.stderr)
        return QUOTA_EXIT_CODE
    finally:
        snapshot.save()
    print(f"wrote {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
