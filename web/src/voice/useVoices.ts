// Speaks agent and Manor lines aloud, one at a time, never the same sentence twice.
// Spoken: agents on #manor or asking the Operator, and Manor announcements on #manor.
// Silent: JSON actions to the Manor, Manor action results, private whispers.
import { useEffect, useRef, useState } from "react";
import { CHANNEL, MANOR, OPERATOR, agentIdFromRelayName } from "../../../shared/map";
import type { AgentId, LogEntry } from "../../../shared/types";
import { effectiveTo } from "../lib/replies";
import type { FreshBatch } from "../state/useFreshEntries";

/** `priority` lines (answers to the Operator) are never dropped as stale. */
type Line = { speaker: string; text: string; queuedAt: number; priority: boolean };

/** Lines that waited longer than this are dropped so the voices never lag the map. */
const STALE_MS = 10_000;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function shouldSpeak(e: LogEntry): e is Extract<LogEntry, { kind: "message" }> {
  if (e.kind !== "message" || e.private) return false;
  if (agentIdFromRelayName(e.from)) {
    const to = effectiveTo(e);
    return to === CHANNEL || to === OPERATOR;
  }
  return e.from === MANOR && e.to === CHANNEL;
}

/**
 * Only one open tab speaks, or two windows on the same machine play every line twice (an echo).
 * The speaking tab is the one the operator last clicked or typed in.
 */
function useVoiceLeader() {
  const me = useRef(Math.random().toString(36).slice(2));
  const [leader, setLeader] = useState(() => document.hasFocus());
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return setLeader(true);
    const ch = new BroadcastChannel("hollow-manor-voices");
    const claim = () => {
      setLeader(true);
      ch.postMessage(me.current);
    };
    ch.onmessage = (e) => e.data !== me.current && setLeader(false);
    if (document.hasFocus()) claim();
    for (const ev of ["pointerdown", "keydown", "focus"]) window.addEventListener(ev, claim);
    return () => {
      for (const ev of ["pointerdown", "keydown", "focus"]) window.removeEventListener(ev, claim);
      ch.close();
    };
  }, []);
  return leader;
}

/** `paused` while the operator holds push-to-talk: the current line pauses, the queue waits, nothing is lost. */
export function useVoices(batch: FreshBatch, enabled: boolean, paused = false) {
  const queue = useRef<Line[]>([]);
  const spoken = useRef(new Set<string>());
  const playing = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  /** Ends the line that is playing (used when voices are switched off). */
  const finish = useRef<(() => void) | null>(null);
  const current = useRef<Line | null>(null);
  const pausedRef = useRef(paused);
  const [speaking, setSpeaking] = useState<string | null>(null);
  /** The browser refused to autoplay; cleared by the next click or key press. */
  const [blocked, setBlocked] = useState(false);
  const leader = useVoiceLeader();

  useEffect(() => {
    if (!blocked) return;
    const unblock = () => setBlocked(false);
    window.addEventListener("pointerdown", unblock);
    window.addEventListener("keydown", unblock);
    return () => {
      window.removeEventListener("pointerdown", unblock);
      window.removeEventListener("keydown", unblock);
    };
  }, [blocked]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      audio.current?.pause();
    } else {
      // Lines that waited while the operator talked start their stale clock now.
      const now = Date.now();
      for (const l of queue.current) l.queuedAt = now;
      void audio.current?.play().catch(() => {});
    }
  }, [paused]);

  useEffect(() => {
    if (!enabled || !leader) {
      queue.current = [];
      audio.current?.pause();
      finish.current?.();
      return;
    }
    for (const { entry } of batch.items) {
      if (!shouldSpeak(entry)) continue;
      const id = `${entry.from}:${normalize(entry.text)}`;
      if (spoken.current.has(id)) continue;
      spoken.current.add(id);
      const line = { speaker: entry.from, text: entry.text, queuedAt: Date.now(), priority: effectiveTo(entry) === OPERATOR };
      if (line.priority) {
        // Answers to the human come first: ahead of queued chatter, after earlier answers.
        const at = queue.current.findIndex((l) => !l.priority);
        queue.current.splice(at === -1 ? queue.current.length : at, 0, line);
        // Cut off chatter that is playing so the answer is heard right away.
        if (current.current && !current.current.priority) {
          audio.current?.pause();
          finish.current?.();
        }
      } else {
        queue.current.push(line);
      }
    }
    void drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id, enabled, leader]);

  async function drain() {
    if (playing.current) return;
    playing.current = true;
    try {
      for (;;) {
        // Hold the queue while the operator is talking.
        while (pausedRef.current) await new Promise((r) => setTimeout(r, 120));
        const line = queue.current.shift();
        if (!line) break;
        if (!line.priority && Date.now() - line.queuedAt > STALE_MS) continue;
        current.current = line;
        await say(line);
        current.current = null;
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
        // A pause (operator talking) does not end the line; it resumes where it stopped.
        finish.current = resolve;
        el.onended = el.onerror = () => resolve();
        el.play().catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") setBlocked(true);
          resolve();
        });
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
  return { speaking, speakingAgent, blocked: blocked && leader };
}
