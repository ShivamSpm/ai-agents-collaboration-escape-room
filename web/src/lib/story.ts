// Turns the raw world into the story a viewer follows: the current objective, what each agent needs right now,
// and short sentences for actions. Everything is derived from real game state or real messages in the log.
import { AGENTS, DOORS, MANOR, OBJECTS, ROOMS, agentIdFromRelayName } from "../../../shared/map";
import type { Action, AgentId, LogEntry, World } from "../../../shared/types";

type Message = Extract<LogEntry, { kind: "message" }>;
type ActionEntry = Extract<LogEntry, { kind: "action" }>;

const GATE_CODE = /\b1031\b|10\s*\/\s*31/;
const SECRET_CODE = /\b0666\b/;

/** Index of the first message (not from the Manor) that carries a code, or -1. */
export function codeMessage(world: World, code: RegExp): { index: number; message?: Message } {
  for (let i = 0; i < world.log.length; i++) {
    const e = world.log[i];
    if (e.kind === "message" && e.from !== MANOR && code.test(e.text)) return { index: i, message: e };
  }
  return { index: -1 };
}

export const gateCodeKnown = (w: World) => codeMessage(w, GATE_CODE).index >= 0 || w.doors.crypt_gate.unlocked;
const read = (w: World, o: "portrait" | "ledger" | "bookshelf") => w.cluesRead.includes(o);
const inCrypt = (w: World, id: AgentId) => w.agents[id].room === "crypt";

// ---------- objective banner ----------

export type Objective = { title: string; detail: string; alarm?: boolean };

export function currentObjective(w: World): Objective {
  if (w.status === "lobby") return { title: "The manor awaits", detail: "Three agents, two AI vendors, one locked house. None can escape alone." };
  if (w.status === "escaped") return { title: "Escaped", detail: "All three agents stand in the Crypt." };

  if (w.collapsed) {
    if (!read(w, "bookshelf"))
      return w.circuits.B
        ? { title: "Escape route destroyed", detail: "Find another way to the Crypt. A bookshelf shuddered in the Library: the Medium must read it.", alarm: true }
        : { title: "Escape route destroyed", detail: "Find another way to the Crypt. The Library needs light again so the Medium can read the bookshelf.", alarm: true };
    if (!w.doors.secret_door.unlocked)
      return { title: "Open the secret door", detail: "The bookshelf hides keypad 0666. The Locksmith must enter it in the Library." };
    if (!w.circuits.C)
      return { title: "Release the iron door", detail: "The iron door obeys circuit C. The Electrician must switch over, and the Library will go dark." };
    return { title: "Reach the Crypt", detail: "Through the Secret Passage, the Conservatory and the iron door." };
  }

  if (!read(w, "portrait")) return { title: "Read the first clue", detail: "Only the Medium can read clues. The portrait in the Foyer is waiting." };
  if (!w.circuits.B && !read(w, "ledger"))
    return { title: "Find the crypt gate code", detail: "Medium needs Library light. Electrician controls the power." };
  if (!read(w, "ledger")) return { title: "Find the crypt gate code", detail: "The Library is lit. The Medium must read the ledger." };
  if (!gateCodeKnown(w)) return { title: "Ask the one who watches", detail: "The ledger's date is torn out. Only the Operator knows the night the dead walk." };
  if (!w.doors.crypt_gate.unlocked)
    return { title: "Open the crypt gate", detail: "The code is known. The Locksmith must enter it at the East Corridor." };
  return { title: "Reach the Crypt", detail: "The gate is open. All three must stand in the Crypt." };
}

// ---------- what each agent needs ----------

function lastAction(w: World, id: AgentId): ActionEntry | undefined {
  for (let i = w.log.length - 1; i >= 0; i--) {
    const e = w.log[i];
    if (e.kind === "action" && e.agent === id) return e;
  }
}

/** One line: the agent's current task or blocker. */
export function agentNeed(w: World, id: AgentId): { text: string; blocked?: boolean } {
  if (w.status === "lobby") return { text: "Asleep in the Foyer" };
  if (inCrypt(w, id)) return { text: w.status === "escaped" ? "Escaped" : "In the Crypt · waiting for the others" };
  const last = lastAction(w, id);
  if (last && !last.ok) return { text: `Blocked: ${firstSentence(last.text)}`, blocked: true };

  const room = w.agents[id].room;
  const gateKnown = gateCodeKnown(w);
  if (id === "medium") {
    if (!w.collapsed) {
      if (!read(w, "portrait")) return { text: "Reading the portrait" };
      if (!read(w, "ledger")) {
        if (!w.circuits.B) return { text: room === "library" ? "Needs light in Library" : "Heading to the Library · needs light" };
        return { text: room === "library" ? "Reading the ledger" : "Heading to the lit Library" };
      }
      if (!gateKnown) return { text: "Needs the date from the Operator" };
      return { text: told(w, GATE_CODE, "medium") ? "Code discovered · told the Locksmith" : "Code discovered · telling the Locksmith" };
    }
    if (!read(w, "bookshelf")) return { text: w.circuits.B ? "Must read the bookshelf" : "Needs light in Library" };
    if (!w.circuits.C) return { text: "Bookshelf read · code 0666 shared" };
    return { text: "Heading to the Crypt" };
  }
  if (id === "electrician") {
    const atBox = room === "basement";
    if (!w.circuits.B && !w.circuits.C) return { text: atBox ? "At fuse box · awaiting which circuit" : "Heading to the fuse box" };
    if (w.circuits.B && !w.collapsed) return { text: "Library lit · holding circuit B" };
    if (w.circuits.B && w.collapsed && !read(w, "bookshelf")) return { text: "Holding B until the bookshelf is read" };
    if (w.circuits.B && w.collapsed) return { text: atBox ? "At fuse box · ready to switch to C" : "Heading back to switch to C" };
    return { text: "Iron door released · heading to the Crypt" };
  }
  // locksmith
  if (!w.collapsed) {
    if (!gateKnown) return { text: "Needs gate code from Medium" };
    if (!w.doors.crypt_gate.unlocked) return { text: room === "east_corridor" ? "At the gate · entering the code" : "Has the code · heading to the gate" };
    return { text: "Gate open · heading to the Crypt" };
  }
  if (!read(w, "bookshelf")) return { text: "Route destroyed · needs a new way" };
  if (!w.doors.secret_door.unlocked) return { text: room === "library" ? "Entering 0666 at the secret door" : "Has code 0666 · heading to the Library" };
  return { text: w.circuits.C ? "Secret door open · heading to the Crypt" : "Secret door open · waiting for circuit C" };
}

function told(w: World, code: RegExp, from: AgentId) {
  return w.log.some((e) => e.kind === "message" && e.from === AGENTS[from].relayName && code.test(e.text));
}

/**
 * The moment a code is passed on: the newest message carrying a code to a teammate, and whose card to light up.
 * Returns a key that changes once per hand-off.
 */
export function latestHandoff(w: World): { key: string; agent: AgentId; t: number } | undefined {
  for (let i = w.log.length - 1; i >= 0; i--) {
    const e = w.log[i];
    if (e.kind !== "message" || e.from === MANOR) continue;
    const isGate = GATE_CODE.test(e.text);
    if (!isGate && !SECRET_CODE.test(e.text)) continue;
    const direct = agentIdFromRelayName(e.to);
    const agent = direct && direct !== agentIdFromRelayName(e.from) ? direct : "locksmith";
    if (agentIdFromRelayName(e.from) === agent) continue;
    return { key: `${w.runId}:${i}`, agent, t: e.t };
  }
}

// ---------- feed sentences ----------

const DOOR_LABEL: Record<string, string> = { crypt_gate: "crypt gate", secret_door: "secret door", iron_door: "iron door" };

export function firstSentence(text: string) {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

/** "Electrician entered the Basement." */
export function actionSentence(e: ActionEntry): string {
  const name = AGENTS[e.agent].relayName;
  if (!e.ok) return `${name}: ${firstSentence(e.text)}`;
  const a: Action = e.action;
  switch (a.action) {
    case "look":
      return `${name} looked around.`;
    case "move":
      return `${name} entered the ${ROOMS[a.to].name}.`;
    case "inspect":
      return `${name} read the ${OBJECTS[a.object].name.toLowerCase()}.`;
    case "power": {
      const rooms = (Object.keys(ROOMS) as (keyof typeof ROOMS)[]).filter((r) => ROOMS[r].circuit === a.circuit).map((r) => ROOMS[r].name);
      return `${name} switched on circuit ${a.circuit}: ${rooms.join(", ")} lit.`;
    }
    case "unlock":
      return `${name} unlocked the ${DOOR_LABEL[a.door] ?? DOORS[a.door].kind + " door"}.`;
  }
}

/** Clue text is story-critical, so inspect results are shown, not hidden. */
export const showResult = (e: ActionEntry) => e.ok && e.action.action === "inspect";
