// Live sound wave of the operator's mic while push-to-talk is held.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

const BARS = 48;

export function SoundWave({ stream, color, label }: { stream: MediaStream | null; color: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvas.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const g = canvas.current.getContext("2d")!;
    const { width: w, height: h } = canvas.current;
    let raf = 0;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      g.clearRect(0, 0, w, h);
      const gap = 4;
      const bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        // Mirror around the centre so the wave grows outward from the middle.
        const bin = data[Math.floor((Math.abs(i - BARS / 2) / (BARS / 2)) * data.length * 0.6)] / 255;
        const bh = Math.max(4, bin * h);
        g.fillStyle = color;
        g.shadowColor = color;
        g.shadowBlur = 12;
        g.globalAlpha = 0.45 + bin * 0.55;
        g.beginPath();
        g.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [stream, color]);

  return (
    <AnimatePresence>
      {stream && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          className="pointer-events-none absolute bottom-[96px] left-[652px] z-20 -translate-x-1/2 rounded-2xl border bg-ink/90 px-6 pb-3 pt-2 backdrop-blur"
          style={{ borderColor: color, boxShadow: `0 0 36px ${color}55` }}
        >
          <div className="mb-1 flex items-center justify-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em]" style={{ color }}>
            <span className="size-2 animate-pulse rounded-full bg-blood" />
            {label}
          </div>
          <canvas ref={canvas} width={560} height={72} className="block" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
