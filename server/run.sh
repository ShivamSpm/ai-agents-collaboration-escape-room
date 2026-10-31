#!/bin/sh
# Runs the orchestrator and brings it back after a reset (which exits the process on purpose).
# Ctrl+C twice to stop.
cd "$(dirname "$0")" || exit 1
while true; do
  bun index.ts
  echo "[run.sh] orchestrator exited; restarting in 1s (Ctrl+C again to stop)"
  sleep 1
done
