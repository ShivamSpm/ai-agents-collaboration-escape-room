// One prominent objective above the map, picked from real game state, with the dependency that blocks it.
import { AnimatePresence, motion } from "motion/react";
import type { World } from "../../../shared/types";
import { currentObjective } from "../lib/story";

export function ObjectiveBanner({ world }: { world: World }) {
  const o = currentObjective(world);
  const color = o.alarm ? "#ef4444" : "#f5b041";
  return (
    <div
      className="glass relative mb-3 flex h-[84px] shrink-0 items-center gap-5 overflow-hidden px-6"
      style={{ borderColor: `${color}66`, boxShadow: `0 0 28px ${color}22` }}
    >
      <span className="font-mono text-[13px] uppercase tracking-[0.3em]" style={{ color }}>
        Objective
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={o.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
          className="min-w-0 flex-1"
        >
          <div className="truncate font-spooky text-[34px] leading-none tracking-wide" style={{ color }}>
            {o.title.toUpperCase()}
          </div>
          <div className="mt-1.5 truncate text-[18px] text-bone">{o.detail}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
