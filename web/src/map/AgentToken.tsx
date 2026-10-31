// A character token: portrait in a glowing ring that glides room -> door -> room along the agent's lastPath,
// leans into its walk, bobs while idle, swells while speaking and hops when an action succeeds.
import { animate, motion, useAnimationControls, useMotionValue, useTransform, useVelocity } from "motion/react";
import { useEffect, useRef } from "react";
import { AGENTS } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { agentSlot, pathWaypoints } from "../lib/geometry";

const SECONDS_PER_ROOM = 0.5;
/** Portrait radius in map pixels (the old glyph token was 17). */
const R = 30;
const HOP_ACTIONS = new Set(["inspect", "unlock", "power"]);

export const portraitFor = (agent: AgentId) => `/characters/${agent}.png`;

/** Index of the agent's latest successful clue/unlock/power action, so a new one triggers a hop. */
function lastWinIndex(world: World, agent: AgentId) {
  for (let i = world.log.length - 1; i >= 0; i--) {
    const e = world.log[i];
    if (e.kind === "action" && e.agent === agent) return e.ok && HOP_ACTIONS.has(e.action.action) ? i : -1;
  }
  return -1;
}

export function AgentToken({ world, agent, index, speaking }: { world: World; agent: AgentId; index: number; speaking: boolean }) {
  const meta = AGENTS[agent];
  const state = world.agents[agent];
  const slot = agentSlot(world, agent);
  const signature = `${world.runId}|${state.room}|${state.lastPath.join(">")}`;
  const lastSignature = useRef(signature);
  const x = useMotionValue(slot.x);
  const y = useMotionValue(slot.y);
  // Lean into the direction of travel.
  const vx = useVelocity(x);
  const lean = useTransform(vx, [-500, 0, 500], [-12, 0, 12], { clamp: true });
  const hop = useAnimationControls();

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
    // A little bounce in the step while walking.
    void hop.start({ y: [0, -6, 0, -6, 0], transition: { duration, ease: "easeInOut" } });
    return () => (ax.stop(), ay.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, slot.x, slot.y]);

  const win = lastWinIndex(world, agent);
  const lastWin = useRef(win);
  useEffect(() => {
    if (win === lastWin.current) return;
    lastWin.current = win;
    if (win >= 0) void hop.start({ y: [0, -22, 0, -8, 0], scale: [1, 1.15, 1], transition: { duration: 0.7, ease: "easeOut" } });
  }, [win, hop]);

  const clip = `clip-${agent}`;
  return (
    <motion.g style={{ x, y }}>
      <motion.g style={{ rotate: lean }}>
        <motion.g animate={hop}>
          <motion.g
            animate={{ y: [0, -4, 0], scale: speaking ? [1, 1.12, 1] : 1 }}
            transition={{
              y: { duration: 2.4 + index * 0.3, repeat: Infinity, delay: index * 0.6, ease: "easeInOut" },
              scale: speaking ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 },
            }}
          >
            <circle r={R + 12} fill={meta.color} opacity={speaking ? 0.4 : 0.22} filter="url(#glow)" />
            {speaking && (
              <motion.circle
                r={R}
                fill="none"
                stroke={meta.color}
                strokeWidth={3}
                animate={{ r: [R, R + 18], opacity: [0.9, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <defs>
              <clipPath id={clip}>
                <circle r={R} />
              </clipPath>
            </defs>
            <circle r={R + 2} fill="#0b0d12" />
            <image href={portraitFor(agent)} x={-R} y={-R} width={R * 2} height={R * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMin slice" />
            <circle r={R} fill="none" stroke={meta.color} strokeWidth={3} />
            <rect x={-46} y={R + 6} width={92} height={18} rx={9} fill="#0b0d12" opacity={0.85} stroke={meta.color} strokeOpacity={0.5} />
            <text y={R + 19} textAnchor="middle" fill={meta.color} fontSize={12} fontWeight={700} fontFamily="JetBrains Mono, monospace" letterSpacing="0.08em">
              {meta.relayName.toUpperCase()}
            </text>
          </motion.g>
        </motion.g>
      </motion.g>
    </motion.g>
  );
}
