// Log entries that arrived with the latest world update, so the UI animates only what is new.
// The first world seen (page load or reconnect after a crash) is a baseline: nothing replays.
import { useEffect, useRef, useState } from "react";
import type { LogEntry, World } from "../../../shared/types";

export type Fresh = { key: string; entry: LogEntry };
export type FreshBatch = { id: number; items: Fresh[] };

export function useFreshEntries(world: World): FreshBatch {
  const seen = useRef<{ runId: string; len: number } | null>(null);
  const [batch, setBatch] = useState<FreshBatch>({ id: 0, items: [] });

  useEffect(() => {
    const prev = seen.current;
    const len = world.log.length;
    seen.current = { runId: world.runId, len };
    // Baseline, new run, or a reset that shrank the log.
    if (!prev || prev.runId !== world.runId || len < prev.len) return;
    if (len === prev.len) return;
    const items = world.log.slice(prev.len).map((entry, i) => ({ key: `${world.runId}:${prev.len + i}`, entry }));
    setBatch((b) => ({ id: b.id + 1, items }));
  }, [world]);

  return batch;
}
