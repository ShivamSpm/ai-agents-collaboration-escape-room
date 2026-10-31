// Operator controls. Hotkeys: S start, C collapse, W type a whisper, hold V to talk, H hide/show this bar.
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENT_IDS, AGENTS } from "../../../shared/map";
import type { AgentId } from "../../../shared/types";
import type { Operator } from "../state/useWorld";
import { useMicDevices, usePushToTalk } from "../voice/usePushToTalk";

type Props = {
  operator: Operator;
  visible: boolean;
  onToggle(): void;
  /** Agent waiting on a hint; voice and typed whispers go to them first. */
  hintAgent?: AgentId;
  voicesOn: boolean;
  onToggleVoices(): void;
};

export function OperatorBar({ operator, visible, onToggle, hintAgent, voicesOn, onToggleVoices }: Props) {
  const [picked, setPicked] = useState<AgentId>("locksmith");
  const [text, setText] = useState("");
  const [mic, setMic] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const target = hintAgent ?? picked;

  const { devices, refresh } = useMicDevices();
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
      } else if (k === "s") operator.start();
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
  }, [operator, visible, onToggle, talk]);

  const whisper = () => {
    if (!text.trim()) return;
    operator.whisper(target, text.trim());
    setText("");
    input.current?.blur();
  };

  if (!visible) return null;
  const color = AGENTS[target].color;
  const talkLabel = { idle: "Hold V to talk", listening: "Listening…", transcribing: "Transcribing…", error: "Mic error, retry" }[talk.state];

  return (
    <footer className="flex h-[64px] items-center gap-3 border-t border-line px-8">
      <span className="label mr-1">Operator</span>
      <button onClick={operator.start} className="rounded-xl bg-gradient-to-r from-teal to-magenta px-5 py-2 font-mono text-sm font-bold uppercase tracking-widest text-ink shadow-[0_0_20px_rgb(0_245_212/0.3)] hover:brightness-110">
        Start <Kbd>S</Kbd>
      </button>
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
        <select
          value={target}
          onChange={(e) => setPicked(e.target.value as AgentId)}
          disabled={!!hintAgent}
          className="rounded-lg bg-transparent px-1 py-1 font-mono text-sm outline-none"
          style={{ color }}
        >
          {AGENT_IDS.map((id) => (
            <option key={id} value={id} className="bg-ink">
              {AGENTS[id].relayName}
            </option>
          ))}
        </select>
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
        onChange={(e) => setMic(e.target.value)}
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
