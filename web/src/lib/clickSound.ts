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

/** A collapsing-stone rumble: a low thump, filtered noise that dies away, and a few falling-rock clacks. */
export function collapseSound() {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);

    // Deep thump.
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(70, t);
    thump.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    thump.connect(tg).connect(out);
    thump.start(t);
    thump.stop(t + 1.3);

    // Rumble: brown-ish noise through a falling low-pass.
    const len = Math.floor(ctx.sampleRate * 2.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 2.2);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(1, t + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    noise.connect(lp).connect(ng).connect(out);
    noise.start(t);

    // Falling rocks.
    for (let i = 0; i < 7; i++) {
      const at = t + 0.15 + Math.random() * 1.4;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(180 + Math.random() * 260, at);
      o.frequency.exponentialRampToValueAtTime(60, at + 0.08);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.12, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.12);
    }
  } catch {
    // Audio unavailable; the shake and banner still show.
  }
}

/** Push-to-talk cue: a soft falling "hush" when voices pause, a rising chime when they resume. */
export function talkSound(kind: "pause" | "resume") {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const notes = kind === "pause" ? [660, 440] : [440, 660];
    notes.forEach((f, i) => {
      const at = t + i * 0.07;
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      o.connect(g).connect(ctx!.destination);
      o.start(at);
      o.stop(at + 0.14);
    });
  } catch {
    // Audio unavailable; the sound wave still shows.
  }
}
