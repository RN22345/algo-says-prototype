/* TRAFFIC. Cars come now and then, not in a loop: each lane waits a random gap (longer at night, data/world.json traffic), then a car
   drives in from the island edge, fading in, and fades out at the far edge. Cars keep their lanes, keep a gap, and stop before a
   crosswalk while anyone (the player or a pedestrian) is on it. Real time, so a sleep skip does not flood the road.
   Unity: a spawner per lane with a pooled car prefab; the crosswalk check is a trigger volume.
   Exports: stepTraffic(dt, occupied), trafficItems(), carNear(crossIndex), edgeAlpha(y), trafficState. */
import { D } from "../core/data.js";
import { tod } from "../core/clock.js";
import { P } from "./proj.js";
import { hasSpr, drawSpr } from "./art.js";
import { prism, shade } from "./drawkit.js";
import { crosses } from "./world.js";

const cars = [], wait = [2, 6];
let uid = 0;
const T = () => D.world.traffic || {}, B = () => D.world.bounds;
const rr = (a, b) => a + Math.random() * (b - a);
const night = () => { const m = tod(); return m < 360 || m >= 1260; };
export const trafficState = () => cars;
/* 0 at the island edge, 1 inside, over fadeTiles. */
export function edgeAlpha(y) { const f = T().fadeTiles || 2.5, b = B(); return Math.max(0, Math.min(1, (y - b.y0 + 0.5) / f, (b.y1 + 0.5 - y) / f)); }
const lanes = () => { const R = D.world.road; return [{ dir: 1, x: R.lanes.p, id: "vh_car_green_p" }, { dir: -1, x: R.lanes.n, id: "vh_car_green_n" }]; };

function spawn(i, L) {
  const b = B(), y = L.dir > 0 ? b.y0 - 1 : b.y1 + 1, t = T();
  if (cars.some(c => c.lane === i && Math.abs(c.y - y) < 4)) return false;
  cars.push({ n: ++uid, lane: i, dir: L.dir, x: L.x, id: L.id, y, v: 0, vmax: rr(...(t.speed || [1.7, 2.3])), hue: (t.hues || [0])[Math.floor(Math.random() * (t.hues || [0]).length)], len: 2 });
  return true;
}
/* occupied: list of crosswalk indices with someone on them. */
export function stepTraffic(dt, occupied) {
  const t = T(), b = B(), L = lanes();
  L.forEach((ln, i) => {
    wait[i] -= dt;
    if (wait[i] <= 0) {
      const n = cars.filter(c => c.lane === i).length;
      if (n < (t.maxPerLane || 2) && spawn(i, ln)) wait[i] = rr(...(night() ? t.gapNight || [24, 55] : t.gapDay || [9, 22]));
      else wait[i] = 1.5;
    }
  });
  const cs = crosses();
  for (const c of cars) {
    let target = c.vmax; const half = c.len / 2;
    for (const k of occupied) {
      const [, cy0, , cd] = cs[k];
      if (c.dir > 0) { const front = c.y + half, line = cy0 - 0.3; if (front < line + 0.05 && line - front < 2.4) target = 0; }
      else { const front = c.y - half, line = cy0 + cd + 0.3; if (front > line - 0.05 && front - line < 2.4) target = 0; }
    }
    for (const o of cars) {
      if (o === c || o.lane !== c.lane) continue;
      const gap = c.dir > 0 ? (o.y - half) - (c.y + half) : (c.y - half) - (o.y + half);
      if (gap > -0.01 && gap < 1.3) target = Math.min(target, Math.max(0, o.v * 0.9));
    }
    c.v += Math.max(-6 * dt, Math.min(2.4 * dt, target - c.v)); c.y += c.dir * c.v * dt;
  }
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if ((c.dir > 0 && c.y > b.y1 + 1.5) || (c.dir < 0 && c.y < b.y0 - 1.5)) cars.splice(i, 1); }
}
/* Is a car on or about to enter crosswalk k? People wait at the curb when it is. */
export function carNear(k) {
  const [, cy0, , cd] = crosses()[k];
  return cars.some(c => { const half = c.len / 2; return c.y + half > cy0 - 1.4 && c.y - half < cy0 + cd + 1.4 && c.v > 0.2 || (c.y + half > cy0 - 0.1 && c.y - half < cy0 + cd + 0.1); });
}
function drawCar(g, c) {
  const a = edgeAlpha(c.y); if (a <= 0) return;
  const prev = g.globalAlpha; g.globalAlpha = prev * a;
  if (hasSpr(c.id)) drawSpr(g, c.id, c.x, c.y, { hue: c.hue });
  else {
    const col = ["#3ec45a", "#e8344f", "#ffc61a", "#3a7bf0", "#b744c9", "#2fd9cf"][(c.hue / 60 | 0) % 6];
    prism(g, c.x - 0.5, c.y - 1.0, 1.0, 2.0, 0.45, shade(col, 20), shade(col, -40), col);
    prism(g, c.x - 0.42, c.y - 0.6, 0.84, 0.9, 0.7, "#cfe6ff", "#8fb2d9", "#a9c8ea", 0.45);
  }
  if (night()) {   // headlights
    const [hx, hy] = P(c.x, c.y + c.dir * 1.6), gr = g.createRadialGradient(hx, hy, 4, hx, hy, 90);
    gr.addColorStop(0, "rgba(255,240,170,.45)"); gr.addColorStop(1, "rgba(255,240,170,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(hx, hy, 90, 50, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = prev;
}
export function trafficItems() {
  return cars.map(c => { const [sx, sy] = P(c.x, c.y); return { at: [c.x, c.y], d: c.x + c.y + 0.75, bb: [sx - 300, sy - 380, 600, 480], f: g => drawCar(g, c) }; });
}
