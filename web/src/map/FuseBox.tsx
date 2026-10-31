// Compact fuse-box readout in the map's empty lower-right corner, from the real circuit state.
// Each lamp flashes when its circuit changes, tying the Electrician's switch to the rooms lighting up.
import { motion } from "motion/react";
import type { World } from "../../../shared/types";

const CIRCUITS = [
  { id: "A", rooms: "Foyer · Corridor · Basement · Crypt" },
  { id: "B", rooms: "Library" },
  { id: "C", rooms: "Conservatory · Passage" },
] as const;

export function FuseBox({ world }: { world: World }) {
  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-xl border border-line bg-ink/85 px-4 py-3 backdrop-blur">
      <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.25em] text-muted">Fuse box · power</div>
      <div className="flex flex-col gap-1.5">
        {CIRCUITS.map(({ id, rooms }) => {
          const on = world.circuits[id];
          return (
            <div key={id} className="flex items-center gap-3">
              <motion.span
                key={`${id}:${on}`}
                initial={{ scale: 1.8, opacity: 0.3 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="size-3.5 rounded-full"
                style={{ background: on ? "#f5b041" : "#1c2430", boxShadow: on ? "0 0 12px #f5b041" : "none" }}
              />
              <span className="w-[120px] font-mono text-[16px] font-semibold text-bone">
                {id}: <span className={on ? "text-candle" : "text-muted"}>{on ? "ON" : "OFF"}</span>
              </span>
              <span className={`text-[14px] ${on ? "text-bone/80" : "text-muted/60"}`}>{rooms}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
