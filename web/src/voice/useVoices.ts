// Speaks agent and Manor lines aloud, one at a time, never the same sentence twice.
// Spoken: agents on #manor or asking the Operator, and Manor announcements on #manor.
// Silent: JSON actions to the Manor, Manor action results, private whispers.
import { useEffect, useRef, useState } from "react";
import { CHANNEL, MANOR, OPERATOR, agentIdFromRelayName } from "../../../shared/map";
import type { AgentId, LogEntry } from "../../../shared/types";
import type { FreshBatch } from "../state/useFreshEntries";

type Line = { speaker: string; text: string; queuedAt: number };

/** Lines that waited longer than this are dropped so the voices never lag the map. */
const STALE_MS = 10_000;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function shouldSpeak(e: LogEntry): e is Extract<LogEntry, { kind: "message" }> {
  if (e.kind !== "message" || e.private) return false;
  if (agentIdFromRelayName(e.from)) return e.to === CHANNEL || e.to === OPERATOR;
  return e.from === MANOR && e.to === CHANNEL;
}

export function useVoices(batch: FreshBatch, enabled: boolean) {
  const queue = useRef<Line[]>([]);
  const spoken = useRef(new Set<string>());
  const playing = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      queue.current = [];
      audio.current?.pause();
      return;
    }
    for (const { entry } of batch.items) {
      if (!shouldSpeak(entry)) continue;
      const id = `${entry.from}:${normalize(entry.text)}`;
      if (spoken.current.has(id)) continue;
      spoken.current.add(id);
      queue.current.push({ speaker: entry.from, text: entry.text, queuedAt: Date.now() });
    }
    void drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id, enabled]);

  async function drain() {
    if (playing.current) return;
    playing.current = true;
    try {
      for (let line = queue.current.shift(); line; line = queue.current.shift()) {
        if (Date.now() - line.queuedAt > STALE_MS) continue;
        await say(line);
      }
    } finally {
      playing.current = false;
      setSpeaking(null);
    }
  }

  async function say(line: Line) {
    try {
      const res = await fetch("/voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speaker: line.speaker, text: line.text }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const el = new Audio(url);
      audio.current = el;
      setSpeaking(line.speaker);
      await new Promise<void>((resolve) => {
        el.onended = el.onerror = el.onpause = () => resolve();
        el.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("voice line skipped", err);
    }
  }

  // Forget spoken lines when the run resets.
  useEffect(() => {
    if (batch.items.some(({ entry }) => entry.kind === "event" && entry.event === "start")) spoken.current.clear();
  }, [batch]);

  const speakingAgent: AgentId | undefined = speaking ? agentIdFromRelayName(speaking) : undefined;
  return { speaking, speakingAgent };
}
