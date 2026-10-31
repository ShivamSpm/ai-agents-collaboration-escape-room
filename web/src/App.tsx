// Hollow Manor at exactly 1920x1080, scaled to fit smaller windows while developing.
import { useCallback, useEffect, useState } from "react";
import { HouseMap } from "./map/HouseMap";
import { HintCard } from "./overlays/HintCard";
import { CollapseBanner, CrashOverlay, EndCard } from "./overlays/Overlays";
import { AgentCards } from "./panels/AgentCards";
import { ObjectiveBanner } from "./panels/ObjectiveBanner";
import { Objectives } from "./panels/Objectives";
import { OperatorBar } from "./panels/OperatorBar";
import { RelayFeed } from "./panels/RelayFeed";
import { TopBar } from "./panels/TopBar";
import { PresentationContext, readPresentation } from "./lib/presentation";
import { useFreshEntries } from "./state/useFreshEntries";
import { readMode, useWorld } from "./state/useWorld";
import { hintState } from "./voice/hints";
import { useVoices } from "./voice/useVoices";

const W = 1920;
const H = 1080;

function useStageScale() {
  const fit = () => Math.min(window.innerWidth / W, window.innerHeight / H);
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

export default function App() {
  const [mode] = useState(readMode);
  const { world, connection, operator } = useWorld(mode);
  const batch = useFreshEntries(world);
  const [present, setPresent] = useState(readPresentation);
  // The operator bar is for the operator, not the judges: hidden by default in presentation mode (H shows it).
  const [barVisible, setBarVisible] = useState(() => !readPresentation());
  const toggleBar = useCallback(() => setBarVisible((v) => !v), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
      if (typing || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "p") return;
      setPresent((p) => {
        setBarVisible(p); // entering presentation hides the bar; leaving it shows the bar again
        return !p;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [voicesOn, setVoicesOn] = useState(true);
  const [talking, setTalking] = useState(false);
  const { speaking, blocked: voicesBlocked } = useVoices(batch, voicesOn, talking);
  const hintAgent = hintState(world).pending?.agent;
  const scale = useStageScale();

  return (
    <PresentationContext.Provider value={present}>
    <div className="relative h-full w-full overflow-hidden">
      <div
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
        className="absolute left-1/2 top-1/2 flex flex-col"
      >
        <TopBar world={world} connection={connection} />
        <main className="flex min-h-0 flex-1 gap-6 px-8 pt-3">
          <section className="relative flex w-[1320px] shrink-0 flex-col">
            <ObjectiveBanner world={world} />
            <div className="glass relative min-h-0 flex-1 overflow-hidden p-2">
              <HouseMap world={world} batch={batch} speaking={speaking} />
              <CollapseBanner batch={batch} />
              <HintCard world={world} />
              {voicesBlocked && (
                <div className="absolute left-4 top-4 z-20 animate-pulse rounded-xl border border-candle/70 bg-ink/90 px-4 py-2 font-mono text-[13px] uppercase tracking-widest text-candle">
                  🔇 The browser blocked the voices: click anywhere to turn them on
                </div>
              )}
            </div>
            {!present && <Objectives world={world} />}
          </section>
          <aside className="flex min-h-0 flex-1 flex-col gap-4 pb-5">
            <AgentCards world={world} speaking={speaking} />
            <RelayFeed world={world} />
          </aside>
        </main>
        <OperatorBar
          world={world}
          operator={operator}
          visible={barVisible}
          onToggle={toggleBar}
          hintAgent={hintAgent}
          voicesOn={voicesOn}
          onToggleVoices={() => setVoicesOn((v) => !v)}
          onTalking={setTalking}
        />
        <CrashOverlay connection={connection} world={world} batch={batch} />
        <EndCard world={world} onReplay={operator.replay} />
      </div>
    </div>
    </PresentationContext.Provider>
  );
}
