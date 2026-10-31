// Rooms with candlelight (lit) or fog (dark), the walls, and the collapse rubble.
import { motion } from "motion/react";
import { ROOMS } from "../../../shared/map";
import type { RoomId, World } from "../../../shared/types";
import { roomRect, U } from "../lib/geometry";

const ROOM_IDS = Object.keys(ROOMS) as RoomId[];

export const isLit = (world: World, id: RoomId) => world.circuits[ROOMS[id].circuit];
export const isVisible = (world: World, id: RoomId) => id !== "secret_passage" || world.doors.secret_door.revealed;

export function Rooms({ world }: { world: World }) {
  return (
    <g>
      {ROOM_IDS.filter((id) => isVisible(world, id)).map((id) => {
        const r = roomRect(id);
        const lit = isLit(world, id);
        return (
          <motion.g key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#090b11" />
            <motion.rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill="url(#candle)"
              initial={false}
              animate={{ opacity: lit ? [0.2, 1, 0.45, 1] : 0 }}
              transition={{ duration: 0.4, times: lit ? [0, 0.4, 0.6, 1] : undefined }}
            />
            <motion.rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              filter="url(#fog)"
              initial={false}
              animate={{ opacity: lit ? 0 : 0.5 }}
              transition={{ duration: 0.4 }}
            />
            <text
              x={r.x + 12}
              y={r.y + 28}
              fill={lit ? "#f5d9a8" : "#7a8391"}
              fontFamily="JetBrains Mono, monospace"
              fontSize={17}
              fontWeight={600}
              letterSpacing="0.14em"
              style={{ textTransform: "uppercase", transition: "fill 400ms" }}
            >
              {ROOMS[id].name}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}

/** Walls drawn as a dark extruded base, a side face and a lit top edge, so the tilted map reads as raised. */
const WALL_HEIGHT = 9;

export function Walls({ world }: { world: World }) {
  const rects = ROOM_IDS.filter((id) => isVisible(world, id)).map((id) => ({ id, ...roomRect(id) }));
  return (
    <g fill="none" strokeLinejoin="round">
      {rects.map((r) => (
        <rect key={`shadow-${r.id}`} x={r.x + 3} y={r.y + WALL_HEIGHT + 4} width={r.w} height={r.h} stroke="#000" strokeWidth={8} opacity={0.55} filter="url(#soft)" />
      ))}
      {rects.map((r) => (
        <rect key={`side-${r.id}`} x={r.x} y={r.y + WALL_HEIGHT / 2} width={r.w} height={r.h} stroke="#6f6a60" strokeWidth={WALL_HEIGHT} opacity={0.55} />
      ))}
      {rects.map((r) => (
        <rect key={`top-${r.id}`} x={r.x} y={r.y} width={r.w} height={r.h} stroke="#d8d2c4" strokeWidth={3} opacity={0.95} />
      ))}
    </g>
  );
}

// Fixed rubble layout so it looks the same every run.
const RUBBLE = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: 6.2 + r(1) * 9.6, y: 4.15 + r(2) * 1.7, s: 8 + r(3) * 18, a: r(4) * 90 };
});

export function Rubble({ world }: { world: World }) {
  if (!world.collapsed) return null;
  const r = roomRect("east_corridor");
  return (
    <g>
      <motion.rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill="#1a1512"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ duration: 0.3 }}
      />
      {RUBBLE.map((b, i) => (
        <motion.rect
          key={i}
          x={b.x * U - b.s / 2}
          y={b.y * U - b.s / 2}
          width={b.s}
          height={b.s * 0.7}
          rx={2}
          fill={i % 3 ? "#5b5348" : "#3d372f"}
          stroke="#2a251f"
          style={{ transformBox: "fill-box", transformOrigin: "center", rotate: b.a }}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.012, type: "spring", stiffness: 300, damping: 18 }}
        />
      ))}
      <motion.text
        x={r.x + r.w / 2}
        y={r.y + r.h / 2 + 5}
        textAnchor="middle"
        fill="#ef4444"
        fontFamily="JetBrains Mono, monospace"
        fontSize={16}
        fontWeight={700}
        letterSpacing="0.2em"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ delay: 0.5 }}
      >
        COLLAPSED
      </motion.text>
    </g>
  );
}
