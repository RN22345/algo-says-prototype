/* WebAudio: three short original loops (rendered offline and looped) and short synth sound effects. Nothing starts before a click.
   Levels come from the prefs (js/pc/prefs.js): master, music, effects, mute. */
let ctx = null, master = null, musicGain = null, sfxGain = null, src = null, srcGain = null, now = -1, worldLoop = false, noiseBuf = null;
let lv = [0.7, 0.8, 0.8, false]; // master, music, effects, muted
const cache = {};

export const LOOPS = [
  { name: "Sunny Shelf", bpm: 112, wave: "square", lg: 0.05, lead: [72, 0, 76, 79, 0, 81, 79, 76, 74, 0, 76, 74, 72, 0, 67, 0], bass: [48, 0, 48, 0, 55, 0, 55, 0, 57, 0, 57, 0, 53, 0, 55, 0], bw: "triangle", hat: 0.5 },
  { name: "Late Parcels", bpm: 84, wave: "sine", lg: 0.12, lead: [69, 72, 76, 72, 69, 72, 74, 72, 67, 71, 74, 71, 67, 71, 72, 71], bass: [45, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 40, 0, 0, 0], bw: "sine", hat: 0 },
  { name: "Rider Rush", bpm: 140, wave: "square", lg: 0.04, lead: [76, 79, 83, 79, 76, 79, 83, 88, 74, 77, 81, 77, 74, 77, 81, 86], bass: [40, 40, 52, 40, 40, 40, 52, 40, 43, 43, 55, 43, 45, 45, 57, 45], bw: "sawtooth", hat: 1 }
];

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); musicGain = ctx.createGain(); sfxGain = ctx.createGain();
    musicGain.connect(master); sfxGain.connect(master); master.connect(ctx.destination); setLevels(...lv);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return true;
}

export const ready = () => !!ctx && ctx.state === "running";

export function setLevels(m, mu, sx = lv[2], muted = lv[3]) {
  lv = [m, mu, sx, !!muted];
  if (!master) return;
  const t = ctx.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, t, 0.015);
  set(master, muted ? 0 : m); set(musicGain, mu); set(sfxGain, sx);
}

async function render(i) {
  if (cache[i]) return cache[i];
  const L = LOOPS[i], sr = 22050, step = 60 / L.bpm / 2, n = L.lead.length;
  const oc = new OfflineAudioContext(1, Math.ceil(sr * step * n), sr);
  const tone = (t, midi, type, g, d) => {
    const o = oc.createOscillator(), a = oc.createGain(); o.type = type; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(a); a.connect(oc.destination); o.start(t); o.stop(t + d + 0.02);
  };
  const nb = oc.createBuffer(1, sr * 0.05, sr), nd = nb.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  for (let k = 0; k < n; k++) {
    const t = k * step;
    if (L.lead[k]) tone(t, L.lead[k], L.wave, L.lg, step * 1.5);
    if (L.bass[k]) tone(t, L.bass[k], L.bw, 0.16, step * 1.8);
    if (L.hat && k % 2) { const s = oc.createBufferSource(), a = oc.createGain(); s.buffer = nb; a.gain.value = 0.04 * L.hat; s.connect(a); a.connect(oc.destination); s.start(t); }
  }
  return (cache[i] = await oc.startRendering());
}

/* `opts.level` makes the loop quieter than in the Music app (0 to 1). `opts.world` marks it as the background music of the world. */
export async function playLoop(i, opts = {}) {
  if (!unlock()) return false;
  stopLoop(); now = i; worldLoop = !!opts.world;
  const buf = await render(i); if (now !== i) return false;
  src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  srcGain = ctx.createGain(); srcGain.gain.value = opts.level == null ? 1 : opts.level;
  src.connect(srcGain); srcGain.connect(musicGain); src.start();
  return true;
}

export function stopLoop() {
  if (src) { try { src.stop(); } catch (e) { /* already stopped */ } src.disconnect(); src = null; }
  if (srcGain) { srcGain.disconnect(); srcGain = null; }
  now = -1; worldLoop = false;
}
export const playing = () => now;
export const isWorldLoop = () => worldLoop && now >= 0;

/* Short effect beep (used by the parcel catch game). Silent until audio was unlocked by a click. */
export function sfx(freq, dur = 0.08, type = "square") {
  if (!ctx || ctx.state !== "running") return;
  const o = ctx.createOscillator(), a = ctx.createGain(); o.type = type; o.frequency.value = freq;
  a.gain.setValueAtTime(0.12, ctx.currentTime); a.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(a); a.connect(sfxGain); o.start(); o.stop(ctx.currentTime + dur + 0.02);
}

/* ---------- game sound effects: short original synth sounds, no files ----------
   n: tones   [freq or [from, to], start s, length s, wave, gain, optional low-pass Hz]
   z: noise   [start s, length s, filter type, filter Hz or [from, to], gain, Q] */
const SFX = {
  click: { n: [[[1100, 700], 0, 0.04, "triangle", 0.17]] },
  pick: { n: [[[480, 760], 0, 0.08, "sine", 0.22]] },
  shelve: { n: [[[260, 170], 0, 0.1, "sine", 0.3]], z: [[0, 0.04, "bandpass", 1800, 0.08, 1]] },
  pack: { n: [[[200, 110], 0.02, 0.12, "sine", 0.26]], z: [[0, 0.12, "bandpass", 2600, 0.2, 0.8], [0.1, 0.1, "bandpass", 1800, 0.16, 0.8]] },
  order: { n: [[784, 0, 0.16, "sine", 0.24], [1175, 0.12, 0.34, "sine", 0.24], [2350, 0.12, 0.2, "sine", 0.05]] },
  cash: { n: [[1319, 0, 0.09, "square", 0.06, 3000], [1976, 0.07, 0.45, "sine", 0.2], [2637, 0.07, 0.35, "sine", 0.08], [3951, 0.07, 0.25, "sine", 0.05]] },
  buy: { n: [[587, 0, 0.1, "triangle", 0.26], [880, 0.08, 0.1, "triangle", 0.26], [1175, 0.16, 0.24, "triangle", 0.24]] },
  post: { n: [[[300, 900], 0, 0.22, "sine", 0.2], [1047, 0.2, 0.12, "triangle", 0.2], [1319, 0.3, 0.22, "triangle", 0.2]], z: [[0, 0.22, "bandpass", [600, 3000], 0.07, 1]] },
  chat: { n: [[[620, 980], 0, 0.07, "sine", 0.24], [[760, 1180], 0.09, 0.09, "sine", 0.2]] },
  rider: { n: [[523, 0, 0.11, "square", 0.14, 1800], [523, 0.17, 0.17, "square", 0.14, 1800]] },
  missed: { n: [[392, 0, 0.16, "triangle", 0.26], [294, 0.15, 0.3, "triangle", 0.26]] },
  hit: { n: [[880, 0, 0.07, "square", 0.08, 3000], [1320, 0, 0.1, "sine", 0.22]] },
  miss: { n: [[[170, 70], 0, 0.16, "sawtooth", 0.26, 500]] },
  claim: { n: [[[660, 990], 0, 0.09, "triangle", 0.26], [1320, 0.07, 0.14, "sine", 0.14]] },
  joy: { n: [[560, 0, 0.1, "sine", 0.24], [420, 0.1, 0.1, "sine", 0.24], [520, 0.2, 0.1, "sine", 0.24], [330, 0.3, 0.24, "sine", 0.24]] },
  done: { n: [[523, 0, 0.12, "triangle", 0.24], [659, 0.1, 0.12, "triangle", 0.24], [784, 0.2, 0.12, "triangle", 0.24], [1047, 0.3, 0.4, "triangle", 0.26], [2093, 0.3, 0.3, "sine", 0.05]] },
  error: { n: [[180, 0, 0.1, "square", 0.17, 700], [150, 0.13, 0.17, "square", 0.17, 700]] },
  trend: { n: [[1319, 0, 0.18, "sine", 0.22], [1661, 0.07, 0.18, "sine", 0.22], [1976, 0.14, 0.2, "sine", 0.22], [2637, 0.21, 0.36, "sine", 0.22]] }
};
export const SFX_NAMES = Object.keys(SFX);
const lastAt = {};

function envelope(g, t0, dur, peak) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
const sweep = (p, v, t0, dur) => { if (Array.isArray(v)) { p.setValueAtTime(v[0], t0); p.exponentialRampToValueAtTime(v[1], t0 + dur); } else p.setValueAtTime(v, t0); };

/* Play a named effect. Returns false when it did not play (audio locked or muted, unknown name, or the same effect played a moment ago). */
export function playSfx(name) {
  const d = SFX[name];
  if (!d || !ctx || ctx.state !== "running" || lv[3]) return false;
  const nowMs = performance.now();
  if (nowMs - (lastAt[name] || -1e9) < 45) return false;
  lastAt[name] = nowMs;
  const t = ctx.currentTime + 0.005;
  (d.n || []).forEach(([f, s, dur, type, g, lp]) => {
    const o = ctx.createOscillator(), a = ctx.createGain(); o.type = type;
    sweep(o.frequency, f, t + s, dur); envelope(a, t + s, dur, g);
    if (lp) { const l = ctx.createBiquadFilter(); l.type = "lowpass"; l.frequency.value = lp; o.connect(l); l.connect(a); } else o.connect(a);
    a.connect(sfxGain); o.start(t + s); o.stop(t + s + dur + 0.03);
  });
  (d.z || []).forEach(([s, dur, ft, f, g, q]) => {
    const o = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), a = ctx.createGain(); o.buffer = noiseBuf; fl.type = ft; fl.Q.value = q || 1;
    sweep(fl.frequency, f, t + s, dur); envelope(a, t + s, dur, g);
    o.connect(fl); fl.connect(a); a.connect(sfxGain); o.start(t + s); o.stop(t + s + dur + 0.03);
  });
  return true;
}
