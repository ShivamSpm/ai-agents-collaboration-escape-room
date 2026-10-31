// One glass card per agent: role, model chip, current room, last action and its result.
import { AGENT_IDS, AGENTS, ROOMS } from "../../../shared/map";
import type { Action, AgentId, World } from "../../../shared/types";
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

export function AgentCards({ world }: { world: World }) {
  return (
    <div className="flex flex-col gap-3">
      {AGENT_IDS.map((id) => {
        const meta = AGENTS[id];
        const last = lastAction(world, id);
        const Glyph = GLYPHS[meta.glyph];
        return (
          <div key={id} className="glass flex items-center gap-4 px-4 py-3" style={{ borderColor: `${meta.color}40` }}>
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
                <span className="ml-auto rounded-md border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">{meta.runsOn}</span>
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
          </div>
        );
      })}
    </div>
  );
}
