// Glue between Agent Relay and the HauntedHouse actor. The orchestrator is the Manor: agents DM it one JSON
// action, it asks the actor (which runs the engine), and DMs the result back. Every message is mirrored into the
// actor's log so the UI feed survives a crash too.

import { parseAction } from "../shared/engine"
import { AGENT_IDS, AGENTS, CHANNEL, MANOR, OPERATOR, agentIdFromRelayName } from "../shared/map"
import { runScript, type ScriptSink } from "../shared/scripted"
import type { Action, AgentId, OperatorOp } from "../shared/types"
import { call } from "./actor"
import { Relay, type Incoming } from "./relay"

export class Bridge {
    private relay = new Relay()
    private scriptCtrl: AbortController | null = null

    async init() {
        await this.relay.connect((m) => void this.onRelayMessage(m).catch((e) => console.error("[bridge]", e)))
    }

    private mirror(from: string, to: string, text: string, isPrivate = false) {
        return call((h) => h.message(from, to, text, isPrivate))
    }

    /** Sends as Manor and mirrors it to the feed. */
    private async manorSays(to: string, text: string) {
        await this.relay.send(MANOR, to, text).catch((e) => console.error("[relay] send failed", e))
        await this.mirror(MANOR, to, text)
    }

    async onRelayMessage(m: Incoming) {
        if (m.from === MANOR || m.from === OPERATOR) return // our own sends are mirrored when sent
        const agent = agentIdFromRelayName(m.from)
        if (m.channel) {
            await this.mirror(m.from, `#${m.channel}`, m.text)
            // Relay 15 delivers one agent's channel posts to the Codex agent but not to Claude agents (they only
            // hear Manor), so Manor forwards teammates' posts to them. Not mirrored: the feed already has the post.
            if (agent) {
                for (const id of AGENT_IDS) {
                    if (id === agent || AGENTS[id].runsOn !== "Claude Code") continue
                    await this.relay
                        .send(MANOR, AGENTS[id].relayName, `(teammate chat, not a Manor reply) #manor ${m.from}: ${m.text}`)
                        .catch((e) => console.error("[relay] forward failed", e))
                }
            }
            return
        }
        // Every DM we can see is addressed to Manor (or Operator); treat it as an action attempt.
        await this.mirror(m.from, MANOR, m.text)
        if (!agent) return
        const parsed = parseAction(m.text)
        if (!parsed.ok) {
            await this.manorSays(m.from, parsed.error)
            return
        }
        const r = await call((h) => h.act(agent, parsed.action))
        console.log(`[act] ${agent} ${JSON.stringify(parsed.action)} -> ${r.ok ? "ok" : "FAIL"}: ${r.text.slice(0, 100)}`)
        await this.manorSays(m.from, r.text)
    }

    /** Live run: start the world, spawn the agents, announce, and DM each a look. Returns once kicked off. */
    async start() {
        if (this.relay.spawned) return { ok: false, error: "agents already running; reset first" }
        const { announce } = await call((h) => h.operator("start"))
        void (async () => {
            try {
                await this.relay.spawnAgents()
                if (announce) await this.manorSays(CHANNEL, announce)
                for (const id of AGENT_IDS) {
                    const r = await call((h) => h.act(id, { action: "look" }))
                    await this.manorSays(AGENTS[id].relayName, r.text)
                }
            } catch (e) {
                console.error("[start] failed", e)
            }
        })()
        return { ok: true }
    }

    /** Scripted replay: no LLMs, same traffic. Labelled in the log so the UI can show it. */
    async scripted() {
        if (this.relay.spawned) return { ok: false, error: "live agents running; reset first" }
        this.scriptCtrl?.abort()
        const ctrl = (this.scriptCtrl = new AbortController())
        await call((h) => h.operator("start"))
        await call((h) => h.event("start", "SCRIPTED REPLAY: no live agents in this run."))
        const sink: ScriptSink = {
            act: (agent: AgentId, action: Action) => call((h) => h.act(agent, action)),
            message: (from, to, text, isPrivate) => this.mirror(from, to, text, isPrivate),
            operator: (op: OperatorOp) => call((h) => h.operator(op)),
        }
        void runScript(sink, { delayMs: Number(process.env.SCRIPT_DELAY_MS ?? 1200), signal: ctrl.signal }).catch((e) =>
            console.error("[scripted]", e),
        )
        return { ok: true }
    }

    async collapse() {
        const { announce } = await call((h) => h.operator("collapse"))
        if (!announce) return { ok: false, error: "nothing to collapse (not running, or already collapsed)" }
        if (this.relay.spawned) await this.manorSays(CHANNEL, announce)
        else await this.mirror(MANOR, CHANNEL, announce)
        return { ok: true }
    }

    async whisper(agent: AgentId, text: string) {
        const name = AGENTS[agent]?.relayName
        if (!name || !text.trim()) return { ok: false, error: "need agent and text" }
        if (this.relay.spawned) await this.relay.send(OPERATOR, name, text).catch((e) => console.error("[relay] whisper failed", e))
        await this.mirror(OPERATOR, name, text, true)
        await call((h) => h.event("whisper", `Operator whispered to ${name}.`))
        return { ok: true }
    }

    /**
     * Resets the world. After a live run it also asks for a process restart: Relay will not let this process
     * re-register Manor while its old client is still connected, but a fresh process (via run.sh) can.
     */
    async reset() {
        this.scriptCtrl?.abort()
        this.scriptCtrl = null
        const restart = this.relay.spawned
        if (restart) await this.relay.stopAgents()
        await call((h) => h.operator("reset"))
        return { ok: true, restart }
    }
}
