# web/ — Hollow Manor UI (Person B)

Vite + React + TypeScript + Tailwind + Motion. The map is one SVG drawn from `shared/map.ts`, tilted in CSS perspective; the world comes from `shared/types.ts`.

```bash
bun install
bun run dev          # http://localhost:5173 (fake data, labelled on screen)
# http://localhost:5173/?mode=live  -> real HauntedHouse actor via POST /api/socket (proxied to :3001)
```

- **Fake mode** (default until the actor ships): `src/fake/fakeStream.ts` plays the happy path, collapse and replan. A "FAKE DATA" badge is always shown.
- **Live mode**: `POST /api/socket` must return `{ websocketUrl }` (the Durable Actors grant, see `spikes/durable-counter/FINDINGS.md`). The UI sends `{type:"hello"}` and renders every `{type:"world"}`. If the socket drops it shows the crash overlay and retries every 1s.
- Operator hotkeys: `S` start, `C` collapse, `W` whisper, `H` hide the operator bar. Buttons call `/api/run/*`.
- Designed for exactly 1920x1080; smaller windows scale it down.
