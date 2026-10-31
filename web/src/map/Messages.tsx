// Message particles (sender -> recipients) and speech bubbles above agent tokens.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AGENT_IDS, AGENTS, agentIdFromRelayName, CHANNEL, MANOR, OPERATOR } from "../../../shared/map";
import type { Point, World } from "../../../shared/types";
import { agentSlot, MANOR_SIGIL, OPERATOR_POINT } from "../lib/geometry";
import type { FreshBatch } from "../state/useFreshEntries";

type Particle = { key: string; from: Point; to: Point; color: string };
type Bubble = { key: string; at: Point; text: string; color: string };

export function colorFor(name: string) {
  const id = agentIdFromRelayName(name);
  if (id) return AGENTS[id].color;
  if (name === MANOR) return "#ef4444";
  return "#ffffff";
}

function pointFor(world: World, name: string): Point | undefined {
  const id = agentIdFromRelayName(name);
  if (id) return agentSlot(world, id);
  if (name === MANOR) return MANOR_SIGIL;
  if (name === OPERATOR) return OPERATOR_POINT;
  return undefined;
}

export function Messages({ world, batch }: { world: World; batch: FreshBatch }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});

  useEffect(() => {
    const ps: Particle[] = [];
    const bs: Record<string, Bubble> = {};
    for (const { key, entry } of batch.items) {
      if (entry.kind !== "message") continue;
      const from = pointFor(world, entry.from);
      if (!from) continue;
      const color = colorFor(entry.from);
      const targets =
        entry.to === CHANNEL
          ? AGENT_IDS.filter((id) => AGENTS[id].relayName !== entry.from).map((id) => agentSlot(world, id))
          : [pointFor(world, entry.to)].filter((p): p is Point => !!p);
      targets.forEach((to, i) => ps.push({ key: `${key}:${i}`, from, to, color }));
      // Bubbles for agents talking to people, not JSON actions to the Manor.
      if (agentIdFromRelayName(entry.from) && entry.to !== MANOR) {
        const text = entry.text.length > 60 ? `${entry.text.slice(0, 57)}…` : entry.text;
        bs[entry.from] = { key, at: from, text, color };
      }
    }
    if (ps.length) setParticles((cur) => [...cur, ...ps]);
    if (Object.keys(bs).length) setBubbles((cur) => ({ ...cur, ...bs }));
    const timers = Object.values(bs).map((b) =>
      setTimeout(() => setBubbles((cur) => Object.fromEntries(Object.entries(cur).filter(([, v]) => v.key !== b.key))), 4000),
    );
    return () => timers.forEach(clearTimeout);
    // Only react to new batches; world is read for positions at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id]);

  return (
    <g>
      {particles.map((p) => (
        <motion.circle
          key={p.key}
          r={6}
          fill={p.color}
          filter="url(#glow)"
          initial={{ cx: p.from.x, cy: p.from.y, opacity: 0 }}
          animate={{ cx: p.to.x, cy: p.to.y, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          onAnimationComplete={() => setParticles((cur) => cur.filter((x) => x.key !== p.key))}
        />
      ))}
      <AnimatePresence>
        {Object.values(bubbles).map((b) => (
          <motion.foreignObject
            key={b.key}
            x={b.at.x - 120}
            y={b.at.y - 92}
            width={240}
            height={64}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex h-full items-end justify-center">
              <div
                className="rounded-xl px-3 py-1.5 text-[13px] leading-snug text-bone"
                style={{ background: "rgb(9 11 17 / 0.92)", border: `1px solid ${b.color}`, boxShadow: `0 0 14px ${b.color}55` }}
              >
                {b.text}
              </div>
            </div>
          </motion.foreignObject>
        ))}
      </AnimatePresence>
    </g>
  );
}
