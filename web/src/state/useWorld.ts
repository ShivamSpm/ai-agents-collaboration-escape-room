// World state for the UI: the HauntedHouse actor socket (live) or the fake stream.
// Live: POST /api/socket -> { websocketUrl } (Gate D) -> WebSocket -> {type:"world"}; retry every 1s.
import { useEffect, useMemo, useRef, useState } from "react";
import { createWorld } from "../../../shared/map";
import type { ActorIn, ActorOut, AgentId, World } from "../../../shared/types";
import { createFakeStream, type FakeStream } from "../fake/fakeStream";

export type Mode = "fake" | "live";
export type Connection = "fake" | "connecting" | "live" | "lost";

export type Operator = {
  start(): void;
  scripted(): void;
  collapse(): void;
  whisper(agent: AgentId, text: string): void;
  reset(): void;
};

/** `?mode=live` or VITE_WORLD_MODE=live switches to the real actor. Default is fake until the actor ships. */
export function readMode(): Mode {
  const q = new URLSearchParams(location.search).get("mode");
  const m = q ?? import.meta.env.VITE_WORLD_MODE ?? "fake";
  return m === "live" ? "live" : "fake";
}

async function post(path: string, body?: unknown) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) console.warn(`${path} -> ${res.status}`);
  } catch (err) {
    console.warn(`${path} failed`, err);
  }
}

export function useWorld(mode: Mode) {
  const [world, setWorld] = useState<World>(() => createWorld("lobby"));
  const [connection, setConnection] = useState<Connection>(mode === "fake" ? "fake" : "connecting");
  const fake = useRef<FakeStream | null>(null);

  useEffect(() => {
    if (mode !== "fake") return;
    fake.current = createFakeStream(setWorld);
    return () => fake.current?.stop();
  }, [mode]);

  useEffect(() => {
    if (mode !== "live") return;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const again = () => {
      if (closed) return;
      setConnection((c) => (c === "live" ? "lost" : c));
      retry = setTimeout(connect, 1000);
    };
    async function connect() {
      try {
        const res = await fetch("/api/socket", { method: "POST" });
        if (!res.ok) throw new Error(`grant ${res.status}`);
        const { websocketUrl } = (await res.json()) as { websocketUrl: string };
        socket = new WebSocket(websocketUrl);
        socket.onopen = () => {
          setConnection("live");
          socket?.send(JSON.stringify({ type: "hello" } satisfies ActorIn));
        };
        socket.onmessage = ({ data }) => {
          const msg = JSON.parse(String(data)) as ActorOut;
          if (msg.type === "world") setWorld(msg.world);
        };
        socket.onclose = again;
      } catch {
        again();
      }
    }
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [mode]);

  const operator = useMemo<Operator>(
    () =>
      mode === "fake"
        ? {
            start: () => fake.current?.start(),
            scripted: () => fake.current?.start(),
            collapse: () => fake.current?.collapse(),
            whisper: (agent, text) => fake.current?.whisper(agent, text),
            reset: () => fake.current?.reset(),
          }
        : {
            start: () => post("/api/run/start"),
            scripted: () => post("/api/run/scripted"),
            collapse: () => post("/api/run/collapse"),
            whisper: (agent, text) => post("/api/run/whisper", { agent, text }),
            reset: () => post("/api/run/reset"),
          },
    [mode],
  );

  return { world, connection, operator };
}
