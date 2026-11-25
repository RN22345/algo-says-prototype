/* ROOM. One room, placed only from data/room.json. view.type "iso" draws a floor diamond and two back walls on a canvas;
   stations are sprites (or art on a wall face), sorted by z. Clicks use an SVG polygon per station (rect or polygon hit area from the data).
   Hover shows a highlight and a name tag. The window swaps day or night art with the clock. Locked stations (missing gear) show a lock tag.
   Events in: frame, gear:changed, flag:changed, stock:changed, order:*. Events out: station:click {id}. Exports: stationRect(id). */
import { D } from "../core/data.js";
import { S, flag, hasGear } from "../core/state.js";
import { artImg, artSize, isPlaceholder } from "../core/assets.js";
import { isDaylight, tod } from "../core/clock.js";
import { on, emit } from "../core/bus.js";
import { h } from "./ui.js";

let cv, g, svg, tags, shade, lastDay = null, geo = {}, badgeCache = {};
const NS = "http://www.w3.org/2000/svg";
const V = () => D.room.view;
const P = (x, y, z = 0) => [V().ox + (x - y) * V().tw, V().oy + (x + y) * V().th - z * V().zUnit];

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/* Where a station sits: art box, hit polygon, tag point. All in room pixels. */
function place(st) {
  const [iw, ih] = artSize(st.art), img = artImg(st.art);
  const nw = img ? img.naturalWidth : iw, nh = img ? img.naturalHeight : ih;
  if (st.mount) {
    const m = st.mount, L = m.t[1] - m.t[0], zt = m.z[1], zb = m.z[0];
    const f = m.face === "x" ? (t, z) => P(0, t, z) : (t, z) => P(t, 0, z);
    const q = [f(m.t[0], zb), f(m.t[1], zb), f(m.t[1], zt), f(m.t[0], zt)];
    const tl = m.face === "x" ? f(m.t[1], zt) : f(m.t[0], zt);                  // image top-left corner
    const dx = m.face === "x" ? [L * V().tw, -L * V().th] : [L * V().tw, L * V().th];
    return { kind: "wall", q, tl, dx, zt, zb, hit: q, tag: [(q[2][0] + q[3][0]) / 2, Math.min(q[2][1], q[3][1]) - 6], box: bbox(q) };
  }
  let ax, ay, w = nw * (st.scale || 1), hh = nh * (st.scale || 1), diamond = null;
  if (st.tile) {
    const [gx, gy, fw, fd] = st.tile, c = P(gx + fw / 2, gy + fd / 2);
    ax = c[0]; ay = c[1] + 0.45 * (fw + fd) / 2 * V().th + (st.dy || 0);
    diamond = [P(gx, gy + fd), P(gx, gy), P(gx + fw, gy), P(gx + fw, gy + fd)];
  } else { ax = st.x; ay = st.y; }
  const box = [ax - w / 2, ay - hh, w, hh];
  let hit;
  if (st.hit && st.hit.type === "poly") hit = st.hit.points;
  else if (st.hit && st.hit.type === "rect") hit = [[st.hit.x, st.hit.y], [st.hit.x + st.hit.w, st.hit.y], [st.hit.x + st.hit.w, st.hit.y + st.hit.h], [st.hit.x, st.hit.y + st.hit.h]];
  else { const pts = [[box[0], box[1]], [box[0] + w, box[1]], [box[0] + w, box[1] + hh], [box[0], box[1] + hh]]; hit = diamond ? hull(pts.concat(diamond)) : pts; }
  return { kind: "sprite", box, hit, tag: [ax, box[1] - 4] };
}
const bbox = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
export function stationRect(id) { const p = geo[id]; if (!p) return null; const b = bbox(p.hit); return { x: b[0], y: b[1], w: b[2], h: b[3] }; }

const visible = st => !st.flag || flag(st.flag);
const locked = st => st.requiresGear && !hasGear(st.requiresGear);

function poly(pts, fill, stroke, lw = 0) {
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = "round"; g.stroke(); }
}
function drawShell() {
  const v = V(), N = v.N, C = D.room.colors, wh = (v.wallH) / v.zUnit, slab = 0.22;
  // floor slab sides
  poly([P(0, N, 0), P(N, N, 0), P(N, N, -slab), P(0, N, -slab)], "#b98d4f");
  poly([P(N, 0, 0), P(N, N, 0), P(N, N, -slab), P(N, 0, -slab)], "#a47c42");
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (i + j) % 2 ? C.floorA : C.floorB);
  // walls
  poly([P(0, 0, 0), P(0, N, 0), P(0, N, wh), P(0, 0, wh)], C.wallL);
  poly([P(0, 0, 0), P(N, 0, 0), P(N, 0, wh), P(0, 0, wh)], C.wallR);
  // base boards and top caps
  poly([P(0, 0, 0), P(0, N, 0), P(0, N, 0.16), P(0, 0, 0.16)], "#8aa6d6");
  poly([P(0, 0, 0), P(N, 0, 0), P(N, 0, 0.16), P(0, 0, 0.16)], "#9fb8e0");
  poly([P(0, 0, wh), P(0, N, wh), P(0, N, wh + 0.08), P(0, 0, wh + 0.08)], "#fff");
  poly([P(0, 0, wh), P(N, 0, wh), P(N, 0, wh + 0.08), P(0, 0, wh + 0.08)], "#fff");
  // soft wall panel lines
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 3;
  for (let t = 1; t < N; t++) { g.beginPath(); const a = P(0, t, 0.16), b = P(0, t, wh); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); const c = P(t, 0, 0.16), d = P(t, 0, wh); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke(); }
  // a rug
  poly([P(1.3, 1.6), P(3.4, 1.6), P(3.4, 3.2), P(1.3, 3.2)].map(p => p), "rgba(255,255,255,.28)");
}
function drawFace(img, m, win) {
  if (!img) return;
  const q = win.q, [tx, ty] = win.tl, w = img.naturalWidth, hgt = img.naturalHeight;
  const L = m.t[1] - m.t[0], hh = (m.z[1] - m.z[0]) * V().zUnit;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const sk = m.face === "x" ? -V().th / V().tw : V().th / V().tw;
  g.transform(1, sk, 0, 1, tx, ty);
  g.drawImage(img, 0, 0, L * V().tw, hh);
  g.restore();
  // frame outline
  poly(q, null, "#ffffffcc", 6);
}
function draw() {
  g.clearRect(0, 0, 1920, 1080);
  const bg = artImg(D.room.bg.art);
  if (bg && !isPlaceholder(D.room.bg.art)) g.drawImage(bg, D.room.bg.x, D.room.bg.y, D.room.bg.w, D.room.bg.h); else drawShell();
  const items = [];
  if (D.room.window) items.push({ z: D.room.window.z ?? 1, win: true });
  for (const st of D.room.stations) if (visible(st)) items.push({ z: st.z ?? 5, st });
  items.sort((a, b) => a.z - b.z);
  for (const it of items) {
    if (it.win) {
      const w = D.room.window, pl = { q: [P(0, w.mount.t[1], w.mount.z[0]), P(0, w.mount.t[0], w.mount.z[0]), P(0, w.mount.t[0], w.mount.z[1]), P(0, w.mount.t[1], w.mount.z[1])], tl: P(0, w.mount.t[1], w.mount.z[1]) };
      drawFace(artImg(isDaylight() ? w.dayArt : w.nightArt), { ...w.mount }, pl);
      continue;
    }
    const st = it.st, p = geo[st.id], img = artImg(st.art); if (!img || !p) continue;
    g.save(); if (locked(st)) g.globalAlpha = 0.38;
    if (p.kind === "wall") {
      const m = st.mount, L = m.t[1] - m.t[0], hh = (m.z[1] - m.z[0]) * V().zUnit, sk = m.face === "x" ? -V().th / V().tw : V().th / V().tw;
      g.transform(1, sk, 0, 1, p.tl[0], p.tl[1]); g.drawImage(img, 0, 0, L * V().tw, hh);
    } else g.drawImage(img, p.box[0], p.box[1], p.box[2], p.box[3]);
    g.restore();
  }
}

function buildHits() {
  svg.innerHTML = ""; tags.innerHTML = ""; geo = {}; badgeCache = {};
  for (const st of D.room.stations) {
    if (!visible(st)) continue;
    const p = place(st); geo[st.id] = p; st._p = p;
  }
  draw();
  const sorted = D.room.stations.filter(visible).sort((a, b) => (b.z ?? 5) - (a.z ?? 5));  // front items first so they win overlaps
  for (const st of sorted) {
    const p = geo[st.id], lk = locked(st);
    const poly = document.createElementNS(NS, "polygon"); poly.setAttribute("points", p.hit.map(q => q.join(",")).join(" "));
    if (lk) poly.classList.add("lock"); poly.dataset.id = st.id;
    const tag = h("div", { class: "stag" + (lk ? " lock" : ""), style: { left: p.tag[0] + "px", top: p.tag[1] + "px" }, "data-id": st.id }, lk ? "🔒 " + st.label : st.label);
    poly.addEventListener("mouseenter", () => tag.classList.add("hl")); poly.addEventListener("mouseleave", () => tag.classList.remove("hl"));
    poly.addEventListener("click", () => emit("station:click", { id: st.id, locked: lk }));
    svg.append(poly); tags.append(tag);
  }
  // keep tag z-order by depth so back items do not cover front tags
}

function updateBadges() {
  const counts = { door: S.doorSamples.length + S.doorBoxes.length, packing: S.orders.filter(o => o.status === "toPack").length, shelves: Object.values(S.boxes).reduce((a, b) => a + b, 0) };
  for (const id of Object.keys(counts)) {
    const tag = tags.querySelector(`[data-id="${id}"]`); if (!tag) continue;
    if (badgeCache[id] === counts[id]) continue; badgeCache[id] = counts[id];
    const old = tag.querySelector(".badge"); if (old) old.remove();
    if (counts[id] > 0) tag.append(h("span", { class: "badge" }, String(counts[id])));
  }
}
export function nudge(id, on_ = true) { const t = tags.querySelector(`[data-id="${id}"]`); if (t) t.classList.toggle("nudge", on_); }

export function initRoom() {
  const root = document.getElementById("room");
  cv = h("canvas", { width: 1920, height: 1080 }); g = cv.getContext("2d");
  svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 1920 1080");
  tags = h("div", { style: { position: "absolute", inset: "0", pointerEvents: "none" } });
  shade = h("div", { class: "daynight" });
  root.append(cv, shade, svg, tags);
  buildHits();
  on("gear:changed", buildHits); on("flag:changed", buildHits); on("newgame", buildHits);
  on("frame", () => {
    const dl = isDaylight(); if (dl !== lastDay) { lastDay = dl; draw(); }
    const m = tod(); shade.style.opacity = m < 1020 ? 0 : m < 1140 ? 0.12 : 0.26;
    updateBadges();
  });
  on("stock:changed", updateBadges);
  updateBadges();
}
export const redrawRoom = () => { if (g) buildHits(); };
