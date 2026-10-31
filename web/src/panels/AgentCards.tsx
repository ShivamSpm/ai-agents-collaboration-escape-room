// One glass card per agent: portrait, name, role, CLI + model, room badge, and what the agent needs right now
// (from real state and messages). A card lights up while its agent speaks, and glows when a code is passed to it.
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { AGENT_IDS, AGENTS, ROOMS } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { runtimeFor } from "../lib/runtime";
import { agentNeed, latestHandoff } from "../lib/story";
import { portraitFor } from "../map/AgentToken";
import { GLYPHS } from "../map/Glyphs";

/** The agent whose card should glow right now, for 4s after a fresh code hand-off. */
function useHandoffGlow(world: World): AgentId | undefined {
  const handoff = latestHandoff(world);
  const [glow, setGlow] = useState<AgentId>();
  useEffect(() => {
    // Only fresh hand-offs: reloading the page mid-run must not replay the moment.
    if (!handoff || Date.now() - handoff.t > 6000) return;
    setGlow(handoff.agent);
    const t = setTimeout(() => setGlow(undefined), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff?.key]);
  return glow;
}

/** `speaking` is the Relay name whose voice is playing; that card lights up. */
export function AgentCards({ world, speaking }: { world: World; speaking: string | null }) {
  const glow = useHandoffGlow(world);
  return (
    <div className="flex flex-col gap-3">
      {AGENT_IDS.map((id) => {
        const meta = AGENTS[id];
        const need = agentNeed(world, id);
        const talking = speaking === meta.relayName;
        const received = glow === id;
        const hot = talking || received;
        const Glyph = GLYPHS[meta.glyph];
        return (
          <motion.div
            key={id}
            className="glass relative flex items-center gap-4 px-4 py-3"
            animate={hot ? { scale: 1.03, x: -6 } : { scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{
              borderColor: hot ? meta.color : `${meta.color}40`,
              borderWidth: hot ? 2 : 1,
              background: hot ? `linear-gradient(90deg, ${meta.color}33, ${meta.color}0d)` : undefined,
              boxShadow: received ? `0 0 40px ${meta.color}aa` : talking ? `0 0 28px ${meta.color}66` : undefined,
            }}
          >
            {(talking || received) && (
              <span
                className="absolute -top-2.5 left-20 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-ink"
                style={{ background: meta.color }}
              >
                {talking && (
                  <span className="flex h-3 items-end gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-0.5 rounded-full bg-ink"
                        animate={{ height: [3, 12, 5, 10, 3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                )}
                {received ? "Code received" : "Speaking"}
              </span>
            )}
            <div className="relative shrink-0">
              <img
                src={portraitFor(id)}
                alt={meta.relayName}
                className="size-16 rounded-full border-[3px] object-cover object-top"
                style={{ borderColor: meta.color, boxShadow: `0 0 18px ${meta.color}66` }}
              />
              <svg viewBox="-12 -12 24 24" className="absolute -bottom-1 -right-1 size-6 rounded-full bg-ink">
                <Glyph size={14} color={meta.color} />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-semibold" style={{ color: meta.color }}>{meta.relayName}</span>
                <span className="text-[15px] text-muted">{meta.role}</span>
                <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-bone/80">{ROOMS[world.agents[id].room].name}</span>
                <span
                  className="flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[12px] font-semibold"
                  style={{ borderColor: `${meta.color}55`, background: `${meta.color}10` }}
                  title="Which agent CLI and model this agent runs on"
                >
                  <span className="uppercase tracking-wider text-bone/80">{runtimeFor(id).cli}</span>
                  {runtimeFor(id).model && <span style={{ color: meta.color }}>· {runtimeFor(id).model}</span>}
                </span>
              </div>
              <div className={`mt-1 truncate text-[17px] ${need.blocked ? "text-blood" : received ? "text-white" : "text-bone"}`}>{need.text}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
