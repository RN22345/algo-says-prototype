/* Synthesised sound: sfx from the bus event "sfx" (click, coin, pop, error, rec, whoosh, ding, lesson, thud, tap) and a soft music loop.
   Starts after the first pointer or key press. Mute is saved. No audio files needed. */
import { on } from "./bus.js";
import { flag } from "./state.js";

let ctx = null, master = null, muted = false, musicOn = false, musicTimer = null;
try { muted = localStorage.getItem("algosays.mute") === "1"; musicOn = localStorage.getItem("algosays.music") !== "0"; } catch (e) { /* ignore */ }

function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  syncMusic(); return ctx;
}
function tone(freq, t0, dur, type = "sine", vol = 0.2, slide = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
const SFX = {
  click: t => tone(520, t, 0.07, "square", 0.08),
  tap: t => tone(300, t, 0.05, "triangle", 0.12),
  coin: t => { tone(988, t, 0.09, "square", 0.1); tone(1319, t + 0.08, 0.22, "square", 0.1); },
  pop: t => tone(400, t, 0.12, "sine", 0.2, 500),
  error: t => { tone(180, t, 0.18, "sawtooth", 0.12); tone(140, t + 0.12, 0.2, "sawtooth", 0.12); },
  rec: t => { tone(880, t, 0.08, "sine", 0.15); tone(880, t + 0.2, 0.08, "sine", 0.15); },
  whoosh: t => tone(700, t, 0.3, "sawtooth", 0.05, -500),
  ding: t => { tone(880, t, 0.3, "sine", 0.15); tone(1320, t + 0.1, 0.4, "sine", 0.12); },
  lesson: t => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.3, "triangle", 0.14)),
  thud: t => tone(120, t, 0.18, "sine", 0.3, -60)
};
export function play(name) {
  if (muted || !flag("sound")) return; const c = ensure(); if (!c) return;
  (SFX[name] || SFX.click)(c.currentTime + 0.005);
}
const NOTES = [262, 330, 392, 330, 294, 349, 440, 349];
function syncMusic() {
  clearInterval(musicTimer); musicTimer = null;
  if (!ctx || muted || !musicOn) return;
  let i = 0;
  musicTimer = setInterval(() => { if (ctx.state !== "running") return; const t = ctx.currentTime + 0.02; tone(NOTES[i % 8] * (i % 16 < 8 ? 1 : 1.125), t, 0.5, "triangle", 0.035); if (i % 4 === 0) tone(NOTES[i % 8] / 2, t, 0.8, "sine", 0.03); i++; }, 480);
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; try { localStorage.setItem("algosays.mute", m ? "1" : "0"); } catch (e) { /* ignore */ } syncMusic(); }
export const musicEnabled = () => musicOn;
export function setMusic(v) { musicOn = v; try { localStorage.setItem("algosays.music", v ? "1" : "0"); } catch (e) { /* ignore */ } syncMusic(); }
export function initSound() {
  on("sfx", play);
  ["pointerdown", "keydown", "touchend"].forEach(n => document.addEventListener(n, () => ensure(), { capture: true }));
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("button,.btn,.chip,.slot")) play("click"); }, true);
}
