"""
Summarise the Jev shadow log (logs/jev_shadow.jsonl).

Usage (from backend/):  python scripts/jev_shadow_report.py [path] [--model NAME]

Shows overall agreement, a Groq-vs-Jev confusion table, how agreement changes with
Jev's confidence, and every disagreement so you can judge who was right.
"""
import argparse
import json
import sys
from pathlib import Path


def load(path: Path, model: str | None):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if model and row.get("model") != model:
            continue
        rows.append(row)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="logs/jev_shadow.jsonl")
    parser.add_argument("--model", default=None, help="only rows from this model")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        print(f"No log at {path}. Verify some posts with JEV_ENABLED=true first.")
        return 1
    rows = load(path, args.model)
    if not rows:
        print("Log is empty.")
        return 1

    total = len(rows)
    agreed = sum(r["agree"] for r in rows)
    print(f"Claims compared: {total}   agreement: {agreed}/{total} = {agreed / total:.1%}\n")

    both_yes = sum(r["groq_verifiable"] and r["jev_p_verifiable"] >= 0.5 for r in rows)
    both_no = sum(not r["groq_verifiable"] and r["jev_p_verifiable"] < 0.5 for r in rows)
    groq_only = sum(r["groq_verifiable"] and r["jev_p_verifiable"] < 0.5 for r in rows)
    jev_only = sum(not r["groq_verifiable"] and r["jev_p_verifiable"] >= 0.5 for r in rows)
    print("                   Jev verifiable   Jev not verifiable")
    print(f"Groq verifiable    {both_yes:>14}   {groq_only:>18}")
    print(f"Groq not verif.    {jev_only:>14}   {both_no:>18}\n")

    print("Agreement by Jev confidence (distance of P from 0.5):")
    bands = [(0.0, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.51)]
    for lo, hi in bands:
        sel = [r for r in rows if lo <= abs(r["jev_p_verifiable"] - 0.5) < hi]
        if sel:
            ok = sum(r["agree"] for r in sel)
            print(f"  |P-0.5| in [{lo:.1f}, {hi:.1f}): {ok}/{len(sel)} agree ({ok / len(sel):.0%})")

    disagreements = [r for r in rows if not r["agree"]]
    print(f"\nDisagreements ({len(disagreements)}):")
    for r in sorted(disagreements, key=lambda r: -abs(r["jev_p_verifiable"] - 0.5)):
        groq = "verifiable" if r["groq_verifiable"] else "NOT verifiable"
        print(f"  Groq: {groq:<15} Jev P={r['jev_p_verifiable']:.2f}  | {r['text'][:110]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
