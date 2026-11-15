"""
Live check of how the app's verdict agent judges numeric claims, on fixed evidence.

Each case runs the real VerificationAgent (Groq, gpt-oss-120b) several times on identical
input, so it measures both correctness and consistency. Needs GROQ_API_KEY and quota
(about 3k tokens per run on the 120B model; the Iowa case also ranks evidence once on 20B).

    cd backend && PYTHONPATH=. venv/bin/python -m research.checks.numeric_claims [runs]
"""
import asyncio
import hashlib
import json
import logging
import sys
from pathlib import Path

logging.disable(logging.INFO)

from app.agents.evidence_ranker import EvidenceRankerAgent  # noqa: E402
from app.agents.verification import VerificationAgent  # noqa: E402
from research.eval import credibility  # noqa: E402

SNAPSHOT = Path(__file__).resolve().parents[1] / "snapshots" / "averitec.json"
IOWA = "Forty percent of Iowa’s energy resources are from renewables."


def _item(url: str, snippet: str, published_at=None) -> dict:
    domain = url.split("/")[2]
    return {"url": url, "domain": domain, "title": "", "snippet": snippet, "published_at": published_at,
            "query_stance": "support", "domain_reputation": credibility.score("default", domain)}


async def _iowa_evidence() -> list:
    """Real search results for the Iowa claim, ranked once by the app's ranker."""
    snap = json.loads(SNAPSHOT.read_text())["evidence"]
    items = [dict(x) for x in snap[hashlib.sha256(IOWA.encode()).hexdigest()[:16]]["items"]]
    for x in items:
        x["domain_reputation"] = credibility.score("default", x.get("domain", ""))
    claim = {"id": "c0", "text": IOWA, "time_sensitivity": "low"}
    return (await EvidenceRankerAgent().rank_evidence([claim], {"c0": items}))["c0"]


NIGERIA = [_item("https://www.worldbank.org/nigeria",
                 "Nigeria's population was estimated at about 227 million in 2024, the largest in Africa.", "2024-07-01"),
           _item("https://www.un.org/nigeria-pop",
                 "UN figures put Nigeria's population above 220 million.", "2024-05-01")]
IOWA_2017 = _item("https://www.iowapbs.org/iowa-electricity",
                  "In 2017, 37.14% of Iowa's electricity came from wind power, the highest share of any state.",
                  "2018-03-01")
IOWA_NOW = _item("https://www.eia.gov/state/iowa",
                 "Wind turbines generated about 59% of Iowa's in-state electricity in 2024.", "2025-03-01")

# name -> (claim, evidence factory, verdicts that pass, verdicts that must never appear)
CASES = {
    # The claim understates a figure that is now ~60% (of electricity, not energy): true with a
    # caveat, or outdated; never false, and the same answer every run.
    "iowa_current_only": (IOWA, "iowa", {"supported", "strongly_supported", "outdated", "mixed"}, {"contradicted"}),
    "iowa_with_2017": (IOWA, "iowa+2017", {"supported", "strongly_supported", "outdated", "mixed"}, {"contradicted"}),
    "nigeria_true": ("Nigeria's current population exceeds 200 million.", NIGERIA, {"supported", "strongly_supported"}, set()),
    "nigeria_false": ("Nigeria's population is 50 million.", NIGERIA, {"contradicted"}, {"supported", "strongly_supported"}),
    "iowa_overstated": ("90% of Iowa's electricity comes from wind.", [IOWA_NOW], {"contradicted", "weak"},
                        {"supported", "strongly_supported"}),
}


def _capture_raw(verifier) -> list:
    """Record each raw model reply, so a parse failure can be inspected."""
    replies = []
    create = verifier.client.chat.completions.create

    async def recording_create(**kwargs):
        response = await create(**kwargs)
        replies.append(response.choices[0].message.content)
        return response

    verifier.client.chat.completions.create = recording_create
    return replies


async def main(runs: int) -> int:
    iowa = await _iowa_evidence()
    evidence = {"iowa": iowa, "iowa+2017": iowa[:4] + [IOWA_2017]}
    verifier = VerificationAgent()
    raw = _capture_raw(verifier)
    failures = 0
    for name, (claim_text, ev, ok, never) in CASES.items():
        items = evidence[ev] if isinstance(ev, str) else ev
        claim = {"id": "c0", "text": claim_text, "time_sensitivity": "low"}
        verdicts = []
        for _ in range(runs):
            try:
                v = await verifier._verify_single_claim(claim, items)
                verdicts.append((v["verdict"], v["confidence"], v["reasoning"]))
            except Exception as e:  # noqa: BLE001
                verdicts.append(("ERROR", 0.0, str(e)[:120]))
                print(f"     raw reply that failed to parse: {raw[-1]!r}")
            await asyncio.sleep(30)  # stay under 8k tokens/minute
        labels = [v for v, _, _ in verdicts]
        consistent = len(set(labels)) == 1
        passed = consistent and all(v in ok for v in labels) and not any(v in never for v in labels)
        failures += not passed
        print(f"{'PASS' if passed else 'FAIL'} {name}{'' if consistent else ' (inconsistent)'}: " + ", ".join(f"{v} {c:.2f}" for v, c, _ in verdicts))
        print(f"     {verdicts[0][2][:200]}")
    print(f"\n{len(CASES) - failures}/{len(CASES)} cases passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    sys.exit(asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 3)))
