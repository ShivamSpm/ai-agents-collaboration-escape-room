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

- **Gate R (Agent Relay, Person A):** _pending_ — pass = Claude + Codex agents chat on a channel, one DMs `Manor`, reply arrives in < 15s.
- **Gate D (Durable Actors, Person B):** _pending_ — pass = counter actor value survives Ctrl+C and restart of `durable-actors dev`, shown in a browser on the Mac.
- **Decisions taken:** _none yet_ (e.g. "AGENT_DRIVER=lite", "ONE_CIRCUIT=false", "dropped crash claim").

## If one of us falls behind

Drop UI items in this order: crash animation polish, objectives strip, agent cards (the feed covers them), whisper box (keep collapse). If Person A is blocked on Relay for 20 minutes, switch to lite agents; if Gate D fails, use the tab close/reopen fallback. Never fake the crash or pass a scripted run off as live.
