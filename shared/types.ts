// Hollow Manor shared types. Owned by Person A; FROZEN at 12:00 (changes need both people).
// Imported by actors/, server/ and web/. No runtime dependencies, types only.

// ---------- ids ----------

export type AgentId = "medium" | "electrician" | "locksmith";

export type RoomId =
  | "foyer"
  | "library"
  | "secret_passage"
  | "conservatory"
  | "crypt"
  | "east_corridor"
  | "basement";

export type DoorId =
  | "foyer_library"
  | "foyer_basement"
  | "foyer_corridor"
  | "crypt_gate"
  | "secret_door"
  | "passage_conservatory"
  | "iron_door";

export type ObjectId = "portrait" | "ledger" | "bookshelf";

export type CircuitId = "A" | "B" | "C";

/** Circuits the Electrician can switch. A is always on. */
export type SwitchableCircuit = "B" | "C";

// ---------- map definitions (values live in map.ts) ----------

export type Point = { x: number; y: number };

export type RoomDef = {
  name: string;
  /** Grid units on the 16 x 11 grid. */
  x: number;
  y: number;
  w: number;
  h: number;
  circuit: CircuitId;
};

export type DoorKind = "open" | "code" | "magnet";

export type DoorDef = {
  between: readonly [RoomId, RoomId];
  kind: DoorKind;
  /** Only for kind "code". */
  code?: string;
  /** Only for kind "magnet": the door passes only while this circuit is on. */
  circuit?: CircuitId;
  /** Door does not exist until the corridor collapses. */
  hiddenUntilCollapse?: boolean;
  /** Position on the wall, in grid units. */
  at: Point;
};

export type ObjectDef = {
  name: string;
  room: RoomId;
  /** Icon position, in grid units. */
  at: Point;
  /** Only readable after the collapse. */
  hiddenUntilCollapse?: boolean;
};

// ---------- actions (what agents DM to "Manor") ----------

export type Action =
  | { action: "look" }
  | { action: "move"; to: RoomId }
  | { action: "inspect"; object: ObjectId }
  | { action: "power"; circuit: SwitchableCircuit }
  | { action: "unlock"; door: DoorId; code: string };

export type ActionName = Action["action"];

// ---------- world (the HauntedHouse actor's persisted state) ----------

export type RunStatus = "lobby" | "running" | "escaped" | "failed";

export type AgentState = {
  room: RoomId;
  /** Rooms walked through on the last move, start to end inclusive. The UI animates along it. */
  lastPath: RoomId[];
};

export type DoorState = { unlocked: boolean; revealed: boolean };

export type Stats = {
  actions: number;
  failedActions: number;
  messages: number;
  wrongCodes: number;
};

export type EventName = "start" | "collapse" | "whisper" | "escaped" | "resumed";

export type LogEntry =
  | { t: number; kind: "action"; agent: AgentId; action: Action; ok: boolean; text: string }
  /**
   * from/to are Relay names: "Medium" | "Electrician" | "Locksmith" | "Manor" | "Operator",
   * or "#manor" for the channel (to only).
   */
  | { t: number; kind: "message"; from: string; to: string; text: string; private: boolean }
  | { t: number; kind: "event"; event: EventName; text: string };

export type World = {
  runId: string;
  status: RunStatus;
  startedAt: number | null;
  endedAt: number | null;
  agents: Record<AgentId, AgentState>;
  circuits: { A: true; B: boolean; C: boolean };
  doors: Record<DoorId, DoorState>;
  collapsed: boolean;
  /** Object ids the Medium has read. */
  cluesRead: ObjectId[];
  stats: Stats;
  /** Every action, result, Relay message and operator event, in order. */
  log: LogEntry[];
  /** Increments on every change; shown in the UI. */
  rev: number;
};

// ---------- engine signatures (implemented in engine.ts) ----------

export type ApplyResult = { world: World; ok: boolean; text: string };

/** "start" | "collapse" | "reset" go through the engine; whispers are plain messages. */
export type OperatorOp = "start" | "collapse" | "reset";

export type OperatorResult = { world: World; announce?: string };

// ---------- actor socket protocol ----------

/** Messages sent TO the HauntedHouse actor socket. */
export type ActorIn =
  | { type: "act"; requestId: string; agent: AgentId; action: Action }
  | { type: "message"; from: string; to: string; text: string; private: boolean }
  | { type: "operator"; requestId: string; op: OperatorOp }
  | { type: "hello" };

/** Messages sent FROM the actor socket. */
export type ActorOut =
  | { type: "world"; world: World }
  | { type: "result"; requestId: string; ok: boolean; text: string }
  | { type: "operatorResult"; requestId: string; op: OperatorOp; announce?: string };

// ---------- operator HTTP API (server/) ----------

export type WhisperBody = { agent: AgentId; text: string };

/** Generic reply from POST /api/run/* endpoints. */
export type RunResponse = { ok: boolean; error?: string };

// POST /api/socket returns whatever Durable Actors' socket grant looks like.
// Shape TBD after Gate D; web/ should treat it as opaque and pass it to the actor client.
