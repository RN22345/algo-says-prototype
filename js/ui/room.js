/* ROOM. The house, its yard and the street, placed only from data/room.json. view.type "iso" draws the floor, two back walls,
   a low front wall with a door gap, the yard, sidewalk and road on a canvas. Stations, the player and outside vehicles are
   depth-sorted every frame. Clicks: a station polygon walks the player to the station, then opens it; the floor walks the
   player there. Keys: WASD or arrows walk, E or Space uses the nearest station. Move furniture mode lives in layout.js.
   Events in: gear:changed, flag:changed, newgame, layout:changed, modal:open/close, sample:arrived.
   Events out: station:click {id, locked}. Exports: stationRect(id), nudge(id), redrawRoom(), tileOf(st), toTile(), P(). */
import { D } from "../core/data.js";
import { S, flag, hasGear } from "../core/state.js";
import { artImg, artSize, isPlaceholder } from "../core/assets.js";
import { isDaylight, tod } from "../core/clock.js";
import { on, emit } from "../core/bus.js";
import { h } from "./ui.js";
import { drawOutside, outsideItems } from "./outside.js";

let cv, g, shell, sg, svg, tags, shade, lastDay = null, geo = {}, badgeCache = {}, modals = 0;
const NS = "http://www.w3.org/2000/svg";
const V = () => D.room.view;
export const P = (x, y, z = 0) => [V().ox + (x - y) * V().tw, V().oy + (x + y) * V().th - z * V().zUnit];
export const toTile = (sx, sy) => { const X = (sx - V().ox) / V().tw, Y = (sy - V().oy) / V().th; return [(X + Y) / 2, (Y - X) / 2]; };
export const hooks = { editing: () => false, ghost: null, pick: null };   // set by layout.js

/* ---------- station placement ---------- */
export function tileOf(st) {
  const L = S.layout && S.layout[st.id], t = st.tile; if (!t) return null;
  if (!L) return t;
  return L.flip ? [L.gx, L.gy, t[3], t[2]] : [L.gx, L.gy, t[2], t[3]];
}
export const flipOf = st => !!(S.layout && S.layout[st.id] && S.layout[st.id].flip);
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const bbox = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
export function placeAt(st, tile) {
  const [iw, ih] = artSize(st.art), img = artImg(st.art);
  const k = (st.scale || 1) * (V().artScale || 1);
  const w = (img ? img.naturalWidth : iw) * k, hh = (img ? img.naturalHeight : ih) * k;
  const [gx, gy, fw, fd] = tile, c = P(gx + fw / 2, gy + fd / 2);
  const ax = c[0], ay = c[1] + 0.45 * (fw + fd) / 2 * V().th + (st.dy || 0) * (V().artScale || 1);
  const diamond = [P(gx, gy + fd), P(gx, gy), P(gx + fw, gy), P(gx + fw, gy + fd)];
  const box = [ax - w / 2, ay - hh, w, hh];
  const showArt = img && !(st.id === "door" && isPlaceholder(st.art));
  let hit;
  if (st.hit && st.hit.type === "poly") hit = st.hit.points;
  else if (st.hit && st.hit.type === "rect") hit = [[st.hit.x, st.hit.y], [st.hit.x + st.hit.w, st.hit.y], [st.hit.x + st.hit.w, st.hit.y + st.hit.h], [st.hit.x, st.hit.y + st.hit.h]];
  else hit = showArt ? hull([[box[0], box[1]], [box[0] + w, box[1]], [box[0] + w, box[1] + hh], [box[0], box[1] + hh]].concat(diamond)) : diamond;
  return { box, hit, diamond, tag: [ax, (showArt ? box[1] : Math.min(...diamond.map(p => p[1])) - 30) - 4], showArt, tile };
}
export function stationRect(id) { const p = geo[id]; if (!p) return null; const b = bbox(p.hit); return { x: b[0], y: b[1], w: b[2], h: b[3] }; }
export const visible = st => !st.flag || flag(st.flag);
const locked = st => st.requiresGear && !hasGear(st.requiresGear);
export const stations = () => D.room.stations.filter(st => visible(st) && st.tile);

/* ---------- walk grid (cell = 0.25 tile) ---------- */
const CELL = 0.25;
const dims = () => ({ W: Math.round((V().Nx + D.room.yard.walk) / CELL), H: Math.round(V().Ny / CELL) });
function rectDist(x, y, t) { const dx = Math.max(t[0] - x, 0, x - (t[0] + t[2])), dy = Math.max(t[1] - y, 0, y - (t[1] + t[3])); return Math.hypot(dx, dy); }
export function blockedAt(x, y, ignore) {
  const N = V(), Fr = D.room.front;
  if (y < 0.3 || y > N.Ny - 0.2 || x < 0.3 || x > N.Nx + D.room.yard.walk - 0.1) return true;
  if (Math.abs(x - N.Nx) < 0.22 && !(y > Fr.door[0] + 0.15 && y < Fr.door[1] - 0.15)) return true;
  for (const st of stations()) { if (st.solid === false || st.id === ignore) continue; const t = tileOf(st); if (rectDist(x, y, t) < 0.18) return true; }
  return false;
}
function bfs(sx, sy, goal) {
  const { W, H } = dims(), ci = v => Math.floor(v / CELL), start = [Math.min(W - 1, Math.max(0, ci(sx))), Math.min(H - 1, Math.max(0, ci(sy)))];
  const seen = new Int32Array(W * H).fill(-1), q = [start[0] + start[1] * W]; seen[q[0]] = q[0];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], x = c % W, y = (c / W) | 0, cx = (x + 0.5) * CELL, cy = (y + 0.5) * CELL;
    if (qi > 0 && goal(cx, cy)) { const path = []; let k = c; while (k !== seen[k]) { path.push([((k % W) + 0.5) * CELL, (((k / W) | 0) + 0.5) * CELL]); k = seen[k]; } return path.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = nx + ny * W; if (seen[n] >= 0) continue;
      const mx = (nx + 0.5) * CELL, my = (ny + 0.5) * CELL;
      if (blockedAt(mx, my) || (dx && dy && (blockedAt((x + 0.5) * CELL, my) || blockedAt(mx, (y + 0.5) * CELL)))) continue;
      seen[n] = c; q.push(n);
    }
  }
  return null;
}

/* ---------- player ---------- */
const pl = { path: [], then: null, moving: false, face: 1, step: 0, keys: {} };
const PS = () => { if (!S.player) S.player = { x: D.room.player.start[0], y: D.room.player.start[1] }; return S.player; };
function walkTo(tx, ty, then) {
  const p = PS();
  const path = bfs(p.x, p.y, (x, y) => Math.hypot(x - tx, y - ty) < 0.2) || bfs(p.x, p.y, (x, y) => Math.hypot(x - tx, y - ty) < 0.6);
  pl.path = path || []; pl.then = then || null;
  if (!pl.path.length && then) { pl.then = null; then(); }
}
function walkToStation(st) {
  const p = PS(), t = tileOf(st), near = D.room.player.useDist;
  const open = () => emit("station:click", { id: st.id, locked: locked(st) });
  if (rectDist(p.x, p.y, t) <= near + 0.1) { pl.path = []; return open(); }
  const path = bfs(p.x, p.y, (x, y) => rectDist(x, y, t) <= near);
  if (!path) return open();       // unreachable: open anyway so nothing is ever stuck
  pl.path = path; pl.then = open;
}
function nearestStation() {
  const p = PS(); let best = null, bd = 9;
  for (const st of stations()) { const d = rectDist(p.x, p.y, tileOf(st)); if (d < bd) { bd = d; best = st; } }
  return bd <= D.room.player.useDist + 0.15 ? best : null;
}
const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable); };
function stepPlayer(dt) {
  const p = PS(), sp = D.room.player.speed * dt; let mx = 0, my = 0;
  if (modals === 0 && !hooks.editing()) {
    const k = pl.keys, up = k.w || k.arrowup, dn = k.s || k.arrowdown, lf = k.a || k.arrowleft, rt = k.d || k.arrowright;
    if (up) { mx -= 1; my -= 1; } if (dn) { mx += 1; my += 1; } if (lf) { mx -= 1; my += 1; } if (rt) { mx += 1; my -= 1; }
  }
  if (mx || my) {
    pl.path = []; pl.then = null;
    const l = Math.hypot(mx, my); mx = mx / l * sp; my = my / l * sp;
    if (!blockedAt(p.x + mx, p.y + my)) { p.x += mx; p.y += my; } else if (!blockedAt(p.x + mx, p.y)) p.x += mx; else if (!blockedAt(p.x, p.y + my)) p.y += my;
    pl.moving = true; pl.face = (mx - my) >= 0 ? 1 : -1;
  } else if (pl.path.length) {
    const [tx, ty] = pl.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d <= sp) { p.x = tx; p.y = ty; pl.path.shift(); } else { p.x += dx / d * sp; p.y += dy / d * sp; }
    if (Math.abs(dx - dy) > 0.01) pl.face = (dx - dy) >= 0 ? 1 : -1;
    pl.moving = true;
    if (!pl.path.length && pl.then) { const f = pl.then; pl.then = null; f(); }
  } else pl.moving = false;
  if (pl.moving) pl.step += dt * 9;
  // highlight the station in reach
  const ns = nearestStation(); for (const t of tags.children) t.classList.toggle("near", !!ns && t.dataset.id === ns.id);
}
function drawPlayer() {
  const p = PS(), [x, y] = P(p.x, p.y), bob = pl.moving ? Math.abs(Math.sin(pl.step)) * 4 : 0, leg = pl.moving ? Math.sin(pl.step) * 5 : 0;
  g.save(); g.translate(x, y);
  g.fillStyle = "rgba(28,36,82,.22)"; g.beginPath(); g.ellipse(0, 0, 20, 9, 0, 0, Math.PI * 2); g.fill();
  g.lineCap = "round"; g.strokeStyle = "#1c2452"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(-6, -22); g.lineTo(-6 + leg, -2); g.moveTo(6, -22); g.lineTo(6 - leg, -2); g.stroke();
  g.translate(0, -bob);
  g.fillStyle = "#2fd9cf"; g.strokeStyle = "#1c2452"; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(-15, -58, 30, 38, 12) : g.rect(-15, -58, 30, 38); g.fill(); g.stroke();
  const carry = S.orders && S.orders.some(o => o.status === "picked");
  if (carry) { g.fillStyle = "#d9a066"; g.fillRect(-12, -46, 24, 16); g.strokeRect(-12, -46, 24, 16); }
  g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(0, -72, 15, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#1c2452"; g.beginPath(); g.arc(0, -76, 15, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  g.beginPath(); g.arc(4 * pl.face, -71, 2.2, 0, Math.PI * 2); g.fill();
  g.restore();
}

/* ---------- drawing ---------- */
function polyOn(c, pts, fill, stroke, lw = 0) {
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = "round"; c.stroke(); }
}
function drawShell() {
  const c = sg, v = V(), Nx = v.Nx, Ny = v.Ny, C = D.room.colors, wh = v.wallH / v.zUnit, slab = 0.22, Y = D.room.yard;
  c.clearRect(0, 0, 1920, 1080);
  const bg = artImg(D.room.bg.art);
  if (bg && !isPlaceholder(D.room.bg.art)) { c.drawImage(bg, D.room.bg.x, D.room.bg.y, D.room.bg.w, D.room.bg.h); return; }
  // yard, sidewalk, road
  const X0 = Nx, gEnd = Nx + Y.grass, wEnd = Nx + Y.road[0], rEnd = Nx + Y.road[1];
  for (let i = 0; i < Math.ceil(Y.grass * 2); i++) for (let j = 0; j < Ny * 2; j++) polyOn(c, [P(X0 + i / 2, j / 2), P(X0 + (i + 1) / 2, j / 2), P(X0 + (i + 1) / 2, (j + 1) / 2), P(X0 + i / 2, (j + 1) / 2)], (i + j) % 2 ? C.grassA : C.grassB);
  polyOn(c, [P(gEnd, -1), P(wEnd, -1), P(wEnd, Ny + 1), P(gEnd, Ny + 1)], C.walk);
  for (let j = -1; j <= Ny; j++) polyOn(c, [P(gEnd, j), P(wEnd, j), P(wEnd, j + 0.04), P(gEnd, j + 0.04)], "#c2c7d3");
  polyOn(c, [P(wEnd, -1), P(rEnd, -1), P(rEnd, Ny + 1), P(wEnd, Ny + 1)], C.road);
  const mid = (wEnd + rEnd) / 2;
  for (let j = -1; j < Ny + 1; j += 0.9) polyOn(c, [P(mid - 0.04, j), P(mid + 0.04, j), P(mid + 0.04, j + 0.45), P(mid - 0.04, j + 0.45)], "#f4f1e4");
  polyOn(c, [P(X0, Fr0()), P(gEnd, Fr0()), P(gEnd, Fr1()), P(X0, Fr1())], "#e9d3b0");     // path to the door
  // floor slab sides and tiles
  polyOn(c, [P(0, Ny, 0), P(Nx, Ny, 0), P(Nx, Ny, -slab), P(0, Ny, -slab)], "#b98d4f");
  for (let i = 0; i < Nx; i++) for (let j = 0; j < Ny; j++) polyOn(c, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (i + j) % 2 ? C.floorA : C.floorB);
  for (const r of D.room.rugs || []) polyOn(c, [P(r[0], r[1]), P(r[0] + r[2], r[1]), P(r[0] + r[2], r[1] + r[3]), P(r[0], r[1] + r[3])], "rgba(255,255,255,.3)");
  // back walls
  polyOn(c, [P(0, 0, 0), P(0, Ny, 0), P(0, Ny, wh), P(0, 0, wh)], C.wallL);
  polyOn(c, [P(0, 0, 0), P(Nx, 0, 0), P(Nx, 0, wh), P(0, 0, wh)], C.wallR);
  polyOn(c, [P(0, 0, 0), P(0, Ny, 0), P(0, Ny, 0.16), P(0, 0, 0.16)], "#8aa6d6");
  polyOn(c, [P(0, 0, 0), P(Nx, 0, 0), P(Nx, 0, 0.16), P(0, 0, 0.16)], "#9fb8e0");
  polyOn(c, [P(0, 0, wh), P(0, Ny, wh), P(0, Ny, wh + 0.08), P(0, 0, wh + 0.08)], "#fff");
  polyOn(c, [P(0, 0, wh), P(Nx, 0, wh), P(Nx, 0, wh + 0.08), P(0, 0, wh + 0.08)], "#fff");
  c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 3;
  for (let t = 1; t < Math.max(Nx, Ny); t++) { c.beginPath(); if (t < Ny) { const a = P(0, t, 0.16), b = P(0, t, wh); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); } if (t < Nx) { const d1 = P(t, 0, 0.16), d2 = P(t, 0, wh); c.moveTo(d1[0], d1[1]); c.lineTo(d2[0], d2[1]); } c.stroke(); }
  // window
  const w = D.room.window; if (w) {
    const m = w.mount, img = artImg(isDaylight() ? w.dayArt : w.nightArt), L = m.t[1] - m.t[0], hh = (m.z[1] - m.z[0]) * v.zUnit, tl = P(0, m.t[1], m.z[1]);
    if (img) { c.save(); c.transform(1, -v.th / v.tw, 0, 1, tl[0], tl[1]); c.drawImage(img, 0, 0, L * v.tw, hh); c.restore(); }
    polyOn(c, [P(0, m.t[1], m.z[0]), P(0, m.t[0], m.z[0]), P(0, m.t[0], m.z[1]), P(0, m.t[1], m.z[1])], null, "#ffffffcc", 6);
  }
  // left front wall (low) and front-right wall split by the door
  const fh = D.room.front.h, C2 = C.front;
  polyOn(c, [P(0, Ny, 0), P(Nx, Ny, 0), P(Nx, Ny, fh), P(0, Ny, fh)], C2, "#9fb8e0", 2);
}
const Fr0 = () => D.room.front.door[0], Fr1 = () => D.room.front.door[1];
function drawFrontRight() {   // drawn after everything inside so it sits in front
  const v = V(), Nx = v.Nx, Ny = v.Ny, fh = D.room.front.h, C2 = D.room.colors.front;
  polyOn(g, [P(Nx, 0, 0), P(Nx, Fr0(), 0), P(Nx, Fr0(), fh), P(Nx, 0, fh)], C2, "#9fb8e0", 2);
  polyOn(g, [P(Nx, Fr1(), 0), P(Nx, Ny, 0), P(Nx, Ny, fh), P(Nx, Fr1(), fh)], C2, "#9fb8e0", 2);
  for (const y of [Fr0(), Fr1()]) { const a = P(Nx, y, 0), b = P(Nx, y, 2.1); g.strokeStyle = "#8a5a2b"; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  const a = P(Nx, Fr0(), 2.1), b = P(Nx, Fr1(), 2.1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
}
function drawStation(st, p, ghost) {
  g.save();
  if (ghost) g.globalAlpha = 0.72; else if (locked(st)) g.globalAlpha = 0.38;
  if (ghost) polyOn(g, p.diamond, ghost.ok ? "rgba(47,217,207,.35)" : "rgba(232,52,79,.4)", ghost.ok ? "#2fd9cf" : "#e8344f", 3);
  if (st.id === "door" && !p.showArt) polyOn(g, p.diamond, "#c0703a", "#8a5a2b", 3);
  else if (p.showArt) {
    const img = artImg(st.art), [bx, by, bw, bh] = p.box;
    if (ghost ? ghost.flip : flipOf(st)) { g.translate(bx + bw / 2, 0); g.scale(-1, 1); g.drawImage(img, -bw / 2, by, bw, bh); }
    else g.drawImage(img, bx, by, bw, bh);
  }
  g.restore();
}
function draw(now) {
  g.clearRect(0, 0, 1920, 1080); g.drawImage(shell, 0, 0);
  const items = [];
  for (const st of stations()) {
    if (hooks.ghost && hooks.ghost.st === st) continue;
    const t = tileOf(st), p = geo[st.id] || placeAt(st, t);
    items.push({ d: st.solid === false ? -1 : t[0] + t[2] + t[1] + t[3] - 0.6, f: () => drawStation(st, p) });
  }
  if (hooks.ghost) { const gh = hooks.ghost, t = gh.tile; items.push({ d: t[0] + t[2] + t[1] + t[3], f: () => drawStation(gh.st, placeAt(gh.st, t), gh) }); }
  const p = PS(), outside = [];
  (p.x > V().Nx ? outside : items).push({ d: p.x + p.y + 0.35, f: drawPlayer });
  for (const it of outsideItems(now)) outside.push(it);
  items.sort((a, b) => a.d - b.d); outside.sort((a, b) => a.d - b.d);
  for (const it of items) it.f(g);
  drawFrontRight();
  for (const it of outside) it.f(g);
  drawOutside(g, now);
}

/* ---------- hits and tags ---------- */
function buildHits() {
  svg.innerHTML = ""; tags.innerHTML = ""; geo = {}; badgeCache = {};
  const back = document.createElementNS(NS, "rect"); back.setAttribute("x", 0); back.setAttribute("y", 0); back.setAttribute("width", 1920); back.setAttribute("height", 1080); back.setAttribute("class", "floorhit");
  svg.append(back);
  for (const st of stations()) geo[st.id] = placeAt(st, tileOf(st));
  if (sg) drawShell();
  const sorted = stations().sort((a, b) => { const ta = tileOf(a), tb = tileOf(b); return (tb[0] + tb[1] + tb[2] + tb[3]) - (ta[0] + ta[1] + ta[2] + ta[3]); });
  for (const st of sorted) {
    const p = geo[st.id], lk = locked(st);
    const poly = document.createElementNS(NS, "polygon"); poly.setAttribute("points", p.hit.map(q => q.join(",")).join(" "));
    if (lk) poly.classList.add("lock"); poly.dataset.id = st.id;
    const tag = h("div", { class: "stag" + (lk ? " lock" : ""), style: { left: p.tag[0] + "px", top: p.tag[1] + "px" }, "data-id": st.id }, lk ? "🔒 " + st.label : st.label);
    poly.addEventListener("mouseenter", () => tag.classList.add("hl")); poly.addEventListener("mouseleave", () => tag.classList.remove("hl"));
    poly.addEventListener("click", e => { e.stopPropagation(); if (hooks.editing()) { if (hooks.pick) hooks.pick(st); return; } walkToStation(st); });
    svg.append(poly); tags.append(tag);
  }
}
function svgPoint(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : pt; }

function updateBadges() {
  const counts = { door: S.doorSamples.length + S.doorBoxes.length, packing: S.orders.filter(o => o.status === "toPack").length, shelves: Object.values(S.boxes).reduce((a, b) => a + b, 0) };
  for (const id of Object.keys(counts)) {
    const tag = tags.querySelector(`[data-id="${id}"]`); if (!tag) continue;
    if (badgeCache[id] === counts[id]) continue; badgeCache[id] = counts[id];
    const old = tag.querySelector(".badge"); if (old) old.remove();
    if (counts[id] > 0) tag.append(h("span", { class: "badge" }, String(counts[id])));
  }
}
export function nudge(id, on_ = true) { const t = tags && tags.querySelector(`[data-id="${id}"]`); if (t) t.classList.toggle("nudge", on_); }
export const svgEl = () => svg;
export const pointerTile = e => { const q = svgPoint(e); return toTile(q.x, q.y); };

export function initRoom() {
  const root = document.getElementById("room");
  cv = h("canvas", { width: 1920, height: 1080 }); g = cv.getContext("2d");
  shell = document.createElement("canvas"); shell.width = 1920; shell.height = 1080; sg = shell.getContext("2d");
  svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 1920 1080");
  tags = h("div", { style: { position: "absolute", inset: "0", pointerEvents: "none" } });
  shade = h("div", { class: "daynight" });
  root.append(cv, shade, svg, tags);
  buildHits();
  svg.addEventListener("click", e => { if (hooks.editing()) return; const [x, y] = pointerTile(e); walkTo(x, y); });
  window.addEventListener("keydown", e => {
    if (typing()) return; const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { pl.keys[k] = true; if (k.startsWith("arrow")) e.preventDefault(); }
    if ((k === "e" || k === " ") && modals === 0 && !hooks.editing()) { const st = nearestStation(); if (st) { e.preventDefault(); emit("station:click", { id: st.id, locked: locked(st) }); } }
  });
  window.addEventListener("keyup", e => { pl.keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", () => { pl.keys = {}; });
  on("gear:changed", buildHits); on("flag:changed", buildHits); on("layout:changed", buildHits);
  on("newgame", () => { S.player = null; pl.path = []; buildHits(); });
  on("modal:open", () => { modals++; pl.keys = {}; }); on("modal:close", () => { modals = Math.max(0, modals - 1); });
  on("frame", () => {
    const dl = isDaylight(); if (dl !== lastDay) { lastDay = dl; drawShell(); }
    const m = tod(); shade.style.opacity = m < 1020 ? 0 : m < 1140 ? 0.12 : 0.26;
    updateBadges();
  });
  on("stock:changed", updateBadges);
  updateBadges();
  let last = performance.now();
  const loop = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (S.started) stepPlayer(dt); draw(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
export const redrawRoom = () => { if (g) buildHits(); };
