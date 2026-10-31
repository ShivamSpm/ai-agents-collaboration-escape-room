// When an objective is accomplished: a huge Creepster label slams in, hangs, then melts away like ectoplasm,
// with an evil laugh. Credits the agent whose action just completed it.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AGENTS, agentIdFromRelayName } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { evilLaugh } from "../lib/spooky";
import { portraitFor } from "../map/AgentToken";
import { OBJECTIVES } from "../panels/Objectives";

type Flash = { id: number; label: string; agent?: AgentId };

/** Short and sweet: the label holds briefly, then melts. */
const HOLD_MS = 1600;

/** The agent behind the newest successful action or message, for the credit line. */
function lastActor(world: World): AgentId | undefined {
  for (let i = world.log.length - 1; i >= 0; i--) {
    const e = world.log[i];
    if (e.kind === "action" && e.ok) return e.agent;
    if (e.kind === "message") {
      const id = agentIdFromRelayName(e.from);
      if (id) return id;
    }
  }
}

export function ObjectiveFlash({ world }: { world: World }) {
  const seen = useRef<{ runId: string; done: boolean[] } | null>(null);
  const [queue, setQueue] = useState<Flash[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const done = OBJECTIVES.map((o) => o.done(world));
    const prev = seen.current;
    seen.current = { runId: world.runId, done };
    // First world seen, a new run, or a reset: baseline only, nothing to celebrate.
    if (!prev || prev.runId !== world.runId || world.status === "lobby") return;
    const fresh = OBJECTIVES.filter((_, i) => done[i] && !prev.done[i]);
    if (!fresh.length) return;
    const agent = lastActor(world);
    setQueue((q) => [...q, ...fresh.map((o) => ({ id: nextId.current++, label: o.label, agent }))]);
  }, [world]);

  const flash = queue[0];
  useEffect(() => {
    if (!flash) return;
    evilLaugh();
    const t = setTimeout(() => setQueue((q) => q.slice(1)), HOLD_MS);
    return () => clearTimeout(t);
  }, [flash]);

  const meta = flash?.agent ? AGENTS[flash.agent] : undefined;
  const color = meta?.color ?? "#9effa1";

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.9 } }}
        >
          {/* Dim the house so the label owns the frame for a moment. */}
          <motion.div className="absolute inset-0 bg-black/15" />
          <div className="relative text-center">
            {meta && flash.agent && (
              <motion.div
                className="mb-1 flex items-center justify-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.25em]"
                style={{ color }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
                exit={{ opacity: 0 }}
              >
                <img src={portraitFor(flash.agent)} alt="" className="size-8 rounded-full border-2 object-cover object-top" style={{ borderColor: color }} />
                {meta.relayName} did it
              </motion.div>
            )}
            <motion.div
              className="font-spooky text-[92px] uppercase leading-none"
              style={{ color: "#c9ff9e", textShadow: `0 0 30px ${color}, 0 0 80px #6bff6b88, 0 6px 0 #1b3a12` }}
              initial={{ scale: 2.2, opacity: 0, filter: "blur(18px)", rotate: -4 }}
              animate={{
                scale: [2.2, 0.95, 1.04, 1],
                opacity: [0, 1, 0.75, 1, 0.85, 1],
                filter: ["blur(18px)", "blur(0px)", "blur(0px)", "blur(0px)"],
                rotate: [-4, 1.5, -0.8, 0],
                transition: { duration: 0.6, ease: "easeOut" },
              }}
              // Melts away: drips down, smears, stretches and dissolves into ectoplasm.
              exit={{
                y: 90,
                scaleY: 1.6,
                scaleX: 0.9,
                skewX: 12,
                letterSpacing: "0.35em",
                opacity: [1, 0.6, 0.85, 0],
                filter: ["blur(0px)", "blur(3px)", "blur(8px)", "blur(22px)"],
                transition: { duration: 0.9, ease: "easeIn" },
              }}
            >
              {flash.label}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
