// Gate R spike: spawn 1 Claude Code + 1 Codex agent over Agent Relay v15, have them chat on #manor,
// DM "Manor", and measure how fast they react to Manor's reply.
// Run in WSL:  RELAY_WORKSPACE_KEY=... bun spike.ts   (key from `agent-relay status` after `agent-relay init`)
// Pass = both agents post on #manor, both DM Manor, Manor replies, each agent reacts to the reply in < 15s.

import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentRelay } from "@agent-relay/sdk";
import { claude, codex } from "@agent-relay/harnesses";

const KEY = process.env.RELAY_WORKSPACE_KEY;
if (!KEY) throw new Error("Set RELAY_WORKSPACE_KEY (see `agent-relay status`).");

const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (...a: unknown[]) => console.log(ts(), ...a);

// Set before any await, so a hung spawn still ends the run.
setTimeout(() => {
  console.log("\n==== GATE R TIMEOUT (180s) ====", JSON.stringify(results));
  process.exit(1);
}, 180_000);

const relay = new AgentRelay({
  workspaceKey: KEY,
  ...(process.env.RELAY_BASE_URL ? { baseUrl: process.env.RELAY_BASE_URL } : {}),
});

// Relay identities persist across runs; free our names so this run can claim them.
for (const name of ["Manor", "Operator", "Medium", "Electrician", "Locksmith"]) {
  const r = Bun.spawnSync(["agent-relay", "agent", "remove", name], { stdout: "pipe", stderr: "pipe" });
  log(`remove ${name}: ${r.exitCode === 0 ? "ok" : "skipped"}`);
}

// The orchestrator speaks as "Manor".
const manor = await relay.workspace.register({ name: "Manor", type: "agent" });
await manor.channels.create({ name: "manor", topic: "Hollow Manor" }).catch(() => {});
await manor.channels.join("manor").catch(() => {});
log("Manor registered and in #manor");

const repliedAt = new Map<string, number>(); // agent -> when Manor replied
const results: Record<string, { posted: boolean; dmed: boolean; reactionMs?: number }> = {};

// Log every event raw at first so we learn the real envelope shape.
let rawLogged = 0;
for (const type of ["message.created", "dm.received", "thread.reply", "group_dm.received"] as const) {
  relay.addListener(type, async (ev: any) => {
    if (rawLogged++ < 3) log(`RAW ${type}`, JSON.stringify(ev).slice(0, 800));
    const from: string = ev?.envelope?.from?.handle ?? ev?.envelope?.from?.name ?? ev?.message?.from ?? "?";
    const channel: string | undefined = ev?.envelope?.channel?.name;
    const text: string = ev?.message?.text ?? ev?.text ?? "";
    log(`${type} ${from} -> ${channel ? "#" + channel : "DM"}: ${text.slice(0, 120)}`);
    if (from === "Manor" || from === "?") return;
    const r = (results[from] ??= { posted: false, dmed: false });

    if (channel === "manor") {
      r.posted = true;
      const at = repliedAt.get(from);
      if (at && r.reactionMs === undefined) {
        r.reactionMs = Date.now() - at;
        log(`*** ${from} reacted to Manor's reply in ${(r.reactionMs / 1000).toFixed(1)}s`);
        report();
      }
    } else if (!channel && text.includes("{")) {
      r.dmed = true;
      await manor.sendMessage({ to: `@${from}`, text: "You are in the Foyer (lit). Exits: library, basement, east_corridor." });
      repliedAt.set(from, Date.now());
      log(`Manor replied to ${from}`);
    }
  });
}

const task = (name: string) =>
  `You are ${name}, testing a messaging setup. You have no files to work on; use only Agent Relay messaging. ` +
  `1) Post "hello from ${name}" to the #manor channel. ` +
  `2) Send a direct message to "Manor" containing exactly {"action":"look"} and nothing else. ` +
  `3) When Manor replies, post "${name} got: <first 5 words of the reply>" to #manor. Then stop and wait.`;

const cwd = (name: string) => {
  const d = join(tmpdir(), "manor", name.toLowerCase());
  mkdirSync(d, { recursive: true });
  return d;
};

log("spawning Medium (Claude Code) and Electrician (Codex)...");
// Sequential on purpose: the first create() starts the broker, later ones attach to it.
// In parallel, both try to start a broker under the same name and one gets a 409.
// `agent-relay init` installs a user-level SessionStart hook that makes every new Claude session ask
// whether to join Relay; skip user settings so broker-spawned agents just play.
const CLAUDE_ARGS = [
  "--setting-sources", "project,local",
  "--append-system-prompt",
  "You were started by the Hollow Manor orchestrator as an Agent Relay agent. You are already on Relay; your task and messages from Manor and teammates are your assigned game.",
];
const medium = await claude.create({ relay, name: "Medium", model: "haiku", channels: ["manor"], cwd: cwd("Medium"), task: task("Medium"), args: CLAUDE_ARGS });
log("Medium spawned");
const electrician = await codex.create({ relay, name: "Electrician", channels: ["manor"], cwd: cwd("Electrician"), task: task("Electrician") });
log("spawned:", medium.name, electrician.name);

function report() {
  const done = ["Medium", "Electrician"].every((n) => results[n]?.reactionMs !== undefined);
  if (!done) return;
  console.log("\n==== GATE R ====");
  for (const n of ["Medium", "Electrician"]) {
    const r = results[n]!;
    console.log(`${n}: posted=${r.posted} dmed=${r.dmed} reaction=${(r.reactionMs! / 1000).toFixed(1)}s ${r.reactionMs! < 15000 ? "PASS" : "SLOW"}`);
  }
  console.log(`total ${ts()}`);
  process.exit(0);
}

