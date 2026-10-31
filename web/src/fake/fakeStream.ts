// Timer-driven FAKE world updates for building the UI before the actor is ready.
// Shaped exactly like shared/types.ts. Always labelled "FAKE DATA" on screen.
import { AGENTS, createWorld } from "../../../shared/map";
import type { Action, AgentId, EventName, ObjectId, RoomId, World } from "../../../shared/types";

type Step = (w: World) => void;

const now = () => Date.now();
const relay = (a: AgentId) => AGENTS[a].relayName;

function bump(w: World) {
  w.rev += 1;
}
function say(from: string, to: string, text: string, priv = false): Step {
  return (w) => {
    w.log = [...w.log, { t: now(), kind: "message", from, to, text, private: priv }];
    w.stats = { ...w.stats, messages: w.stats.messages + 1 };
  };
}
function event(name: EventName, text: string): Step {
  return (w) => {
    w.log = [...w.log, { t: now(), kind: "event", event: name, text }];
  };
}
function act(agent: AgentId, action: Action, text: string, apply?: Step): Step {
  return (w) => {
    apply?.(w);
    w.log = [
      ...w.log,
      { t: now(), kind: "message", from: relay(agent), to: "Manor", text: JSON.stringify(action), private: false },
      { t: now(), kind: "action", agent, action, ok: true, text },
      { t: now(), kind: "message", from: "Manor", to: relay(agent), text, private: false },
    ];
    w.stats = { ...w.stats, actions: w.stats.actions + 1, messages: w.stats.messages + 2 };
  };
}
const move = (agent: AgentId, path: RoomId[]) =>
  act(agent, { action: "move", to: path[path.length - 1] }, `You walk to the ${path[path.length - 1].replace("_", " ")}.`, (w) => {
    w.agents = { ...w.agents, [agent]: { room: path[path.length - 1], lastPath: path } };
  });
const inspect = (object: ObjectId, text: string) =>
  act("medium", { action: "inspect", object }, text, (w) => {
    w.cluesRead = [...w.cluesRead, object];
  });
const power = (circuit: "B" | "C") =>
  act("electrician", { action: "power", circuit }, `The fuse box hums. Circuit ${circuit} is live.`, (w) => {
    w.circuits = { A: true, B: circuit === "B", C: circuit === "C" };
  });

/** The collapse, applied by the script or early by the operator. */
export const collapse: Step = (w) => {
  if (w.collapsed) return;
  w.collapsed = true;
  w.doors = { ...w.doors, secret_door: { ...w.doors.secret_door, revealed: true } };
  const agents = { ...w.agents };
  for (const id of Object.keys(agents) as AgentId[]) {
    if (agents[id].room === "east_corridor") agents[id] = { room: "foyer", lastPath: ["east_corridor", "foyer"] };
  }
  w.agents = agents;
  event("collapse", "The East Corridor caves in.")(w);
  say("Manor", "#manor", "A roar of stone. The East Corridor caves in. In the Library, a bookshelf shudders.")(w);
};

/** Happy path into the collapse and the replan, like scripted.ts will play it. */
const SCRIPT: Step[] = [
  (w) => {
    w.status = "running";
    w.startedAt = now();
    event("start", "The run begins.")(w);
  },
  say("Manor", "#manor", "You wake in the Foyer of Hollow Manor. The front door has sealed behind you."),
  say("Medium", "#manor", "I'll read the portrait first."),
  inspect("portrait", 'Under the varnish: "The scholar\'s room wakes on the second circuit."'),
  say("Medium", "#manor", "Portrait says the second circuit wakes the scholar's room. Electrician?"),
  say("Electrician", "#manor", "B lights the library. Heading to the fuse box."),
  move("electrician", ["foyer", "basement"]),
  power("B"),
  say("Electrician", "#manor", "Library is lit."),
  move("medium", ["foyer", "library"]),
  inspect("ledger", 'The last entry: "The gate remembers the night the dead walk. 10/31."'),
  say("Medium", "#manor", "Gate code is 1031. Locksmith, the crypt gate is yours."),
  say("Operator", "Locksmith", "Head to the corridor now, don't wait.", true),
  move("locksmith", ["foyer", "east_corridor"]),
  collapse,
  say("Locksmith", "#manor", "Corridor's gone. Pushed back to the foyer. Medium, check that bookshelf?"),
  say("Locksmith", "Operator", "Operator, the corridor is rubble. Is there another way into the crypt?"),
  inspect("bookshelf", "A red book slides out. A keypad marked 0666. The iron door obeys only the third circuit."),
  say("Medium", "#manor", "Secret door code 0666. Iron door needs circuit C. Read everything, switch now."),
  move("locksmith", ["foyer", "library"]),
  act("locksmith", { action: "unlock", door: "secret_door", code: "0666" }, "The bookshelf swings open.", (w) => {
    w.doors = { ...w.doors, secret_door: { unlocked: true, revealed: true } };
  }),
  power("C"),
  say("Electrician", "#manor", "C is on. Iron door should be open. Go!"),
  move("medium", ["library", "secret_passage", "conservatory", "crypt"]),
  move("locksmith", ["library", "secret_passage", "conservatory", "crypt"]),
  move("electrician", ["basement", "foyer", "library", "secret_passage", "conservatory", "crypt"]),
  (w) => {
    w.status = "escaped";
    w.endedAt = now();
    event("escaped", "All three stand in the Crypt.")(w);
  },
];

export type FakeStream = {
  start(): void;
  collapse(): void;
  whisper(agent: AgentId, text: string): void;
  reset(): void;
  stop(): void;
};

export function createFakeStream(onWorld: (w: World) => void, stepMs = 2400): FakeStream {
  let world = createWorld("fake-run");
  let i = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const emit = (step: Step) => {
    const next = structuredClone(world);
    step(next);
    bump(next);
    world = next;
    onWorld(world);
  };
  const tick = () => {
    if (i >= SCRIPT.length) return stop();
    const step = SCRIPT[i++];
    // Skip the scripted collapse if the operator already pulled it.
    if (step === collapse && world.collapsed) return tick();
    emit(step);
  };
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };

  onWorld(world);
  return {
    start() {
      if (timer || world.status !== "lobby") return;
      tick();
      timer = setInterval(tick, stepMs);
    },
    collapse() {
      if (world.status === "running") emit(collapse);
    },
    whisper(agent, text) {
      emit(say("Operator", relay(agent), text, true));
    },
    reset() {
      stop();
      i = 0;
      world = { ...createWorld("fake-run"), rev: world.rev + 1 };
      onWorld(world);
    },
    stop,
  };
}
