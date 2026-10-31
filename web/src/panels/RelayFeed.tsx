// The Relay feed, newest at the bottom. Story mode (default) shows the agents' coordination and short action
// sentences; "Details" shows the full technical log (JSON actions and the Manor's complete replies).
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AGENTS, agentIdFromRelayName, MANOR, OPERATOR } from "../../../shared/map";
import type { LogEntry, World } from "../../../shared/types";
import { portraitFor } from "../map/AgentToken";
import { colorFor } from "../map/Messages";
import { usePresentation } from "../lib/presentation";
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

/** Presentation mode: the story minus walking (the map shows moves); only clue, power and unlock actions. */
function presentRow(e: LogEntry): boolean {
  if (e.kind === "action" && e.ok && e.action.action === "move") return false;
  return storyRow(e);
}

/** Presentation mode shows only the latest rows, larger. */
const PRESENT_ROWS = 7;

/** Details mode: the previous full log. Actions appear as their mirrored JSON messages. */
function detailRow(e: LogEntry): boolean {
  return e.kind !== "action" && !(e.kind === "event" && e.event === "resumed") && !(e.kind === "message" && isJsonBounce(e));
}

/** Who is talking: the agent's portrait, the Manor's sigil, or the Operator's mic. */
function Avatar({ name }: { name: string }) {
  const agent = agentIdFromRelayName(name);
  const color = colorFor(name);
  const ring = { borderColor: color, boxShadow: `0 0 10px ${color}55` };
  if (agent || name === MANOR)
    return (
      <img
        src={agent ? portraitFor(agent) : "/characters/manor.png"}
        alt={name}
        className="size-11 shrink-0 rounded-full border-2 object-cover object-top"
        style={ring}
      />
    );
  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-full border-2 bg-ink text-xl" style={ring}>
      {name === OPERATOR ? "🎙" : "•"}
    </div>
  );
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

function ChatRow({ m, latest, big }: { m: Message; latest: boolean; big: boolean }) {
  return (
    <div
      className={`flex gap-3 rounded-lg border-l-[3px] px-3 py-2 transition-colors ${latest ? "bg-white/[0.06]" : ""}`}
      style={{ borderColor: latest ? colorFor(m.from) : "transparent" }}
    >
      <Avatar name={m.from} />
      <div className="min-w-0 flex-1">
        <Route m={m} />
        <div className={`mt-0.5 leading-snug ${big ? "text-[20px]" : "text-[18px]"} ${m.from === OPERATOR ? "text-white" : "text-bone"}`}>{m.text}</div>
      </div>
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
    <div className="flex gap-3 text-[15px] leading-snug">
      <Avatar name={m.from} />
      <div className="min-w-0 flex-1">
        <Route m={m} />
        <div className={`mt-0.5 ${m.from === MANOR ? "text-red-200/90" : m.from === OPERATOR ? "text-white" : "text-bone/90"} ${to === MANOR ? "font-mono text-[13px] text-bone/60" : ""}`}>
          {m.text}
        </div>
      </div>
    </div>
  );
}

export function RelayFeed({ world }: { world: World }) {
  const present = usePresentation();
  const [detailsOn, setDetails] = useState(false);
  const details = detailsOn && !present;
  const scroller = useRef<HTMLDivElement>(null);
  const keep = present ? presentRow : details ? detailRow : storyRow;
  const all: Row[] = world.log.map((entry, i) => ({ entry, key: `${world.runId}:${i}` })).filter(({ entry }) => keep(entry));
  const rows = present ? all.slice(-PRESENT_ROWS) : all;
  const latestChat = [...rows].reverse().find(({ entry }) => entry.kind === "message")?.key;

  // Always follow the newest message: on every world update (presentation mode keeps the row count fixed),
  // and again once the new row's entry animation has settled so it never stops short of the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    const settle = setTimeout(() => el.scrollTo({ top: el.scrollHeight }), 350);
    return () => clearTimeout(settle);
  }, [world.rev, rows.length, details, present]);

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
          {!present && <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            className={`rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest ${details ? "border-teal/60 text-teal" : "border-line text-muted hover:text-bone"}`}
          >
            Details
          </button>}
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
                <ChatRow m={entry} latest={key === latestChat} big={present} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
