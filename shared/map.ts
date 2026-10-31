// Hollow Manor map and static game data. Owned by Person A; FROZEN at 12:00 with types.ts.
// The UI renders from this; the engine plays on it. Clue TEXT lives only in engine.ts.

import type {
  AgentId,
  DoorDef,
  DoorId,
  DoorState,
  ObjectDef,
  ObjectId,
  RoomDef,
  RoomId,
  World,
} from "./types";

// ---------- config ----------

/** The fuse box powers only one of B or C at a time. Set false if it causes failed runs. */
export const ONE_CIRCUIT = true;
/** Hard cap on actions per agent per run. */
export const MAX_ACTIONS_PER_AGENT = 40;
/** After this many failed actions in a row, the Manor appends a nudge to its reply. */
export const NUDGE_AFTER_FAILED = 3;

export const GRID = { w: 16, h: 11 } as const;
export const START_ROOM: RoomId = "foyer";
export const EXIT_ROOM: RoomId = "crypt";
/** Which room an agent must stand in to use `power`. */
export const FUSE_BOX_ROOM: RoomId = "basement";

// ---------- rooms and doors ----------

export const ROOMS = {
  foyer:          { name: "Foyer",          x: 0,  y: 4, w: 6,  h: 4, circuit: "A" }, // start
  library:        { name: "Library",        x: 0,  y: 0, w: 5,  h: 4, circuit: "B" },
  secret_passage: { name: "Secret Passage", x: 5,  y: 1, w: 2,  h: 2, circuit: "C" }, // hidden until collapse
  conservatory:   { name: "Conservatory",   x: 7,  y: 0, w: 4,  h: 4, circuit: "C" },
  crypt:          { name: "Crypt",          x: 11, y: 0, w: 5,  h: 4, circuit: "A" }, // exit
  east_corridor:  { name: "East Corridor",  x: 6,  y: 4, w: 10, h: 2, circuit: "A" }, // collapses
  basement:       { name: "Basement",       x: 1,  y: 8, w: 5,  h: 3, circuit: "A" }, // fuse box
} as const satisfies Record<RoomId, RoomDef>;

export const DOORS = {
  foyer_library:        { between: ["foyer", "library"],               kind: "open",   at: { x: 2,  y: 4 } },
  foyer_basement:       { between: ["foyer", "basement"],              kind: "open",   at: { x: 3,  y: 8 } },
  foyer_corridor:       { between: ["foyer", "east_corridor"],         kind: "open",   at: { x: 6,  y: 5 } },
  crypt_gate:           { between: ["east_corridor", "crypt"],         kind: "code",   code: "1031", at: { x: 13, y: 4 } },
  secret_door:          { between: ["library", "secret_passage"],      kind: "code",   code: "0666", hiddenUntilCollapse: true, at: { x: 5, y: 2 } },
  passage_conservatory: { between: ["secret_passage", "conservatory"], kind: "open",   at: { x: 7,  y: 2 } },
  iron_door:            { between: ["conservatory", "crypt"],          kind: "magnet", circuit: "C", at: { x: 11, y: 2 } },
} as const satisfies Record<DoorId, DoorDef>;

/** Clue objects. Positions are where the UI draws the icon. */
export const OBJECTS = {
  portrait:  { name: "Portrait",  room: "foyer",   at: { x: 1, y: 5 } },
  ledger:    { name: "Ledger",    room: "library", at: { x: 1, y: 1 } },
  bookshelf: { name: "Bookshelf", room: "library", at: { x: 4, y: 1 }, hiddenUntilCollapse: true },
} as const satisfies Record<ObjectId, ObjectDef>;

// ---------- agents ----------

export const AGENT_IDS = ["medium", "electrician", "locksmith"] as const satisfies readonly AgentId[];

export const AGENTS = {
  medium:      { relayName: "Medium",      role: "Reads clues",     runsOn: "Claude Code", glyph: "eye",  color: "#a78bfa" },
  electrician: { relayName: "Electrician", role: "Controls power",  runsOn: "Codex",       glyph: "bolt", color: "#facc15" },
  locksmith:   { relayName: "Locksmith",   role: "Opens locks",     runsOn: "Codex",       glyph: "key",  color: "#2dd4bf" },
} as const satisfies Record<AgentId, { relayName: string; role: string; runsOn: string; glyph: string; color: string }>;

export const MANOR = "Manor";
export const OPERATOR = "Operator";
export const CHANNEL = "#manor";

/** Relay agent name ("Medium") to AgentId ("medium"); undefined for Manor, Operator or unknown senders. */
export function agentIdFromRelayName(name: string): AgentId | undefined {
  return AGENT_IDS.find((id) => AGENTS[id].relayName.toLowerCase() === name.toLowerCase());
}

// ---------- initial world ----------

/**
 * A fresh run in the lobby. Every agent in the Foyer, only circuit A on.
 * `unlocked` is true for open doors; code doors start locked; magnet doors pass by circuit, not `unlocked`.
 */
export function createWorld(runId: string): World {
  const doors = {} as Record<DoorId, DoorState>;
  for (const [id, def] of Object.entries(DOORS) as [DoorId, DoorDef][]) {
    doors[id] = { unlocked: def.kind === "open", revealed: !def.hiddenUntilCollapse };
  }
  return {
    runId,
    status: "lobby",
    startedAt: null,
    endedAt: null,
    agents: {
      medium:      { room: START_ROOM, lastPath: [START_ROOM] },
      electrician: { room: START_ROOM, lastPath: [START_ROOM] },
      locksmith:   { room: START_ROOM, lastPath: [START_ROOM] },
    },
    circuits: { A: true, B: false, C: false },
    doors,
    collapsed: false,
    cluesRead: [],
    stats: { actions: 0, failedActions: 0, messages: 0, wrongCodes: 0 },
    log: [],
    rev: 0,
  };
}
