# Hollow Manor: Build Plan

Oct 31, 2026 · @Shivam

> Team split: **Person A = Shivam** (`shared/`, `actors/`, `server/`; Windows + WSL2) · **Person B = teammate** (`web/`; macOS). See [TEAM.md](TEAM.md) for the task split, handoffs and coordination rules.
>
> **Machines:** the plan below was written for Windows + WSL2. On the Mac, run everything natively in the macOS terminal and skip every WSL step. **The demo is recorded on the teammate's Mac**, so the full stack and all agent CLIs must be installed and proven there (checklist in TEAM.md).

## How to use this plan (instructions for Claude Code)

Build Hollow Manor exactly as specified below, in the build order in the timeline section, stopping at each gate. Hacking runs 11:00am to 4:00pm on Oct 31; submission closes at 4:00pm sharp.

- Read the whole plan before writing code, then create a task list from the build order and tick items off as you go.
- **Verify every SDK call against the live docs before using it.** The Agent Relay and Durable Actors snippets here come from their docs this morning; both projects release often. Sources: [Agent Relay docs](https://agentrelay.com/docs), [Agent Relay repo](https://github.com/AgentWorkforce/relay), [Durable Actors repo](https://github.com/TerseAI/durable-actors) (read its TypeScript guide in `docs/reference/typescript-guide.md`).
- On Windows, everything runs inside WSL2 (Ubuntu), in the Linux filesystem (`~/hollow-manor`), never under `/mnt/c`. On macOS, everything runs natively. Keep code portable between the two (POSIX shell, LF line endings, no hardcoded OS paths).
- **Gates are hard stops.** If a gate fails, switch to the fallback named for it. Never spend more than 20 minutes stuck on one integration.
- Keep the game engine a pure TypeScript module with unit tests. LLMs never decide whether an action succeeds; the engine does.
- Commit after every milestone with a clear message, so you can roll back before the demo.
- Two people: Person A owns `shared/`, `actors/` and `server/`; Person B owns `web/`. Each runs their own Claude Code session in their own folder. `shared/types.ts` is frozen at 12:00; changes after that need both people to agree.
- No auth, no database besides the actor, no deployment. It runs on one laptop and is recorded.

## Project summary

**Hollow Manor: three AI agents from two vendors wake up trapped in a haunted house, and none of them can escape alone.** Each agent holds information and an ability the others lack, so they must coordinate over Agent Relay. A Durable Actor runs the house: it validates every action, keeps state that survives a server crash, and streams the world to a 2D map.

| Agent | Runs on | Can do | Knows privately |
| --- | --- | --- | --- |
| The Medium | Claude Code | Read clues (`inspect`) in lit rooms | Nothing about circuits or locks |
| The Electrician | Codex CLI | Switch circuits (`power`) from the Basement | Which circuit lights which room |
| The Locksmith | Claude Code | Enter codes (`unlock`) at doors | Which doors exist and their lock types |

The operator (you) controls the run from a panel: start it, privately whisper new instructions to any agent, and collapse the East Corridor mid-run to force a live replan.

**The demo we are building toward**, about 2 minutes, recorded at 1920x1080:

1. The agents wake in the Foyer and start sharing what they know; messages fly between them on the map.
2. The Medium reads a clue, the Electrician lights the Library, the Medium finds the gate code.
3. You whisper a private instruction to the Locksmith.
4. You collapse the East Corridor. The agents discover a secret passage and replan with a new sequence.
5. You kill the actor server. The manor goes dark, restarts, and resumes from the exact same state.
6. All three reach the Crypt. End card: time, actions, messages.

Prize fit: the hosts want projects using Durable Actors and Agent Relay, with bonus points for both; separate prizes go to the best project for each.

## Setup checklist (before 11:00, no project code)

Install and log in to everything now; write no project code until 11:00, because the rules require all code to be created at the event.

On the Mac, read "inside WSL" as "natively in the macOS terminal", skip the WSL and Windows-browser items, and put the OpenAI key in `~/.zshrc`. The Mac needs every item on this list, because it is the demo machine.

- [ ] WSL2 with Ubuntu working; open a WSL terminal and work in `~`.
- [ ] Node.js 22.19+ inside WSL (`node -v`).
- [ ] Latest Bun inside WSL (`bun --version`; the Durable Actors README currently asks for 1.4.2+).
- [ ] Claude Code installed **inside WSL** and logged in (`claude` runs and answers). A Windows install does not count: Agent Relay spawns the CLIs from WSL.
- [ ] Codex CLI installed **inside WSL** and logged in (`codex` runs and answers).
- [ ] Agent Relay CLI: `curl -fsSL https://raw.githubusercontent.com/AgentWorkforce/relay/main/install.sh | bash`, then `agent-relay --version`.
- [ ] OpenAI API key from the event credits exported in `~/.bashrc` (needed by Codex and the fallback agents).
- [ ] From a Windows browser, confirm a WSL server is reachable at `http://localhost:<port>` (run `python3 -m http.server 8000` in WSL to test).
- [ ] OBS Studio on Windows, set to record the browser window at 1920x1080, 30fps. Do one 10-second test recording.
- [ ] Windows Focus mode on (no notifications in the recording). Browser zoom 100%.
- [ ] Devpost account created and joined to the hackathon.
- [ ] Skim the Agent Relay TypeScript SDK docs and the Durable Actors TypeScript guide.

## Architecture

Three processes run in WSL: the actor runtime, the orchestrator, and the web dev server. Agents never touch game state; they message the Manor, the orchestrator forwards to the actor, and the actor decides.

```
                          WSL2 (Ubuntu)
 ┌──────────────────────────────────────────────────────────────────────┐
 │                                                                      │
 │  Medium (Claude Code)   Electrician (Codex)   Locksmith (Claude Code)│
 │        │                       │                       │             │
 │        └──────── #manor channel + DMs to "Manor" ───────┘             │
 │                                │                                     │
 │                         Agent Relay                                  │
 │                                │ onMessageReceived                   │
 │                                ▼                                     │
 │   ┌──────────────────────────────────────────────┐                   │
 │   │ server/  (Bun + Express) — orchestrator       │                   │
 │   │  relay.ts: spawns agents, sends as Manor      │                   │
 │   │  bridge.ts: parse JSON → act, mirror chat,    │                   │
 │   │             outage queue                      │                   │
 │   │  /api/socket  /api/run/*  (operator API)      │                   │
 │   └───────────────┬──────────────────────────────┘                   │
 │                   │ WebSocket: act / message / operator              │
 │                   ▼                                                  │
 │   ┌──────────────────────────────────────────────┐                   │
 │   │ actors/  (durable-actors dev)                 │                   │
 │   │  HauntedHouse actor: @Persisted World         │                   │
 │   │  calls shared/engine.ts apply() / operator()  │                   │
 │   └───────────────┬──────────────────────────────┘                   │
 │                   │ WebSocket: {type:"world", world} on every change │
 │                   ▼                                                  │
 │   ┌──────────────────────────────────────────────┐                   │
 │   │ web/  (Vite dev server)                       │                   │
 │   └───────────────┬──────────────────────────────┘                   │
 └───────────────────┼──────────────────────────────────────────────────┘
                     ▼
        Windows browser (1920x1080, recorded with OBS)
        reads world from actor socket, calls operator API on server
```

**Processes**

1. `actors/`, run with `durable-actors dev`. Defines the `HauntedHouse` actor, which holds all game state and runs the engine.
2. `server/`, Bun + Express. Starts Agent Relay, spawns the three agents, receives every Relay message, forwards action messages to the actor, replies to agents as the Manor, mirrors all chat into the actor for the UI, and exposes the operator API and the socket grant.
3. `web/`, Vite + React + TypeScript + Tailwind + framer-motion. Gets world state from the actor's WebSocket and calls the operator API.

**One action, end to end**

1. The Medium DMs the Manor: `{"action":"inspect","object":"portrait"}`.
2. The orchestrator receives it, parses the JSON, and sends `{type:"act", requestId, agent:"medium", action}` to the actor socket.
3. The actor applies it with `engine.apply()` (serialized, so concurrent actions never race), persists, broadcasts the new world to every socket, and answers `{type:"result", requestId, ok, text}`.
4. The orchestrator DMs the result text back to the Medium as the Manor.
5. The UI animates the change.

**Operator API** (server): `POST /api/socket` (actor WebSocket grant), `POST /api/run/start`, `POST /api/run/collapse`, `POST /api/run/whisper {agent, text}`, `POST /api/run/reset`, `POST /api/run/scripted` (starts the scripted bot instead of LLM agents).

**Repo layout**

```
hollow-manor/
  shared/        types.ts, map.ts, engine.ts, engine.test.ts, scripted.ts
  actors/        durable-actors project; src/actors.ts imports ../shared
  server/        index.ts, relay.ts, bridge.ts, prompts/{common,medium,electrician,locksmith}.md
  web/           Vite app: App.tsx, Map/, Feed/, OperatorBar/, overlays/
```

## Game design

Seven rooms, three roles, a 9-action happy path and a 7-action replan after the collapse. Keep it this small: a clean run must finish in under 3 minutes of real time.

**Map** (grid units on a 16 x 11 grid; put this in `shared/map.ts`, the UI renders from it):

```ts
export const ROOMS = {
  foyer:          { name: "Foyer",          x: 0,  y: 4, w: 6,  h: 4, circuit: "A" }, // start
  library:        { name: "Library",        x: 0,  y: 0, w: 5,  h: 4, circuit: "B" },
  secret_passage: { name: "Secret Passage", x: 5,  y: 1, w: 2,  h: 2, circuit: "C" }, // hidden until collapse
  conservatory:   { name: "Conservatory",   x: 7,  y: 0, w: 4,  h: 4, circuit: "C" },
  crypt:          { name: "Crypt",          x: 11, y: 0, w: 5,  h: 4, circuit: "A" }, // exit
  east_corridor:  { name: "East Corridor",  x: 6,  y: 4, w: 10, h: 2, circuit: "A" }, // collapses
  basement:       { name: "Basement",       x: 1,  y: 8, w: 5,  h: 3, circuit: "A" }, // fuse box
} as const;

export const DOORS = {
  foyer_library:        { between: ["foyer", "library"],               kind: "open",     at: { x: 2,  y: 4 } },
  foyer_basement:       { between: ["foyer", "basement"],              kind: "open",     at: { x: 3,  y: 8 } },
  foyer_corridor:       { between: ["foyer", "east_corridor"],         kind: "open",     at: { x: 6,  y: 5 } },
  crypt_gate:           { between: ["east_corridor", "crypt"],         kind: "code",     code: "1031", at: { x: 13, y: 4 } },
  secret_door:          { between: ["library", "secret_passage"],      kind: "code",     code: "0666", hiddenUntilCollapse: true, at: { x: 5, y: 2 } },
  passage_conservatory: { between: ["secret_passage", "conservatory"], kind: "open",     at: { x: 7,  y: 2 } },
  iron_door:            { between: ["conservatory", "crypt"],          kind: "magnet",   circuit: "C", at: { x: 11, y: 2 } },
} as const;
```

**Rules**

- Circuit A is always on (Foyer, East Corridor, Basement, Crypt). The fuse box can power **only one of B or C at a time** (`ONE_CIRCUIT = true` in config, so it can be switched off if it causes failed runs).
- Dark rooms are walkable, but clues can only be read in a lit room.
- `move` takes a destination room, not a single step. The engine finds a path through passable doors; it fails with a reason if none exists. A `code` door blocks until unlocked; a `magnet` door blocks unless its circuit is on; a hidden door does not exist until revealed.
- The run is won when all three agents stand in the Crypt.

**Clues** (text lives only in the engine; no prompt contains a code):

| Object | Room | Visible | Text returned to the Medium |
| --- | --- | --- | --- |
| portrait | Foyer | always | Under the varnish, fresh ink: "The scholar's room wakes on the second circuit." |
| ledger | Library | always, needs light | The last entry reads: "The gate remembers the night the dead walk. 10/31." |
| bookshelf | Library | after collapse, needs light | A red book slides out. Behind it, a keypad marked 0666. Scratched below: "Past the glasshouse, the iron door obeys only the third circuit." |

**Actions** (an agent sends exactly one JSON object per action message to the Manor):

| Action | Who | Valid when |
| --- | --- | --- |
| `{"action":"look"}` | everyone | always; returns room, lit or dark, exits and their state, objects, who is here |
| `{"action":"move","to":"library"}` | everyone | a path exists |
| `{"action":"inspect","object":"portrait"}` | Medium | same room as the object, room lit, object visible |
| `{"action":"power","circuit":"B"}` | Electrician | standing in the Basement; circuit B or C |
| `{"action":"unlock","door":"crypt_gate","code":"1031"}` | Locksmith | standing in a room the door connects; door revealed |

Anything else (wrong role, wrong room, bad JSON, wrong code) returns a short, specific error so the agent can correct itself. Wrong codes count as failed attempts on the end card.

**Happy path** (no collapse):

1. Medium inspects the portrait and tells the team "second circuit" lights the Library.
2. Electrician moves to the Basement and powers B. The Library lights up.
3. Medium moves to the Library and inspects the ledger: code 1031. Tells the Locksmith.
4. Locksmith moves to the East Corridor and unlocks the crypt gate.
5. All three move to the Crypt. Escaped.

**The collapse** (operator button, best triggered right after the code 1031 is shared and before the gate is unlocked):

- The East Corridor becomes impassable. Anyone in it is pushed back to the Foyer.
- The bookshelf becomes visible. The Manor posts to #manor: "A roar of stone. The East Corridor caves in. In the Library, a bookshelf shudders."

**Replan path** after the collapse:

1. Medium (in the Library, B still on) inspects the bookshelf: code 0666, iron door needs circuit C.
2. Locksmith moves to the Library and unlocks the secret door with 0666.
3. Electrician powers C. The Library goes dark and the Conservatory lights up. With the one-circuit rule, this must happen after the bookshelf is read; that ordering is the coordination the audience watches.
4. All three move to the Crypt through the passage, the Conservatory and the iron door. Escaped.

## Durable Actor: HauntedHouse

One `HauntedHouse` actor per run (actor id = run id, e.g. `run-3`) is the single source of truth. It persists the whole world, applies actions one at a time, and broadcasts every change.

**State** (all fields `@Persisted`; types in `shared/types.ts`):

```ts
type AgentId = "medium" | "electrician" | "locksmith";
type World = {
  runId: string;
  status: "lobby" | "running" | "escaped" | "failed";
  startedAt: number | null;
  endedAt: number | null;
  agents: Record<AgentId, { room: RoomId; lastPath: RoomId[] }>;
  circuits: { A: true; B: boolean; C: boolean };
  doors: Record<DoorId, { unlocked: boolean; revealed: boolean }>;
  collapsed: boolean;
  cluesRead: string[];            // object ids the Medium has read
  stats: { actions: number; failedActions: number; messages: number; wrongCodes: number };
  log: LogEntry[];                // every action, result, Relay message and operator event, in order
  rev: number;                    // increments on every change; shown in the UI
};
type LogEntry =
  | { t: number; kind: "action"; agent: AgentId; action: Action; ok: boolean; text: string }
  | { t: number; kind: "message"; from: string; to: string; text: string; private: boolean }
  | { t: number; kind: "event"; event: "start" | "collapse" | "whisper" | "escaped" | "resumed"; text: string };
```

**Socket protocol.** The actor follows the documented pattern (`onConnect` sends the world; `broadcast` pushes it). Incoming messages:

| Message | Sent by | Effect |
| --- | --- | --- |
| `{type:"act", requestId, agent, action}` | orchestrator | `engine.apply()`, persist, broadcast, reply `{type:"result", requestId, ok, text}` |
| `{type:"message", from, to, text, private}` | orchestrator | append to log, broadcast (the feed survives a crash too) |
| `{type:"operator", op:"start" \| "collapse" \| "reset"}` | orchestrator | apply the event, broadcast, reply with any text the Manor should announce |
| `{type:"hello"}` | web | reply with the full world |

Outgoing: `{type:"world", world}` on every change. Keep the world small (no history beyond `log`) so a full broadcast each time is fine.

**Rules for the implementation**

- All game logic lives in `shared/engine.ts` as pure functions: `apply(world, agent, action) => { world, ok, text }` and `operator(world, op) => { world, announce? }`. The actor only calls them. Unit-test the happy path, the replan path, every error case, and the one-circuit rule with `bun test`.
- Mark `onMessage` `@Interleave` only if needed for responsiveness; serialized execution is the point (two agents unlocking at once can never corrupt state). Say this in the pitch.
- Check the TypeScript guide for whether the generated client can call actor methods directly. If it can, the orchestrator may call `act()` as a method instead of using a socket; the socket protocol above is the safe default because it is the documented path.
- On load after a restart, append a `resumed` event to the log so the UI can show the "manor stirs again" overlay.
- Use the built-in observability UI while debugging; consider showing it for 2 seconds in the video as proof the state is real.

## Agent Relay: agents and orchestration

The orchestrator spawns two Claude Code agents and one Codex agent through the Relay SDK, puts them in one shared channel, and acts as the Manor: the game master they DM to take actions.

**Spawning** (`server/relay.ts`; confirm names against the current SDK docs):

```ts
import { AgentRelay, Models } from "@agent-relay/sdk";

const relay = new AgentRelay();
relay.onMessageReceived = (msg) => bridge.onRelayMessage(msg); // sees every message: from, to, text

const channels = ["manor"];
const common = await readPrompt("common.md");
await relay.claude.spawn({ name: "Medium",      model: Models.Claude.SONNET, channels, task: common + await readPrompt("medium.md") });
await relay.codex.spawn({  name: "Electrician", model: /* fastest Codex model in Models.Codex */, channels, task: common + await readPrompt("electrician.md") });
await relay.claude.spawn({ name: "Locksmith",   model: /* fastest Claude model in Models.Claude */, channels, task: common + await readPrompt("locksmith.md") });
await Promise.all(["Medium", "Electrician", "Locksmith"].map((n) => relay.waitForAgentReady(n)));
```

- Spawn each agent with an empty working directory (e.g. `/tmp/manor/<name>`), so a coding agent has no files to explore.
- Prefer speed over intelligence for every model. If the CLIs accept a reasoning-effort setting, set it low.
- Name the Manor sender: register a Relay agent called `Manor` for the orchestrator to send as, or use `relay.system().sendMessage(...)` if registering is not supported. Whisper messages are sent the same way as `Operator`.

**Action protocol**

- Agents talk to each other on `#manor`. Agents take actions by DMing `Manor` with one JSON object, nothing else.
- The orchestrator handles every message: anything addressed to `Manor` is parsed (extract the first `{...}` in the text, `JSON.parse`, validate with zod) and sent to the actor as `act`; the result text goes back to the sender as a DM from `Manor`. Every message, including Manor replies, is mirrored to the actor as `message` for the feed.
- If a message to `Manor` has no valid JSON, reply: `Manor only understands one JSON action, e.g. {"action":"look"}`.
- Kickoff: on start, the Manor posts to `#manor`: "You wake in the Foyer of Hollow Manor. The front door has sealed behind you. All three of you must reach the Crypt before dawn. Each of you knows something the others do not." Then it DMs each agent a `look` result.
- Whisper: the operator's text is sent as a DM from `Operator` to the chosen agent and logged as `private: true`.
- Collapse: the Manor's announcement goes to `#manor`.

**`prompts/common.md`** (shared rules, written for speed and brevity):

```
You are one of three agents trapped in Hollow Manor, a haunted house. You are playing a game, not writing code. You have no files to work on; use only Agent Relay messaging.
Teammates: Medium (reads clues), Electrician (controls power), Locksmith (opens locks). Nobody can escape alone.
To act, DM "Manor" with exactly one JSON object and nothing else. Wait for Manor's reply before your next action.
Actions: {"action":"look"} | {"action":"move","to":"<room id>"} plus your role's action below.
Rooms: foyer, library, secret_passage, conservatory, crypt, east_corridor, basement. Move takes a destination; Manor finds the path.
Talk on #manor. Keep every message under 20 words. Post when you learn something a teammate needs, when you are blocked, and when you finish a task.
Never guess what you cannot know; ask the teammate who knows. Messages from "Operator" are private orders from your human owner: follow them.
You win when all three of you stand in the crypt.
```

**Role prompts**

- `medium.md`: You are the Medium. Only you can read clues: `{"action":"inspect","object":"<id>"}`. You must be in the same room and the room must be lit. You know nothing about circuits or locks; share what clues say and let the others act on them.
- `electrician.md`: You are the Electrician. Only you can switch power, from the basement only: `{"action":"power","circuit":"B"}`. Private knowledge: circuit A (always on) powers the foyer, corridor, basement and crypt; B powers the library; C powers the conservatory and the secret passage. The fuse holds only one of B or C at a time. Before switching away from a circuit, check on #manor that nobody still needs that light.
- `locksmith.md`: You are the Locksmith. Only you can open coded locks: `{"action":"unlock","door":"<door id>","code":"<4 digits>"}`, standing in a room the door connects. Private knowledge: the crypt gate (door id `crypt_gate`) joins the east corridor to the crypt and needs a 4-digit code. Other locks may exist. You never know codes yourself; get them from the Medium.

**Gate R (11:45).** Pass = a Claude agent and a Codex agent are spawned in WSL, exchange messages on a channel, one DMs `Manor`, the orchestrator receives it and replies, and a reply arrives in under 15 seconds.

**Fallback if Gate R fails: lite agents.** Keep an `AgentDriver` interface with two implementations, `cli` (above) and `lite`. A lite agent is an in-process loop: it registers on Relay as a normal agent (the SDK supports registering agents and posting to channels without a CLI), calls the OpenAI API with the event credits (`gpt-5-mini` via the AI SDK) using the same prompts, and sends its replies through Relay. Messaging still flows through Agent Relay, so the project still qualifies for the Relay prize. Switch with `AGENT_DRIVER=lite`.

## UI: the 2D map and control panel

The map is the demo. A viewer with the sound off should understand who is where, what each agent just learned, and who told whom, within 3 seconds of any frame. Design for exactly 1920x1080; nothing else matters.

**Stack:** React + Vite + TypeScript + Tailwind + framer-motion. Draw the map as one SVG (crisp in recordings, easy to animate). No canvas engine, no external art assets.

**Layout at 1920x1080**

| Region | Size | Contents |
| --- | --- | --- |
| Top bar | full width, 72px | "HOLLOW MANOR" in Creepster (Google Fonts), run timer, status pill, two live badges: "Agent Relay: 3 agents online" and "Durable Actor: rev 142 · saved" |
| Map | left, about 1240px wide | the house, agents, lighting, message particles |
| Agent cards | right column, top | one card per agent: name, role icon, model chip (Claude Sonnet / Codex), current room, last action and its result |
| Relay feed | right column, below cards | every message in order: channel messages, DMs to and from the Manor, Operator whispers with a lock icon |
| Objectives strip | under the map, 56px | five chips that tick off: Library lit, Gate code found, Gate unlocked, Escape route found, Escaped |
| Operator bar | bottom, 64px, hideable | Start, Scripted run, Collapse corridor, Whisper (agent dropdown + text), Reset |

**Look and feel**

- Palette: near-black blue background (#0b0d12), walls in pale bone (#d8d2c4) at 3px, lit rooms with a warm candle glow (radial gradient, amber #f5b041 at about 18% opacity), dark rooms in deep shadow with a slight fog texture made from an SVG turbulence filter.
- Agent colors, used everywhere that agent appears (token, card, feed, particles): Medium violet #a78bfa, Electrician electric yellow #facc15, Locksmith teal #2dd4bf. Manor messages in blood red #ef4444, Operator in white.
- Agents are glowing ghost tokens (a soft circle with a role glyph: eye, bolt, key) with a name label. They float with a subtle 2px bob.
- Doors are drawn on the walls: open doors as gaps, coded doors as a small padlock that turns into an open lock, the iron door as bars that slide away when circuit C is on, the secret door invisible until revealed and then drawn with a crack-reveal animation.
- Room names in small caps inside each room; objects as small icons (portrait frame, ledger, bookshelf) that pulse once when read.

**Motion (this is what makes the demo land)**

- Moves: tokens glide along `lastPath` through door positions, about 500ms per room.
- Messages: when an agent posts, a speech bubble with the first 60 characters appears above its token for 4 seconds, and a glowing particle in the sender's color flies to each recipient's token (to all teammates for #manor, to the Manor sigil for actions). Manor replies fly from a red Manor sigil in the map's top corner.
- Power: when a circuit switches, its rooms fade between dark and lit over 400ms, with a short flicker.
- Collapse: screen shake (300ms), the corridor fills with rubble tiles and dust particles, and a red banner "THE EAST CORRIDOR HAS COLLAPSED" slides in for 3 seconds.
- Escape: tokens gather in the Crypt, the screen fades to an end card: "ESCAPED" with time, actions, messages, wrong codes, and a "Built with Agent Relay + Durable Actors" line in text (no logo images).
- Crash: when the actor socket drops, the map goes dark with "The manor has gone silent... reconnecting" and a pulsing candle. On reconnect: "The manor stirs. State restored at rev N."

**Operator controls**

- Hotkeys for clean recording: `S` start, `C` collapse, `W` focus the whisper box, `H` hide or show the operator bar.
- All operator actions also appear in the feed, so the viewer sees what you did.

**Build it against fake state first.** Person B starts by rendering a hard-coded `World` and a timer-driven fake event stream (the scripted bot's output), so the UI is finished before the agents work.

## Crash and resume moment

Mid-run, you press Ctrl+C on the `durable-actors dev` terminal, the manor goes dark, you restart it, and the run continues from the exact same state. This is the 10-second proof that Durable Actors does what it claims.

**What has to be true**

1. The actor's `@Persisted` world survives a restart of `durable-actors dev`. **Verify this at Gate D (11:45) with a counter actor before building anything on it.**
2. The web UI reconnects automatically (retry every 1 second with a fresh socket grant) and redraws from the restored world.
3. The orchestrator survives the outage: agent action messages that arrive while the actor is down are queued, not dropped, and flushed in order on reconnect. Agents just see a slower Manor reply. Never restart the orchestrator, because it owns the agents.
4. The actor appends a `resumed` event on reload, which the UI shows as "The manor stirs. State restored at rev N."

**For the recording** (on the Mac): keep the terminal visible in a corner of the screen (or cut to it), so viewers see the real Ctrl+C and restart, not a fake animation.

**Fallback if Gate D fails** (local dev does not persist across restarts): demo resilience instead by closing and reopening the browser tab mid-run (state is server-side) and by showing the observability UI with the actor's persisted state. Say less about crash recovery in the pitch; do not fake it.

## Build order and timeline

Both integrations are de-risked in the first 45 minutes, the UI is built against fake data while the agents come up, and feature work stops at 3:00. Both tools stay in scope: each gate has a fallback, so neither can sink the project.

| Time | Person A: engine, actor, agents | Person B: UI |
| --- | --- | --- |
| 11:00–11:45 | Repo + `shared/types.ts`, `map.ts`. **Spike R:** spawn 1 Claude + 1 Codex via Relay in WSL, channel chat, DM to Manor, measure reply latency. | **Spike D:** `durable-actors init`, counter actor with WebSocket, browser shows the count, Ctrl+C and restart, count survives. Then Vite app shell. |
| 11:45 | **Gate R and Gate D.** Failed gate = switch to its fallback now. Freeze `shared/types.ts` at 12:00. | same |
| 11:45–1:00 | `engine.ts` + tests (happy path, replan, errors, one-circuit rule). `scripted.ts` bot that plays both paths. `HauntedHouse` actor wired to the engine. | Map from `map.ts`: rooms, walls, doors, lighting, agent tokens, movement along paths, driven by the fake event stream. |
| 1:00–1:20 | Lunch at the desk. | Lunch at the desk. |
| 1:20–2:15 | `relay.ts` + `bridge.ts`: spawn 3 agents, action parsing, Manor replies, message mirroring, operator endpoints, outage queue. First full LLM run. | Feed panel, agent cards, objectives strip, message bubbles and particles, operator bar and hotkeys, connect to the real actor socket. |
| 2:15–3:00 | Tune prompts. Target: 5 clean runs in a row, including collapse + replan. Log every failure and fix the cause. | Collapse, power, escape and crash animations. End card. Polish to 1920x1080. |
| 3:00 | **Feature freeze.** Only bug fixes from here. | same |
| 3:00–3:25 | Record 3 full takes (OBS). | Crash rehearsal; watch takes and pick the best. |
| 3:25–3:45 | Cut the 2-minute video; Devpost write-up. | Screenshots, README, Devpost images. |
| 3:45–4:00 | **Submit by 3:50.** Buffer for upload problems. | same |

**If you end up solo:** run the Person B column as a second Claude Code session in `web/` in parallel, and drop in this order if time runs short: crash animation polish, objectives strip, agent cards (the feed covers them), whisper box (keep collapse).

## Risks and fallbacks

The biggest risk is agents being slow or looping; the second is either SDK misbehaving on WSL. Every row has a decision made in advance.

| Risk | Early sign | Fallback |
| --- | --- | --- |
| Relay CLI spawning fails or is slow on WSL | Gate R fails, or replies take over 15s | Lite agents (`AGENT_DRIVER=lite`): same prompts, OpenAI API, messages still through Relay |
| Local actor state does not survive restart | Gate D counter resets | Tab close/reopen demo + observability UI; drop the crash claim |
| Agents chatter or loop | Same message twice, or no action for 30s | Tighten prompts; the Manor appends a one-line nudge to its reply ("The candles burn low.") after 3 failed actions; cap each agent at 40 actions per run |
| Agents explore the filesystem or write code | Tool calls other than Relay messaging | Empty working directory; restate in the prompt that it is a game; restrict allowed tools in the spawn options if the SDK supports it |
| The Medium reads the bookshelf too early | n/a: it is hidden until the collapse | Already designed out |
| One-circuit rule causes failed runs | Electrician switches before the bookshelf is read | Set `ONE_CIRCUIT = false` |
| Model rate limits or credit exhaustion | 429 errors | Switch the Electrician to a Claude agent; keep runs short; stop runs you are not recording |
| Windows browser cannot reach WSL (Shivam's dev machine only) | Local page will not load | Use the WSL IP from `hostname -I` instead of localhost |
| Works on WSL but not on the Mac (demo machine) | First run on the Mac fails | Reproduce Gate R and Gate D on the Mac before 1:20; from 2:15 do every run on the Mac |
| UI scope creep | Animations unfinished at 2:45 | Freeze at 3:00; the list of what to drop is in the timeline section |
| No clean run by 3:15 | Takes keep failing | Record the scripted bot run, clearly labelled "scripted replay" on screen, plus the best partial LLM run. Never pass scripted runs off as live agents |

**Scripted bot** (`shared/scripted.ts`): plays the happy path and the replan path by sending the same actions and short messages straight to the actor, with 1-second gaps. It is used to build and test the UI without spending model calls, and as the labelled fallback above.

## Demo script and recording

A 2-minute video with your voice over it: hook, run, twist, crash, escape, why it matters. Record the run once at real speed; in the edit, speed up waits to 2x with a small "2x" label on screen so nothing looks faked.

| Time | On screen | You say (roughly) |
| --- | --- | --- |
| 0:00–0:15 | Map, agents in the Foyer, title bar | "Three AI agents, from two different companies, wake up trapped in a haunted house. None of them can escape alone: each knows something the others don't." |
| 0:15–0:45 | Start. Messages fly; portrait read; Library lights up; ledger read | "They coordinate over Agent Relay. The Medium reads a clue, the Electrician, a Codex agent, works out which circuit it means and lights the Library." |
| 0:45–0:55 | You type a whisper to the Locksmith (e.g. "Head to the corridor now, don't wait") | "Each agent has a human owner who can steer it privately, mid-run." |
| 0:55–1:15 | Press C. Shake, rubble, banner; agents replan; bookshelf; secret door | "Now I collapse their escape route. Nobody scripted what happens next: they share what they find and build a new plan." |
| 1:15–1:30 | Ctrl+C in the terminal; manor goes dark; restart; "State restored at rev N" | "The house itself is a Durable Actor. I kill the server... and the game picks up exactly where it was. Every action is applied one at a time, so three agents can never corrupt the state." |
| 1:30–1:45 | Escape and end card | "Escaped in [time], [N] messages, zero humans solving the puzzle." |
| 1:45–2:00 | End card | "Today it's a haunted house. Tomorrow it's your agent, your teammate's agent and a vendor's agent finishing real work together, with state that never gets lost." |

**Recording checklist**

- [ ] 1920x1080, browser in full screen (F11), operator bar visible only when you use it (`H`).
- [ ] Terminal ready in a corner or as a cut-in for the crash.
- [ ] Record the voice-over separately after picking the best take; it is far easier than narrating live.
- [ ] Record at least 3 full takes before 3:25.
- [ ] If chosen for live demo at 4:00–5:00, play the video and narrate over it; offer to run it live only if runs have been reliable all afternoon.

**Devpost write-up:** one-line pitch, the 2-minute video, a screenshot of the map mid-run, a short "How it works" naming both tools and what each does, and the repo link.

**Sources:** [Haunted Hacks event details](https://www.hackathonradar.com/database/hackathon/haunted-hacks-realtime-ai-edition-2026) · [Agent Relay SDK](https://socket.dev/npm/package/agent-relay/overview/3.2.15) · [Agent Relay repo](https://github.com/AgentWorkforce/relay) · [Durable Actors repo](https://github.com/TerseAI/durable-actors) · [Durable Actors README](https://raw.githubusercontent.com/TerseAI/durable-actors/main/README.md)
