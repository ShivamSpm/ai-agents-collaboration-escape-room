// Short synthesized UI sounds (no audio files): a rising blip for "on", a falling one for "off".
let ctx: AudioContext | null = null;

export function clickSound(kind: "on" | "off" = "on") {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    const [from, to] = kind === "on" ? [440, 880] : [520, 260];
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch {
    // Audio blocked or unavailable; the visual state still changes.
  }
}
