// One glass card per agent: role, model chip, current room, last action and its result.
import { motion } from "motion/react";
import { AGENT_IDS, AGENTS, ROOMS } from "../../../shared/map";
import type { Action, AgentId, World } from "../../../shared/types";
import { runtimeFor } from "../lib/runtime";
import { portraitFor } from "../map/AgentToken";
import { GLYPHS } from "../map/Glyphs";

function describe(a: Action) {
  switch (a.action) {
    case "look": return "look";
    case "move": return `move → ${ROOMS[a.to].name}`;
    case "inspect": return `inspect ${a.object}`;
    case "power": return `power circuit ${a.circuit}`;
    case "unlock": return `unlock ${a.door} · ${a.code}`;
  }
}

function lastAction(world: World, agent: AgentId) {
  for (let i = world.log.length - 1; i >= 0; i--) {
    const e = world.log[i];
    if (e.kind === "action" && e.agent === agent) return e;
  }
}

/** `speaking` is the Relay name whose voice is playing; that card lights up. */
export function AgentCards({ world, speaking }: { world: World; speaking: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      {AGENT_IDS.map((id) => {
        const meta = AGENTS[id];
        const last = lastAction(world, id);
        const talking = speaking === meta.relayName;
        const Glyph = GLYPHS[meta.glyph];
        return (
          <motion.div
            key={id}
            className="glass relative flex items-center gap-4 px-4 py-3"
            animate={talking ? { scale: 1.03, x: -6 } : { scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{
              borderColor: talking ? meta.color : `${meta.color}40`,
              borderWidth: talking ? 2 : 1,
              background: talking ? `linear-gradient(90deg, ${meta.color}33, ${meta.color}0d)` : undefined,
              boxShadow: talking ? `0 0 28px ${meta.color}66` : undefined,
            }}
          >
            {talking && (
              <span
                className="absolute -top-2.5 left-20 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-ink"
                style={{ background: meta.color }}
              >
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
                Speaking
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
                <span
                  className="ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[13px] font-semibold"
                  style={{ borderColor: `${meta.color}66`, background: `${meta.color}14` }}
                  title="Which agent CLI and model this agent runs on"
                >
                  <span className="uppercase tracking-wider text-bone">{runtimeFor(id).cli}</span>
                  {runtimeFor(id).model && <span style={{ color: meta.color }}>· {runtimeFor(id).model}</span>}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[14px]">
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-bone">{ROOMS[world.agents[id].room].name}</span>
                {last ? (
                  <span className={`truncate ${last.ok ? "text-bone/80" : "text-blood"}`}>
                    {last.ok ? "✓" : "✗"} {describe(last.action)}
                  </span>
                ) : (
                  <span className="text-muted">waiting…</span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
