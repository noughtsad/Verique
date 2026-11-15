#!/usr/bin/env bash
# Core experiments (paper Table III: B0, B1, B2, B3 via SBA on B2, plus B2p = the app as it is
# today) on the 40-claim simple set. Run from backend/:
#
#     bash research/run_core.sh
#
# Each config is checkpointed every 10 claims. When Groq's daily cap stops a run (exit 3), the
# script waits and resumes the same config from its last checkpoint, so it can run across days.
set -u
cd "$(dirname "$0")/.."

DATASET=research/data/averitec_simple40.jsonl
SNAPSHOT=research/snapshots/simple40.json
LOG=research/results/core40.log
WAIT_SECONDS=${WAIT_SECONDS:-1200}
mkdir -p research/results

for config in B2 B1 B0 B2p; do
  while true; do
    echo "[$(date '+%F %T')] $config: starting/resuming" | tee -a "$LOG"
    PYTHONPATH=. venv/bin/python -m research.eval.run_eval \
      --dataset "$DATASET" --snapshot "$SNAPSHOT" --configs "$config" --runs 1 \
      --capture --batch-size 10 --name "core40-$config" --out research/results >>"$LOG" 2>&1
    code=$?
    if [ "$code" -eq 0 ]; then
      echo "[$(date '+%F %T')] $config: done" | tee -a "$LOG"
      break
    elif [ "$code" -eq 3 ]; then
      echo "[$(date '+%F %T')] $config: paused by Groq quota, retrying in ${WAIT_SECONDS}s" | tee -a "$LOG"
      sleep "$WAIT_SECONDS"
    else
      echo "[$(date '+%F %T')] $config: failed with exit $code, stopping (see $LOG)" | tee -a "$LOG"
      exit "$code"
    fi
  done
done

echo "[$(date '+%F %T')] B3: applying SBA to B2's verdicts" | tee -a "$LOG"
PYTHONPATH=. venv/bin/python -m research.eval.rescore_sba research/results/core40-B2/predictions.jsonl \
  > research/results/core40-B3_sba_rescore.json 2>>"$LOG"
echo "[$(date '+%F %T')] all core experiments finished" | tee -a "$LOG"
