// Operator controls. Hotkeys: S start, C collapse, W type a whisper, hold V to talk, H hide/show this bar.
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENT_IDS, AGENTS, agentIdFromRelayName } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { clickSound } from "../lib/clickSound";
import { portraitFor } from "../map/AgentToken";
import type { Operator } from "../state/useWorld";
import { SoundWave } from "../voice/SoundWave";
import { preferredMic, useMicDevices, usePushToTalk } from "../voice/usePushToTalk";

type RunState = "off" | "starting" | "waking" | "on";

/** Off until started; "waking" while live agents boot (no agent has spoken yet); then on. */
function runState(world: World, pending: boolean): RunState {
  if (world.status !== "running") return pending ? "starting" : "off";
  const agentSpoke = world.log.some((e) => e.kind === "message" && agentIdFromRelayName(e.from));
  return agentSpoke ? "on" : "waking";
}

type Props = {
  world: World;
  operator: Operator;
  visible: boolean;
  onToggle(): void;
  /** Agent waiting on a hint; voice and typed whispers go to them first. */
  hintAgent?: AgentId;
  voicesOn: boolean;
  onToggleVoices(): void;
};

export function OperatorBar({ world, operator, visible, onToggle, hintAgent, voicesOn, onToggleVoices }: Props) {
  const [picked, setPicked] = useState<AgentId>("locksmith");
  const [text, setText] = useState("");
  const [mic, setMic] = useState("");
  const [micChosen, setMicChosen] = useState(false);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // A pending hint question selects its asker until the operator clicks someone else.
  const [override, setOverride] = useState(false);
  useEffect(() => setOverride(false), [hintAgent]);
  const target = hintAgent && !override ? hintAgent : picked;
  const state = runState(world, pending);

  const { devices, refresh } = useMicDevices();
  // Auto-pick a USB/external mic until the operator chooses one by hand.
  useEffect(() => {
    if (!micChosen) setMic(preferredMic(devices));
  }, [devices, micChosen]);

  useEffect(() => {
    if (world.status === "running" || !pending) return;
    const t = setTimeout(() => setPending(false), 15_000);
    return () => clearTimeout(t);
  }, [world.status, pending]);
  useEffect(() => {
    if (world.status === "running") setPending(false);
  }, [world.status]);

  const start = useCallback(() => {
    if (state !== "off") return clickSound("off");
    clickSound("on");
    setPending(true);
    // A finished run needs a reset first; replay does reset + wait + start in one press.
    if (world.status === "escaped" || world.status === "failed") operator.replay();
    else operator.start();
  }, [state, operator, world.status]);
  const onText = useCallback((t: string) => operator.whisper(target, t), [operator, target]);
  const talk = usePushToTalk(mic, onText, refresh);

  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    const onDown = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "v") {
        e.preventDefault();
        if (!e.repeat) void talk.start();
      } else if (k === "s") start();
      else if (k === "c") operator.collapse();
      else if (k === "h") onToggle();
      else if (k === "w") {
        e.preventDefault();
        if (!visible) onToggle();
        setTimeout(() => input.current?.focus(), 0);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "v") talk.stop();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [operator, visible, onToggle, talk, start]);

  const whisper = () => {
    if (!text.trim()) return;
    operator.whisper(target, text.trim());
    setText("");
    input.current?.blur();
  };

  // The wave shows even with the bar hidden (H), so hold-V still gives feedback on camera.
  const wave = <SoundWave stream={talk.stream} color={AGENTS[target].color} label={`Operator → ${AGENTS[target].relayName}`} />;
  if (!visible) return wave;
  const color = AGENTS[target].color;
  const talkLabel = { idle: "Hold V to talk", listening: "Listening…", transcribing: "Transcribing…", error: "Mic error, retry" }[talk.state];

  return (
    <>
      {wave}
    <footer className="flex h-[64px] items-center gap-3 border-t border-line px-8">
      <span className="label mr-1">Operator</span>
      <StartButton state={state} onClick={start} />
      <Btn onClick={operator.scripted}>Scripted</Btn>
      <Btn onClick={operator.collapse} danger>
        Collapse <Kbd>C</Kbd>
      </Btn>

      <div className="glass ml-1 flex flex-1 items-center gap-2 !rounded-xl px-2 py-1.5" style={hintAgent ? { borderColor: color, boxShadow: `0 0 18px ${color}55` } : undefined}>
        <button
          onPointerDown={() => void talk.start()}
          onPointerUp={talk.stop}
          onPointerLeave={talk.stop}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[12px] uppercase tracking-wider ${
            talk.state === "listening" ? "bg-blood/20 text-blood" : talk.state === "transcribing" ? "text-candle" : "text-bone/80 hover:text-teal"
          }`}
        >
          <span className={`size-2.5 rounded-full ${talk.state === "listening" ? "animate-pulse bg-blood" : "bg-teal/70"}`} />
          🎙 {talkLabel}
        </button>
        <span className="font-mono text-xs text-muted">to</span>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Talk to">
          {AGENT_IDS.map((id) => {
            const on = id === target;
            const c = AGENTS[id].color;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                title={`Talk to the ${AGENTS[id].relayName}`}
                onClick={() => {
                  clickSound("on");
                  setPicked(id);
                  setOverride(true);
                }}
                className={`relative rounded-full transition-all ${on ? "scale-110" : "opacity-45 grayscale hover:opacity-80 hover:grayscale-0"}`}
              >
                <img
                  src={portraitFor(id)}
                  alt={AGENTS[id].relayName}
                  className="size-10 rounded-full border-2 object-cover object-top"
                  style={{ borderColor: c, boxShadow: on ? `0 0 14px ${c}` : "none" }}
                />
                {on && <span className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full" style={{ background: c }} />}
              </button>
            );
          })}
        </div>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") whisper();
            if (e.key === "Escape") input.current?.blur();
          }}
          placeholder={hintAgent ? `Answer ${AGENTS[hintAgent].relayName}'s question…` : "…or type a private order (W)"}
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-bone placeholder:text-muted outline-none"
        />
        <Btn onClick={whisper}>Send</Btn>
      </div>

      <select
        value={mic}
        onChange={(e) => {
          setMic(e.target.value);
          setMicChosen(true);
        }}
        title="Microphone"
        className="w-36 truncate rounded-xl border border-line bg-transparent px-2 py-2 font-mono text-[11px] text-muted outline-none"
      >
        <option value="" className="bg-ink">Default mic</option>
        {devices
          .filter((d) => d.deviceId && d.deviceId !== "default")
          .map((d) => (
            <option key={d.deviceId} value={d.deviceId} className="bg-ink">
              {d.label || "Microphone"}
            </option>
          ))}
      </select>
      <Btn onClick={onToggleVoices}>{voicesOn ? "🔊 Voices" : "🔇 Muted"}</Btn>
      <Btn onClick={operator.reset}>Reset</Btn>
      <Btn onClick={onToggle}>
        <Kbd>H</Kbd>
      </Btn>
    </footer>
    </>
  );
}

const START_LOOK: Record<RunState, { label: string; dot: string; cls: string }> = {
  off: { label: "Start", dot: "bg-ink/60", cls: "bg-gradient-to-r from-teal to-magenta text-ink shadow-[0_0_20px_rgb(0_245_212/0.3)] hover:brightness-110 active:scale-95" },
  starting: { label: "Starting…", dot: "bg-candle animate-pulse", cls: "border border-candle/60 text-candle" },
  waking: { label: "Waking agents…", dot: "bg-candle animate-pulse", cls: "border border-candle/60 text-candle" },
  on: { label: "Live", dot: "bg-teal animate-pulse shadow-[0_0_10px_#00f5d4]", cls: "border border-teal/70 bg-teal/10 text-teal" },
};

/** Start shows whether the run is off, starting, waking its agents, or live. */
function StartButton({ state, onClick }: { state: RunState; onClick(): void }) {
  const look = START_LOOK[state];
  return (
    <button
      onClick={onClick}
      aria-pressed={state !== "off"}
      title={state === "off" ? "Start a live run (S)" : "Run is on. Reset to stop it."}
      className={`flex items-center gap-2.5 rounded-xl px-5 py-2 font-mono text-sm font-bold uppercase tracking-widest transition-all ${look.cls}`}
    >
      <span className={`size-2.5 rounded-full ${look.dot}`} />
      {look.label}
      <span className={`rounded px-1.5 text-[10px] ${state === "off" ? "bg-ink/20" : "bg-current/15"}`}>{state === "off" ? "OFF" : "ON"}</span>
    </button>
  );
}

function Btn({ children, onClick, danger }: { children: React.ReactNode; onClick(): void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 font-mono text-[12px] uppercase tracking-wider transition-colors ${
        danger ? "border-blood/50 text-blood hover:bg-blood/10" : "border-line text-bone/80 hover:border-teal/50 hover:text-teal"
      }`}
    >
      {children}
    </button>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-current/40 px-1.5 text-[10px] opacity-70">{children}</kbd>
);
