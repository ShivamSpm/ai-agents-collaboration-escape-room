// Gate D spike: call the Counter actor's methods directly from a backend.
// Usage: bun check.ts read | bun check.ts inc <n>
import { actors } from "./generated"

const [cmd = "read", n = "1"] = process.argv.slice(2)
const counter = actors.Counter.get("gate-d")

if (cmd === "inc") for (let i = 0; i < Number(n); i++) await counter.increment()
console.log(`Counter[gate-d] = ${await counter.read()}`)
