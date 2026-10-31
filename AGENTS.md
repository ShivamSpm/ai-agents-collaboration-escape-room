# Hollow Manor — agent instructions

Hackathon project (Haunted Hacks, Oct 31 2026; submission closes 4:00pm). Three AI agents coordinate over Agent Relay to escape a haunted house run by a Durable Actor, shown on a 2D map.

**Read before doing anything:**
1. [PLAN.md](PLAN.md) — the full spec: game design, actor, Relay orchestration, UI, timeline, gates, fallbacks. Build exactly what it says, in its build order.
2. [TEAM.md](TEAM.md) — who owns which folder, the interface contract between halves, handoff times, gate status.

**Find out which person you are working for** (ask if unclear):
- **Person A (Shivam):** owns `shared/`, `actors/`, `server/`, `spikes/relay/`.
- **Person B (teammate):** owns `web/`, `spikes/durable-counter/`.

**Hard rules**
- Edit only files in your person's folders. Never edit the other person's folders; ask instead.
- `shared/types.ts` is frozen at 12:00; changing it afterwards needs both people's agreement.
- Everything runs in WSL2 (Ubuntu) in the Linux filesystem (`~/hollow-manor`), not under `/mnt/c`.
- Verify every Agent Relay and Durable Actors API against the live docs before using it (links in PLAN.md); the snippets in the plan may be out of date.
- Game logic lives only in `shared/engine.ts` as pure, unit-tested functions (`bun test`). LLMs never decide whether an action succeeds.
- Gates are hard stops; on failure switch to the named fallback. Never spend more than 20 minutes stuck on one integration.
- `git pull --rebase` before every push. Commit after every milestone with a clear message.
- When a gate result or a fallback decision is known, update the "Gate status" section of TEAM.md and push it.
- No auth, no database besides the actor, no deployment. Never fake the crash demo or present a scripted run as live agents.
