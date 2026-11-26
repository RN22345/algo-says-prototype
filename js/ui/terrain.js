/* TERRAIN. Draws the static world once onto an offscreen "shell" canvas (a floating diorama): ground tiles painted back to front
   (grass, sidewalk, road, crosswalk, floors of the house and bought rooms), lane marks, the back walls, low dividers and the
   end wall. Redrawn when art loads, a room is bought or the daylight changes the window. Also: the front wall with the door
   (drawn over the room's items), props as depth-sortable items (trees, lamps, fences, houses), and drifting clouds.
   Exports: initShell, drawShell, shellCanvas, shellOrigin, drawFront, propItems, drawClouds. */
import { D } from "../core/data.js";
import { artImg } from "../core/assets.js";
import { isDaylight } from "../core/clock.js";
import { P } from "./proj.js";
import { polyOn, fallbackProp } from "./drawkit.js";
import { hasSpr, spr, drawSpr, sprBoxAt } from "./art.js";
import { walls, rooms, props, version } from "./world.js";

let shell = null, sg = null, SX0 = 0, SY0 = 0, SW = 1, SH = 1;
export const shellCanvas = () => shell;
export const shellOrigin = () => [SX0, SY0, SW, SH];
export function initShell() {
  const b = D.world.bounds;
  SX0 = Math.floor(P(b.x0, b.y1)[0] - 120); SY0 = Math.floor(P(b.x0, b.y0)[1] - 560);
  SW = Math.ceil(P(b.x1, b.y0)[0] + 120 - SX0); SH = Math.ceil(P(b.x1, b.y1)[1] + 160 - SY0);
  shell = document.createElement("canvas"); shell.width = SW; shell.height = SH; sg = shell.getContext("2d");
}

/* ---------- ground ---------- */
function tileMap() {
  const m = new Map(), put = (r, e) => { for (let i = r[0]; i < r[0] + r[2]; i++) for (let j = r[1]; j < r[1] + r[3]; j++) m.set(i + "," + j, { i, j, ...e }); };
  for (const g of D.world.ground) put(g.rect, { tile: g.tile, fb: g.fb, kind: g.tile === "tl_grass" ? "grass" : "flat" });
  const F = D.world.floors;
  for (const r of rooms()) put(r.rect, { tile: r.bought ? F.bought : F.house, fb: r.bought ? F.fbBought : F.fbHouse, kind: "floor" });
  return [...m.values()].sort((a, b) => (a.i + a.j) - (b.i + b.j) || a.i - b.i);
}
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function paintTile(c, t) {
  if (hasSpr(t.tile)) { drawSpr(c, t.tile, t.i + 0.5, t.j + 0.5); return; }
  const q = [P(t.i, t.j), P(t.i + 1, t.j), P(t.i + 1, t.j + 1), P(t.i, t.j + 1)];
  polyOn(c, q, Array.isArray(t.fb) ? t.fb[(t.i + t.j) & 1] : (t.kind === "grass" && (t.i + t.j) & 1 ? "#93cc6e" : t.fb));
  if (t.kind === "grass") {      // light tuft texture, drawn once
    c.strokeStyle = "#7fbf5a"; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k < 7; k++) { const p = P(t.i + 0.1 + rnd() * 0.8, t.j + 0.1 + rnd() * 0.8); c.moveTo(p[0] - 4, p[1]); c.lineTo(p[0], p[1] - 8); c.lineTo(p[0] + 4, p[1]); }
    c.stroke();
  }
}
function laneMarks(c) {
  const R = D.world.road, b = D.world.bounds, x = (R.lanes.p + R.lanes.n) / 2, [, cy, , cd] = R.cross;
  for (let y = b.y0 + 0.2; y < b.y1 - 0.5; y += 1) { if (y + 0.5 > cy - 0.2 && y < cy + cd + 0.2) continue; polyOn(c, [P(x - 0.04, y), P(x + 0.04, y), P(x + 0.04, y + 0.5), P(x - 0.04, y + 0.5)], "#f4f1e4"); }
}

/* ---------- walls ---------- */
function spans(w) {
  const out = []; let a = w.from; for (const g of [...w.gaps].sort((p, q) => p[0] - q[0])) { if (g[0] > a) out.push([a, g[0]]); a = g[1]; }
  if (a < w.to) out.push([a, w.to]); return out;
}
const face = (w, a, b, z0, z1) => w.a === "x" ? [P(a, w.at, z0), P(b, w.at, z0), P(b, w.at, z1), P(a, w.at, z1)] : [P(w.at, a, z0), P(w.at, b, z0), P(w.at, b, z1), P(w.at, a, z1)];
function wallsInShell(c) {
  const C = D.room.colors, v = D.room.view;
  for (const w of walls()) {
    if (w.kind === "front") continue;
    for (const [a, b] of spans(w)) {
      if (w.kind === "back") {
        const col = w.a === "x" ? C.wallR : C.wallL;
        polyOn(c, face(w, a, b, 0, w.h), col); polyOn(c, face(w, a, b, 0, 0.16), w.a === "x" ? "#9fb8e0" : "#8aa6d6");
        polyOn(c, face(w, a, b, w.h, w.h + 0.08), "#fff");
        c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 3;
        for (let t = Math.ceil(a); t < b; t++) { const p0 = w.a === "x" ? P(t, w.at, 0.16) : P(w.at, t, 0.16), p1 = w.a === "x" ? P(t, w.at, w.h) : P(w.at, t, w.h); c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke(); }
      } else {
        polyOn(c, face(w, a, b, 0, w.h), C.front, "#9fb8e0", 2);
        polyOn(c, face(w, a, b, w.h, w.h + 0.06), "#fff");
      }
    }
    if (w.kind === "low") for (const g of w.gaps) for (const t of g) { const a = P(t, w.at, 0), b = P(t, w.at, w.h + 0.2); c.strokeStyle = "#8a5a2b"; c.lineWidth = 8; c.lineCap = "round"; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  }
  const win = D.room.window;
  if (win) {
    const m = win.mount, img = artImg(isDaylight() ? win.dayArt : win.nightArt), L = m.t[1] - m.t[0], hh = (m.z[1] - m.z[0]) * v.zUnit, tl = P(0, m.t[1], m.z[1]);
    if (img) { c.save(); c.transform(1, -v.th / v.tw, 0, 1, tl[0], tl[1]); c.drawImage(img, 0, 0, L * v.tw, hh); c.restore(); }
    polyOn(c, [P(0, m.t[1], m.z[0]), P(0, m.t[0], m.z[0]), P(0, m.t[0], m.z[1]), P(0, m.t[1], m.z[1])], null, "#ffffffcc", 6);
  }
}
export function drawShell() {
  if (!sg) return;
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, SW, SH); sg.setTransform(1, 0, 0, 1, -SX0, -SY0); seed = 7;
  for (const t of tileMap()) paintTile(sg, t);
  laneMarks(sg); wallsInShell(sg);
}
/* Front walls (low, with the door gap) are drawn after the room's items so they sit in front. */
export function drawFront(g) {
  const C = D.room.colors;
  for (const w of walls()) {
    if (w.kind !== "front") continue;
    for (const [a, b] of spans(w)) polyOn(g, face(w, a, b, 0, w.h), C.front, "#9fb8e0", 2);
    g.strokeStyle = "#8a5a2b"; g.lineWidth = 9; g.lineCap = "round";
    for (const gp of w.gaps) { for (const t of gp) { const a = P(w.at, t, 0), b = P(w.at, t, 2.1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } const a = P(w.at, gp[0], 2.1), b = P(w.at, gp[1], 2.1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  }
}

/* ---------- props as items ---------- */
let items = [], itemsVer = -1, itemsSprites = -1;
export function propItems() {
  const n = Object.keys((D.sprites && D.sprites.sprites) || {}).filter(hasSpr).length;
  if (itemsVer === version() && itemsSprites === n) return items;
  itemsVer = version(); itemsSprites = n; items = [];
  for (const p of props()) {
    const [sx, sy] = P(p.cx, p.cy), s = spr(p.id), bb = s ? sprBoxAt(p.id, sx, sy, { flip: p.flip }) : [sx - 70, sy - 260, 140, 300];
    items.push({ d: p.cx + p.cy + Math.min(0.2 + (p.fw + p.fd) / 10, 0.6), bb, tall: bb[3] > 150, f: g => { if (!drawSpr(g, p.id, p.cx, p.cy, { flip: p.flip })) fallbackProp(g, p.id, p.cx, p.cy, p.fw, p.fd); } });
  }
  return items;
}

/* ---------- clouds ---------- */
export function drawClouds(g, now, front) {
  for (const c of D.world.clouds || []) {
    if (!!c.front !== front) continue; const s = spr(c.art); if (!s) continue;
    const w = s.w / 2 * c.s * 1.4, h = s.h / 2 * c.s * 1.4, span = SW + 1200, x = SX0 - 600 + ((c.x - SX0 + 600 + now / 1000 * c.v) % span + span) % span;
    g.globalAlpha = front ? 0.92 : 0.95; g.drawImage(s.img, x, c.y, w, h); g.globalAlpha = 1;
  }
}
