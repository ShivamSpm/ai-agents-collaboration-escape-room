// The HauntedHouse actor client with an outage queue.
// Every call goes through one FIFO chain; if the actor server is down, the call retries every 1s, and every
// later call waits behind it. So agent actions during a crash are held in order, never dropped.

import { actors } from "./generated"

export const RUN_ID = process.env.RUN_ID ?? "run-1"

type House = ReturnType<typeof actors.HauntedHouse.get>

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let chain: Promise<unknown> = Promise.resolve()
let down = false

export function isActorDown() {
    return down
}

/** Queues a call against this run's actor. Application errors (thrown by actor code) are not retried. */
export function call<T>(fn: (house: House) => Promise<T>): Promise<T> {
    const next = chain.then(async () => {
        for (;;) {
            try {
                const result = await fn(actors.HauntedHouse.get(RUN_ID))
                if (down) console.log("[actor] back up; flushing queued calls")
                down = false
                return result
            } catch (err) {
                // The client reports an unreachable actor server as ActorInvocationError "unavailable", or
                // "outcome_unknown" if the call may have gone out. Retry those (a replayed move/unlock is harmless);
                // anything else is a real error from actor code.
                const code = (err as { code?: string })?.code
                if ((err as Error)?.name === "ActorInvocationError" && code !== "unavailable" && code !== "outcome_unknown") throw err
                if (!down) console.log(`[actor] unreachable, queueing calls: ${(err as Error)?.message ?? err}`)
                down = true
                await sleep(1000)
            }
        }
    })
    chain = next.catch(() => {})
    return next
}

/** WebSocket grant for the browser. Not queued: the UI retries on its own. */
export function socketGrant() {
    return actors.HauntedHouse.prepareWebsocket({ actorId: RUN_ID, metadata: null })
}
