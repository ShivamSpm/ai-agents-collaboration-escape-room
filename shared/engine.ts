// Hollow Manor game engine. Pure functions: (world, input) -> new world. Owned by Person A.
// The actor only calls these; LLMs never decide whether an action succeeds.
// Every function clones its input world, so callers can keep the old one.

import {
  AGENT_IDS,
  AGENTS,
  DOORS,
  EXIT_ROOM,
  FUSE_BOX_ROOM,
  MANOR,
  MAX_ACTIONS_PER_AGENT,
  NUDGE_AFTER_FAILED,
  OBJECTS,
  ONE_CIRCUIT,
  ROOMS,
  START_ROOM,
  createWorld,
} from "./map";
import type {
  Action,
  AgentId,
  ApplyResult,
  DoorDef,
  DoorId,
  EventName,
  ObjectDef,
  ObjectId,
  OperatorOp,
  OperatorResult,
  RoomId,
  World,
} from "./types";

// ---------- texts (codes live only here and in map.ts, never in prompts) ----------

export const CLUES: Record<ObjectId, string> = {
  portrait: 'Under the varnish, fresh ink: "The scholar\'s room wakes on the second circuit."',
  ledger: 'The last entry reads: "The gate remembers the night the dead walk. 10/31."',
  bookshelf:
    'A red book slides out. Behind it, a keypad marked 0666. Scratched below: "Past the glasshouse, the iron door obeys only the third circuit."',
};

export const KICKOFF =
  "You wake in the Foyer of Hollow Manor. The front door has sealed behind you. All three of you must reach the Crypt before dawn. Each of you knows something the others do not.";

export const COLLAPSE_ANNOUNCE =
  "A roar of stone. The East Corridor caves in. In the Library, a bookshelf shudders.";

export const ESCAPED_TEXT = "All three of you stand in the Crypt. You have escaped Hollow Manor!";

export const NUDGE = "The candles burn low.";

const DOOR_LABEL: Record<DoorId, string> = {
  foyer_library: "doorway",
  foyer_basement: "stairs",
  foyer_corridor: "archway",
  crypt_gate: "crypt gate",
  secret_door: "secret door",
  passage_conservatory: "doorway",
  iron_door: "iron door",
};

const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
const DOOR_IDS = Object.keys(DOORS) as DoorId[];
const OBJECT_IDS = Object.keys(OBJECTS) as ObjectId[];

// ---------- validation (use on anything parsed from an agent message) ----------

export type Validated = { ok: true; action: Action } | { ok: false; error: string };

const isRoom = (v: unknown): v is RoomId => typeof v === "string" && (ROOM_IDS as string[]).includes(v);
const isDoor = (v: unknown): v is DoorId => typeof v === "string" && (DOOR_IDS as string[]).includes(v);
const isObject = (v: unknown): v is ObjectId => typeof v === "string" && (OBJECT_IDS as string[]).includes(v);

/** Checks the shape of an action. Game rules (role, room, light) are checked later by apply(). */
export function validateAction(raw: unknown): Validated {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: 'Send one JSON object, e.g. {"action":"look"}.' };
  const a = raw as Record<string, unknown>;
  switch (a.action) {
    case "look":
      return { ok: true, action: { action: "look" } };
    case "move":
      if (!isRoom(a.to)) return { ok: false, error: `Unknown room "${String(a.to)}". Rooms: ${ROOM_IDS.join(", ")}.` };
      return { ok: true, action: { action: "move", to: a.to } };
    case "inspect":
      if (!isObject(a.object)) return { ok: false, error: `Nothing called "${String(a.object)}" can be inspected.` };
      return { ok: true, action: { action: "inspect", object: a.object } };
    case "power":
      if (a.circuit !== "B" && a.circuit !== "C")
        return { ok: false, error: "The fuse box only switches circuit B or C. Circuit A is always on." };
      return { ok: true, action: { action: "power", circuit: a.circuit } };
    case "unlock":
      if (!isDoor(a.door)) return { ok: false, error: `You know of no door called "${String(a.door)}".` };
      if (typeof a.code !== "string" && typeof a.code !== "number") return { ok: false, error: "unlock needs a 4-digit code." };
      return { ok: true, action: { action: "unlock", door: a.door, code: String(a.code) } };
    default:
      return { ok: false, error: `Unknown action "${String(a.action)}". Actions: look, move, inspect, power, unlock.` };
  }
}

/** Extracts the first {...} object from free text and validates it. */
export function parseAction(text: string): Validated {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: 'Manor only understands one JSON action, e.g. {"action":"look"}' };
  try {
    return validateAction(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return { ok: false, error: 'Manor only understands one JSON action, e.g. {"action":"look"}' };
  }
}

// ---------- queries ----------

export function isLit(world: World, room: RoomId): boolean {
  return world.circuits[ROOMS[room].circuit];
}

/** Why a door cannot be passed right now, or null if it can. Hidden doors are reported as "hidden". */
export function doorBlock(world: World, id: DoorId): string | null {
  const def: DoorDef = DOORS[id];
  const state = world.doors[id];
  if (!state.revealed) return "hidden";
  if (def.kind === "code" && !state.unlocked) return `The ${DOOR_LABEL[id]} is locked with a 4-digit code.`;
  if (def.kind === "magnet" && def.circuit && !world.circuits[def.circuit])
    return `The ${DOOR_LABEL[id]} is sealed; its magnet will not release.`;
  return null;
}

function roomBlocked(world: World, room: RoomId): boolean {
  return world.collapsed && room === "east_corridor";
}

/** Rooms that do not exist for the agents until the collapse reveals them. */
function roomHidden(world: World, room: RoomId): boolean {
  return !world.collapsed && room === "secret_passage";
}

function doorBetween(a: RoomId, b: RoomId): DoorId | undefined {
  return DOOR_IDS.find((id) => {
    const [x, y] = DOORS[id].between;
    return (x === a && y === b) || (x === b && y === a);
  });
}

/**
 * Shortest path from -> to, inclusive. With ignoreLocks, code and magnet doors count as passable
 * (hidden doors and the collapsed corridor never do). Returns null if no path.
 */
export function findPath(world: World, from: RoomId, to: RoomId, ignoreLocks = false): RoomId[] | null {
  if (from === to) return [from];
  const prev = new Map<RoomId, RoomId>([[from, from]]);
  const queue: RoomId[] = [from];
  while (queue.length) {
    const room = queue.shift()!;
    for (const id of DOOR_IDS) {
      const [a, b] = DOORS[id].between;
      if (a !== room && b !== room) continue;
      const next = a === room ? b : a;
      if (prev.has(next) || roomBlocked(world, next) || roomHidden(world, next)) continue;
      const block = doorBlock(world, id);
      if (block === "hidden" || (block && !ignoreLocks)) continue;
      prev.set(next, room);
      if (next === to) {
        const path: RoomId[] = [to];
        let cur = to;
        while (cur !== from) path.unshift((cur = prev.get(cur)!));
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

function objectVisible(world: World, id: ObjectId): boolean {
  const def: ObjectDef = OBJECTS[id];
  return !def.hiddenUntilCollapse || world.collapsed;
}

function doorStateText(world: World, id: DoorId): string {
  if (DOORS[id].kind === "open") return "open";
  const block = doorBlock(world, id);
  if (!block) return DOORS[id].kind === "code" ? "unlocked" : "open, magnet released";
  return DOORS[id].kind === "code" ? "locked, 4-digit code" : "sealed by a magnet";
}

/** What an agent sees from where it stands. */
export function look(world: World, agent: AgentId): string {
  const room = world.agents[agent].room;
  const lit = isLit(world, room);
  const exits = DOOR_IDS.filter((id) => {
    const [a, b] = DOORS[id].between;
    return (a === room || b === room) && world.doors[id].revealed && !roomHidden(world, a === room ? b : a);
  }).map((id) => {
    const [a, b] = DOORS[id].between;
    const other = a === room ? b : a;
    if (roomBlocked(world, other)) return `${ROOMS[other].name} (buried in rubble)`;
    return `${ROOMS[other].name} via ${id} (${doorStateText(world, id)})`;
  });
  const objects = OBJECT_IDS.filter((id) => OBJECTS[id].room === room && objectVisible(world, id)).map((id) =>
    lit ? id : `${id} (too dark to read)`,
  );
  const here = AGENT_IDS.filter((id) => id !== agent && world.agents[id].room === room).map((id) => AGENTS[id].relayName);
  return [
    `You are in the ${ROOMS[room].name} (${lit ? "lit" : "dark"}).`,
    `Exits: ${exits.join("; ") || "none"}.`,
    `Objects: ${objects.join(", ") || "none"}.`,
    `Here: ${here.join(", ") || "nobody else"}.`,
  ].join(" ");
}

// ---------- actions ----------

type Outcome = { ok: boolean; text: string };

function doLook(w: World, agent: AgentId): Outcome {
  return { ok: true, text: look(w, agent) };
}

function doMove(w: World, agent: AgentId, to: RoomId): Outcome {
  const from = w.agents[agent].room;
  if (from === to) return { ok: true, text: `You are already in the ${ROOMS[to].name}. ${look(w, agent)}` };
  if (roomBlocked(w, to)) return { ok: false, text: `The ${ROOMS[to].name} is buried in rubble. Find another way.` };
  if (roomHidden(w, to)) return { ok: false, text: `You know of no way to reach the ${ROOMS[to].name} from here.` };
  const path = findPath(w, from, to);
  if (!path) {
    const loose = findPath(w, from, to, true);
    if (!loose) return { ok: false, text: `You know of no way to reach the ${ROOMS[to].name} from here.` };
    for (let i = 0; i < loose.length - 1; i++) {
      const door = doorBetween(loose[i]!, loose[i + 1]!);
      const block = door && doorBlock(w, door);
      if (block) return { ok: false, text: `${block} (${door}, between ${ROOMS[loose[i]!].name} and ${ROOMS[loose[i + 1]!].name})` };
    }
    return { ok: false, text: `You know of no way to reach the ${ROOMS[to].name} from here.` };
  }
  w.agents[agent] = { room: to, lastPath: path };
  return { ok: true, text: `You move: ${path.map((r) => ROOMS[r].name).join(" -> ")}. ${look(w, agent)}` };
}

function doInspect(w: World, agent: AgentId, object: ObjectId): Outcome {
  if (agent !== "medium") return { ok: false, text: "Only the Medium can read clues. Tell the Medium where to look." };
  const room = w.agents[agent].room;
  const def = OBJECTS[object];
  if (!objectVisible(w, object) || def.room !== room) return { ok: false, text: `There is no ${object} in the ${ROOMS[room].name}.` };
  if (!isLit(w, room)) return { ok: false, text: `It is too dark in the ${ROOMS[room].name} to read. This room needs power.` };
  if (!w.cluesRead.includes(object)) w.cluesRead.push(object);
  return { ok: true, text: CLUES[object] };
}

function doPower(w: World, agent: AgentId, circuit: "B" | "C"): Outcome {
  if (agent !== "electrician") return { ok: false, text: "Only the Electrician can work the fuse box." };
  if (w.agents[agent].room !== FUSE_BOX_ROOM) return { ok: false, text: `The fuse box is in the ${ROOMS[FUSE_BOX_ROOM].name}.` };
  if (w.circuits[circuit]) return { ok: true, text: `Circuit ${circuit} is already on.` };
  const rooms = (c: "B" | "C") => ROOM_IDS.filter((r) => ROOMS[r].circuit === c).map((r) => ROOMS[r].name).join(", ");
  w.circuits[circuit] = true;
  let text = `You throw the switch. Circuit ${circuit} hums to life: ${rooms(circuit)} lit.`;
  if (ONE_CIRCUIT) {
    const other = circuit === "B" ? "C" : "B";
    if (w.circuits[other]) {
      w.circuits[other] = false;
      text += ` Circuit ${other} cuts out: ${rooms(other)} dark.`;
    }
  }
  return { ok: true, text };
}

function doUnlock(w: World, agent: AgentId, door: DoorId, code: string): Outcome {
  if (agent !== "locksmith") return { ok: false, text: "Only the Locksmith can work a lock." };
  const def: DoorDef = DOORS[door];
  if (!w.doors[door].revealed) return { ok: false, text: `You know of no door called "${door}".` };
  const room = w.agents[agent].room;
  const [a, b] = def.between;
  if (room !== a && room !== b)
    return { ok: false, text: `The ${DOOR_LABEL[door]} joins the ${ROOMS[a].name} and the ${ROOMS[b].name}; you are in the ${ROOMS[room].name}.` };
  if (def.kind === "open") return { ok: false, text: `The ${DOOR_LABEL[door]} has no lock.` };
  if (def.kind === "magnet") return { ok: false, text: `The ${DOOR_LABEL[door]} has no keypad. It is held by a magnet; it needs power.` };
  if (w.doors[door].unlocked) return { ok: true, text: `The ${DOOR_LABEL[door]} is already unlocked.` };
  if (!/^\d{4}$/.test(code)) return { ok: false, text: "The keypad takes exactly 4 digits." };
  if (code !== def.code) {
    w.stats.wrongCodes++;
    return { ok: false, text: "The keypad buzzes. Wrong code." };
  }
  w.doors[door].unlocked = true;
  return { ok: true, text: `Click. The ${DOOR_LABEL[door]} swings open.` };
}

function consecutiveFailures(w: World, agent: AgentId): number {
  let n = 0;
  for (let i = w.log.length - 1; i >= 0; i--) {
    const e = w.log[i]!;
    if (e.kind !== "action" || e.agent !== agent) continue;
    if (e.ok) break;
    n++;
  }
  return n;
}

/** Applies one agent action. Never throws on bad input; returns ok:false with a reason instead. */
export function apply(world: World, agent: AgentId, raw: Action | unknown, now = Date.now()): ApplyResult {
  if (world.status !== "running") {
    const text = world.status === "lobby" ? "The run has not started yet. Wait." : "The run is over.";
    return { world, ok: false, text };
  }
  const w = structuredClone(world);
  const v = validateAction(raw);
  const actionsSoFar = w.log.filter((e) => e.kind === "action" && e.agent === agent).length;

  let out: Outcome;
  if (!v.ok) out = { ok: false, text: v.error };
  else if (actionsSoFar >= MAX_ACTIONS_PER_AGENT) out = { ok: false, text: "Your candle has burned out. You can only talk now." };
  else {
    const a = v.action;
    switch (a.action) {
      case "look": out = doLook(w, agent); break;
      case "move": out = doMove(w, agent, a.to); break;
      case "inspect": out = doInspect(w, agent, a.object); break;
      case "power": out = doPower(w, agent, a.circuit); break;
      case "unlock": out = doUnlock(w, agent, a.door, a.code); break;
    }
  }

  w.stats.actions++;
  if (!out.ok) w.stats.failedActions++;
  const action: Action = v.ok ? v.action : ({ action: "look" } as Action);
  w.log.push({ t: now, kind: "action", agent, action, ok: out.ok, text: out.text });
  if (!out.ok && consecutiveFailures(w, agent) >= NUDGE_AFTER_FAILED) out.text += ` ${NUDGE}`;

  if (AGENT_IDS.every((id) => w.agents[id].room === EXIT_ROOM)) {
    w.status = "escaped";
    w.endedAt = now;
    w.log.push({ t: now, kind: "event", event: "escaped", text: ESCAPED_TEXT });
    out.text += ` ${ESCAPED_TEXT}`;
  }
  w.rev++;
  return { world: w, ok: out.ok, text: out.text };
}

// ---------- operator events ----------

export function operator(world: World, op: OperatorOp, now = Date.now()): OperatorResult {
  if (op === "reset") {
    const w = createWorld(world.runId);
    w.rev = world.rev + 1;
    return { world: w };
  }
  if (world.status !== "running" && !(op === "start" && world.status === "lobby")) return { world };

  const w = structuredClone(world);
  if (op === "start") {
    if (w.status !== "lobby") return { world };
    w.status = "running";
    w.startedAt = now;
    w.log.push({ t: now, kind: "event", event: "start", text: KICKOFF });
    w.rev++;
    return { world: w, announce: KICKOFF };
  }

  // collapse
  if (w.collapsed) return { world };
  w.collapsed = true;
  w.doors.secret_door.revealed = true;
  for (const id of AGENT_IDS) {
    if (w.agents[id].room === "east_corridor") w.agents[id] = { room: START_ROOM, lastPath: ["east_corridor", START_ROOM] };
  }
  w.log.push({ t: now, kind: "event", event: "collapse", text: COLLAPSE_ANNOUNCE });
  w.rev++;
  return { world: w, announce: COLLAPSE_ANNOUNCE };
}

// ---------- log helpers (chat mirroring, whispers, resume) ----------

/** Appends a Relay message to the feed. stats.messages counts everything except Manor replies. */
export function appendMessage(
  world: World,
  m: { from: string; to: string; text: string; private: boolean },
  now = Date.now(),
): World {
  const w = structuredClone(world);
  w.log.push({ t: now, kind: "message", ...m });
  if (m.from !== MANOR) w.stats.messages++;
  w.rev++;
  return w;
}

export function appendEvent(world: World, event: EventName, text: string, now = Date.now()): World {
  const w = structuredClone(world);
  w.log.push({ t: now, kind: "event", event, text });
  w.rev++;
  return w;
}
