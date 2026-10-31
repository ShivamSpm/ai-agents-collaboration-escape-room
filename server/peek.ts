// Prints the actor's current world: status, rooms, circuits, stats, and the last few log lines.
// Usage (actor server running):  bun peek.ts [lines]
import { RUN_ID } from "./actor"
import { actors } from "./generated"

const lines = Number(process.argv[2] ?? 12)
const w = await actors.HauntedHouse.get(RUN_ID).getWorld()
const secs = (t: number) => (w.startedAt ? `${Math.round((t - w.startedAt) / 1000)}s`.padStart(5) : "")

console.log(`run ${w.runId}  status=${w.status}  rev=${w.rev}  collapsed=${w.collapsed}  circuits=B:${w.circuits.B ? "on" : "off"} C:${w.circuits.C ? "on" : "off"}`)
console.log(`rooms: ${Object.entries(w.agents).map(([id, a]) => `${id}=${a.room}`).join("  ")}`)
console.log(`stats: ${JSON.stringify(w.stats)}${w.endedAt && w.startedAt ? `  escaped in ${Math.round((w.endedAt - w.startedAt) / 1000)}s` : ""}`)
for (const e of w.log.slice(-lines)) {
    const what =
        e.kind === "action"
            ? `ACT ${e.agent} ${JSON.stringify(e.action)}${e.ok ? "" : `  FAIL: ${e.text}`}`
            : e.kind === "message"
              ? `${e.from} -> ${e.to}${e.private ? " (private)" : ""}: ${e.text}`
              : `*** ${e.event}: ${e.text}`
    console.log(`${secs(e.t)} ${what.slice(0, 140)}`)
}
