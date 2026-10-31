// Every Relay message and operator event, in order, newest at the bottom.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { agentIdFromRelayName, MANOR, OPERATOR } from "../../../shared/map";
import type { World } from "../../../shared/types";
import { portraitFor } from "../map/AgentToken";
import { colorFor } from "../map/Messages";
import { effectiveTo, isJsonBounce } from "../lib/replies";

export function RelayFeed({ world }: { world: World }) {
  const scroller = useRef<HTMLDivElement>(null);
  const rows = world.log
    .map((entry, i) => ({ entry, key: `${world.runId}:${i}` }))
    // Actions are mirrored as messages; "resumed" also fires on idle wake-ups, and real crashes get their own banner.
    .filter(
      ({ entry }) =>
        entry.kind !== "action" && !(entry.kind === "event" && entry.event === "resumed") && !(entry.kind === "message" && isJsonBounce(entry)),
    );

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [rows.length]);

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
        <span className="font-mono text-[11px] text-muted">{world.stats.messages} messages</span>
      </div>
      <div ref={scroller} className="scrollbar-none min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {rows.length === 0 && <div className="pt-8 text-center font-mono text-sm text-muted">The manor is quiet. Press S to start.</div>}
        <AnimatePresence initial={false}>
          {rows.map(({ entry, key }) =>
            entry.kind === "event" ? (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-1.5 text-center font-mono text-[13px] uppercase tracking-[0.16em] text-candle/80"
              >
                ✦ {entry.text}
              </motion.div>
            ) : entry.kind === "message" ? (
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 text-[18px] leading-snug">
                <Avatar name={entry.from} />
                <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-mono text-[13px] font-semibold">
                  {entry.private && <span title="private">🔒</span>}
                  <span style={{ color: colorFor(entry.from) }}>{entry.from}</span>
                  <span className="text-muted">→</span>
                  <span style={{ color: effectiveTo(entry).startsWith("#") ? "#7d8796" : colorFor(effectiveTo(entry)) }}>{effectiveTo(entry)}</span>
                </div>
                <div
                  className={`mt-0.5 ${entry.from === MANOR ? "italic text-red-200/90" : entry.from === OPERATOR ? "text-white" : "text-bone/90"} ${
                    effectiveTo(entry) === MANOR ? "font-mono text-[14px] text-bone/60" : ""
                  }`}
                >
                  {entry.text}
                </div>
                </div>
              </motion.div>
            ) : null,
          )}
        </AnimatePresence>
      </div>
    </div>
  );
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
