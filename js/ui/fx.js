/* FX. Small world effects so things never just pop in or vanish: appear(key) gives a springy scale and fade for a thing that was not
   there a moment ago; puff(x, y) leaves a dust puff where something left. Keys are strings chosen by the caller (a station id,
   "door:2"). Unity: appear is a scale tween on spawn (DOTween-style), puff a small particle burst.
   Exports: appear(key, now) -> {s, a, z}, seenBefore(key), forget(prefix, alive), puff(x, y, col), drawPuffs(g, now). */
import { P } from "./proj.js";

const seen = new Map(), puffs = [];
const DUR = 420;
let armed = false;
/* Nothing pops during the first second (the world appears as a whole when the game starts). */
setTimeout(() => { armed = true; }, 1000);
export function appear(key, now = performance.now()) {
  if (!seen.has(key)) seen.set(key, armed ? now : -1e9);
  const t = Math.min(1, (now - seen.get(key)) / DUR);
  if (t >= 1) return { s: 1, a: 1, z: 0, done: true };
  const u = t - 1, s = Math.max(0.01, 1 + 2.7 * u * u * u + 1.7 * u * u);   // back-out ease
  return { s, a: Math.min(1, t * 3), z: (1 - t) * (1 - t) * 0.6, done: false };
}
export const seenBefore = key => seen.has(key);
/* Drop keys with this prefix that are not in alive, so they pop again if they come back. Returns the dropped keys. */
export function forget(prefix, alive) {
  const out = [];
  for (const k of seen.keys()) if (k.startsWith(prefix) && !alive.has(k)) { seen.delete(k); out.push(k); }
  return out;
}
export function puff(x, y, col = "255,255,255") { if (armed) puffs.push({ x, y, t0: performance.now(), col }); }
export function drawPuffs(g, now) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i], t = (now - p.t0) / 600; if (t >= 1) { puffs.splice(i, 1); continue; }
    const [sx, sy] = P(p.x, p.y);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, r = 14 + t * 34;
      g.fillStyle = `rgba(${p.col},${0.7 * (1 - t)})`; g.beginPath(); g.arc(sx + Math.cos(a) * r, sy - 12 + Math.sin(a) * r * 0.5 - t * 18, 10 * (1 - t * 0.5), 0, Math.PI * 2); g.fill();
    }
  }
}
