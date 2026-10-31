// When an agent asks the Operator for help: who asked and what.
import { AnimatePresence, motion } from "motion/react";
import { AGENTS } from "../../../shared/map";
import type { World } from "../../../shared/types";
import { hintState } from "../voice/hints";

export function HintCard({ world }: { world: World }) {
  const { pending } = hintState(world);
  const meta = pending ? AGENTS[pending.agent] : undefined;
  return (
    <>
      <AnimatePresence>
        {pending && meta && (
          <motion.div
            key={pending.index}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-5 left-1/2 z-10 w-[640px] -translate-x-1/2 rounded-2xl border bg-ink/90 px-6 py-4 backdrop-blur"
            style={{ borderColor: meta.color, boxShadow: `0 0 36px ${meta.color}44` }}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: meta.color }}>
              <motion.span className="size-2 rounded-full" style={{ background: meta.color }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              {meta.relayName} asks the Operator
            </div>
            <div className="mt-1.5 text-[19px] leading-snug text-bone">“{pending.text}”</div>
            <div className="mt-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted">
              <span>Hold V to answer by voice · or type below</span>
              {/* The operator is "the one who watches": these are the codes only they hold. */}
              <span className="rounded-md border border-candle/50 px-2 py-0.5 text-[13px] text-candle">
                Answer: {world.collapsed && world.cluesRead.includes("bookshelf") ? "0666" : "1031"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
