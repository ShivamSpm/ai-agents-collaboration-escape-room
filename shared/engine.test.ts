import { describe, expect, test } from "bun:test";
import { appendMessage, apply, findPath, isLit, look, operator, parseAction } from "./engine";
import { createWorld } from "./map";
import type { Action, AgentId, World } from "./types";

const T = 1_000;

function started(): World {
  return operator(createWorld("test"), "start", T).world;
}

/** Applies an action and asserts its outcome; returns the new world. */
function act(w: World, agent: AgentId, action: Action | unknown, expectOk = true): World {
  const r = apply(w, agent, action, T);
  if (r.ok !== expectOk) throw new Error(`${agent} ${JSON.stringify(action)}: expected ok=${expectOk}, got "${r.text}"`);
  return r.world;
}

function text(w: World, agent: AgentId, action: Action | unknown): string {
  return apply(w, agent, action, T).text;
}

/** Plays the happy path up to the code 1031 being known and the Locksmith in the corridor. */
function upToGate(): World {
  let w = started();
  w = act(w, "medium", { action: "inspect", object: "portrait" });
  w = act(w, "electrician", { action: "move", to: "basement" });
  w = act(w, "electrician", { action: "power", circuit: "B" });
  w = act(w, "medium", { action: "move", to: "library" });
  w = act(w, "medium", { action: "inspect", object: "ledger" });
  w = act(w, "locksmith", { action: "move", to: "east_corridor" });
  return w;
}

describe("happy path", () => {
  test("clues, power, gate, escape", () => {
    let w = started();
    expect(w.status).toBe("running");
    expect(text(w, "medium", { action: "inspect", object: "portrait" })).toContain("second circuit");

    w = upToGate();
    expect(isLit(w, "library")).toBe(true);
    expect(w.cluesRead).toEqual(["portrait", "ledger"]);
    expect(w.log.at(-2)).toMatchObject({ kind: "action", agent: "medium", ok: true });

    w = act(w, "locksmith", { action: "unlock", door: "crypt_gate", code: "1031" });
    expect(w.doors.crypt_gate.unlocked).toBe(true);

    w = act(w, "locksmith", { action: "move", to: "crypt" });
    w = act(w, "medium", { action: "move", to: "crypt" });
    expect(w.agents.medium.lastPath).toEqual(["library", "foyer", "east_corridor", "crypt"]);
    expect(w.status).toBe("running");
    const r = apply(w, "electrician", { action: "move", to: "crypt" }, T + 5);
    expect(r.ok).toBe(true);
    expect(r.text).toContain("escaped");
    expect(r.world.status).toBe("escaped");
    expect(r.world.endedAt).toBe(T + 5);
    expect(r.world.log.at(-1)).toMatchObject({ kind: "event", event: "escaped" });
    expect(r.world.stats).toMatchObject({ failedActions: 0, wrongCodes: 0 });
  });
});

describe("collapse and replan", () => {
  test("collapse pushes agents out of the corridor and reveals the secret door", () => {
    const r = operator(upToGate(), "collapse", T);
    expect(r.announce).toContain("East Corridor caves in");
    expect(r.world.collapsed).toBe(true);
    expect(r.world.agents.locksmith).toEqual({ room: "foyer", lastPath: ["east_corridor", "foyer"] });
    expect(r.world.doors.secret_door.revealed).toBe(true);
    expect(operator(r.world, "collapse", T).world).toBe(r.world); // second collapse is a no-op
  });

  test("bookshelf, secret door, circuit C, escape through the passage", () => {
    let w = operator(upToGate(), "collapse", T).world;
    // The keypad code is withheld: agents must ask the Operator for 0666.
    const shelf = text(w, "medium", { action: "inspect", object: "bookshelf" });
    expect(shelf).toContain("The watcher keeps this code");
    expect(shelf).not.toContain("0666");
    w = act(w, "medium", { action: "inspect", object: "bookshelf" });

    w = act(w, "locksmith", { action: "move", to: "library" });
    w = act(w, "locksmith", { action: "unlock", door: "secret_door", code: "0666" });

    // iron door still sealed while C is off
    expect(text(w, "medium", { action: "move", to: "crypt" })).toContain("magnet");
    w = act(w, "medium", { action: "move", to: "crypt" }, false);

    w = act(w, "electrician", { action: "power", circuit: "C" });
    expect(w.circuits).toEqual({ A: true, B: false, C: true });
    expect(isLit(w, "library")).toBe(false);
    expect(isLit(w, "conservatory")).toBe(true);

    w = act(w, "medium", { action: "move", to: "crypt" });
    expect(w.agents.medium.lastPath).toEqual(["library", "secret_passage", "conservatory", "crypt"]);
    w = act(w, "locksmith", { action: "move", to: "crypt" });
    w = act(w, "electrician", { action: "move", to: "crypt" });
    expect(w.agents.electrician.lastPath).toEqual(["basement", "foyer", "library", "secret_passage", "conservatory", "crypt"]);
    expect(w.status).toBe("escaped");
  });

  test("the corridor is impassable after the collapse", () => {
    const w = operator(upToGate(), "collapse", T).world;
    expect(text(w, "medium", { action: "move", to: "east_corridor" })).toContain("rubble");
    expect(findPath(w, "foyer", "crypt")).toBeNull();
    expect(look(w, "locksmith")).toContain("East Corridor (buried in rubble)");
  });
});

describe("one-circuit rule", () => {
  test("powering C switches B off and back", () => {
    let w = started();
    w = act(w, "electrician", { action: "move", to: "basement" });
    w = act(w, "electrician", { action: "power", circuit: "B" });
    const r = apply(w, "electrician", { action: "power", circuit: "C" }, T);
    expect(r.text).toContain("Circuit B cuts out");
    expect(r.world.circuits).toEqual({ A: true, B: false, C: true });
    w = act(r.world, "electrician", { action: "power", circuit: "B" });
    expect(w.circuits).toEqual({ A: true, B: true, C: false });
  });

  test("the ledger cannot be read after switching to C", () => {
    let w = started();
    w = act(w, "electrician", { action: "move", to: "basement" });
    w = act(w, "electrician", { action: "power", circuit: "C" });
    w = act(w, "medium", { action: "move", to: "library" });
    expect(text(w, "medium", { action: "inspect", object: "ledger" })).toContain("too dark");
  });
});

describe("errors", () => {
  test("actions before start are rejected without changing the world", () => {
    const w = createWorld("test");
    const r = apply(w, "medium", { action: "look" }, T);
    expect(r.ok).toBe(false);
    expect(r.world).toBe(w);
  });

  test("wrong role", () => {
    const w = started();
    expect(text(w, "locksmith", { action: "inspect", object: "portrait" })).toContain("Only the Medium");
    expect(text(w, "medium", { action: "power", circuit: "B" })).toContain("Only the Electrician");
    expect(text(w, "electrician", { action: "unlock", door: "crypt_gate", code: "1031" })).toContain("Only the Locksmith");
  });

  test("wrong room", () => {
    const w = started();
    expect(text(w, "electrician", { action: "power", circuit: "B" })).toContain("Basement");
    expect(text(w, "medium", { action: "inspect", object: "ledger" })).toContain("no ledger in the Foyer");
    expect(text(w, "locksmith", { action: "unlock", door: "crypt_gate", code: "1031" })).toContain("you are in the Foyer");
  });

  test("dark room", () => {
    let w = started();
    w = act(w, "medium", { action: "move", to: "library" });
    expect(text(w, "medium", { action: "inspect", object: "ledger" })).toContain("too dark");
    expect(look(w, "medium")).toContain("(dark)");
  });

  test("locked gate blocks movement with the reason", () => {
    const w = started();
    const t = text(w, "medium", { action: "move", to: "crypt" });
    expect(t).toContain("locked with a 4-digit code");
    expect(t).toContain("crypt_gate");
  });

  test("wrong and malformed codes", () => {
    let w = upToGate();
    const r = apply(w, "locksmith", { action: "unlock", door: "crypt_gate", code: "1234" }, T);
    expect(r.ok).toBe(false);
    expect(r.world.stats.wrongCodes).toBe(1);
    expect(r.world.stats.failedActions).toBe(1);
    expect(text(w, "locksmith", { action: "unlock", door: "crypt_gate", code: "10/31" })).toContain("4 digits");
    w = act(w, "locksmith", { action: "unlock", door: "crypt_gate", code: 1031 }); // numbers accepted too
    expect(w.doors.crypt_gate.unlocked).toBe(true);
  });

  test("hidden things do not exist before the collapse", () => {
    let w = upToGate();
    expect(text(w, "medium", { action: "inspect", object: "bookshelf" })).toContain("no bookshelf");
    expect(text(w, "medium", { action: "move", to: "secret_passage" })).toContain("no way");
    w = act(w, "locksmith", { action: "move", to: "library" });
    expect(text(w, "locksmith", { action: "unlock", door: "secret_door", code: "0666" })).toContain("no door");
    expect(look(w, "medium")).not.toContain("bookshelf");
    expect(findPath(w, "foyer", "secret_passage", true)).toBeNull();
  });

  test("non-code doors", () => {
    let w = operator(upToGate(), "collapse", T).world;
    w = act(w, "locksmith", { action: "move", to: "library" });
    expect(text(w, "locksmith", { action: "unlock", door: "foyer_library", code: "0000" })).toContain("no lock");
  });

  test("bad action shapes", () => {
    const w = started();
    expect(text(w, "medium", { action: "fly" })).toContain("Unknown action");
    expect(text(w, "medium", { action: "move", to: "attic" })).toContain("Unknown room");
    expect(text(w, "electrician", { action: "power", circuit: "A" })).toContain("B or C");
    expect(text(w, "medium", "hello")).toContain("JSON object");
  });

  test("nudge after three failures in a row", () => {
    let w = started();
    w = act(w, "medium", { action: "power", circuit: "B" }, false);
    w = act(w, "medium", { action: "power", circuit: "B" }, false);
    expect(text(w, "medium", { action: "power", circuit: "B" })).toContain("candles burn low");
    w = act(w, "medium", { action: "look" });
    expect(text(w, "medium", { action: "power", circuit: "B" })).not.toContain("candles burn low");
  });
});

describe("parsing and logging", () => {
  test("parseAction extracts the JSON from chatter", () => {
    expect(parseAction('Sure! {"action":"move","to":"library"} thanks')).toEqual({ ok: true, action: { action: "move", to: "library" } });
    expect(parseAction("let me look around").ok).toBe(false);
    expect(parseAction("{not json}").ok).toBe(false);
  });

  test("look describes room, exits, objects and company", () => {
    const t = look(started(), "medium");
    expect(t).toContain("Foyer (lit)");
    expect(t).toContain("Library via foyer_library (open)");
    expect(t).toContain("portrait");
    expect(t).toContain("Electrician, Locksmith");
  });

  test("every change bumps rev; messages count except Manor", () => {
    let w = started();
    const rev = w.rev;
    w = appendMessage(w, { from: "Medium", to: "#manor", text: "hi", private: false }, T);
    w = appendMessage(w, { from: "Manor", to: "Medium", text: "ok", private: false }, T);
    expect(w.rev).toBe(rev + 2);
    expect(w.stats.messages).toBe(1);
    expect(w.log.at(-1)).toMatchObject({ kind: "message", from: "Manor" });
  });

  test("reset returns a fresh lobby with a higher rev", () => {
    const w = upToGate();
    const r = operator(w, "reset", T).world;
    expect(r.status).toBe("lobby");
    expect(r.log).toEqual([]);
    expect(r.rev).toBe(w.rev + 1);
  });
});
