# Hollow Manor: Team Split

Two people, two Claude Code (or Codex) sessions, one repo. The full spec is [PLAN.md](PLAN.md); this file says who builds what, when the two halves meet, and how we avoid stepping on each other.

| | Person A: **Shivam** | Person B: **teammate** |
| --- | --- | --- |
| Machine | Windows 11 + WSL2 (Ubuntu) | macOS (native) · **demo machine** |
| Owns | `shared/`, `actors/`, `server/`, `spikes/relay/` | `web/`, `spikes/durable-counter/` |
| In one line | Game engine, Durable Actor, Agent Relay orchestrator, prompts | The 2D map, feed, cards, operator bar, animations, end card |
| Gate | **Gate R** (Agent Relay spike) | **Gate D** (Durable Actors persistence spike) |
| After 3:00 | Operate the runs during takes (start, whisper, collapse, crash), cut video, Devpost write-up | Drives OBS on the Mac, crash rehearsal, pick best take, screenshots, README, Devpost images |

## Setup

```bash
git clone https://github.com/ShivamSpm/ai-agents-collaboration-escape-room.git ~/hollow-manor
cd ~/hollow-manor
```

- **Shivam (Windows):** run the clone and everything else inside a WSL terminal, in the Linux filesystem, never under `/mnt/c`.
- **Teammate (Mac):** run it in the normal macOS terminal. No WSL. Install Bun, Node 22.19+ and Durable Actors natively.

## Demo machine: the Mac

The video is recorded on the teammate's Mac, so the **whole stack must run there**, not only `web/`:

- [ ] On the Mac, install and log in to Claude Code, Codex CLI and the Agent Relay CLI (`agent-relay --version`), and export the OpenAI event key in the shell profile (`~/.zshrc`). Do this early, in a spare minute before 1:00, not at 2:15.
- [ ] OBS (or the macOS screen recorder) set to 1920x1080, 30fps; one 10-second test recording. Focus / Do Not Disturb on.
- [ ] Rerun the Gate D counter check **on the Mac** (it already runs there if the spike was done on the Mac).
- [ ] Rerun the Gate R relay spike **on the Mac** once (`spikes/relay/`, ~5 minutes) after Shivam pushes it, so CLI spawning is proven on the demo machine.
- [ ] From ~2:15, all prompt-tuning runs and every recorded take happen on the Mac. Shivam pushes fixes; the Mac pulls and reruns.

Each of us runs the full stack locally while developing. Do not point the Mac UI at Shivam's WSL backend over the network; WSL networking makes that unreliable. Before ~1:00 the teammate only needs `web/` with fake data; after that, the actor + server with the scripted bot (`POST /api/run/scripted`), which needs no LLMs.

## Ownership rules

- **Only edit files in folders you own.** If you need a change in the other person's folder, ask them (chat, or an issue). This keeps our two agent sessions from producing merge conflicts.
- `shared/types.ts` and `shared/map.ts` are written by Person A and **frozen at 12:00**. After that, a change needs both people to agree; announce it before pushing.
- Person B *reads* from `shared/` (imports types, `ROOMS`, `DOORS`, and later `scripted.ts`) but never writes to it.
- Both commit straight to `main`, small and often. Always `git pull --rebase` before `git push`. Commit after every milestone.

## Interface contract (what web/ can rely on)

All of these are specified in PLAN.md; this is the short list Person B builds against.

| Contract | Owner | Where specified |
| --- | --- | --- |
| `World`, `LogEntry`, `AgentId`, `RoomId`, `DoorId`, `Action` types | A | `shared/types.ts` (PLAN.md › Durable Actor: State) |
| `ROOMS`, `DOORS` with grid coords (16 x 11 grid) | A | `shared/map.ts` (PLAN.md › Game design: Map) |
| Actor socket: web sends `{type:"hello"}`, receives `{type:"world", world}` on every change | A | PLAN.md › Socket protocol |
| `POST /api/socket` returns an actor WebSocket grant; retry every 1s on drop | A | PLAN.md › Operator API, Crash and resume |
| `POST /api/run/start`, `/collapse`, `/whisper {agent,text}`, `/reset`, `/scripted` | A | PLAN.md › Operator API |
| `resumed` event in `world.log` after an actor restart | A | PLAN.md › Crash and resume |

**Pushed and ready to import** (`shared/types.ts`, `shared/map.ts`): beyond the plan, `map.ts` also gives the UI `OBJECTS` (clue icon positions), `AGENTS` (relay name, role, model, glyph, color), `createWorld(runId)` (a valid lobby `World` for fake state), and `ONE_CIRCUIT` / `MAX_ACTIONS_PER_AGENT` config. `ActorIn`/`ActorOut` type the socket messages; operator messages carry a `requestId` and get an `operatorResult` reply.

**Ports (proposed, change together if the tools pick others):** web (Vite) `5173`, server (Express) `3001`, actor runtime: whatever `durable-actors dev` uses by default. Vite proxies `/api` to `localhost:3001`.

## Handoffs (when the halves meet)

| Time | From → To | What is handed over |
| --- | --- | --- |
| ~11:30 | A → B | First push of `shared/types.ts` + `shared/map.ts`, so B can render the map from real data. |
| 11:45 | B → A | **Gate D result** (fill in below): does `@Persisted` state survive Ctrl+C + restart? How does a browser get a socket grant and connect? Exact client import names. A builds `actors/` on these findings. |
| 11:45 | A → B | **Gate R result** (fill in below): does Relay CLI spawning work, or are we on `AGENT_DRIVER=lite`? |
| 12:00 | A | `shared/types.ts` frozen. |
| ~1:00 | A → B | `HauntedHouse` actor runnable + `shared/scripted.ts`. B switches from the fake event stream to the real actor socket, driven by the scripted bot (`POST /api/run/scripted`). |
| by 1:20 | A → B | Relay spike reproduced on the Mac (demo machine). |
| ~2:15 | A → B | First full LLM run, **on the Mac**. B checks every animation against real agent timing. |
| 3:00 | both | **Feature freeze.** Bug fixes only. |

Until ~1:00, Person B builds against a hard-coded `World` and a timer-driven fake event stream inside `web/` (e.g. `web/src/fake/`), shaped exactly like `shared/types.ts`. Delete or keep it behind a flag once the real socket works.

## Gate status (update and push when known)

- **Gate R (Agent Relay, Person A):** **PASS (12:45, WSL, Agent Relay 15.0.1)**: Medium (Claude Code, haiku) and Electrician (Codex) each posted on `#manor`, DMed `Manor` a JSON action, and reacted to Manor's reply in 3.0s and 3.9s; whole run 20s. CLI agents stay (no lite fallback). Spike: [spikes/relay/spike.ts](spikes/relay/spike.ts). Setup on the Mac, once: install the CLI, then `agent-relay init` (local server on `127.0.0.1:8787`, key in `~/.agentworkforce/relay/workspaces.json`). Gotchas the code already handles: spawn agents one at a time; free agent names at startup; start Claude agents with `--setting-sources project,local` (init's global SessionStart hook otherwise makes them stop and ask whether to join Relay); kill leftover `agent-relay-broker` processes after a run.
- **Gate D (Durable Actors, Person B):** **PASS (11:40, on the Mac with `terse actor dev`)**: the counter survived Ctrl+C and restart, and the browser reconnected by itself. Backend calls `actors.X.prepareWebsocket({ actorId, metadata })` → `{ websocketUrl }`, and direct method calls (`actors.X.get(id).method()`) also work. Details: [spikes/durable-counter/FINDINGS.md](spikes/durable-counter/FINDINGS.md).
- **Decisions taken:**
  - **Locksmith runs on Codex, not Claude** (13:20). Relay 15 never wakes an idle broker-spawned Claude agent, so a Claude Locksmith stalled once it had the code. Lineup: Medium = Claude Code (Sonnet), Electrician = Codex, Locksmith = Codex. Still two vendors. Override per agent with `MEDIUM_CLI` / `ELECTRICIAN_CLI` / `LOCKSMITH_CLI` = `claude` | `codex`. `shared/map.ts` now says `runsOn: "Codex"` for the Locksmith (agreed by both, 13:35), so the agent card chip matches.
  - Claude agents are told to stay in their turn (sleep 3s + check inbox) while waiting, and Manor forwards teammates' `#manor` posts to them; both are workarounds for the same Relay wake-up gap.
  - "Resumed" is logged by the orchestrator after a real actor outage, not by the actor (the runtime unloads idle actors, which looked like restarts).
  - Collapse timing: agents are fast (happy path escapes in ~36s; code found ~28s, gate unlocked ~31s). Press Collapse ~20s in, right after the Medium moves to the Library; the replan still works.

## Live results (WSL, 13:30)

| Run | Result |
| --- | --- |
| Scripted replay | escaped, 13 actions, 0 failed |
| Scripted + actor killed (SIGINT) mid-run and restarted | resumed and escaped; same 13 actions / 24 messages as an uncrashed run, nothing lost or duplicated |
| Live agents, happy path | **escaped in 36s**, 15 actions, 0 failed |
| Live agents, collapse at 22s | **escaped in 90s**, 21 actions, 0 failed; bookshelf read at 52s, secret door at 62s, circuit C at 81s (after the bookshelf, as designed) |

## Running the full stack (Mac or WSL)

One-time: Bun, Node 22, Claude Code and Codex logged in, `OPENAI_API_KEY` set, `bunx terse-cli@latest install`, the Agent Relay CLI installer, then `agent-relay init`.

```bash
cd actors && bun install && terse actor dev                  # terminal 1: Ready http://127.0.0.1:7100 (first build ~70s)
cd server && bun install && bun run generate && ./run.sh     # terminal 2: orchestrator on :3001 (run.sh restarts it after a reset)
cd web && bun install && bun run dev                         # terminal 3: open http://localhost:5173/?mode=live
```

- Start, Scripted, Collapse, Whisper and Reset all work against the real actor. Reset after a live run restarts the orchestrator on purpose (Relay won't re-register Manor in the same process); `run.sh` brings it back in ~2s.
- **For the UI:** a scripted run logs an extra `start` event with text starting `SCRIPTED REPLAY`; please show a "SCRIPTED REPLAY" badge when you see it. The browser gets `{type:"world", world}` on connect and on every change, as the README expects.
- Crash demo: Ctrl+C on terminal 1, then rerun `terse actor dev`. Never restart terminal 2 mid-run.

## If one of us falls behind

Drop UI items in this order: crash animation polish, objectives strip, agent cards (the feed covers them), whisper box (keep collapse). If Person A is blocked on Relay for 20 minutes, switch to lite agents; if Gate D fails, use the tab close/reopen fallback. Never fake the crash or pass a scripted run off as live.
