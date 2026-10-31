// One glass card per agent: name, role, what it needs right now (from real state and messages), room badge,
// and a secondary model label. The recipient's card glows when a code is passed to it.
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { AGENT_IDS, AGENTS, ROOMS } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { GLYPHS } from "../map/Glyphs";
import { agentNeed, latestHandoff } from "../lib/story";

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

export function AgentCards({ world }: { world: World }) {
  const glow = useHandoffGlow(world);
  return (
    <div className="flex flex-col gap-3">
      {AGENT_IDS.map((id) => {
        const meta = AGENTS[id];
        const need = agentNeed(world, id);
        const Glyph = GLYPHS[meta.glyph];
        const lit = glow === id;
        return (
          <motion.div
            key={id}
            animate={lit ? { scale: [1, 1.03, 1], boxShadow: [`0 0 0px ${meta.color}00`, `0 0 36px ${meta.color}aa`, `0 0 18px ${meta.color}66`] } : { scale: 1, boxShadow: `0 0 0px ${meta.color}00` }}
            transition={{ duration: 0.8 }}
            className="glass flex items-center gap-4 px-4 py-3"
            style={{ borderColor: lit ? meta.color : `${meta.color}40` }}
          >
            <svg viewBox="-24 -24 48 48" className="size-12 shrink-0">
              <circle r={22} fill={meta.color} opacity={0.15} />
              <circle r={17} fill="#0b0d12" stroke={meta.color} strokeWidth={2.5} />
              <Glyph size={19} color={meta.color} />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-semibold" style={{ color: meta.color }}>{meta.relayName}</span>
                <span className="text-[15px] text-muted">{meta.role}</span>
                <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-bone/80">{ROOMS[world.agents[id].room].name}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted/60">{meta.runsOn}</span>
              </div>
              <div className={`mt-1 truncate text-[17px] ${need.blocked ? "text-blood" : lit ? "text-white" : "text-bone"}`}>
                {lit ? "Code received!" : need.text}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
