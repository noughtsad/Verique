#!/usr/bin/env bash
# Remaining experiments from the plan, after run_core.sh. Run from backend/:
#
#     bash research/run_remaining.sh
#
# Order (most valuable first): B2d (judged as of claim date), robustness test (B1, B2; B3 is
# derived from B2's verdicts), B4 / A2 / A3, then 2 extra runs of B2 for mean +/- std.
# Every step is checkpointed every 10 claims; on a Groq quota stop (exit 3) it waits and resumes.
set -u
cd "$(dirname "$0")/.."

DATASET=research/data/averitec_simple40.jsonl
SNAPSHOT=research/snapshots/simple40.json
LOG=research/results/remaining.log
WAIT_SECONDS=${WAIT_SECONDS:-1200}
mkdir -p research/results

run_step() {  # run_step <name> <run_eval args...>
  local name=$1; shift
  while true; do
    echo "[$(date '+%F %T')] $name: starting/resuming" | tee -a "$LOG"
    PYTHONPATH=. venv/bin/python -m research.eval.run_eval --dataset "$DATASET" --snapshot "$SNAPSHOT" \
      --capture --batch-size 10 --name "$name" --out research/results "$@" >>"$LOG" 2>&1
    local code=$?
    if [ "$code" -eq 0 ]; then
      echo "[$(date '+%F %T')] $name: done" | tee -a "$LOG"; return 0
    elif [ "$code" -eq 3 ]; then
      echo "[$(date '+%F %T')] $name: paused by Groq quota, retrying in ${WAIT_SECONDS}s" | tee -a "$LOG"
      sleep "$WAIT_SECONDS"
    else
      echo "[$(date '+%F %T')] $name: failed with exit $code, stopping (see $LOG)" | tee -a "$LOG"; exit "$code"
    fi
  done
}

run_step rem-B2d --configs B2d --runs 1
run_step rem-robust --robustness --configs B1 B2 --derive-sba-from B2 --ks 1 2 3 4 5 \
  --n-claims 19 --junk-credibility 0.15 --runs 1
for config in B4 A2 A3; do
  run_step "rem-$config" --configs "$config" --runs 1
done

# Repeat runs: reuse the core B2 run as run 0, add runs 1 and 2.
mkdir -p research/results/rem-B2x3
[ -f research/results/rem-B2x3/B2_k0_run0.partial.jsonl ] || \
  cp research/results/core40-B2/B2_k0_run0.partial.jsonl research/results/rem-B2x3/
run_step rem-B2x3 --configs B2 --runs 3

echo "[$(date '+%F %T')] all remaining experiments finished" | tee -a "$LOG"
