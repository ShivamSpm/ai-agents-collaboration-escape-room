// Doors on the walls: gaps (open), padlocks (code), sliding bars (magnet), a crack reveal (hidden).
import { motion } from "motion/react";
import { DOORS } from "../../../shared/map";
import type { DoorDef, DoorId, World } from "../../../shared/types";
import { doorGeom, U } from "../lib/geometry";
import { LockGlyph } from "./Glyphs";

const DOOR_IDS = Object.keys(DOORS) as DoorId[];
const GAP = U * 0.8;

export function Doors({ world }: { world: World }) {
  return (
    <g>
      {DOOR_IDS.map((id) => (
        <Door key={id} id={id} world={world} />
      ))}
    </g>
  );
}

function Door({ id, world }: { id: DoorId; world: World }) {
  const def: DoorDef = DOORS[id];
  const state = world.doors[id];
  if (!state.revealed) return null;
  const { center: c, horizontal: h } = doorGeom(id);
  const half = GAP / 2;
  const [x1, y1, x2, y2] = h ? [c.x - half, c.y, c.x + half, c.y] : [c.x, c.y - half, c.x, c.y + half];
  const powered = def.kind === "magnet" && def.circuit ? world.circuits[def.circuit] : false;

  return (
    <g>
      {/* The opening cut into the wall. */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#090b11" strokeWidth={7} />
      {def.hiddenUntilCollapse && (
        <motion.path
          d={h ? `M${x1} ${c.y - 10} l10 8 l8 -6 l12 9 l10 -7` : `M${c.x - 10} ${y1} l8 10 l-6 8 l9 12 l-7 10`}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 1.4, times: [0, 0.6, 1] }}
        />
      )}
      {def.kind === "code" && (
        <motion.g initial={false} animate={{ scale: state.unlocked ? [1, 1.35, 1] : 1 }} style={{ originX: `${c.x}px`, originY: `${c.y}px` }}>
          <circle cx={c.x} cy={c.y} r={14} fill="#090b11" stroke={state.unlocked ? "#2dd4bf" : "#ef4444"} strokeWidth={1.5} />
          <LockGlyph open={state.unlocked} x={c.x} y={c.y} size={16} color={state.unlocked ? "#2dd4bf" : "#ef4444"} />
        </motion.g>
      )}
      {def.kind === "magnet" && (
        <motion.g
          initial={false}
          animate={h ? { x: powered ? GAP : 0, opacity: powered ? 0 : 1 } : { y: powered ? -GAP : 0, opacity: powered ? 0 : 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {[-0.3, 0, 0.3].map((f) => (
            <line
              key={f}
              x1={h ? c.x + f * GAP : c.x - 8}
              y1={h ? c.y - 8 : c.y + f * GAP}
              x2={h ? c.x + f * GAP : c.x + 8}
              y2={h ? c.y + 8 : c.y + f * GAP}
              stroke="#9aa3b2"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
        </motion.g>
      )}
    </g>
  );
}
