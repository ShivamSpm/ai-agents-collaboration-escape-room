# Gate D: Durable Actors persistence spike

**Result: PASS** (Oct 31, 11:40, macOS, terse-cli 0.14.9 / terse-sdk 0.14.9, Bun 1.4.4)

`Counter[gate-d]` went 5 → 7 from the browser, the actor server was stopped with SIGINT (same as Ctrl+C; port 7100 closed), restarted, and the value was still 7. The browser page reconnected on its own with a fresh grant and kept counting (8).

## What we used

- CLI: `terse` (`bunx terse-cli@latest install`). npm also has a `durable-actors` package (0.14.6) with a `durable-actors` bin, which is presumably what PLAN.md's `durable-actors dev` refers to. We did not try it.
- Scaffold: `terse init durable-counter --template counter` gives `actor/` (the actor) and `client/` (a backend that calls it). `--non-interactive` needs a prior `terse auth login`.
- Run: `cd actor && terse actor dev` prints `Ready http://127.0.0.1:7100`. **The first start took about 70s to compile**; start it early.
- Client: `cd client && terse actor generate` writes `client/generated/`. Re-run it after changing actor methods or state.

## Answers for Person A

- **Persistence:** `@Persisted` fields live in `actor/.durable-actors/` (SQLite). They survive a stop and restart of `terse actor dev`. Both `.durable-actors/` and `generated/` are already gitignored by the template.
- **Socket grant (backend):**
  ```ts
  import { actors } from "./generated"
  const { websocketUrl } = await actors.Counter.prepareWebsocket({ actorId: "gate-d", metadata: null })
  ```
  The browser just does `new WebSocket(websocketUrl)`. It first receives `{type:"state", state}`, then `{type:"state_update", changes}` for every change to an `@Emittable` field. Anything the browser sends arrives in the actor's `onMessage(socket, message)`.
- **Direct method calls work:** `await actors.Counter.get("gate-d").increment()` from a backend (see `client/check.ts`). So the orchestrator can call actor methods directly instead of using the socket protocol.
- **Local needs no key:** the generated client reads `TERSE_ACTOR_URL` and `TERSE_API_KEY`, with defaults for the local dev server.
- **While the actor server is down,** `prepareWebsocket` fails (our route returns 503). Retrying every 1s with a fresh grant reconnects as soon as the server is back (see `client/web.ts`).

## Run it

```bash
cd spikes/durable-counter/actor && bun install && terse actor dev     # terminal 1
cd spikes/durable-counter/client && bun install && terse actor generate && bun web.ts   # terminal 2, open http://localhost:3001
bun check.ts read        # or: bun check.ts inc 3
```
