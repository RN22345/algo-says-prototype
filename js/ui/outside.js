/* OUTSIDE. What the player sees beyond the front door: riders and the supplier van at the curb, boxes on the doorstep,
   packed parcels by the door, and passing traffic. Visual only: the sims (stock.js, orders.js) decide what arrives and
   when; this file only shows it, timed by the game clock (courier times, supplier arrival) and by events.
   Events in: sample:arrived. Exports: outsideItems(now) -> [{d, f(g)}] for depth sorting, drawOutside(g, now). */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { tod } from "../core/clock.js";
import { on } from "../core/bus.js";
import { P } from "./room.js";

let sampleRiderAt = -1e9;
on("sample:arrived", () => { sampleRiderAt = S.t; });

const N = () => D.room.view.Nx, NY = () => D.room.view.Ny, Y = () => D.room.yard;
const doorMid = () => (D.room.front.door[0] + D.room.front.door[1]) / 2;
function prism(g, x, y, w, d, hgt, top, left, right) {
  const q = (a, b, z) => P(a, b, z), path = pts => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
  g.lineWidth = 2; g.strokeStyle = "#1c2452"; g.lineJoin = "round";
  path([q(x, y + d, 0), q(x + w, y + d, 0), q(x + w, y + d, hgt), q(x, y + d, hgt)]); g.fillStyle = left; g.fill(); g.stroke();
  path([q(x + w, y, 0), q(x + w, y + d, 0), q(x + w, y + d, hgt), q(x + w, y, hgt)]); g.fillStyle = right; g.fill(); g.stroke();
  path([q(x, y, hgt), q(x + w, y, hgt), q(x + w, y + d, hgt), q(x, y + d, hgt)]); g.fillStyle = top; g.fill(); g.stroke();
}
function label(g, x, y, z, text, col = "#1c2452") {
  const [sx, sy] = P(x, y, z); g.font = "600 17px Fredoka, sans-serif"; const w = g.measureText(text).width + 18;
  g.fillStyle = "#fff"; g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(sx - w / 2, sy - 30, w, 26, 13) : g.rect(sx - w / 2, sy - 30, w, 26); g.fill(); g.stroke();
  g.fillStyle = col; g.textAlign = "center"; g.fillText(text, sx, sy - 11);
}
function rider(g, x, y, col, text) {
  prism(g, x, y, 0.45, 1.0, 0.32, col, shade(col, -30), shade(col, -15));         // scooter
  const [hx, hy] = P(x + 0.22, y + 0.55, 0.95);
  g.fillStyle = "#1c2452"; g.beginPath(); g.roundRect ? g.roundRect(hx - 11, hy, 22, 30, 8) : g.rect(hx - 11, hy, 22, 30); g.fill();
  g.fillStyle = col; g.strokeStyle = "#1c2452"; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy - 6, 12, 0, Math.PI * 2); g.fill(); g.stroke();
  prism(g, x + 0.05, y - 0.05, 0.36, 0.36, 0.35, "#f2c46b", "#c98f3a", "#ddaa52");  // delivery box behind the seat
  if (text) label(g, x + 0.2, y + 0.5, 1.6, text, col);
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, v + k)); return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); }
/* y position on the road for a vehicle that is parked from t0 to t1 (game minutes), driving in and out for 6 minutes. */
function roadY(t, t0, t1, park) {
  if (t < t0 - 6 || t > t1 + 6) return null;
  if (t < t0) return park - (t0 - t) / 6 * (park + 3);
  if (t > t1) return park + (t - t1) / 6 * (NY() + 3 - park);
  return park;
}

export function outsideItems(now) {
  const out = [], t = S.t, m = tod(), base = t - m, curbX = N() + Y().road[0] + 0.15, park = doorMid() - 0.5;
  // courier at the pickup times (D.time.courierTimes), later when the courier is delayed
  for (const ct of D.time.courierTimes) {
    const t0 = base + ct + (S.mods && S.mods.courierDelay ? 60 : 0), y = roadY(t, t0, t0 + 25, park);
    if (y != null) { const packed = (S.orders || []).filter(o => o.status === "packed").length; out.push({ d: curbX + y + 2, f: g => rider(g, curbX, y, "#ff7a1a", y === park ? (packed ? `Courier: ${packed} to collect` : "Courier") : "") }); }
  }
  // the rider who brings a sample
  { const y = roadY(t, sampleRiderAt, sampleRiderAt + 30, park + 1.3); if (y != null) out.push({ d: curbX + y + 2, f: g => rider(g, curbX, y, "#3a7bf0", y === park + 1.3 ? "Sample delivered" : "") }); }
  // supplier van at the arrival time when boxes come
  { const t0 = base + D.time.supplierArrive, y = roadY(t, t0, t0 + 35, park - 1.2);
    if (y != null && (S.doorBoxes.length || (S.deliveries || []).length || t < t0)) out.push({ d: curbX + y + 3, f: g => { prism(g, curbX, y, 0.95, 1.7, 1.05, "#ffffff", "#c9d3ea", "#e3e9f7"); const [sx, sy] = P(curbX + 0.95, y + 0.85, 0.55); g.fillStyle = "#3a7bf0"; g.font = "400 18px 'Lilita One', sans-serif"; g.textAlign = "center"; g.fillText("SUPPLY", sx + 4, sy); if (y === park - 1.2) label(g, curbX + 0.5, y + 0.8, 1.6, "Supplier van", "#3a7bf0"); } }); }
  // boxes and samples waiting on the doorstep (outside), packed parcels inside by the door
  const step = [N() + 0.35, D.room.front.door[0] - 0.35];
  const waiting = S.doorSamples.length + S.doorBoxes.length;
  for (let i = 0; i < Math.min(waiting, 4); i++) { const x = step[0] + (i % 2) * 0.42, y = step[1] - Math.floor(i / 2) * 0.42; out.push({ d: x + y + 0.5, f: g => prism(g, x, y, 0.36, 0.36, 0.34, "#f2c46b", "#c98f3a", "#ddaa52") }); }
  // passing traffic (real time, not game time)
  const cars = [["#e8344f", 0.08, 0], ["#3ec45a", 0.055, 0.5], ["#ffc61a", 0.07, 0.25]];
  const laneA = N() + Y().road[0] + 0.25, laneB = N() + Y().road[1] - 1.0, span = NY() + 8;
  cars.forEach(([col, sp, ph], i) => {
    const k = ((now / 1000) * sp + ph) % 1, x = i % 2 ? laneB : laneA, y = i % 2 ? NY() + 4 - k * span : -4 + k * span;
    out.push({ d: x + y + 1, f: g => { prism(g, x, y, 0.75, 1.3, 0.45, shade(col, 20), shade(col, -40), col); prism(g, x + 0.08, y + 0.3, 0.6, 0.6, 0.75, "#cfe6ff", "#8fb2d9", "#a9c8ea"); } });
  });
  return out;
}

/* Packed parcels stacked inside, by the door. */
export function drawOutside(g) {
  const packed = (S.orders || []).filter(o => o.status === "packed").length;
  for (let i = 0; i < Math.min(packed, 6); i++) { const x = N() - 0.75 - (i % 2) * 0.4, y = D.room.front.door[1] + 0.15 + Math.floor(i / 2) * 0.05; prism(g, x, y, 0.34, 0.34, 0.3 + Math.floor(i / 2) * 0.32, "#e6b877", "#b9833f", "#d29b55"); }
}
