/* WORLD MODEL. What exists and where, with no drawing. From data/room.json (the house) and data/world.json (street, props, property
   rooms) plus the state S (owned rooms, placed furniture, layout) it builds, and caches until refresh():
   rooms (house plus bought extensions), walls (with gaps for doors), stations (house, bought rooms, for-sale signs, placed furniture),
   props (trees, lamps, fences of unbought lots), and answers blockedAt(x, y) for walking.
   Exports: owns, rooms, walls, stations, stationById, props, tileOf, baseTile, flipOf, spriteId, locked, rectDist, blockedAt,
   fitsRoom, roomAt, clearOfDoors, shelfRange, onCrosswalk, crossRect, worldBox, refresh, version. */
import { D } from "../core/data.js";
import { S, flag, hasGear } from "../core/state.js";
import { hasSpr, spr } from "./art.js";
import { FB } from "./drawkit.js";
import { P } from "./proj.js";

const V = () => D.room.view;
let cache = null, ver = 0;
export const version = () => ver;
export function refresh() { cache = null; ver++; grid = null; }
export const owns = id => !!(S.property && S.property[id]);

/* ---------- stations ---------- */
export const spriteId = st => { const id = st.sprite || st.art; return id && hasSpr(id) ? id : null; };
export function baseTile(st) { const t = st.tile; if (!t) return null; const id = spriteId(st), s = id && spr(id); return s && s.fw ? [t[0], t[1], s.fw, s.fd] : t; }
export function tileOf(st) {
  const t = baseTile(st), L = S.layout && S.layout[st.id]; if (!t) return null;
  if (!L) return t;
  return L.flip ? [L.gx, L.gy, t[3], t[2]] : [L.gx, L.gy, t[2], t[3]];
}
export const flipOf = st => !!(S.layout && S.layout[st.id] && S.layout[st.id].flip);
export const locked = st => !!(st.requiresGear && !hasGear(st.requiresGear));
export const stationById = id => stations().find(s => s.id === id) || null;
export const shelfRange = id => (S.shelfOwn && S.shelfOwn[id]) || (id === "shelves" ? [0, 4] : [0, 0]);

/* A station record for a piece of furniture (placed, or the ghost of one from the tray). */
export function pieceStation(id, uid) {
  const d = D.F[id]; if (!d) return null;
  return { id: uid || "piece_" + id, label: d.name, art: d.art, sprite: d.sprite, tile: [0, 0, d.tile[2], d.tile[3]], scale: d.scale || 0.8, dy: d.dy || 0, z: 5,
    deco: !d.opens, opens: d.opens, furniture: id, shelves: d.shelves, effects: d.effects, emoji: d.emoji, color: "#d9a066", piece: true };
}
function signStation(p) {
  return { id: "sale_" + p.id, label: "For sale: " + p.name, art: "od_sale_sign", sprite: "od_sale_sign", tile: [p.sign[0], p.sign[1], 1.3, 0.6], fixed: true, sign: true, opens: "property", prop: p.id, z: 5, emoji: "🏷️", color: "#e8344f" };
}

/* ---------- build ---------- */
function build() {
  const v = V(), Fr = D.room.front, hWall = v.wallH / v.zUnit, props = D.world.properties || [];
  const rooms = [{ id: "house", rect: [0, 0, v.Nx, v.Ny], bought: false }];
  for (const p of props) if (owns(p.id)) rooms.push({ id: p.id, rect: p.floor, bought: true, prop: p });
  const walls = [];
  for (const r of rooms) {
    const [x0, y0, w, d] = r.rect, next = props.find(p => owns(p.id) && p.floor[1] === y0 + d);
    walls.push({ a: "y", at: x0, from: y0, to: y0 + d, h: hWall, kind: "back", gaps: [] });
    if (r.id === "house") walls.push({ a: "x", at: y0, from: x0, to: x0 + w, h: hWall, kind: "back", gaps: [] });
    walls.push({ a: "y", at: x0 + w, from: y0, to: y0 + d, h: Fr.h, kind: "front", gaps: r.id === "house" ? [Fr.door] : [] });
    walls.push({ a: "x", at: y0 + d, from: x0, to: x0 + w, h: Fr.h, kind: "low", gaps: next ? [next.doorway] : [] });
  }
  const sts = D.room.stations.filter(st => st.tile && (!st.flag || flag(st.flag)));
  for (const p of props) {
    if (owns(p.id)) for (const s of p.stations) sts.push({ ...s, prop: p.id });
    else sts.push(signStation(p));
  }
  for (const pc of S.placed || []) { if (!S.layout || !S.layout[pc.uid]) continue; const st = pieceStation(pc.id, pc.uid); if (st) sts.push(st); }
  const pr = [];
  const add = (id, cx, cy, o = {}) => {
    const s = spr(id), fb = FB[id] || [1, 1], fw = o.fw ?? (s ? s.fw : fb[0]), fd = o.fd ?? (s ? s.fd : fb[1]);
    const tree = id.startsWith("od_tree");
    pr.push({ id, cx, cy, fw, fd, flip: !!o.flip, block: o.block !== false, bw: o.bw ?? (tree ? 0.6 : fw), bd: o.bd ?? (tree ? 0.6 : fd) });
  };
  for (const p of D.world.props || []) add(p.id, p.cx, p.cy, p);
  for (const p of props) {
    if (owns(p.id)) continue; const [fx, fy, fw, fd] = p.floor;
    for (let i = 0; i < fd; i++) { add("od_fence_y", fx + fw, fy + i + 0.5, { bw: 0.3, bd: 1 }); add("od_fence_y", fx, fy + i + 0.5, { block: false }); }
    for (let i = 0; i < fw; i++) add("od_fence_x", fx + i + 0.5, fy + fd, { bw: 1, bd: 0.3 });
  }
  return { rooms, walls, stations: sts, props: pr };
}
const C = () => cache || (cache = build());
export const rooms = () => C().rooms;
export const walls = () => C().walls;
export const stations = () => C().stations;
export const props = () => C().props;

/* ---------- walking ---------- */
export function rectDist(x, y, t) { const dx = Math.max(t[0] - x, 0, x - (t[0] + t[2])), dy = Math.max(t[1] - y, 0, y - (t[1] + t[3])); return Math.hypot(dx, dy); }
const inR = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
export const crossRect = () => D.world.road.cross;
export const onCrosswalk = (x, y, m = 0.5) => { const c = crossRect(); return inR(x, y, [c[0] - m, c[1] - m, c[2] + 2 * m, c[3] + 2 * m]); };
export function blockedAt(x, y, ignore) {
  const c = C(), Wd = D.world;
  let ok = false;
  for (const r of c.rooms) { const [rx, ry, rw, rd] = r.rect; if (x >= rx + 0.3 && x <= rx + rw && y >= ry + (r.id === "house" ? 0.3 : 0) && y <= ry + rd) { ok = true; break; } }
  if (!ok) { const w = Wd.walk; ok = x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1; }
  if (!ok) return true;
  for (const w of c.walls) {
    const [pc, al] = w.a === "x" ? [y, x] : [x, y];
    if (Math.abs(pc - w.at) < 0.22 && al >= w.from - 0.22 && al <= w.to + 0.22 && !w.gaps.some(g => al > g[0] + 0.15 && al < g[1] - 0.15)) return true;
  }
  const rd = Wd.road.rect; if (inR(x, y, rd) && !inR(x, y, Wd.road.cross)) return true;
  for (const p of c.props) if (p.block && Math.abs(x - p.cx) < p.bw / 2 + 0.12 && Math.abs(y - p.cy) < p.bd / 2 + 0.12) return true;
  for (const st of c.stations) { if (st.solid === false || st.id === ignore) continue; if (rectDist(x, y, tileOf(st)) < 0.18) return true; }
  return false;
}
/* BFS grid: cell 0.25 tiles, origin (0, walk.y0). Cached until refresh(). */
export const CELL = 0.25;
let grid = null;
export const gridDims = () => { const w = D.world.walk; return { W: Math.round(w.x1 / CELL), H: Math.round((w.y1 - w.y0) / CELL), y0: w.y0 }; };
export function cellBlocked(ix, iy) {
  const d = gridDims(); if (ix < 0 || iy < 0 || ix >= d.W || iy >= d.H) return true;
  if (!grid || grid.length !== d.W * d.H) grid = new Uint8Array(d.W * d.H);
  const k = ix + iy * d.W; if (!grid[k]) grid[k] = blockedAt((ix + 0.5) * CELL, d.y0 + (iy + 0.5) * CELL) ? 2 : 1;
  return grid[k] === 2;
}

/* ---------- furniture placement rules ---------- */
export function fitsRoom(t) { return rooms().some(r => { const [rx, ry, rw, rd] = r.rect; return t[0] >= rx + 0.1 && t[1] >= ry + 0.1 && t[0] + t[2] <= rx + rw - 0.1 && t[1] + t[3] <= ry + rd - 0.1; }); }
/* The room under a point (tile coordinates), or null. */
export const roomAt = (x, y) => rooms().find(r => x >= r.rect[0] && x <= r.rect[0] + r.rect[2] && y >= r.rect[1] && y <= r.rect[1] + r.rect[3]) || null;
export function clearOfDoors(t) {
  for (const w of walls()) for (const g of w.gaps) {
    const reg = w.a === "x" ? [g[0] - 0.3, w.at - 0.9, g[1] - g[0] + 0.6, 1.8] : [w.at - 0.9, g[0] - 0.3, 1.8, g[1] - g[0] + 0.6];
    if (t[0] < reg[0] + reg[2] && reg[0] < t[0] + t[2] && t[1] < reg[1] + reg[3] && reg[1] < t[1] + t[3]) return false;
  }
  return true;
}

/* World-pixel box the camera may show (the ground diamond plus a margin, and sky above for the walls). */
export function worldBox() {
  const b = D.world.bounds, tw = V().tw;
  return { x0: P(b.x0, b.y1)[0] - tw, y0: P(b.x0, b.y0)[1] - 260, x1: P(b.x1, b.y0)[0] + tw, y1: P(b.x1, b.y1)[1] + 120 };
}
