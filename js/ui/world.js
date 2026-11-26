/* WORLD MODEL. What exists and where, with no drawing. From data/room.json (the house) and data/world.json (street, props, property
   rooms) plus the state S (owned rooms, placed furniture, layout) it builds, and caches until refresh():
   rooms (house plus bought extensions), walls (with gaps for doors), stations (house, bought rooms, for-sale signs, placed furniture),
   props (trees, lamps, fences of unbought lots), and answers blockedAt(x, y) and findPath() for walking (player and people).
   Unity: walkAreas + blockedAt map to a NavMesh with obstacles; findPath to NavMeshAgent.SetDestination.
   Exports: owns, rooms, walls, stations, stationById, props, tileOf, baseTile, flipOf, spriteId, locked, rectDist, blockedAt,
   fitsRoom, roomAt, clearOfDoors, shelfRange, onCrosswalk, crossAt, crosses, crossRect, walkAreas, findPath, clearLine, worldBox, refresh, version. */
import { D } from "../core/data.js";
import { S, flag, hasGear } from "../core/state.js";
import { hasSpr, spr } from "./art.js";
import { FB } from "./drawkit.js";
import { P } from "./proj.js";

const V = () => D.room.view;
let cache = null, ver = 0;
export const version = () => ver;
export function refresh() { cache = null; ver++; grid = null; gridN = null; }
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
    pr.push({ id, cx, cy, fw, fd, flip: !!o.flip, block: o.block !== false, bw: o.bw ?? (tree ? 0.45 : fw), bd: o.bd ?? (tree ? 0.45 : fd) });
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
/* Collision uses a small body radius (BODY) so the player slides past furniture instead of catching on it.
   Furniture blocks its footprint shrunk by INSET; walls are thin lines with door gaps. */
const BODY = 0.16, INSET = 0.1, WALL = 0.16;
export function rectDist(x, y, t) { const dx = Math.max(t[0] - x, 0, x - (t[0] + t[2])), dy = Math.max(t[1] - y, 0, y - (t[1] + t[3])); return Math.hypot(dx, dy); }
const inR = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
export const crosses = () => D.world.road.crosses || [D.world.road.cross];
export const crossRect = () => crosses()[0];
export const onCrosswalk = (x, y, m = 0.5) => crosses().some(c => inR(x, y, [c[0] - m, c[1] - m, c[2] + 2 * m, c[3] + 2 * m]));
/* Which crosswalk (index) a point is on, or -1. */
export const crossAt = (x, y, m = 0.5) => crosses().findIndex(c => inR(x, y, [c[0] - m, c[1] - m, c[2] + 2 * m, c[3] + 2 * m]));
export const walkAreas = () => D.world.walkAreas || (D.world.walk ? [[D.world.walk.x0, D.world.walk.y0, D.world.walk.x1 - D.world.walk.x0, D.world.walk.y1 - D.world.walk.y0]] : []);
export function inWalkArea(x, y, who) {
  if (who !== "npc") for (const r of rooms()) { const [rx, ry, rw, rd] = r.rect; if (x >= rx + 0.25 && x <= rx + rw && y >= ry + (r.id === "house" ? 0.25 : 0) && y <= ry + rd) return true; }
  return walkAreas().some(w => inR(x, y, w)) || crosses().some(c => inR(x, y, c));
}
/* who: "player" (default) or "npc" (people outside ignore the stations inside). ignore: a station id that does not block. */
export function blockedAt(x, y, ignore, who) {
  const c = C(), Wd = D.world;
  if (!inWalkArea(x, y, who)) return true;
  for (const w of c.walls) {
    const [pc, al] = w.a === "x" ? [y, x] : [x, y];
    if (Math.abs(pc - w.at) < WALL && al >= w.from - WALL && al <= w.to + WALL && !w.gaps.some(g => al > g[0] + 0.12 && al < g[1] - 0.12)) return true;
  }
  const rd = Wd.road.rect; if (inR(x, y, rd) && !crosses().some(cr => inR(x, y, cr))) return true;
  for (const p of c.props) if (p.block && Math.abs(x - p.cx) < p.bw / 2 + BODY - 0.04 && Math.abs(y - p.cy) < p.bd / 2 + BODY - 0.04) return true;
  if (who === "npc") return false;
  for (const st of c.stations) {
    if (st.solid === false || st.id === ignore) continue;
    const t = tileOf(st); if (!t) continue;
    if (rectDist(x, y, [t[0] + INSET, t[1] + INSET, Math.max(0.1, t[2] - 2 * INSET), Math.max(0.1, t[3] - 2 * INSET)]) < BODY) return true;
  }
  return false;
}
/* BFS grid over the whole island: cell 0.25 tiles. Cached until refresh(). Two layers: the player's and the people's. */
export const CELL = 0.25;
let grid = null, gridN = null;
export const gridDims = () => { const b = D.world.bounds; return { W: Math.round((b.x1 - b.x0) / CELL), H: Math.round((b.y1 - b.y0) / CELL), x0: b.x0, y0: b.y0 }; };
export function cellBlocked(ix, iy, who) {
  const d = gridDims(); if (ix < 0 || iy < 0 || ix >= d.W || iy >= d.H) return true;
  const npc = who === "npc";
  if (npc) { if (!gridN || gridN.length !== d.W * d.H) gridN = new Uint8Array(d.W * d.H); }
  else if (!grid || grid.length !== d.W * d.H) grid = new Uint8Array(d.W * d.H);
  const G = npc ? gridN : grid, k = ix + iy * d.W;
  if (!G[k]) G[k] = blockedAt(d.x0 + (ix + 0.5) * CELL, d.y0 + (iy + 0.5) * CELL, null, who) ? 2 : 1;
  return G[k] === 2;
}
/* Is the straight line from a to b walkable? Sampled every 0.1 tiles on the cached grid. */
export function clearLine(ax, ay, bx, by, who) {
  const d = gridDims(), n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
  for (let i = 1; i <= n; i++) { const t = i / n; if (cellBlocked(Math.floor((ax + (bx - ax) * t - d.x0) / CELL), Math.floor((ay + (by - ay) * t - d.y0) / CELL), who)) return false; }
  return true;
}
/* Breadth-first search on the grid from (sx, sy) to the first cell where goal(x, y) is true. Returns a smoothed list of points or null. */
export function findPath(sx, sy, goal, who) {
  const { W, H, x0, y0 } = gridDims(), ci = (v, m) => Math.min(m - 1, Math.max(0, v));
  const start = [ci(Math.floor((sx - x0) / CELL), W), ci(Math.floor((sy - y0) / CELL), H)];
  const seen = new Int32Array(W * H).fill(-1), q = [start[0] + start[1] * W]; seen[q[0]] = q[0];
  const cx = x => x0 + (x + 0.5) * CELL, cy = y => y0 + (y + 0.5) * CELL;
  for (let qi = 0; qi < q.length && qi < 60000; qi++) {
    const c = q[qi], x = c % W, y = (c / W) | 0;
    if (qi > 0 && goal(cx(x), cy(y))) {
      const path = []; let k = c; while (k !== seen[k]) { path.push([cx(k % W), cy((k / W) | 0)]); k = seen[k]; }
      return smooth(sx, sy, path.reverse(), who);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = nx + ny * W; if (seen[n] >= 0 || cellBlocked(nx, ny, who) || (dx && dy && (cellBlocked(x, ny, who) || cellBlocked(nx, y, who)))) continue;
      seen[n] = c; q.push(n);
    }
  }
  return null;
}
/* String pulling: drop the grid zigzag, keep only the corners that a straight walk cannot skip. */
function smooth(sx, sy, pts, who) {
  if (pts.length < 2) return pts;
  const out = []; let ax = sx, ay = sy, k = 0;
  while (k < pts.length) {
    let j = k;
    while (j + 1 < pts.length && j - k < 48 && clearLine(ax, ay, pts[j + 1][0], pts[j + 1][1], who)) j++;
    out.push(pts[j]); [ax, ay] = pts[j]; k = j + 1;
  }
  return out;
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
