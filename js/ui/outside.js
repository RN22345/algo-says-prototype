/* OUTSIDE. What the player sees beyond the front door: the courier and the sample rider (each rides a scooter in along the curb,
   parks, walks to the door, waits, walks back and rides off), the supplier van, boxes on the doorstep, packed parcels by the door,
   plus the traffic (traffic.js) and pedestrians (people.js). Things arrive and leave instead of popping: vehicles fade in at the
   island edge, boxes drop in with a bounce, and a dust puff marks where something was taken.
   Visual only: the sims (stock.js, orders.js) decide what arrives and when; this file only shows it, timed by the game clock.
   Events in: sample:arrived. Exports: outsideItems(now, ctx) -> [{d, f(g), bb}] for depth sorting (ctx = {player, dt}), drawOutside(g, now). */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { tod } from "../core/clock.js";
import { on } from "../core/bus.js";
import { P } from "./proj.js";
import { prism } from "./drawkit.js";
import { hasSpr, drawSpr } from "./art.js";
import { drawRig, drawBoxes, lookOf, scooterBoxes } from "./rig.js";
import { stepTraffic, trafficItems, edgeAlpha } from "./traffic.js";
import { stepPeople, peopleItems, peopleOnCross } from "./people.js";
import { crossAt } from "./world.js";
import { appear, forget, puff } from "./fx.js";

let sampleRiderAt = -1e9;
on("sample:arrived", () => { sampleRiderAt = S.t; });

const N = () => D.room.view.Nx, doorMid = () => (D.room.front.door[0] + D.room.front.door[1]) / 2;
const Wd = () => D.world, edge = () => Wd().bounds;
const lerp = (a, b, f) => a + (b - a) * f, cl = f => Math.max(0, Math.min(1, f));

/* y of a vehicle along the curb: drives in over din minutes, parks from t0 to t1, drives on over dout minutes. */
function roadY(t, t0, t1, park, din = 20, dout = 20) {
  const y0 = edge().y0 - 1.5, y1 = edge().y1 + 1.5;
  if (t < t0 - din || t > t1 + dout) return null;
  if (t < t0) { const f = 1 - (t0 - t) / din; return lerp(y0, park, 1 - (1 - f) * (1 - f)); }
  if (t > t1) { const f = (t - t1) / dout; return lerp(park, y1, f * f); }
  return park;
}
/* A delivery visit: ride in, walk to the door, wait, walk back, ride off. Times in game minutes. */
function visit(t, tArrive, tLeave, parkY) {
  const R = 18, Wk = 9;
  const door = [N() + 0.6, doorMid() + 0.05], walkway = [11.5, doorMid() + 0.5], curb = [12.35, parkY];
  if (t < tArrive - R - Wk || t > tLeave + Wk + R) return null;
  const sy = roadY(t, tArrive - Wk, tLeave + Wk, parkY, R, R);
  if (t < tArrive - Wk || t > tLeave + Wk) return { ride: true, sy, x: 12.6, y: sy, ang: Math.PI / 2 };
  const out = t > tLeave, f = out ? cl((t - tLeave) / Wk) : cl((t - (tArrive - Wk)) / Wk), g = out ? 1 - f : f;
  const pts = [curb, walkway, door], seg = g < 0.45 ? 0 : 1, sf = seg === 0 ? g / 0.45 : (g - 0.45) / 0.55;
  const a = pts[seg], b = pts[seg + 1], x = lerp(a[0], b[0], sf), y = lerp(a[1], b[1], sf);
  const dx = (b[0] - a[0]) * (out ? -1 : 1), dy = (b[1] - a[1]) * (out ? -1 : 1);
  return { ride: false, sy: parkY, x, y, ang: Math.atan2(dy, dx), moving: g > 0 && g < 1, at: g >= 1 };
}
function chip(g, x, y, z, text, col) {
  const [sx, sy] = P(x, y, z); g.font = "600 17px Fredoka, sans-serif"; const w = g.measureText(text).width + 22;
  g.fillStyle = "rgba(255,255,255,.88)"; g.beginPath(); g.roundRect ? g.roundRect(sx - w / 2, sy - 30, w, 28, 14) : g.rect(sx - w / 2, sy - 30, w, 28); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(sx - w / 2 + 12, sy - 16, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1c2452"; g.textAlign = "center"; g.fillText(text, sx + 5, sy - 10);
}
function drawVisit(g, v, look, col, text) {
  const a = edgeAlpha(v.sy), ph = performance.now() / 95;
  drawBoxes(g, 12.6, v.sy, Math.PI / 2, scooterBoxes(col), { alpha: a });
  if (v.ride) drawRig(g, look, { x: 12.6, y: v.sy - 0.12, ang: Math.PI / 2, sit: true, z: 0.08, alpha: a, noShadow: true });
  else {
    drawRig(g, look, { x: v.x, y: v.y, ang: v.ang, phase: ph, move: v.moving ? 1 : 0, alpha: 1, wave: v.at && Math.sin(ph / 6) > 0.6 });
    if (v.at && text) chip(g, v.x, v.y, 1.9, text, col);
  }
}

let lastNow = 0, lastBoxes = 0, lastParcels = 0;
export function outsideItems(now, ctx = {}) {
  const out = [], t = S.t, base = t - tod(), R = Wd().road, park = doorMid() - 0.3;
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
  // courier at the pickup times (later when the courier is delayed)
  for (const ct of D.time.courierTimes) {
    const t0 = base + ct + (S.mods && S.mods.courierDelay ? 60 : 0), v = visit(t, t0, t0 + 25, park - 1.7);
    if (v) { const packed = (S.orders || []).filter(o => o.status === "packed").length, d = v.ride ? 12.6 + v.sy : v.x + v.y; const [sx, sy] = P(v.x, v.y);
      out.push({ d: d + 0.35, bb: [sx - 300, sy - 300, 600, 420], f: g => drawVisit(g, v, lookOf("courier"), "#ff7a1a", packed ? `Courier: ${packed} to collect` : "Courier") }); }
  }
  // the rider who brings a sample
  { const v = visit(t, sampleRiderAt + 9, sampleRiderAt + 30, park - 3.4);
    if (v) { const d = v.ride ? 12.6 + v.sy : v.x + v.y; const [sx, sy] = P(v.x, v.y); out.push({ d: d + 0.35, bb: [sx - 300, sy - 300, 600, 420], f: g => drawVisit(g, v, lookOf("rider"), "#3a7bf0", "Sample delivered") }); } }
  // supplier van, parked in the curb strip at the arrival time when boxes come
  { const t0 = base + D.time.supplierArrive, y = roadY(t, t0, t0 + 35, park + 1.0);
    if (y != null && (S.doorBoxes.length || (S.deliveries || []).length || t < t0)) {
      const x = R.curb, [sx, sy] = P(x, y), a = edgeAlpha(y);
      out.push({ d: x + y + 0.9, bb: [sx - 340, sy - 580, 680, 700], f: g => {
        const pa = g.globalAlpha; g.globalAlpha = pa * a;
        if (hasSpr("vh_van_p")) drawSpr(g, "vh_van_p", x, y);
        else { prism(g, x - 0.6, y - 1.3, 1.2, 2.6, 1.05, "#ffffff", "#c9d3ea", "#e3e9f7"); }
        g.globalAlpha = pa;
        if (Math.abs(y - (park + 1.0)) < 0.01) chip(g, x, y, 2.6, "Supplier van", "#3a7bf0");
      } });
    }
  }
  // boxes and samples waiting on the doorstep: they drop in, and puff when taken
  const step = [N() + 0.35, D.room.front.door[0] - 0.35], waiting = Math.min(4, S.doorSamples.length + S.doorBoxes.length), alive = new Set();
  const spot = i => [step[0] + (i % 2) * 0.42 + 0.18, step[1] - Math.floor(i / 2) * 0.42 + 0.18];
  for (let i = 0; i < waiting; i++) {
    const [x, y] = spot(i), [sx, sy] = P(x, y), key = "door:" + i; alive.add(key);
    out.push({ d: x + y + 0.3, bb: [sx - 40, sy - 70, 80, 90], f: g => { const ap = appear(key, now); g.globalAlpha = ap.a; if (!drawSpr(g, "it_box", x, y, { z: ap.z, scale: ap.s })) prism(g, x - 0.18, y - 0.18, 0.36, 0.36, 0.34, "#f2c46b", "#c98f3a", "#ddaa52", ap.z); g.globalAlpha = 1; } });
  }
  forget("door:", alive); if (waiting < lastBoxes) for (let i = waiting; i < lastBoxes; i++) puff(...spot(i)); lastBoxes = waiting;
  // traffic and people (real time)
  const pl = ctx.player || { x: -99, y: -99 }, occ = peopleOnCross(), pk = crossAt(pl.x, pl.y, 0.5);
  if (pk >= 0) occ.add(pk);
  stepTraffic(dt, [...occ]); stepPeople(dt, pl);
  out.push(...trafficItems(), ...peopleItems());
  return out;
}

/* Packed parcels stacked inside, by the door. */
export function drawOutside(g, now = performance.now()) {
  const packed = Math.min(6, (S.orders || []).filter(o => o.status === "packed").length), alive = new Set();
  const at = i => [N() - 0.6 - (i % 2) * 0.4, D.room.front.door[1] + 0.3 + Math.floor(i / 2) * 0.05, Math.floor(i / 2) * 0.3];
  for (let i = 0; i < packed; i++) {
    const [x, y, z] = at(i), key = "parcel:" + i, ap = appear(key, now); alive.add(key);
    g.globalAlpha = ap.a;
    if (!drawSpr(g, "it_parcel", x, y, { z: z + ap.z, scale: ap.s })) prism(g, x - 0.17, y - 0.17, 0.34, 0.34, 0.3, "#e6b877", "#b9833f", "#d29b55", z);
    g.globalAlpha = 1;
  }
  forget("parcel:", alive); if (packed < lastParcels) for (let i = packed; i < lastParcels; i++) puff(at(i)[0], at(i)[1]); lastParcels = packed;
}
