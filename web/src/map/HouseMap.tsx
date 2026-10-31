// The 2D house: one SVG, layered rooms -> walls -> doors -> objects -> agents -> messages.
import { motion, useAnimationControls } from "motion/react";
import { useEffect } from "react";
import { AGENT_IDS, AGENTS, MANOR } from "../../../shared/map";
import type { World } from "../../../shared/types";
import { collapseSound } from "../lib/clickSound";
import { MANOR_SIGIL, MAP_H, MAP_W } from "../lib/geometry";
import type { FreshBatch } from "../state/useFreshEntries";
import { AgentToken } from "./AgentToken";
import { Doors } from "./Doors";
import { Messages } from "./Messages";
import { Objects } from "./Objects";
import { Rooms, Rubble, Walls } from "./Rooms";

const PAD = 24;
const TILT = 24;

export function HouseMap({ world, batch, speaking }: { world: World; batch: FreshBatch; speaking: string | null }) {
  const shake = useAnimationControls();

  useEffect(() => {
    if (batch.items.some(({ entry }) => entry.kind === "event" && entry.event === "collapse")) {
      collapseSound();
      shake.start({ x: [0, -14, 12, -10, 8, -5, 3, 0], y: [0, 7, -8, 5, -4, 2, 0], transition: { duration: 0.6 } });
    }
  }, [batch, shake]);

  return (
    <motion.svg
      animate={shake}
      // Dollhouse tilt: the floor plan leans back in perspective; everything inside still animates in 2D.
      // Nudged right: the left side has rooms down to the near wall, which the tilt flares outward.
      style={{ rotateX: TILT, transformPerspective: 1600, originY: 0.72, scale: 1.07, x: 10 }}
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
      <ManorSigil speaking={speaking === MANOR} />
      {AGENT_IDS.map((id, i) => (
        <AgentToken key={id} world={world} agent={id} index={i} speaking={speaking === AGENTS[id].relayName} />
      ))}
      <Messages world={world} batch={batch} />
    </motion.svg>
  );
}

/** The Manor's ghostly butler: the game master who answers every action. Floats, flickers and swells when it speaks. */
function ManorSigil({ speaking }: { speaking: boolean }) {
  const { x, y } = MANOR_SIGIL;
  const R = 46;
  return (
    <motion.g
      style={{ x, y }}
      animate={{ y: [y, y - 6, y], scale: speaking ? [1, 1.1, 1] : 1 }}
      transition={{ y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.6, repeat: speaking ? Infinity : 0 } }}
    >
      <motion.circle
        r={R + 16}
        fill="#ef4444"
        filter="url(#glow)"
        animate={{ opacity: speaking ? [0.35, 0.8, 0.35] : [0.12, 0.3, 0.12] }}
        transition={{ duration: speaking ? 0.6 : 3, repeat: Infinity }}
      />
      <defs>
        <clipPath id="clip-manor">
          <circle r={R} />
        </clipPath>
      </defs>
      <circle r={R + 2} fill="#0b0d12" />
      <motion.image
        href="/characters/manor.png"
        x={-R}
        y={-R}
        width={R * 2}
        height={R * 2}
        clipPath="url(#clip-manor)"
        preserveAspectRatio="xMidYMin slice"
        animate={{ opacity: [0.85, 1, 0.9, 1, 0.85] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <circle r={R} fill="none" stroke="#ef4444" strokeWidth={3} />
      <rect x={-54} y={R + 8} width={108} height={20} rx={10} fill="#0b0d12" opacity={0.85} stroke="#ef4444" strokeOpacity={0.6} />
      <text y={R + 22} textAnchor="middle" fill="#ef4444" fontFamily="JetBrains Mono, monospace" fontSize={12} fontWeight={700} letterSpacing="0.2em">
        THE MANOR
      </text>
    </motion.g>
  );
}
