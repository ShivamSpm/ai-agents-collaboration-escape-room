// Clue objects: dim until read, a one-time pulse when the Medium reads them.
import { AnimatePresence, motion } from "motion/react";
import { OBJECTS } from "../../../shared/map";
import type { ObjectId, World } from "../../../shared/types";
import { U } from "../lib/geometry";
import { LedgerGlyph, PortraitGlyph, ShelfGlyph } from "./Glyphs";

const ICONS = { portrait: PortraitGlyph, ledger: LedgerGlyph, bookshelf: ShelfGlyph } as const;
const OBJECT_IDS = Object.keys(OBJECTS) as ObjectId[];

export function Objects({ world }: { world: World }) {
  return (
    <g>
      {OBJECT_IDS.map((id) => {
        const def = OBJECTS[id];
        if ("hiddenUntilCollapse" in def && def.hiddenUntilCollapse && !world.collapsed) return null;
        const read = world.cluesRead.includes(id);
        const cx = (def.at.x + 0.5) * U;
        const cy = (def.at.y + 0.5) * U;
        const Glyph = ICONS[id];
        return (
          <motion.g key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AnimatePresence>
              {read && (
                <motion.circle
                  key="pulse"
                  cx={cx}
                  cy={cy}
                  fill="none"
                  stroke="#f5b041"
                  strokeWidth={2}
                  initial={{ r: 22, opacity: 0.9 }}
                  animate={{ r: 64, opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
            <circle cx={cx} cy={cy} r={26} fill="#090b11" stroke={read ? "#f5b041" : "#3a4250"} strokeWidth={1.5} />
            <Glyph x={cx} y={cy} size={30} color={read ? "#f5b041" : "#8a93a3"} />
            <text x={cx} y={cy + 44} textAnchor="middle" fill={read ? "#f5d9a8" : "#7d8796"} fontSize={14} fontFamily="JetBrains Mono, monospace">
              {def.name}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}
