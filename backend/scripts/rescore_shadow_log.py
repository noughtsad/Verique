"""
Re-score the claims of an existing shadow log with another decision model.

Usage (from backend/):
  AI_GATEWAY_BASE_URL=https://opencode.ai/zen JEV_MODEL=jev-1.13-free \
  python scripts/rescore_shadow_log.py logs/jev_shadow.jsonl logs/jev_shadow_jev.jsonl

Keeps Groq's recorded verdicts, replaces the Jev probabilities, so the two models
are compared on exactly the same claims without re-running verification.
"""
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agents.claim_classifier import JEV_BATCH_SIZE, JEV_VERIFIABLE_QUESTION  # noqa: E402
from app.core.jev_client import JevClient, JevError, noul_question  # noqa: E402


async def main(src: str, dst: str) -> None:
    rows = [json.loads(l) for l in Path(src).read_text(encoding="utf-8").splitlines() if l.strip()]
    client = JevClient()
    print(f"{len(rows)} claims -> {client.base_url} model={client.model}")
    out, failed = [], 0
    for start in range(0, len(rows), JEV_BATCH_SIZE):
        batch = rows[start:start + JEV_BATCH_SIZE]
        questions = {
            f"q{i}": noul_question(f'Text: "{r["text"]}"\n{JEV_VERIFIABLE_QUESTION}')
            for i, r in enumerate(batch)
        }
        try:
            result = await client.decide("Claims to classify, one per question.", questions)
        except JevError as exc:
            print(f"batch at {start} failed: {exc}")
            failed += len(batch)
            continue
        for i, r in enumerate(batch):
            p = result.noul(f"q{i}")
            if p is None:
                failed += 1
                continue
            out.append({
                **r,
                "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "model": client.model,
                "jev_p_verifiable": round(p, 4),
                "agree": r["groq_verifiable"] == (p >= 0.5),
            })
    Path(dst).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in out), encoding="utf-8")
    print(f"wrote {len(out)} rows to {dst} ({failed} failed)")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))
