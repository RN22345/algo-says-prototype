/* WebAudio: three short original loops, rendered offline and looped. Nothing starts before a click. */
let ctx = null, master = null, musicGain = null, src = null, now = -1, lv = [0.7, 0.8];
const cache = {};

export const LOOPS = [
  { name: "Sunny Shelf", bpm: 112, wave: "square", lg: 0.05, lead: [72, 0, 76, 79, 0, 81, 79, 76, 74, 0, 76, 74, 72, 0, 67, 0], bass: [48, 0, 48, 0, 55, 0, 55, 0, 57, 0, 57, 0, 53, 0, 55, 0], bw: "triangle", hat: 0.5 },
  { name: "Late Parcels", bpm: 84, wave: "sine", lg: 0.12, lead: [69, 72, 76, 72, 69, 72, 74, 72, 67, 71, 74, 71, 67, 71, 72, 71], bass: [45, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 40, 0, 0, 0], bw: "sine", hat: 0 },
  { name: "Rider Rush", bpm: 140, wave: "square", lg: 0.04, lead: [76, 79, 83, 79, 76, 79, 83, 88, 74, 77, 81, 77, 74, 77, 81, 86], bass: [40, 40, 52, 40, 40, 40, 52, 40, 43, 43, 55, 43, 45, 45, 57, 45], bw: "sawtooth", hat: 1 }
];

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); musicGain = ctx.createGain();
    musicGain.connect(master); master.connect(ctx.destination); setLevels(...lv);
  }
  if (ctx.state === "suspended") ctx.resume();
  return true;
}

export function setLevels(m, mu) { lv = [m, mu]; if (master) { master.gain.value = m; musicGain.gain.value = mu; } }

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

export async function playLoop(i) {
  if (!unlock()) return false;
  stopLoop(); now = i;
  const buf = await render(i); if (now !== i) return false;
  src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(musicGain); src.start();
  return true;
}

export function stopLoop() { if (src) { try { src.stop(); } catch (e) { /* already stopped */ } src.disconnect(); src = null; } now = -1; }
export const playing = () => now;

/* Short effect beep. Silent until audio was unlocked by a click. */
export function sfx(freq, dur = 0.08, type = "square") {
  if (!ctx || ctx.state !== "running") return;
  const o = ctx.createOscillator(), a = ctx.createGain(); o.type = type; o.frequency.value = freq;
  a.gain.setValueAtTime(0.12, ctx.currentTime); a.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(a); a.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
}
