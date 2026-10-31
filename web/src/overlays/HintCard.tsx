// When an agent asks the Operator for help: a slim bar at the top of the map with who asked and the code to
// say. The question shows in full for a few seconds, then the bar shrinks to a small pill so the map stays clear.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AGENTS } from "../../../shared/map";
import type { World } from "../../../shared/types";
import { portraitFor } from "../map/AgentToken";
import { hintState, MAX_HINTS } from "../voice/hints";

const FULL_MS = 5000;

export function HintCard({ world }: { world: World }) {
  const { left, pending } = hintState(world);
  const meta = pending ? AGENTS[pending.agent] : undefined;
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setCompact(false);
    if (!pending) return;
    const t = setTimeout(() => setCompact(true), FULL_MS);
    return () => clearTimeout(t);
  }, [pending?.index]);

  // The operator is "the one who watches": these are the codes only they hold.
  const answer = world.collapsed ? "0666" : "1031";

  return (
    <>
      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-xl border border-line bg-ink/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted">
        Hints
        {Array.from({ length: MAX_HINTS }, (_, i) => (
          <span key={i} className={`size-2.5 rounded-full ${i < left ? "bg-candle shadow-[0_0_8px_#f5b041]" : "bg-line"}`} />
        ))}
      </div>
      <AnimatePresence>
        {pending && meta && (
          <motion.div
            key={pending.index}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={`pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3 rounded-full border bg-ink/90 py-1.5 pl-1.5 backdrop-blur ${
              compact ? "pr-3" : "max-w-[760px] pr-4"
            }`}
            style={{ borderColor: meta.color, boxShadow: `0 0 20px ${meta.color}44` }}
          >
            <motion.img
              layout
              src={portraitFor(pending.agent)}
              alt=""
              className="size-8 shrink-0 rounded-full border-2 object-cover object-top"
              style={{ borderColor: meta.color }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.span layout className="whitespace-nowrap font-mono text-[12px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.relayName} asks you
            </motion.span>
            {!compact && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="truncate text-[15px] text-bone/90"
                title={pending.text}
              >
                “{pending.text}”
              </motion.span>
            )}
            <motion.span layout className="shrink-0 whitespace-nowrap rounded-full border border-candle/60 bg-candle/10 px-2.5 py-0.5 font-mono text-[13px] font-bold text-candle">
              say {answer}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
