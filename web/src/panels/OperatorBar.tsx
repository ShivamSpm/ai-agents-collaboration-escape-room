// Operator controls. Hotkeys: S start, C collapse, W whisper, H hide/show this bar.
import { useEffect, useRef, useState } from "react";
import { AGENT_IDS, AGENTS } from "../../../shared/map";
import type { AgentId } from "../../../shared/types";
import type { Operator } from "../state/useWorld";

export function OperatorBar({ operator, visible, onToggle }: { operator: Operator; visible: boolean; onToggle(): void }) {
  const [agent, setAgent] = useState<AgentId>("locksmith");
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") operator.start();
      else if (k === "c") operator.collapse();
      else if (k === "h") onToggle();
      else if (k === "w") {
        e.preventDefault();
        if (!visible) onToggle();
        setTimeout(() => input.current?.focus(), 0);
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [operator, visible, onToggle]);

  const whisper = () => {
    if (!text.trim()) return;
    operator.whisper(agent, text.trim());
    setText("");
    input.current?.blur();
  };

  if (!visible) return null;
  return (
    <footer className="flex h-[64px] items-center gap-3 border-t border-line px-8">
      <span className="label mr-2">Operator</span>
      <button onClick={operator.start} className="rounded-xl bg-gradient-to-r from-teal to-magenta px-5 py-2 font-mono text-sm font-bold uppercase tracking-widest text-ink shadow-[0_0_20px_rgb(0_245_212/0.3)] hover:brightness-110">
        Start <Kbd>S</Kbd>
      </button>
      <Btn onClick={operator.scripted}>Scripted run</Btn>
      <Btn onClick={operator.collapse} danger>
        Collapse corridor <Kbd>C</Kbd>
      </Btn>
      <div className="glass ml-2 flex flex-1 items-center gap-2 !rounded-xl px-2 py-1.5">
        <span className="pl-1">🔒</span>
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value as AgentId)}
          className="rounded-lg bg-transparent px-2 py-1 font-mono text-sm outline-none"
          style={{ color: AGENTS[agent].color }}
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
          placeholder="Whisper a private order…  (W)"
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-bone placeholder:text-muted outline-none"
        />
        <Btn onClick={whisper}>Send</Btn>
      </div>
      <Btn onClick={operator.reset}>Reset</Btn>
      <Btn onClick={onToggle}>
        Hide <Kbd>H</Kbd>
      </Btn>
    </footer>
  );
}

function Btn({ children, onClick, danger }: { children: React.ReactNode; onClick(): void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-[13px] uppercase tracking-wider transition-colors ${
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
