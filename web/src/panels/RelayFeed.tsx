// The Relay feed, newest at the bottom. Story mode (default) shows the agents' coordination and short action
// sentences; "Details" shows the full technical log (JSON actions and the Manor's complete replies).
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AGENTS, MANOR, OPERATOR } from "../../../shared/map";
import type { LogEntry, World } from "../../../shared/types";
import { colorFor } from "../map/Messages";
import { effectiveTo, isJsonAction, isJsonBounce } from "../lib/replies";
import { actionSentence, showResult } from "../lib/story";

type Row = { entry: LogEntry; key: string };
type Message = Extract<LogEntry, { kind: "message" }>;
type ActionEntry = Extract<LogEntry, { kind: "action" }>;

const visibleEvent = (e: LogEntry) => e.kind === "event" && e.event !== "resumed";

/** Story mode: real conversation, operator moments and game actions; no JSON, no Manor replies to actions. */
function storyRow(e: LogEntry): boolean {
  if (e.kind === "event") return visibleEvent(e);
  if (e.kind === "action") return !(e.ok && e.action.action === "look");
  if (isJsonBounce(e)) return false;
  if (e.to === MANOR && isJsonAction(e.text)) return false; // the action row covers it
  if (e.from === MANOR) return false; // action replies (on the action row) and announcements (shown as events)
  return true;
}

/** Details mode: the previous full log. Actions appear as their mirrored JSON messages. */
function detailRow(e: LogEntry): boolean {
  return e.kind !== "action" && !(e.kind === "event" && e.event === "resumed") && !(e.kind === "message" && isJsonBounce(e));
}

function Route({ m }: { m: Message }) {
  const to = effectiveTo(m);
  return (
    <div className="flex items-center gap-1.5 font-mono text-[14px] font-semibold">
      {m.private && <span title="private">🔒</span>}
      <span style={{ color: colorFor(m.from) }}>{m.from}</span>
      <span className="text-muted">→</span>
      <span style={{ color: to.startsWith("#") ? "#7d8796" : colorFor(to) }}>{to}</span>
    </div>
  );
}

function ChatRow({ m, latest }: { m: Message; latest: boolean }) {
  return (
    <div
      className={`rounded-lg border-l-[3px] px-3 py-2 transition-colors ${latest ? "bg-white/[0.06]" : ""}`}
      style={{ borderColor: latest ? colorFor(m.from) : "transparent" }}
    >
      <Route m={m} />
      <div className={`mt-0.5 text-[18px] leading-snug ${m.from === OPERATOR ? "text-white" : "text-bone"}`}>{m.text}</div>
    </div>
  );
}

function ActionRow({ e }: { e: ActionEntry }) {
  const [open, setOpen] = useState(false);
  const color = AGENTS[e.agent].color;
  const clue = showResult(e);
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} className="block w-full cursor-pointer text-left">
      <div className={`flex items-baseline gap-2.5 px-3 text-[16px] ${e.ok ? "text-bone/80" : "text-blood"}`}>
        <span className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: e.ok ? color : "#ef4444" }} />
        <span className="min-w-0 flex-1">{actionSentence(e)}</span>
        {!clue && <span className="font-mono text-[11px] text-muted/70">{open ? "▴" : "▾"}</span>}
      </div>
      {(clue || open) && (
        <div className={`ml-[30px] mr-3 mt-1 rounded-md bg-white/[0.04] px-3 py-1.5 ${clue ? "text-[16px] text-candle" : "font-mono text-[13px] text-bone/60"}`}>
          {e.text}
        </div>
      )}
    </button>
  );
}

function EventRow({ text }: { text: string }) {
  return <div className="py-1.5 text-center font-mono text-[14px] uppercase tracking-[0.16em] text-candle/90">✦ {text}</div>;
}

function DetailMessage({ m }: { m: Message }) {
  const to = effectiveTo(m);
  return (
    <div className="text-[15px] leading-snug">
      <Route m={m} />
      <div className={`mt-0.5 ${m.from === MANOR ? "text-red-200/90" : m.from === OPERATOR ? "text-white" : "text-bone/90"} ${to === MANOR ? "font-mono text-[13px] text-bone/60" : ""}`}>
        {m.text}
      </div>
    </div>
  );
}

export function RelayFeed({ world }: { world: World }) {
  const [details, setDetails] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const keep = details ? detailRow : storyRow;
  const rows: Row[] = world.log.map((entry, i) => ({ entry, key: `${world.runId}:${i}` })).filter(({ entry }) => keep(entry));
  const latestChat = [...rows].reverse().find(({ entry }) => entry.kind === "message")?.key;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [rows.length, details]);

  return (
    <div className="glass flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="label flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-teal" />
          </span>
          Agent Relay · #manor
        </span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-muted">{world.stats.messages} messages</span>
          <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            className={`rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest ${details ? "border-teal/60 text-teal" : "border-line text-muted hover:text-bone"}`}
          >
            Details
          </button>
        </span>
      </div>
      <div ref={scroller} className="scrollbar-none min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4">
        {rows.length === 0 && <div className="pt-8 text-center font-mono text-sm text-muted">The manor is quiet. Press S to start.</div>}
        <AnimatePresence initial={false}>
          {rows.map(({ entry, key }) => (
            <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {entry.kind === "event" ? (
                <EventRow text={entry.text} />
              ) : entry.kind === "action" ? (
                <ActionRow e={entry} />
              ) : details ? (
                <DetailMessage m={entry} />
              ) : (
                <ChatRow m={entry} latest={key === latestChat} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
