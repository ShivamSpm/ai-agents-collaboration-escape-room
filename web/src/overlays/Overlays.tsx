// Collapse banner, crash ("the manor has gone silent"), resume banner, and the end card.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { World } from "../../../shared/types";
import { clickSound } from "../lib/clickSound";
import { formatDuration } from "../panels/TopBar";
import type { FreshBatch } from "../state/useFreshEntries";
import type { Connection } from "../state/useWorld";

/** Shows a banner for `ms` whenever a matching event arrives. */
function useEventBanner(batch: FreshBatch, event: string, ms: number) {
  const [shownAt, setShownAt] = useState<number | null>(null);
  useEffect(() => {
    if (!batch.items.some(({ entry }) => entry.kind === "event" && entry.event === event)) return;
    setShownAt(batch.id);
    const t = setTimeout(() => setShownAt(null), ms);
    return () => clearTimeout(t);
  }, [batch, event, ms]);
  return shownAt !== null;
}

export function CollapseBanner({ batch }: { batch: FreshBatch }) {
  const show = useEventBanner(batch, "collapse", 3000);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x: "-110%" }}
          animate={{ x: 0 }}
          exit={{ x: "110%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className="pointer-events-none absolute left-1/2 top-10 -ml-[360px] w-[720px] rounded-2xl border border-blood/70 bg-blood/15 px-8 py-4 text-center font-mono text-xl font-bold uppercase tracking-[0.2em] text-blood shadow-[0_0_40px_rgb(239_68_68/0.35)] backdrop-blur"
        >
          The East Corridor has collapsed
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Resume window: a "resumed" event only counts as a crash recovery if the socket dropped shortly before. */
const RESUME_WINDOW_MS = 30_000;

export function CrashOverlay({ connection, world, batch }: { connection: Connection; world: World; batch: FreshBatch }) {
  // Durable actors also reload after ~10s idle, and each reload logs "resumed"; only a real drop earns the banner.
  const [lostAt, setLostAt] = useState<number | null>(null);
  useEffect(() => {
    if (connection === "lost") setLostAt(Date.now());
  }, [connection]);
  const resumedEvent = useEventBanner(batch, "resumed", 4000);
  const resumed = resumedEvent && lostAt !== null && Date.now() - lostAt < RESUME_WINDOW_MS;
  return (
    <>
      <AnimatePresence>
        {connection === "lost" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-20 grid place-items-center bg-black/85"
          >
            <div className="text-center">
              <motion.div
                className="mx-auto mb-6 h-10 w-3 rounded-full bg-candle shadow-[0_0_30px_#f5b041]"
                animate={{ opacity: [0.3, 1, 0.5, 1, 0.3], scaleY: [0.9, 1.05, 0.95, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <div className="font-spooky text-5xl text-bone">The manor has gone silent…</div>
              <div className="mt-3 font-mono text-sm uppercase tracking-[0.2em] text-muted">reconnecting · last saved rev {world.rev}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {resumed && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-10 z-20 -ml-[330px] w-[660px] rounded-2xl border border-teal/60 bg-teal/10 px-8 py-4 text-center font-mono text-lg uppercase tracking-[0.18em] text-teal shadow-[0_0_40px_rgb(0_245_212/0.3)] backdrop-blur"
          >
            The manor stirs. State restored at rev {world.rev}.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function EndCard({ world, onReplay }: { world: World; onReplay(): void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (world.status !== "escaped") return setShow(false);
    // Let the last tokens reach the Crypt first.
    const t = setTimeout(() => setShow(true), 2600);
    return () => clearTimeout(t);
  }, [world.status]);

  const time = world.startedAt && world.endedAt ? formatDuration(world.endedAt - world.startedAt) : "--:--";
  const stats = [
    ["Time", time],
    ["Actions", world.stats.actions],
    ["Messages", world.stats.messages],
    ["Wrong codes", world.stats.wrongCodes],
  ] as const;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 z-30 grid place-items-center bg-ink/92"
        >
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.4, type: "spring" }} className="text-center">
            <div className="font-spooky text-[140px] leading-none text-candle drop-shadow-[0_0_40px_rgb(245_176_65/0.5)]">Escaped</div>
            <div className="mt-10 flex justify-center gap-6">
              {stats.map(([label, value]) => (
                <div key={label} className="glass w-48 px-6 py-5">
                  <div className="label">{label}</div>
                  <div className="mt-2 font-mono text-4xl tabular-nums text-bone">{value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                clickSound("on");
                setShow(false);
                onReplay();
              }}
              className="mt-10 rounded-2xl bg-gradient-to-r from-teal to-magenta px-8 py-3 font-mono text-lg font-bold uppercase tracking-[0.2em] text-ink shadow-[0_0_30px_rgb(0_245_212/0.35)] hover:brightness-110 active:scale-95"
            >
              ↻ Play again
            </button>
            <div className="mt-8 font-mono text-sm uppercase tracking-[0.3em] text-muted">Built with Agent Relay + Durable Actors</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
