// Hollow Manor orchestrator: HTTP API for the web UI and operator, plus the Agent Relay bridge.
// Run in WSL / macOS:  terse actor dev (in actors/), then here: bun run generate && bun index.ts
// Never restart this process mid-run: it owns the agents. Restarting the actor server is fine.

import type { AgentId } from "../shared/types"
import { RUN_ID, socketGrant } from "./actor"
import { Bridge } from "./bridge"

const PORT = Number(process.env.PORT ?? 3001)
const bridge = new Bridge()
await bridge.init()

async function body(req: Request): Promise<Record<string, unknown>> {
    try {
        return (await req.json()) as Record<string, unknown>
    } catch {
        return {}
    }
}

Bun.serve({
    port: PORT,
    idleTimeout: 60,
    async fetch(req) {
        const { pathname } = new URL(req.url)
        if (req.method !== "POST" && pathname !== "/api/health") return new Response("not found", { status: 404 })
        try {
            switch (pathname) {
                case "/api/health":
                    return Response.json({ ok: true, runId: RUN_ID })
                case "/api/socket":
                    try {
                        return Response.json(await socketGrant())
                    } catch (err) {
                        return Response.json({ error: String(err) }, { status: 503 })
                    }
                case "/api/run/start":
                    return Response.json(await bridge.start())
                case "/api/run/scripted":
                    return Response.json(await bridge.scripted())
                case "/api/run/collapse":
                    return Response.json(await bridge.collapse())
                case "/api/run/whisper": {
                    const b = await body(req)
                    return Response.json(await bridge.whisper(b.agent as AgentId, String(b.text ?? "")))
                }
                case "/api/run/reset":
                    return Response.json(await bridge.reset())
                default:
                    return new Response("not found", { status: 404 })
            }
        } catch (err) {
            console.error(`[http] ${pathname}`, err)
            return Response.json({ ok: false, error: String(err) }, { status: 500 })
        }
    },
})

console.log(`[server] Hollow Manor orchestrator on http://localhost:${PORT} (run ${RUN_ID})`)
