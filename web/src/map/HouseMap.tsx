// The 2D house: one SVG, layered rooms -> walls -> doors -> objects -> agents -> messages.
import { motion, useAnimationControls } from "motion/react";
import { useEffect } from "react";
import { AGENT_IDS } from "../../../shared/map";
import type { World } from "../../../shared/types";
import { MANOR_SIGIL, MAP_H, MAP_W } from "../lib/geometry";
import type { FreshBatch } from "../state/useFreshEntries";
import { AgentToken } from "./AgentToken";
import { Doors } from "./Doors";
import { Messages } from "./Messages";
import { Objects } from "./Objects";
import { Rooms, Rubble, Walls } from "./Rooms";

const PAD = 24;
const TILT = 24;

export function HouseMap({ world, batch }: { world: World; batch: FreshBatch }) {
  const shake = useAnimationControls();

  useEffect(() => {
    if (batch.items.some(({ entry }) => entry.kind === "event" && entry.event === "collapse")) {
      shake.start({ x: [0, -10, 9, -7, 6, -3, 0], y: [0, 5, -6, 4, -3, 2, 0], transition: { duration: 0.3 } });
    }
  }, [batch, shake]);

  return (
    <motion.svg
      animate={shake}
      // Dollhouse tilt: the floor plan leans back in perspective; everything inside still animates in 2D.
      style={{ rotateX: TILT, transformPerspective: 1600, originY: 0.62, scale: 1.04 }}
      viewBox={`${-PAD} ${-PAD} ${MAP_W + PAD * 2} ${MAP_H + PAD * 2}`}
      className="h-full w-full overflow-visible"
      role="img"
      aria-label="Map of Hollow Manor"
    >
      <defs>
        <radialGradient id="candle" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0" stopColor="#f5b041" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="#f5b041" stopOpacity="0.12" />
          <stop offset="1" stopColor="#f5b041" stopOpacity="0.04" />
        </radialGradient>
        <filter id="fog" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.4  0 0 0 0 0.5  0 0 0 0.55 0" />
        </filter>
        <filter id="soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <Rooms world={world} />
      <Rubble world={world} />
      <Walls world={world} />
      <Doors world={world} />
      <Objects world={world} />
      <ManorSigil />
      {AGENT_IDS.map((id, i) => (
        <AgentToken key={id} world={world} agent={id} index={i} />
      ))}
      <Messages world={world} batch={batch} />
    </motion.svg>
  );
}

function ManorSigil() {
  const { x, y } = MANOR_SIGIL;
  return (
    <g>
      <motion.circle
        cx={x}
        cy={y}
        r={40}
        fill="#ef4444"
        filter="url(#glow)"
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <circle cx={x} cy={y} r={30} fill="#0b0d12" stroke="#ef4444" strokeWidth={2} />
      <path
        d={Array.from({ length: 5 }, (_, i) => {
          const a = (-90 + i * 144) * (Math.PI / 180);
          return `${i ? "L" : "M"}${x + 22 * Math.cos(a)} ${y + 22 * Math.sin(a)}`;
        }).join(" ") + "Z"}
        fill="none"
        stroke="#ef4444"
        strokeWidth={1.5}
      />
      <text x={x} y={y + 52} textAnchor="middle" fill="#ef4444" fontFamily="JetBrains Mono, monospace" fontSize={11} letterSpacing="0.2em">
        THE MANOR
      </text>
    </g>
  );
}
