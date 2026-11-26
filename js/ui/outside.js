/* OUTSIDE. What the player sees beyond the front door: the courier and the sample rider (a character who walks from the curb to
   the door), the supplier van at the curb, boxes on the doorstep, packed parcels by the door, and passing traffic in two lanes.
   Visual only: the sims (stock.js, orders.js) decide what arrives and when; this file only shows it, timed by the game clock
   (courier times, supplier arrival) and by events. Cars keep their lanes and stop at the crosswalk when the player is on it.
   Uses sprites (ch_courier_0, vh_van_p, vh_car_green_p/_n, it_box, it_parcel) with code-drawn fallbacks.
   Events in: sample:arrived. Exports: trafficState, outsideItems(now, ctx) -> [{d, f(g), bb}] for depth sorting (ctx = {cross}), drawOutside(g). */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { tod } from "../core/clock.js";
import { on } from "../core/bus.js";
import { P } from "./proj.js";
import { prism, label, shade, shadow } from "./drawkit.js";
import { hasSpr, drawSpr, drawSprAt } from "./art.js";

let sampleRiderAt = -1e9;
on("sample:arrived", () => { sampleRiderAt = S.t; });

const N = () => D.room.view.Nx, doorMid = () => (D.room.front.door[0] + D.room.front.door[1]) / 2;
const Wd = () => D.world, edge = () => Wd().bounds;
/* y of a vehicle that drives in along the curb, parks from t0 to t1 (game minutes) and drives on, 6 minutes each way. */
function roadY(t, t0, t1, park) {
  const y0 = edge().y0 - 3, y1 = edge().y1 + 3;
  if (t < t0 - 6 || t > t1 + 6) return null;
  if (t < t0) return y0 + (park - y0) * (1 - (t0 - t) / 6);
  if (t > t1) return park + (t - t1) / 6 * (y1 - park);
  return park;
}
/* A person who walks from the sidewalk to the door at t0, waits until t1, walks back. */
function walker(t, t0, t1) {
  const w = 5, dm = doorMid(), c = [Wd().road.rect[0] - 0.5, dm + 0.5], d = [N() + 0.6, dm + 0.05];
  if (t < t0 - w || t > t1 + w) return null;
  const f = t < t0 ? (t - (t0 - w)) / w : t > t1 ? 1 - (t - t1) / w : 1, moving = f < 1;
  return { x: c[0] + (d[0] - c[0]) * f, y: c[1] + (d[1] - c[1]) * f, moving, face: t > t1 ? 1 : -1, at: !moving };
}
function person(g, who, text, col, hue) {
  const bob = who.moving ? Math.abs(Math.sin(performance.now() / 110)) * 5 : 0;
  shadow(g, who.x, who.y, 0.3, 0.18);
  if (hasSpr("ch_courier_0")) drawSprAt(g, "ch_courier_0", ...P(who.x, who.y), { flip: who.face < 0, lift: bob, hue });
  else {   // old stand-in: a scooter with a rider
    prism(g, who.x - 0.2, who.y - 0.4, 0.45, 1.0, 0.32, col, shade(col, -30), shade(col, -15));
    const [hx, hy] = P(who.x, who.y, 0.95); g.fillStyle = "#1c2452"; g.beginPath(); g.roundRect ? g.roundRect(hx - 11, hy, 22, 30, 8) : g.rect(hx - 11, hy, 22, 30); g.fill();
    g.fillStyle = col; g.strokeStyle = "#1c2452"; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy - 6, 12, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  if (text && who.at) label(g, who.x, who.y, 2.0, text, col);
}

/* ---------- traffic ---------- */
let cars = null, lastNow = 0;
function makeCars() {
  const R = Wd().road, hues = [0, 240, 300, 90, 150, 200], span = edge().y1 - edge().y0 + 6;
  cars = []; let k = 0;
  for (const [dir, lane, id] of [[1, R.lanes.p, "vh_car_green_p"], [-1, R.lanes.n, "vh_car_green_n"]])
    for (let i = 0; i < 3; i++) cars.push({ dir, x: lane, id, hue: hues[k++ % hues.length], y: edge().y0 - 3 + (i * 0.34 + (dir > 0 ? 0 : 0.15)) * span, v: 0, vmax: 1.5 + (k % 3) * 0.25, len: 2 });
}
function stepCars(dt, cross) {
  const [, cy0, , cd] = Wd().road.cross, y0 = edge().y0 - 3, y1 = edge().y1 + 3;
  for (const c of cars) {
    let target = c.vmax; const half = c.len / 2;
    if (cross) {
      if (c.dir > 0) { const front = c.y + half, line = cy0 - 0.3; if (front < line + 0.05 && line - front < 2.2) target = 0; }
      else { const front = c.y - half, line = cy0 + cd + 0.3; if (front > line - 0.05 && front - line < 2.2) target = 0; }
    }
    for (const o of cars) {
      if (o === c || o.dir !== c.dir) continue;
      const gap = c.dir > 0 ? (o.y - half) - (c.y + half) : (c.y - half) - (o.y + half);
      if (gap > -0.01 && gap < 1.1) target = 0;
    }
    c.v += Math.max(-7 * dt, Math.min(3 * dt, target - c.v)); c.y += c.dir * c.v * dt;
    if (c.dir > 0 && c.y > y1) c.y = y0; else if (c.dir < 0 && c.y < y0) c.y = y1;
  }
}
function drawCar(g, c) {
  if (hasSpr(c.id)) { drawSpr(g, c.id, c.x, c.y, { hue: c.hue }); return; }
  const col = ["#3ec45a", "#e8344f", "#ffc61a", "#3a7bf0", "#b744c9", "#2fd9cf"][(c.hue / 60 | 0) % 6];
  prism(g, c.x - 0.5, c.y - 1.0, 1.0, 2.0, 0.45, shade(col, 20), shade(col, -40), col);
  prism(g, c.x - 0.42, c.y - 0.6, 0.84, 0.9, 0.7, "#cfe6ff", "#8fb2d9", "#a9c8ea", 0.45);
}

export const trafficState = () => cars;   // for testing
export function outsideItems(now, ctx = {}) {
  const out = [], t = S.t, m = tod(), base = t - m, R = Wd().road, park = doorMid() - 0.3, [vx, vy] = P(R.curb, park);
  // courier on foot at the pickup times (later when the courier is delayed)
  for (const ct of D.time.courierTimes) {
    const t0 = base + ct + (S.mods && S.mods.courierDelay ? 60 : 0), w = walker(t, t0, t0 + 25);
    if (w) { const packed = (S.orders || []).filter(o => o.status === "packed").length; out.push({ d: w.x + w.y + 0.35, bb: [vx - 700, vy - 400, 1100, 700], f: g => person(g, w, packed ? `Courier: ${packed} to collect` : "Courier", "#ff7a1a") }); }
  }
  // the rider who brings a sample
  { const w = walker(t, sampleRiderAt, sampleRiderAt + 14); if (w) out.push({ d: w.x + w.y + 0.45, bb: [vx - 700, vy - 400, 1100, 700], f: g => person(g, w, "Sample delivered", "#3a7bf0", 200) }); }
  // supplier van, parked in the curb strip at the arrival time when boxes come
  { const t0 = base + D.time.supplierArrive, y = roadY(t, t0, t0 + 35, park + 1.0);
    if (y != null && (S.doorBoxes.length || (S.deliveries || []).length || t < t0)) {
      const x = R.curb, [sx, sy] = P(x, y);
      out.push({ d: x + y + 0.9, bb: [sx - 340, sy - 580, 680, 700], f: g => {
        if (hasSpr("vh_van_p")) { drawSpr(g, "vh_van_p", x, y); }
        else { prism(g, x - 0.6, y - 1.3, 1.2, 2.6, 1.05, "#ffffff", "#c9d3ea", "#e3e9f7"); g.fillStyle = "#3a7bf0"; g.font = "400 18px 'Lilita One', sans-serif"; g.textAlign = "center"; const [bx, by] = P(x + 0.6, y, 0.55); g.fillText("SUPPLY", bx + 4, by); }
        if (Math.abs(y - (park + 1.0)) < 0.01) label(g, x, y, 2.6, "Supplier van", "#3a7bf0");
      } });
    }
  }
  // boxes and samples waiting on the doorstep
  const step = [N() + 0.35, D.room.front.door[0] - 0.35], waiting = S.doorSamples.length + S.doorBoxes.length;
  for (let i = 0; i < Math.min(waiting, 4); i++) {
    const x = step[0] + (i % 2) * 0.42 + 0.18, y = step[1] - Math.floor(i / 2) * 0.42 + 0.18, [sx, sy] = P(x, y);
    out.push({ d: x + y + 0.3, bb: [sx - 40, sy - 70, 80, 90], f: g => { if (!drawSpr(g, "it_box", x, y)) prism(g, x - 0.18, y - 0.18, 0.36, 0.36, 0.34, "#f2c46b", "#c98f3a", "#ddaa52"); } });
  }
  // passing traffic (real time)
  if (!cars) makeCars();
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now; stepCars(dt, ctx.cross);
  for (const c of cars) { const [sx, sy] = P(c.x, c.y); out.push({ d: c.x + c.y + 0.75, bb: [sx - 300, sy - 380, 600, 480], f: g => drawCar(g, c) }); }
  return out;
}

/* Packed parcels stacked inside, by the door. */
export function drawOutside(g) {
  const packed = (S.orders || []).filter(o => o.status === "packed").length;
  for (let i = 0; i < Math.min(packed, 6); i++) {
    const x = N() - 0.6 - (i % 2) * 0.4, y = D.room.front.door[1] + 0.3 + Math.floor(i / 2) * 0.05, z = Math.floor(i / 2) * 0.3;
    if (!drawSpr(g, "it_parcel", x, y, { z })) prism(g, x - 0.17, y - 0.17, 0.34, 0.34, 0.3, "#e6b877", "#b9833f", "#d29b55", z);
  }
}
