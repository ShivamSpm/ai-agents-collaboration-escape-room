// HauntedHouse: the single source of truth for one run (actor id = run id, e.g. "run-3").
// It only calls shared/engine.ts; calls are applied one at a time, so concurrent agents never race.
// Orchestrator: calls methods directly (act, message, operator, event, getWorld). It logs the "resumed" event
// itself after a real outage: the runtime unloads idle actors, so the actor cannot tell a crash from idling.
// Browser: WebSocket via prepareWebsocket; receives {type:"world", world} on connect and on every change.

import { Actor, Persisted, type ActorSocket } from "terse-sdk/actor"
import { appendEvent, appendMessage, apply, operator } from "../../shared/engine"
import { createWorld } from "../../shared/map"
import type { Action, AgentId, EventName, OperatorOp, World } from "../../shared/types"

type WebIn = { type: "hello" }
type WebOut = { type: "world"; world: World }

export class HauntedHouse extends Actor<null, WebIn, WebOut> {
    @Persisted world: World = createWorld(this.id)

    private async publish() {
        this.broadcast({ type: "world", world: this.world })
    }

    async getWorld(): Promise<World> {
        return this.world
    }

    async act(agent: AgentId, action: Action): Promise<{ ok: boolean; text: string }> {
        const r = apply(this.world, agent, action)
        this.world = r.world
        await this.publish()
        return { ok: r.ok, text: r.text }
    }

    async message(from: string, to: string, text: string, isPrivate: boolean): Promise<void> {
        this.world = appendMessage(this.world, { from, to, text, private: isPrivate })
        await this.publish()
    }

    async operator(op: OperatorOp): Promise<{ announce: string | null }> {
        const r = operator(this.world, op)
        this.world = r.world
        await this.publish()
        return { announce: r.announce ?? null }
    }

    async event(event: EventName, text: string): Promise<void> {
        this.world = appendEvent(this.world, event, text)
        await this.publish()
    }

    async onConnect(socket: ActorSocket<null, WebOut>) {
        socket.send({ type: "world", world: this.world })
    }

    async onMessage(socket: ActorSocket<null, WebOut>, message: WebIn) {
        if (message.type === "hello") socket.send({ type: "world", world: this.world })
    }
}
