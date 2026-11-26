/* TERRAIN. Draws the static world (ground tiles, lane marks, back walls, low dividers, the window) into lazily built chunk canvases
   of CH world pixels, so a large island costs memory only where the camera has been (least recently used chunks are dropped).
   Chunks are rebuilt when art loads, a room is bought or the daylight changes the window. Also: the front wall with the door
   (drawn over the room's items), props as depth-sortable items (trees, lamps, fences, houses), and drifting clouds.
   Unity: the ground maps to a Tilemap (isometric), props to prefabs, chunks are what the Tilemap renderer already does.
   Exports: initShell, drawShell, drawGround, shellOrigin, drawFront, propItems, drawClouds. */
import { D } from "../core/data.js";
import { artImg } from "../core/assets.js";
import { isDaylight } from "../core/clock.js";
import { P } from "./proj.js";
import { polyOn, fallbackProp } from "./drawkit.js";
import { hasSpr, spr, drawSpr, sprBoxAt } from "./art.js";
import { walls, rooms, props, version } from "./world.js";

const CH = 1024, MAXCH = 28;
let SX0 = 0, SY0 = 0, SW = 1, SH = 1, chunks = new Map(), tiles = null, stamp = 0;
export const shellOrigin = () => [SX0, SY0, SW, SH];
export function initShell() {
  const b = D.world.bounds;
  SX0 = Math.floor(P(b.x0, b.y1)[0] - 120); SY0 = Math.floor(P(b.x0, b.y0)[1] - 560);
  SW = Math.ceil(P(b.x1, b.y0)[0] + 120 - SX0); SH = Math.ceil(P(b.x1, b.y1)[1] + 160 - SY0);
}

/* ---------- ground ---------- */
function tileMap() {
  const m = new Map(), put = (r, e) => { for (let i = r[0]; i < r[0] + r[2]; i++) for (let j = r[1]; j < r[1] + r[3]; j++) m.set(i + "," + j, { i, j, ...e }); };
  for (const g of D.world.ground) put(g.rect, { tile: g.tile, fb: g.fb, kind: g.tile === "tl_grass" ? "grass" : "flat" });
  const F = D.world.floors;
  for (const r of rooms()) put(r.rect, { tile: r.bought ? F.bought : F.house, fb: r.bought ? F.fbBought : F.fbHouse, kind: "floor" });
  const list = [...m.values()].sort((a, b) => (a.i + a.j) - (b.i + b.j) || a.i - b.i);
  for (const t of list) { const [x, y] = P(t.i + 0.5, t.j + 0.5); t.bb = [x - 100, y - 110, 200, 200]; }
  return list;
}
/* A stable per-tile random number, so a chunk paints the same wherever it starts. */
const hash = (i, j, k) => { let x = Math.imul(i * 374761393 + j * 668265263 + k * 2147483647, 1274126177); x ^= x >>> 13; x = Math.imul(x, 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
function paintTile(c, t) {
  if (hasSpr(t.tile)) { drawSpr(c, t.tile, t.i + 0.5, t.j + 0.5); return; }
  const q = [P(t.i, t.j), P(t.i + 1, t.j), P(t.i + 1, t.j + 1), P(t.i, t.j + 1)];
  polyOn(c, q, Array.isArray(t.fb) ? t.fb[(t.i + t.j) & 1] : (t.kind === "grass" && (t.i + t.j) & 1 ? "#93cc6e" : t.fb));
  if (t.kind === "grass") {      // light tuft texture
    c.strokeStyle = "#7fbf5a"; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k < 7; k++) { const p = P(t.i + 0.1 + hash(t.i, t.j, k) * 0.8, t.j + 0.1 + hash(t.i, t.j, k + 9) * 0.8); c.moveTo(p[0] - 4, p[1]); c.lineTo(p[0], p[1] - 8); c.lineTo(p[0] + 4, p[1]); }
    c.stroke();
  }
}
function laneMarks(c) {
  const R = D.world.road, b = D.world.bounds, x = (R.lanes.p + R.lanes.n) / 2, cs = R.crosses || [R.cross];
  for (let y = b.y0 + 0.2; y < b.y1 - 0.5; y += 1) { if (cs.some(([, cy, , cd]) => y + 0.5 > cy - 0.2 && y < cy + cd + 0.2)) continue; polyOn(c, [P(x - 0.04, y), P(x + 0.04, y), P(x + 0.04, y + 0.5), P(x - 0.04, y + 0.5)], "#f4f1e4"); }
}
/* Island edge: a soft earth rim under the ground so the diorama has thickness. */
function rim(c) {
  const b = D.world.bounds, d = 0.55 * D.room.view.zUnit;
  const a = P(b.x0, b.y1), r = P(b.x1, b.y1), q = P(b.x1, b.y0);
  c.fillStyle = "#b98b5a"; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(r[0], r[1]); c.lineTo(r[0], r[1] + d); c.lineTo(a[0], a[1] + d); c.closePath(); c.fill();
  c.fillStyle = "#9c7046"; c.beginPath(); c.moveTo(r[0], r[1]); c.lineTo(q[0], q[1]); c.lineTo(q[0], q[1] + d); c.lineTo(r[0], r[1] + d); c.closePath(); c.fill();
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
/* Drop every chunk; they are rebuilt when next seen. */
export function drawShell() { chunks.clear(); tiles = null; }
function buildChunk(ix, iy) {
  const c = document.createElement("canvas"); c.width = CH + 2; c.height = CH + 2;
  const g = c.getContext("2d"), x0 = SX0 + ix * CH - 1, y0 = SY0 + iy * CH - 1;
  g.setTransform(1, 0, 0, 1, -x0, -y0);
  if (!tiles) tiles = tileMap();
  rim(g);
  for (const t of tiles) { const bb = t.bb; if (bb[0] > x0 + CH + 2 || bb[0] + bb[2] < x0 || bb[1] > y0 + CH + 2 || bb[1] + bb[3] < y0) continue; paintTile(g, t); }
  laneMarks(g); wallsInShell(g);
  return { c, x0, y0, used: 0 };
}
/* Draw the ground for the view rect vr = [x, y, w, h] in world pixels. */
export function drawGround(g, vr) {
  const i0 = Math.max(0, Math.floor((vr[0] - SX0) / CH)), i1 = Math.min(Math.ceil(SW / CH) - 1, Math.floor((vr[0] + vr[2] - SX0) / CH));
  const j0 = Math.max(0, Math.floor((vr[1] - SY0) / CH)), j1 = Math.min(Math.ceil(SH / CH) - 1, Math.floor((vr[1] + vr[3] - SY0) / CH));
  stamp++; let built = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = i + "," + j; let ch = chunks.get(k);
    if (!ch) { if (built > 2 && chunks.size) continue; ch = buildChunk(i, j); chunks.set(k, ch); built++; }   // at most 3 new chunks a frame
    ch.used = stamp; g.drawImage(ch.c, ch.x0, ch.y0);
  }
  if (chunks.size > MAXCH) { const old = [...chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, chunks.size - MAXCH); for (const [k] of old) chunks.delete(k); }
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
