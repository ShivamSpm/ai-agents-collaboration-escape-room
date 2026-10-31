// Every Relay message and operator event, in order, newest at the bottom.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { MANOR, OPERATOR } from "../../../shared/map";
import type { World } from "../../../shared/types";
import { colorFor } from "../map/Messages";

export function RelayFeed({ world }: { world: World }) {
  const scroller = useRef<HTMLDivElement>(null);
  const rows = world.log
    .map((entry, i) => ({ entry, key: `${world.runId}:${i}` }))
    .filter(({ entry }) => entry.kind !== "action");

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
      <div ref={scroller} className="scrollbar-none min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {rows.length === 0 && <div className="pt-8 text-center font-mono text-sm text-muted">The manor is quiet. Press S to start.</div>}
        <AnimatePresence initial={false}>
          {rows.map(({ entry, key }) =>
            entry.kind === "event" ? (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-1 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-candle/80"
              >
                ✦ {entry.text}
              </motion.div>
            ) : entry.kind === "message" ? (
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[14px] leading-snug">
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  {entry.private && <span title="private">🔒</span>}
                  <span style={{ color: colorFor(entry.from) }}>{entry.from}</span>
                  <span className="text-muted">→</span>
                  <span style={{ color: entry.to.startsWith("#") ? "#7d8796" : colorFor(entry.to) }}>{entry.to}</span>
                </div>
                <div
                  className={`mt-0.5 ${entry.from === MANOR ? "italic text-red-200/90" : entry.from === OPERATOR ? "text-white" : "text-bone/90"} ${
                    entry.to === MANOR ? "font-mono text-[12px] text-bone/60" : ""
                  }`}
                >
                  {entry.text}
                </div>
              </motion.div>
            ) : null,
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
