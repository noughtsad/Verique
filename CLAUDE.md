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
