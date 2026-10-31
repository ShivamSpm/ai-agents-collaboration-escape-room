// Five chips under the map that tick off as the run progresses.
import { motion } from "motion/react";
import type { World } from "../../../shared/types";

const OBJECTIVES: { label: string; done: (w: World) => boolean }[] = [
  { label: "Library lit", done: (w) => w.circuits.B || w.cluesRead.includes("ledger") },
  { label: "Gate code found", done: (w) => w.cluesRead.includes("ledger") },
  { label: "Gate unlocked", done: (w) => w.doors.crypt_gate.unlocked },
  { label: "Escape route found", done: (w) => w.cluesRead.includes("bookshelf") || w.doors.secret_door.unlocked },
  { label: "Escaped", done: (w) => w.status === "escaped" },
];

export function Objectives({ world }: { world: World }) {
  return (
    <div className="flex h-[56px] items-center gap-3 px-2">
      <span className="label mr-1">Objectives</span>
      {OBJECTIVES.map((o) => {
        const done = o.done(world);
        return (
          <motion.span
            key={o.label}
            initial={false}
            animate={{ scale: done ? [1, 1.08, 1] : 1 }}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-wider transition-colors ${
              done ? "border-teal/60 bg-teal/10 text-teal shadow-[0_0_14px_rgb(0_245_212/0.2)]" : "border-line text-muted"
            }`}
          >
            <span className={`size-1.5 rounded-full ${done ? "bg-teal" : "bg-muted/50"}`} />
            {o.label}
          </motion.span>
        );
      })}
    </div>
  );
}
