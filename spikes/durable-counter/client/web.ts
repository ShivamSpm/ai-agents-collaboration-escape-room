// Gate D spike: a browser page that gets a WebSocket grant from this backend,
// connects to the Counter actor, and reconnects every 1s if the actor server dies.
import { actors } from "./generated"

const port = Number(process.env.PORT ?? 3001)

const page = `<!doctype html>
<meta charset="utf-8">
<title>Gate D: durable counter</title>
<style>
  body { font: 16px system-ui; background: #0b0d12; color: #d8d2c4; display: grid; place-items: center; height: 100vh; margin: 0 }
  .count { font-size: 120px; font-weight: 700 }
  .status { font-size: 14px; opacity: .7 }
  button { font-size: 24px; margin: 0 8px; padding: 8px 20px }
</style>
<div style="text-align:center">
  <div class="status" id="status">connecting…</div>
  <div class="count" id="count">?</div>
  <button id="dec">−</button><button id="inc">+</button>
</div>
<script type="module">
  const id = new URLSearchParams(location.search).get("id") ?? "gate-d"
  const $ = (s) => document.getElementById(s)
  let socket

  async function connect() {
    try {
      const res = await fetch("/api/socket?id=" + encodeURIComponent(id), { method: "POST" })
      if (!res.ok) throw new Error("grant failed: " + res.status)
      const { websocketUrl } = await res.json()
      socket = new WebSocket(websocketUrl)
      socket.onopen = () => { $("status").textContent = "connected to Counter[" + id + "]" }
      socket.onmessage = ({ data }) => {
        const msg = JSON.parse(data)
        const value = msg.type === "state" ? msg.state.value : msg.changes?.value
        if (value !== undefined) $("count").textContent = value
      }
      socket.onclose = () => retry("actor server gone, reconnecting…")
    } catch (err) {
      retry(String(err.message ?? err))
    }
  }
  function retry(text) {
    $("status").textContent = text
    setTimeout(connect, 1000)
  }
  $("inc").onclick = () => socket?.send(JSON.stringify({ type: "increment" }))
  $("dec").onclick = () => socket?.send(JSON.stringify({ type: "decrement" }))
  connect()
</script>`

Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/api/socket" && req.method === "POST") {
            const actorId = url.searchParams.get("id") ?? "gate-d"
            try {
                const grant = await actors.Counter.prepareWebsocket({ actorId, metadata: null })
                return Response.json(grant)
            } catch (err) {
                return Response.json({ error: String(err) }, { status: 503 })
            }
        }
        return new Response(page, { headers: { "content-type": "text/html" } })
    },
})

console.log(`Gate D page: http://localhost:${port}`)
