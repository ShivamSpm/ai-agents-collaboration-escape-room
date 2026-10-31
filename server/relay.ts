// Agent Relay side of the orchestrator (Agent Relay 15.0.1; see spikes/relay/spike.ts and TEAM.md › Gate R).
// Registers Manor and Operator, spawns the three CLI agents, and reports every message it sees.

import { mkdirSync, readFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { AgentRelay } from "@agent-relay/sdk"
import { claude, codex } from "@agent-relay/harnesses"
import { AGENTS, MANOR, OPERATOR } from "../shared/map"

export type Incoming = { id: string; from: string; channel?: string; text: string }

const CHANNEL_NAME = "manor"
const AGENT_NAMES = ["Medium", "Electrician", "Locksmith"]
const PROMPTS = join(import.meta.dir, "prompts")
const RELAY_BIN = process.env.AGENT_RELAY_BIN ?? join(homedir(), ".local", "bin", "agent-relay")

// `agent-relay init` installs a user-level SessionStart hook that makes every new Claude session ask whether to
// join Relay. Skip user settings so broker-spawned agents just play, but keep the one user setting init added that
// lets teammates' channel posts reach a Claude session (without it they only ever hear Manor).
const CLAUDE_ARGS = [
    "--setting-sources", "project,local",
    "--settings", JSON.stringify({ crossSessionInbound: "accept" }),
    "--append-system-prompt",
    "You were started by the Hollow Manor orchestrator as an Agent Relay agent. You are already on Relay; your task and messages from Manor, Operator and teammates are your assigned game.",
]
const CODEX_ARGS = ["--config", 'model_reasoning_effort="low"']

function workspaceKey(): string {
    if (process.env.RELAY_WORKSPACE_KEY) return process.env.RELAY_WORKSPACE_KEY
    const file = join(homedir(), ".agentworkforce", "relay", "workspaces.json")
    const cfg = JSON.parse(readFileSync(file, "utf8"))
    const key = cfg.workspaces?.[cfg.active]?.key
    if (!key) throw new Error(`No relay workspace key; run \`agent-relay init\` (looked in ${file})`)
    return key
}

function removeAgent(name: string) {
    Bun.spawnSync([RELAY_BIN, "agent", "remove", name], { stdout: "ignore", stderr: "ignore" })
}

/** Kills brokers and agents left by earlier runs; they keep re-claiming agent names otherwise. */
export function killBrokers() {
    Bun.spawnSync(["pkill", "-f", "agent-relay-broker (init|pty)"], { stdout: "ignore", stderr: "ignore" })
}

function prompt(file: string) {
    return readFileSync(join(PROMPTS, file), "utf8")
}

export class Relay {
    private relay!: AgentRelay
    private manor: any
    private operator: any
    private seen = new Set<string>()
    spawned = false

    async connect(onMessage: (m: Incoming) => void) {
        killBrokers()
        for (const name of [MANOR, OPERATOR, ...AGENT_NAMES]) removeAgent(name)

        this.relay = new AgentRelay({
            workspaceKey: workspaceKey(),
            baseUrl: process.env.RELAY_BASE_URL ?? "http://127.0.0.1:8787",
        } as any)
        this.manor = await this.relay.workspace.register({ name: MANOR, type: "agent" })
        this.operator = await this.relay.workspace.register({ name: OPERATOR, type: "agent" })
        await this.manor.channels.create({ name: CHANNEL_NAME, topic: "Hollow Manor" }).catch(() => {})
        for (const c of [this.manor, this.operator]) await c.channels.join(CHANNEL_NAME).catch(() => {})

        for (const type of ["message.created", "dm.received"] as const) {
            this.relay.addListener(type, (ev: any) => {
                const id: string = ev?.message?.messageId ?? ev?.message?.id
                if (!id || this.seen.has(id)) return
                this.seen.add(id)
                const from: string = ev?.envelope?.from?.name ?? ev?.message?.from?.name ?? "?"
                const channel: string | undefined = ev?.envelope?.channel?.name ?? ev?.message?.channel?.name
                onMessage({ id, from, channel, text: String(ev?.message?.text ?? "") })
            })
        }
        console.log("[relay] connected; Manor and Operator registered in #manor")
    }

    /** Spawns the three agents one at a time (the first create() starts the broker; the rest attach). */
    async spawnAgents() {
        if (this.spawned) return
        this.spawned = true
        killBrokers()
        for (const name of AGENT_NAMES) removeAgent(name)
        // The broker names itself after the cwd; a fresh dir avoids clashing with a crashed broker's name.
        const brokerDir = join(tmpdir(), `manor-broker-${Date.now()}`)
        mkdirSync(brokerDir, { recursive: true })
        process.chdir(brokerDir)

        const common = prompt("common.md")
        const cwd = (name: string) => {
            const d = join(tmpdir(), "manor", name.toLowerCase())
            mkdirSync(d, { recursive: true })
            return d
        }
        const base = (name: string, file: string) => ({
            relay: this.relay,
            name,
            channels: [CHANNEL_NAME],
            cwd: cwd(name),
            task: `${common}\n${prompt(file)}\nStart now: say hello on #manor in one line, then begin.`,
        })
        await claude.create({ ...base(AGENTS.medium.relayName, "medium.md"), model: process.env.MEDIUM_MODEL ?? "sonnet", args: CLAUDE_ARGS })
        console.log("[relay] Medium spawned")
        await codex.create({ ...base(AGENTS.electrician.relayName, "electrician.md"), ...(process.env.ELECTRICIAN_MODEL ? { model: process.env.ELECTRICIAN_MODEL } : {}), args: CODEX_ARGS })
        console.log("[relay] Electrician spawned")
        await claude.create({ ...base(AGENTS.locksmith.relayName, "locksmith.md"), model: process.env.LOCKSMITH_MODEL ?? "haiku", args: CLAUDE_ARGS })
        console.log("[relay] Locksmith spawned")
    }

    async stopAgents() {
        killBrokers()
        for (const name of AGENT_NAMES) removeAgent(name)
        this.spawned = false
    }

    /** Sends as Manor (or Operator) to "#manor" or to an agent's relay name. */
    async send(as: "Manor" | "Operator", to: string, text: string) {
        const client = as === MANOR ? this.manor : this.operator
        await client.sendMessage({ to: to.startsWith("#") ? to : `@${to}`, text })
    }
}
