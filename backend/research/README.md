# backend/research — paper experiments (not part of the app)

Code for the research paper's evaluation (Table III configs, metrics, SBA). It is isolated:
it **imports** the app's agents but never edits app code, and nothing in the app imports it.

**Remove it** with `rm -rf backend/research`; nothing else depends on it.

Rules for anything added here: keep it inside this folder; ablations subclass app agents
(`eval/agents.py`) instead of adding switches to them; no changes to `app/`, `tests/`,
`alembic/`, `pytest.ini`, `requirements.txt` or the root `.gitignore`.

## Run (from `backend/`, venv active)

```bash
pytest research/tests                    # offline tests (also check the subclasses still match the app)

# 1. record decomposition + search results once (needs GROQ_API_KEY and network)
python -m research.eval.run_eval --dataset research/data/social.jsonl \
    --snapshot research/snapshots/social.json --configs B2 --runs 1 --capture
# 2. replay the snapshot for every configuration, mean ± std over 3 runs
python -m research.eval.run_eval --dataset research/data/social.jsonl \
    --snapshot research/snapshots/social.json --configs B0 B1 B2 B3 B4 A1 A2 A3 --runs 3
# 3. outvoting robustness: accuracy vs k injected contradicting snippets
python -m research.eval.run_eval --dataset research/data/confact.jsonl \
    --snapshot research/snapshots/confact.json --robustness --configs B1 B2 B3 [--junk-credibility 0.5]

python -m research.eval.agreement a.jsonl b.jsonl   # Cohen's kappa for the social set
```

`data/` (datasets) and `snapshots/` (recorded search results; what makes runs reproducible) are
created on first use and should be tracked. `results/` is git-ignored.

## Files (`eval/`)

| File | Role |
|---|---|
| `configs.py` | B0–B4, A1–A3, plus `B2p` (the app's current MBFC-first lookup) |
| `systems.py` | Runs one config on one example: decompose → retrieve → credibility → rank → verdict → [SBA] |
| `agents.py` | `ResearchRanker` / `ResearchVerifier`: app agents with switchable dedup, recency, prompt, reputation |
| `snapshot.py` | Capture/replay of decomposition and search; LLM call/token metering |
| `credibility.py` | `flat` / `manual` / `default` / `mbfc` scores, attached at replay time |
| `prompts.py` | B0 (LLM-only) prompt; B1 prompt = app prompt minus reputation wording |
| `sba.py` | SBA formula from the paper draft (Section IV-D) |
| `robustness.py` | Deterministic injection of k contradicting snippets on 5 distinct junk domains |
| `labels.py`, `metrics.py` | 7→3 label map; accuracy, macro-F1, per-class P/R, ECE, coverage, κ, percentiles |
| `datasets.py`, `agreement.py` | JSONL schema; κ CLI |
| `run_eval.py` | CLI; writes `research/results/<timestamp>/` |

## Decisions and open items

- The paper draft is outdated (predates Jev, the 2 + 1 query split and MBFC-first lookup); the
  code is the source of truth. B2/B3 use the hand-curated table as the draft describes, B4 MBFC,
  `B2p` the app's actual lookup. The app's MBFC formula is not the draft's C = 0.6F + 0.2(1−B) + 0.2R.
- SBA is research-only and runs after the verdict LLM. Open cases are decided in `sba.py`.
  Known weaknesses (vote across many unrated domains, no minimum evidence mass, drops 4 of the 7
  verdicts) are what the experiments should test.
- Robustness junk gets `--junk-credibility` (0.15 = rated low, 0.5 = unrated); B1 always sees 0.5.
- Not-verifiable is an abstention: accuracy/F1 over answered items, coverage beside them.
  Post-level label rule (`labels.aggregate_post_label`) is an assumption.
- Not covered yet: dataset converters (confirm CONFACT/AVeriTeC/FEVER format and licence first),
  cache-hit latency (the post Verify path has no cache), planner tokens (it calls Groq over httpx),
  the claim classifier (skipped), the user study / SUS.
