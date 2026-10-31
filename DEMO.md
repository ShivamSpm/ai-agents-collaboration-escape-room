# Running and testing the Hollow Manor demo

How to bring up the whole demo on the Mac (the demo machine) and test it by hand. The same steps work in WSL on Windows; Mac-only notes are marked.

What runs: three terminals (the actor, the orchestrator, the web UI) and one browser tab. The orchestrator spawns the three AI agents itself.

```
terminal 1  actors/   terse actor dev     HauntedHouse actor (game state)  http://127.0.0.1:7100
terminal 2  server/   ./run.sh            orchestrator + Agent Relay       http://localhost:3001
terminal 3  web/      bun run dev         the map UI                       http://localhost:5173/?mode=live
```

## 1. One-time setup

Skip anything already installed. Run in the normal macOS Terminal (on Windows: inside WSL Ubuntu).

| Tool | Install | Check |
| --- | --- | --- |
| Node 22+ | `brew install node@22` (or nvm) | `node -v` |
| Bun 1.4.2+ | `curl -fsSL https://bun.sh/install \| bash` | `bun --version` |
| Claude Code | `curl -fsSL https://claude.ai/install.sh \| bash` | `claude --version` |
| Codex CLI | `npm install -g @openai/codex` | `codex --version` |
| Durable Actors CLI | `bunx terse-cli@latest install --yes` | `terse --version` (0.14.9) |
| Agent Relay CLI | `curl -fsSL https://raw.githubusercontent.com/AgentWorkforce/relay/main/install.sh \| bash` | `agent-relay --version` (15.x) |

Then, once:

1. **Log in to Claude Code:** run `claude`, finish the browser sign-in, then `/exit`.
2. **Log in to Codex:** run `codex`, sign in (ChatGPT or API key), then Ctrl+C.
3. **OpenAI key** (event credits): add `export OPENAI_API_KEY=sk-...` to `~/.zshrc` (Mac) or `~/.bashrc` (WSL), then open a new terminal.
4. **Set up Agent Relay:** run `agent-relay init`. It starts a private relay server on this machine (`127.0.0.1:8787`, workspace "local") and hooks Claude Code and Codex into it. Check with `agent-relay status`.
5. **Optional, character voices and push-to-talk whispers:** `export ELEVENLABS_API_KEY=...` (voices) and the OpenAI key above (speech to text). On the Mac these can also live in the Keychain as `ELEVENLABS_API_KEY_HAUNTED` / `OPENAI_API_KEY_HAUNTED`. Without them the demo works, just silent.

## 2. Get the code

```bash
git clone https://github.com/ShivamSpm/ai-agents-collaboration-escape-room.git ~/hollow-manor
cd ~/hollow-manor
(cd actors && bun install) && (cd server && bun install) && (cd web && bun install)
```

Already cloned? `git pull` in `~/hollow-manor`, then rerun the three `bun install`s.

## 3. Start everything (in this order)

**Terminal 1, the actor:**

```bash
cd ~/hollow-manor/actors && terse actor dev
```

Wait for `Ready  http://127.0.0.1:7100`. The first start compiles for about 70 seconds.

**Terminal 2, the orchestrator** (needs terminal 1 running):

```bash
cd ~/hollow-manor/server && bun run generate && ./run.sh
```

`bun run generate` writes the actor client to `server/generated/`; rerun it whenever the actor's methods change. Wait for:

```
[relay] connected; Manor and Operator registered in #manor
[server] Hollow Manor orchestrator on http://localhost:3001 (run run-1)
```

**Terminal 3, the UI:**

```bash
cd ~/hollow-manor/web && bun run dev
```

Open **http://localhost:5173/?mode=live** in Chrome. Without `?mode=live` you get the built-in fake data (labelled "FAKE DATA"). Set the browser to full screen at 1920x1080 for recording.

Sanity check from any terminal: `curl -s localhost:3001/api/health` prints `{"ok":true,"runId":"run-1"}`.

## 4. Operator controls

| Key | Button | What it does |
| --- | --- | --- |
| `S` | Start | Spawns the three live agents and starts the run |
| (none) | Scripted run | Plays the whole story with no AI calls; the feed shows a "SCRIPTED REPLAY" event |
| `C` | Collapse corridor | Caves in the East Corridor; agents must replan through the secret passage |
| `W` | Whisper | Focuses the whisper box: pick an agent, type, Enter. Sent privately from "Operator" |
| `V` (hold) | Push to talk | Speak a whisper instead of typing (needs the OpenAI key) |
| `H` | Hide/show | Hides the operator bar for clean recording |
| (none) | Reset | Back to the lobby. After a live run, terminal 2 restarts itself in ~2s; that is expected |

Always **Reset** before starting a new run.

## 5. Manual test plan

Do these in order. Expected timings are from test runs in WSL at 13:30.

**Test 1: scripted replay (free, no AI).** Reset, then click Scripted run.
- Expect: a "SCRIPTED REPLAY: no live agents" event in the feed (a separate on-screen badge is still to come in the UI); agents move, the Library lights, the corridor collapses on its own, everyone escapes in about 30 seconds; the "Escaped" end card appears.
- This proves actor, orchestrator and UI are wired together.

**Test 2: live happy path.** Reset, press `S`.
- Expect within ~10s: three hello messages in the feed, then the portrait clue, the Electrician going to the Basement and switching on B, the Medium reading the ledger (code 1031), the Locksmith unlocking the crypt gate.
- Escapes in about **40 seconds**. Terminal 2 prints one `[act] ...` line per action.

**Test 3: collapse and replan (the main demo).** Reset, press `S`, then press `C` about **20 seconds in**, as soon as the Medium heads to the Library.
- The agents are fast: the code is found at ~28s and the gate opens at ~31s, so waiting for the code is too late.
- Expect: screen shake and banner; anyone in the corridor is pushed back to the Foyer; the Medium reads the bookshelf (0666); the Locksmith opens the secret door; the Electrician switches to circuit C only after the bookshelf is read; all three go through the Secret Passage, Conservatory and iron door.
- Escapes in about **90 seconds**.

**Test 4: whisper.** During a live run, press `W`, choose the Locksmith, type e.g. `Head to the library now, don't wait`, press Enter.
- Expect: the feed shows the whisper with a lock icon (private); the Locksmith acts on it within a few seconds.

**Test 5: crash and resume.** During a live run (after a few actions), click terminal 1 and press **Ctrl+C**.
- Expect: the map goes dark with "The manor has gone silent…". Agents keep talking; their actions wait in the orchestrator.
- Run `terse actor dev` again in terminal 1. Within seconds of `Ready`: "The manor stirs. State restored at rev N", and the run continues from the same state.
- **Never** restart terminal 2 mid-run; it owns the agents.

**Test 6: reset loop.** Click Reset after a live run. Terminal 2 prints `restarting for a fresh Relay session` and comes back in ~2s. Press `S` again: a fresh run starts.

A test passes if the run ends on the "Escaped" end card with 0 or few failed actions. Note failures (time, what the agents were doing, last lines of terminal 2) for prompt tuning.

## 6. Watching what happens

- **Terminal 2** prints every action: `[act] medium {"action":"inspect","object":"ledger"} -> ok: ...`.
- **Game state from the actor:** `cd ~/hollow-manor/server && bun peek.ts` (status, rooms, circuits, stats, last 12 log lines; `bun peek.ts 40` for more).
- **An agent's own terminal output:** the newest `agent-relay-ephemeral-*` folder in the temp dir, file `team/worker-logs/<Name>.log`:
  ```bash
  ls -td "${TMPDIR:-/tmp}"/agent-relay-ephemeral-* /tmp/agent-relay-ephemeral-* 2>/dev/null | head -1
  ```
- **Relay:** `agent-relay status`, `agent-relay agent list`.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Terminal 2: `Cannot find module './generated'` | Terminal 1 must be running, then `bun run generate` in `server/`. |
| Terminal 2: `Agent "Manor" already exists` or a 409 from the broker | Stop terminal 2 (Ctrl+C twice), run `pkill -f "agent-relay-broker (init\|pty)"`, start `./run.sh` again. Startup frees the names. |
| Terminal 2: `No relay workspace key` / can't reach `127.0.0.1:8787` | Run `agent-relay init` again, check `agent-relay status`. |
| UI stuck on "reconnecting" with all terminals up | Terminal 2 must be on :3001 (Vite proxies `/api` there). Check `curl -s localhost:3001/api/health`. |
| Start does nothing for 30s+ | Check terminal 2 for spawn errors. Agents need `claude` and `codex` logged in and on PATH in the terminal that runs `./run.sh`. |
| An agent stops acting mid-run | Look at its worker log (section 6). A Claude agent asking whether to join Relay means the user-level hook leaked in; report it. Otherwise whisper it a nudge (`W`) or Reset. |
| Agent spends the run exploring files or writing code | Should not happen (empty working dir, game prompt). Reset; note it for prompt tuning. |
| Runs fail on the one-circuit rule | Set `ONE_CIRCUIT = false` in `shared/map.ts` (needs both teammates to agree). |

## 8. Settings (environment variables for terminal 2)

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEDIUM_CLI` / `ELECTRICIAN_CLI` / `LOCKSMITH_CLI` | `claude` / `codex` / `codex` | Which CLI runs each agent |
| `MEDIUM_MODEL` etc. | Medium `sonnet`; Codex default | Model per agent |
| `RUN_ID` | `run-1` | Actor id for the run (the UI follows the server) |
| `SCRIPT_DELAY_MS` | `1200` | Gap between scripted steps |
| `PORT` | `3001` | Orchestrator port (the Vite proxy expects 3001) |

Example: `LOCKSMITH_CLI=claude ./run.sh`.

Live runs spend Claude and OpenAI credits; Reset any run you are not watching. For recording the video, follow the checklist in [PLAN.md](PLAN.md#demo-script-and-recording).
