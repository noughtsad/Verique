# Verique — Agent Notes

## Knowledge graph (graphify)

This repo has a prebuilt knowledge graph in `graphify-out/` (graph of code, not docs).
For any "how does X work / what connects to Y / trace the flow through Z" question,
check the graph first instead of re-reading files from scratch:

- `graphify-out/GRAPH_REPORT.md` — human-readable digest: god nodes, surprising
  connections, communities, suggested questions. Read this first.
- `graphify-out/graph.json` — raw graph data (nodes, edges, communities).
- `graphify-out/graph.html` — interactive visual browser (open in a browser).

Core abstractions (god nodes, highest fan-out — most likely to be touched by any
cross-cutting change):

| Node | Edges | File |
|---|---|---|
| `SocialService` | 65 | `backend/app/services/social_service.py` |
| `User` | 36 | `backend/app/models/user.py` |
| `cn()` | 34 | `frontend/src/lib/utils.ts` |
| `FollowService` | 32 | `backend/app/services/follow_service.py` |
| `VerificationPipeline` | 27 | `backend/app/agents/pipeline.py` |
| `apiFetch()` | 27 | `frontend/src/lib/api.ts` |

### Commands

```
/graphify .                          # rebuild the graph from scratch
/graphify . --update                 # incremental rebuild after code changes (no LLM cost for code)
/graphify . --watch                  # background auto-sync as files change
/graphify . --wiki                   # generate agent-crawlable wiki (index.md + per-community articles)

/graphify query "<question>"         # ask a question, answered from the graph (cheap, no re-reading files)
/graphify explain "SocialService"     # plain-language explanation of a node + its neighbors
/graphify path "FollowService" "VerificationPipeline"   # shortest path between two symbols

graphify hook install                # installs a post-commit git hook that reruns --update automatically
```

If `graphify` isn't on PATH, use `python -m graphify <command>` instead (Windows PATH
issue with the `graphifyy` pip package — see its README).

The graph was last built at commit `c19316c8`. Run `git rev-parse HEAD` and compare;
if code files have since changed, run `/graphify . --update` before trusting the graph
for a code-structure question.

## Stack

- `backend/` — Python 3.10+, FastAPI, LangGraph multi-agent verification pipeline, SQLAlchemy + Alembic, Supabase Postgres.
- `frontend/` — Next.js 16 (Turbopack, React 19), TypeScript, Tailwind CSS 4, TanStack Query.
- `extension/` — Chrome Manifest V3 browser extension (planned, not yet built out).

See `README.md` for setup/quick start.

## Jev decision model (claim classification)

Setup and day-to-day usage are in `README.md` ("Jev Decision Model"); this section keeps the
design reasoning and evaluation findings for agents changing the code.

Jev (TypeSafe AI) is a *decision* model: it takes a text state plus typed questions and
returns probabilities (yes/no "noul", choice, score), never prose. Verique uses it only for
the **claim classifier** (`backend/app/agents/claim_classifier.py`): "is this claim an
objectively verifiable fact?" Everything that writes text (decomposition, query planning,
explanations) or needs web knowledge stays on Groq.

- Client: `backend/app/core/jev_client.py` (`JevClient.decide`, raises `JevError` on any
  failure; callers must fall back to Groq). Settings: `JEV_*` in `app/core/config.py`,
  documented in `backend/.env.example`.
- Pipeline context: the pipeline's classification step runs the Groq classifier to drop
  opinions/reflections before verification (`ENABLE_CLAIM_CLASSIFIER`). Jev plugs into
  that same `filter_claims`.
- Modes (`JEV_ENABLED=true` required):
  - **shadow** (`JEV_SHADOW_MODE=true`, default): Groq decides; Jev's verdicts are logged
    to `backend/logs/jev_shadow.jsonl` (gitignored) for comparison.
  - **live** (`JEV_SHADOW_MODE=false`): Jev decides claims with P >= `JEV_CONFIDENCE` or
    <= 1 - `JEV_CONFIDENCE` (default 0.8); Groq decides only the unsure ones, or all of
    them if Jev errors / is rate-limited.
- Provider: OpenCode Zen free tier (`AI_GATEWAY_BASE_URL=https://opencode.ai/zen`,
  `JEV_MODEL=jev-1.13-free`), which needed **no API key** when tested (2026-10-12). It is a
  limited-time offer with no published end date, unknown rate limits, and free-tier prompts
  may be logged/trained on, so do not send private text. Vercel AI Gateway
  (`https://ai-gateway.vercel.sh/typesafe`, `typesafe-ai/jev`) needs a card on file and paid
  credits for Jev. `AI_GATEWAY_API_KEY` is Vercel's key and is deliberately never sent to
  other hosts.

### Findings that shaped the design (re-verify before changing)

- Question wording matters: a long rubric-style question gave near-inverted answers on
  laya-free (1/6 correct); the short one in `JEV_VERIFIABLE_QUESTION` scored 5/6. Put each
  claim's text *inside its own question*, not in the shared state (numbered-list state: 2/6).
- One request carries all claims of an article (batches of 25). Free tiers allow only
  ~5 requests/minute (Laya enforced this with 429s), so never call per claim.
- On 61 test claims vs the Groq classifier: `jev-1.13-free` agreed 95% (58/61, 98% when
  |P-0.5| >= 0.3, never rejected a claim Groq accepted); `convaiinnovations/laya-free` only
  66% (it called many plain facts unverifiable and opinions verifiable). Sample is small and
  Groq is not ground truth; compare on real traffic in shadow mode before trusting live mode.
- Decision models are weak at maths/dates and read instructions literally.

### Tooling

- `backend/scripts/jev_shadow_report.py [log]` - agreement rate, confusion table, agreement
  by confidence, every disagreement.
- `backend/scripts/rescore_shadow_log.py SRC DST` - re-score an existing log's claims with
  another model (set `AI_GATEWAY_BASE_URL` / `JEV_MODEL` env vars) without re-verifying.
- `backend/scripts/seed_shadow_posts.py` - creates ~35 varied test posts (facts, opinions,
  mixed, predictions, fluff...) under user `jev_test` in the **shared** DB and verifies them
  (Tavily disabled for the run to save credits). `--verify-only` verifies leftovers,
  `--cleanup` deletes the user, its posts and articles. Verifying also nudged domain
  reputation stats, which cleanup cannot undo.
- Tests: `backend/tests/test_jev_client.py`, `backend/tests/test_claim_classifier_shadow.py`.
