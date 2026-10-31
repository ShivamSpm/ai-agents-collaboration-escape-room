// HauntedHouse: the single source of truth for one run (actor id = run id, e.g. "run-3").
// It only calls shared/engine.ts; calls are applied one at a time, so concurrent agents never race.
// Orchestrator: calls methods directly (act, message, operator, event, getWorld).
// Browser: WebSocket via prepareWebsocket; receives {type:"world", world} on connect and on every change.

import { Actor, Ephemeral, Persisted, type ActorSocket } from "terse-sdk/actor"
import { appendEvent, appendMessage, apply, operator } from "../../shared/engine"
import { createWorld } from "../../shared/map"
import type { Action, AgentId, EventName, OperatorOp, World } from "../../shared/types"

type WebIn = { type: "hello" }
type WebOut = { type: "world"; world: World }

export class HauntedHouse extends Actor<null, WebIn, WebOut> {
    @Persisted world: World = createWorld(this.id)
    /** False after every process start; the first call after a restart mid-run logs "resumed". */
    @Ephemeral booted = false

    private wake() {
        if (this.booted) return
        this.booted = true
        if (this.world.status === "running") {
            this.world = appendEvent(this.world, "resumed", `The manor stirs. State restored at rev ${this.world.rev}.`)
        }
    }

    private publish() {
        this.broadcast({ type: "world", world: this.world })
    }

    async getWorld(): Promise<World> {
        this.wake()
        return this.world
    }

    async act(agent: AgentId, action: Action): Promise<{ ok: boolean; text: string }> {
        this.wake()
        const r = apply(this.world, agent, action)
        this.world = r.world
        this.publish()
        return { ok: r.ok, text: r.text }
    }

    async message(from: string, to: string, text: string, isPrivate: boolean): Promise<void> {
        this.wake()
        this.world = appendMessage(this.world, { from, to, text, private: isPrivate })
        this.publish()
    }

    async operator(op: OperatorOp): Promise<{ announce: string | null }> {
        this.wake()
        const r = operator(this.world, op)
        this.world = r.world
        this.publish()
        return { announce: r.announce ?? null }
    }

    async event(event: EventName, text: string): Promise<void> {
        this.wake()
        this.world = appendEvent(this.world, event, text)
        this.publish()
    }

    async onConnect(socket: ActorSocket<null, WebOut>) {
        this.wake()
        socket.send({ type: "world", world: this.world })
    }

    async onMessage(socket: ActorSocket<null, WebOut>, message: WebIn) {
        if (message.type === "hello") socket.send({ type: "world", world: this.world })
    }
}
