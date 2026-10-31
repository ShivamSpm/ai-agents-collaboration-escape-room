// Scripted bot: plays the happy path, the collapse and the replan with no LLMs.
// Used to build and test the UI, and as the labelled "scripted replay" fallback. Never present it as live agents.
// It drives the same sink the orchestrator uses, so the feed looks exactly like a real run.

import { AGENTS, CHANNEL, MANOR } from "./map";
import type { Action, AgentId, OperatorOp } from "./types";

export type ScriptStep =
  | { kind: "say"; from: AgentId; text: string; to?: string }
  | { kind: "act"; agent: AgentId; action: Action }
  | { kind: "op"; op: Exclude<OperatorOp, "start" | "reset"> };

/** What the bot needs from whoever runs it (the server, or a test). */
export type ScriptSink = {
  act(agent: AgentId, action: Action): Promise<{ ok: boolean; text: string }>;
  message(from: string, to: string, text: string, isPrivate: boolean): Promise<void>;
  operator(op: OperatorOp): Promise<{ announce: string | null }>;
};

const say = (from: AgentId, text: string): ScriptStep => ({ kind: "say", from, text });
const act = (agent: AgentId, action: Action): ScriptStep => ({ kind: "act", agent, action });

/** The full demo story. Assumes the run is already started. */
export const SCRIPT: ScriptStep[] = [
  act("medium", { action: "inspect", object: "portrait" }),
  say("medium", "Portrait: the scholar's room wakes on the second circuit. Electrician?"),
  say("electrician", "Second circuit is B, it powers the library. Heading to the basement."),
  act("electrician", { action: "move", to: "basement" }),
  act("electrician", { action: "power", circuit: "B" }),
  say("electrician", "Circuit B is on. The library is lit."),
  act("medium", { action: "move", to: "library" }),
  act("medium", { action: "inspect", object: "ledger" }),
  say("medium", "Ledger is torn: only the one who watches knows the gate number. Asking the Operator."),
  say("medium", "Operator says 1031. Locksmith, try 1031 on crypt_gate."),
  say("locksmith", "On my way to the east corridor."),
  act("locksmith", { action: "move", to: "east_corridor" }),
  { kind: "op", op: "collapse" },
  say("locksmith", "Corridor caved in, I'm back in the foyer. Medium, check that bookshelf."),
  act("medium", { action: "inspect", object: "bookshelf" }),
  say("medium", "Bookshelf: a hidden door, its code scratched out. Asking the Operator. Iron door needs the third circuit."),
  say("medium", "Operator says 0666. Locksmith, the secret door is yours."),
  say("electrician", "Third circuit is C. It will darken the library; tell me when you're done there."),
  act("locksmith", { action: "move", to: "library" }),
  act("locksmith", { action: "unlock", door: "secret_door", code: "0666" }),
  say("locksmith", "Secret door open."),
  say("medium", "I have what I need. Electrician, switch to C."),
  act("electrician", { action: "power", circuit: "C" }),
  say("electrician", "C is on. Conservatory lit, iron door released. Go!"),
  act("medium", { action: "move", to: "crypt" }),
  act("locksmith", { action: "move", to: "crypt" }),
  act("electrician", { action: "move", to: "crypt" }),
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Plays SCRIPT against the sink with a gap between steps. Each action is mirrored to the feed as a DM to
 * Manor plus Manor's reply, like the orchestrator does for real agents. Stops early if `signal` aborts.
 */
export async function runScript(sink: ScriptSink, opts: { delayMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  const delay = opts.delayMs ?? 1000;
  for (const step of SCRIPT) {
    if (opts.signal?.aborted) return;
    if (step.kind === "say") {
      await sink.message(AGENTS[step.from].relayName, step.to ?? CHANNEL, step.text, false);
    } else if (step.kind === "act") {
      const name = AGENTS[step.agent].relayName;
      await sink.message(name, MANOR, JSON.stringify(step.action), false);
      const r = await sink.act(step.agent, step.action);
      await sink.message(MANOR, name, r.text, false);
    } else {
      const r = await sink.operator(step.op);
      if (r.announce) await sink.message(MANOR, CHANNEL, r.announce, false);
    }
    await sleep(delay);
  }
}
