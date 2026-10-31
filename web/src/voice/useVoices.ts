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

/** Only one open tab speaks, or two windows on the same machine play every line twice (an echo). */
function useVoiceLeader() {
  const [leader, setLeader] = useState(false);
  useEffect(() => {
    if (!navigator.locks) return setLeader(true);
    const ac = new AbortController();
    navigator.locks
      .request("hollow-manor-voices", { signal: ac.signal }, () => {
        setLeader(true);
        return new Promise<void>((resolve) => ac.signal.addEventListener("abort", () => resolve()));
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  return leader;
}

export function useVoices(batch: FreshBatch, enabled: boolean) {
  const queue = useRef<Line[]>([]);
  const spoken = useRef(new Set<string>());
  const playing = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const leader = useVoiceLeader();

  useEffect(() => {
    if (!enabled || !leader) {
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
  }, [batch.id, enabled, leader]);

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
      // Streamed: playback starts on the first audio bytes instead of after the whole clip.
      const el = new Audio(`/voice/tts?${new URLSearchParams({ speaker: line.speaker, text: line.text })}`);
      audio.current = el;
      setSpeaking(line.speaker);
      await new Promise<void>((resolve) => {
        el.onended = el.onerror = el.onpause = () => resolve();
        el.play().catch(() => resolve());
      });
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
