// Title, run timer, status pill and the two live badges (Agent Relay, Durable Actor).
import { useEffect, useState } from "react";
import type { World } from "../../../shared/types";
import type { Connection } from "../state/useWorld";

function useClock(running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const STATUS_STYLE: Record<World["status"], string> = {
  lobby: "border-muted/40 text-muted",
  running: "border-teal/50 text-teal",
  escaped: "border-candle/60 text-candle",
  failed: "border-blood/60 text-blood",
};

const DOT: Record<Connection, string> = {
  fake: "bg-magenta",
  connecting: "bg-candle",
  live: "bg-teal",
  lost: "bg-blood",
};

export function TopBar({ world, connection }: { world: World; connection: Connection }) {
  const now = useClock(world.status === "running");
  const elapsed = world.startedAt ? (world.endedAt ?? now) - world.startedAt : 0;
  const saved = connection === "live" ? "saved" : connection === "lost" ? "offline" : connection === "fake" ? "fake" : "connecting";

  return (
    <header className="flex h-[72px] items-center justify-between border-b border-line px-8">
      <div className="flex items-center gap-4">
        <div className="relative grid size-11 place-items-center rounded-xl bg-gradient-to-br from-teal/80 to-magenta/80 shadow-[0_0_20px_rgb(0_245_212/0.35)]">
          <svg viewBox="0 0 24 24" className="size-6" fill="#07090e">
            <path d="M12 2a8 8 0 0 0-8 8v11l2.5-2 2.5 2 3-2 3 2 2.5-2 2.5 2V10a8 8 0 0 0-8-8Zm-3 7.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
          </svg>
          <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-ink bg-teal" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-spooky text-[34px] leading-none tracking-wide text-bone">Hollow Manor</h1>
            <span className="rounded-md border border-teal/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-teal">Haunted Hacks</span>
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Three agents · one haunted house · nobody escapes alone</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="font-mono text-[28px] tabular-nums text-bone">{formatDuration(elapsed)}</span>
        <span className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-widest ${STATUS_STYLE[world.status]}`}>{world.status}</span>
      </div>

      <div className="flex items-center gap-3">
        {connection === "fake" && (
          <span className="rounded-lg border border-magenta/60 bg-magenta/10 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-magenta">Fake data</span>
        )}
        <Badge dot="bg-teal" pulse={connection === "live"} label="Agent Relay" value="3 agents" />
        <Badge dot={DOT[connection]} pulse={connection === "live"} label="Durable Actor" value={`rev ${world.rev} · ${saved}`} />
      </div>
    </header>
  );
}

function Badge({ dot, pulse, label, value }: { dot: string; pulse: boolean; label: string; value: string }) {
  return (
    <div className="glass flex items-center gap-2.5 !rounded-xl px-3 py-1.5">
      <span className="relative flex size-2.5">
        {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />}
        <span className={`relative inline-flex size-2.5 rounded-full ${dot}`} />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted">{label}</span>
      <span className="font-mono text-xs tabular-nums text-bone">{value}</span>
    </div>
  );
}
