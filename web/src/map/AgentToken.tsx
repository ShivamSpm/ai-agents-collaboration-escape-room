// A glowing ghost token that glides room -> door -> room along the agent's lastPath.
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import { AGENTS } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { agentSlot, pathWaypoints } from "../lib/geometry";
import { GLYPHS } from "./Glyphs";

const SECONDS_PER_ROOM = 0.5;

export function AgentToken({ world, agent, index }: { world: World; agent: AgentId; index: number }) {
  const meta = AGENTS[agent];
  const state = world.agents[agent];
  const slot = agentSlot(world, agent);
  const signature = `${world.runId}|${state.room}|${state.lastPath.join(">")}`;
  const lastSignature = useRef(signature);
  const x = useMotionValue(slot.x);
  const y = useMotionValue(slot.y);

  useEffect(() => {
    if (lastSignature.current === signature) {
      // Same move; another agent arrived or left, so just shuffle to the new slot.
      const ax = animate(x, slot.x, { duration: 0.35 });
      const ay = animate(y, slot.y, { duration: 0.35 });
      return () => (ax.stop(), ay.stop());
    }
    lastSignature.current = signature;
    const pts = pathWaypoints(world, agent);
    const duration = Math.max(0.4, (state.lastPath.length - 1) * SECONDS_PER_ROOM * 1.6);
    const opts = { duration, ease: "easeInOut" as const };
    const ax = animate(x, pts.map((p) => p.x), opts);
    const ay = animate(y, pts.map((p) => p.y), opts);
    return () => (ax.stop(), ay.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, slot.x, slot.y]);

  const Glyph = GLYPHS[meta.glyph];
  return (
    <motion.g style={{ x, y }}>
      <motion.g animate={{ y: [0, -3, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.6, ease: "easeInOut" }}>
        <circle r={26} fill={meta.color} opacity={0.22} filter="url(#glow)" />
        <circle r={17} fill="#0b0d12" stroke={meta.color} strokeWidth={2} />
        <Glyph size={17} color={meta.color} />
        <text y={34} textAnchor="middle" fill={meta.color} fontSize={11} fontWeight={600} fontFamily="JetBrains Mono, monospace" letterSpacing="0.08em">
          {meta.relayName.toUpperCase()}
        </text>
      </motion.g>
    </motion.g>
  );
}
