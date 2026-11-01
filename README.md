# Hollow Manor

**Three AI agents from two vendors wake up trapped in a haunted house. None of them can escape alone.**

Each agent holds knowledge and an ability the others lack, so they have to coordinate in real time to get out. A crash-proof game server referees every move, and a live 2D map shows the whole thing as it happens.

Built in 5 hours at **Haunted Hacks: Realtime AI Edition** (Oct 31, 2026) by a team of two.

<!-- Screenshot: put the image at docs/screenshots/hero.png, then remove this comment line and the one below. -->
<!-- ![Hollow Manor mid-run: agents coordinating on the map with the live Relay feed](docs/screenshots/hero.png) -->

<!-- Demo video: replace this comment with a line like  **[▶ Watch the 2-minute demo](https://...)** -->

## How it works

| Agent | Runs on | Can do | Knows privately |
| --- | --- | --- | --- |
| Medium | Claude Code | Read clues in lit rooms | Nothing about circuits or locks |
| Electrician | Codex CLI | Switch the house's power | Which circuit lights which room |
| Locksmith | Codex CLI | Enter door codes | Which doors exist and how they lock |

- The agents are real CLI coding agents, started as separate processes. They talk to each other over **Agent Relay** (a shared `#manor` channel), and take actions by sending one JSON command to "the Manor".
- The Manor is a **Durable Actor** that owns the entire game state. It validates every action with a deterministic rules engine and streams the world to the browser.
- A human operator can steer the run live: whisper private orders by text or voice, answer the agents when they ask for help, or collapse a corridor mid-run to force a replan.

## Engineering highlights

- **LLMs never decide outcomes.** All game rules live in a pure TypeScript engine (`shared/engine.ts`) with 21 unit tests covering the happy path, the replan path, the one-circuit power rule and every error case. Agents propose; the engine decides.
- **Crash-safe by design.** Every action is applied one at a time inside the actor and persisted. Kill the actor server mid-run, restart it, and the run resumes from the exact same state. Meanwhile the orchestrator queues agent actions in order during the outage and flushes them on reconnect, so nothing is lost or duplicated. Verified: an interrupted run finished with the same 13 actions and 24 messages as an uninterrupted one.
- **Real multi-vendor coordination.** Claude Code and Codex agents with different knowledge share discoveries, ask each other questions and sequence their actions. For example, the Electrician waits for the Medium to finish reading before cutting the Library's power.
- **Hardened against brand-new SDKs.** Agent Relay's current release (v15) differed from its docs, so the integration was built and debugged against the installed packages: one-at-a-time agent spawning, freeing agent identities between runs, routing teammates' messages to agents that would otherwise miss them, and retrying through actor outages.
- **Designed for a recorded demo.** A presentation mode strips the screen to what a viewer needs: an objective banner driven by real game state, a story-first activity feed, per-agent "what I need right now" cards, and character voices.

## Results

| Run | Outcome |
| --- | --- |
| Live agents, no interruptions | Escaped in **36 s**, 15 actions, 0 failed |
| Live agents, corridor collapsed mid-run | Replanned via a secret passage and escaped in **90 s**, 21 actions, 0 failed |
| Actor server killed mid-run and restarted | Resumed at the same state and escaped; no actions lost or duplicated |

<!-- Optional screenshots: docs/screenshots/collapse.png (the replan) and docs/screenshots/escaped.png (the end card). Same pattern as above. -->

## Architecture

```
 Medium (Claude Code)    Electrician (Codex)    Locksmith (Codex)
            \                    |                    /
             └──── Agent Relay: #manor + DMs to "Manor" ────┘
                                 │
                 server/  orchestrator (Bun)
                 spawns agents · parses actions · outage queue · operator API
                                 │  method calls
                 actors/  HauntedHouse Durable Actor
                 persisted world · calls shared/engine.ts · one action at a time
                                 │  WebSocket: full world on every change
                 web/     React map UI (Vite, Tailwind, Motion)
```

**Stack:** TypeScript · Bun · React · Vite · Tailwind · Motion · Agent Relay · Durable Actors · Claude Code · Codex CLI · ElevenLabs (voices) · OpenAI (speech to text)

## My role

<!-- Edit this section to match how you want to describe the split. -->
I owned the backend: the game engine and its tests, the HauntedHouse Durable Actor, and the orchestrator that spawns the agents over Agent Relay, turns their messages into game actions, survives actor crashes and exposes the operator API. I also ran both integration gates and the live-agent testing. My teammate built the web UI (map, animations, voices, operator controls), and we both shaped the final demo experience.

## Run it locally

Needs Bun, Node 22+, Claude Code and Codex logged in, and the Agent Relay and Durable Actors CLIs. Full setup, a manual test plan and troubleshooting are in **[DEMO.md](DEMO.md)**.

```bash
cd actors && bun install && terse actor dev                  # 1. the actor (game state)
cd server && bun install && bun run generate && ./run.sh     # 2. the orchestrator + agents
cd web && bun install && bun run dev                         # 3. open http://localhost:5173/?mode=live
```

## Repo layout

```
shared/   types, map, rules engine + tests, scripted replay bot
actors/   HauntedHouse Durable Actor
server/   orchestrator: Agent Relay agents, Manor bridge, operator API, agent prompts
web/      the map UI
```

Planning docs from the hackathon: [PLAN.md](PLAN.md) (the build plan), [TEAM.md](TEAM.md) (how two people and their AI coding agents split the work).
