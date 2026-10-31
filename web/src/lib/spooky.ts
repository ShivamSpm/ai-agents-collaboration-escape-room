// Halloween atmosphere: low looping background music (ducked under voices) and evil laughs for objectives.
// Sounds were generated with ElevenLabs (music + sound effects) at the event; see public/sfx/.
const MUSIC_VOLUME = 0.14;
const DUCKED_VOLUME = 0.05;
const LAUGHS = ["/sfx/laugh-1.mp3", "/sfx/laugh-2.mp3"];

let music: HTMLAudioElement | null = null;
let ducked = false;
let laughTurn = 0;

function track() {
  if (!music) {
    music = new Audio("/sfx/halloween-bg.mp3");
    music.loop = true;
    music.volume = MUSIC_VOLUME;
  }
  return music;
}

/** Starts or stops the background loop. Browsers allow it only after a click or key press. */
export function setMusic(on: boolean) {
  const m = track();
  if (on) void m.play().catch(() => {});
  else m.pause();
}

/** Lower the music while someone is speaking so voices stay clear. */
export function duckMusic(on: boolean) {
  if (on === ducked || !music) return;
  ducked = on;
  const from = music.volume;
  const to = on ? DUCKED_VOLUME : MUSIC_VOLUME;
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / 400);
    if (music) music.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Alternates between the two laughs so back-to-back objectives don't sound identical. */
export function evilLaugh() {
  const a = new Audio(LAUGHS[laughTurn++ % LAUGHS.length]);
  a.volume = 0.8;
  void a.play().catch(() => {});
}
