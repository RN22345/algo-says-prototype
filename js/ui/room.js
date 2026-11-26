/* ROOM. Draws the world (house, bought rooms, yard, street) and handles clicks. The world is placed only from data/room.json and
   data/world.json; what exists comes from world.js, the static ground from terrain.js (an offscreen shell), the camera from camera.js.
   Every frame: shell, then the depth-sorted items (stations, props, player, vehicles), the front walls, and clouds. An item that
   stands in front of the player and covers them is drawn faded. An SVG layer above holds one hit polygon per station and the
   floor; both it and the name tags move with the camera. Click a station: walk there, then open it. Click the floor: walk.
   Keys: WASD or arrows walk, E or Space uses the nearest station. Move furniture mode lives in layout.js.
   Events in: gear:changed, flag:changed, newgame, layout:changed, property:bought, furniture:changed, modal:open/close, stock:changed.
   Events out: station:click {id, locked}. Exports: P, toTile, perf, hooks, tileOf, flipOf, stations, placeAt, stationRect, nudge, svgEl, pointerTile, redrawRoom. */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { artImg, artSize, isPlaceholder } from "../core/assets.js";
import { isDaylight, tod } from "../core/clock.js";
import { on } from "../core/bus.js";
import { h } from "./ui.js";
import { P, toTile } from "./proj.js";
import * as W from "./world.js";
import { loadSprites, hasSpr, spr, drawSpr, sprBoxAt } from "./art.js";
import { fallbackProp, polyOn } from "./drawkit.js";
import { initShell, drawShell, shellCanvas, shellOrigin, drawFront, propItems, drawClouds } from "./terrain.js";
import { cam, setBounds, follow, apply, matrix, toWorld, toScreen, viewRect, initCameraInput, justPinched } from "./camera.js";
import { pl, PS, walkTo, walkToStation, nearestStation, stepPlayer, drawPlayer, typing } from "./player.js";
import { initJoystick } from "./joystick.js";
import { drawOutside, outsideItems } from "./outside.js";

export { P, toTile };
export const tileOf = W.tileOf, flipOf = W.flipOf, stations = W.stations;
let cv, g, svg, camG, tags, shade, lastDay = null, geo = {}, badgeCache = {}, modals = 0, camStr = "";
const NS = "http://www.w3.org/2000/svg";
const V = () => D.room.view;
export const perf = { ms: 0 };   // smoothed draw time per frame, for testing (window.__algo.perf)
export const hooks = { editing: () => false, ghost: null, pick: null };   // set by layout.js

/* ---------- station placement ---------- */
const hull = pts => {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
const bbox = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
export function placeAt(st, tile, flip = W.flipOf(st)) {
  const [gx, gy, fw, fd] = tile, c = P(gx + fw / 2, gy + fd / 2), diamond = [P(gx, gy + fd), P(gx, gy), P(gx + fw, gy), P(gx + fw, gy + fd)];
  const sid = W.spriteId(st), k = (st.scale || 1) * (V().artScale || 1);
  let box, showArt;
  if (sid) { box = sprBoxAt(sid, c[0], c[1], { flip }); showArt = true; }
  else {
    const [iw, ih] = artSize(st.art), img = artImg(st.art), w = (img ? img.naturalWidth : iw) * k, hh = (img ? img.naturalHeight : ih) * k;
    box = [c[0] - w / 2, c[1] + 0.45 * (fw + fd) / 2 * V().th + (st.dy || 0) * (V().artScale || 1) - hh, w, hh];
    showArt = !!img && !(st.id === "door" && isPlaceholder(st.art));
  }
  let hit;
  if (st.hit && st.hit.type === "poly") hit = st.hit.points;
  else if (st.hit && st.hit.type === "rect") hit = [[st.hit.x, st.hit.y], [st.hit.x + st.hit.w, st.hit.y], [st.hit.x + st.hit.w, st.hit.y + st.hit.h], [st.hit.x, st.hit.y + st.hit.h]];
  else if (showArt || st.sign) {
    const [bx, by, bw, bh] = box, ix = bw * 0.1, iy = bh * 0.08;      // trim the transparent corners
    hit = hull([[bx + ix, by + iy], [bx + bw - ix, by + iy], [bx + bw - ix, by + bh], [bx + ix, by + bh]].concat(diamond));
  } else hit = diamond;
  const top = Math.min(...diamond.map(q => q[1]));
  return { box, hit, diamond, tag: [c[0], (showArt ? Math.max(box[1], top - 250) : top - 30) - 4], showArt, sid, tile, c };
}
export function stationRect(id) {
  const p = geo[id]; if (!p) return null; const b = bbox(p.hit), [x0, y0] = toScreen(b[0], b[1]);
  return { x: x0, y: y0, w: b[2] * cam.z, h: b[3] * cam.z };
}

/* ---------- drawing ---------- */
function drawStation(st, p, ghost) {
  g.save();
  if (ghost) g.globalAlpha = 0.72; else if (W.locked(st)) g.globalAlpha = 0.38;
  if (ghost) polyOn(g, p.diamond, ghost.ok ? "rgba(47,217,207,.35)" : "rgba(232,52,79,.4)", ghost.ok ? "#2fd9cf" : "#e8344f", 3);
  const flip = ghost ? ghost.flip : W.flipOf(st), [cx, cy] = [p.tile[0] + p.tile[2] / 2, p.tile[1] + p.tile[3] / 2];
  if (p.sid) drawSpr(g, p.sid, cx, cy, { flip });
  else if (st.id === "door" && !p.showArt) polyOn(g, p.diamond, "#c0703a", "#8a5a2b", 3);
  else if (p.showArt) {
    const img = artImg(st.art), [bx, by, bw, bh] = p.box;
    if (flip) { g.translate(bx + bw / 2, 0); g.scale(-1, 1); g.drawImage(img, -bw / 2, by, bw, bh); } else g.drawImage(img, bx, by, bw, bh);
  } else if (st.sign) fallbackProp(g, "od_sale_sign", cx, cy);
  else if (st.piece || st.deco) fallbackProp(g, st.furniture || "piece", cx, cy, p.tile[2], p.tile[3]);
  g.restore();
}
function onScreen(bb, vr) { return !bb || (bb[0] < vr[0] + vr[2] + 100 && bb[0] + bb[2] > vr[0] - 100 && bb[1] < vr[1] + vr[3] + 100 && bb[1] + bb[3] > vr[1] - 100); }
function runItems(list, pd, hp, vr) {
  list.sort((a, b) => a.d - b.d);
  for (const it of list) {
    if (!onScreen(it.bb, vr)) continue;
    const hide = it.bb && it.d > pd && hp[0] > it.bb[0] && hp[0] < it.bb[0] + it.bb[2] && hp[1] > it.bb[1] && hp[1] < it.bb[1] + it.bb[3];
    if (hide) { g.globalAlpha = 0.45; it.f(g); g.globalAlpha = 1; } else it.f(g);
  }
}
function draw(now) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1920, 1080); apply(g);
  const vr = viewRect(); drawClouds(g, now, false);
  const sc = shellCanvas(), [ox, oy, sw, sh] = shellOrigin();
  if (sc) { const x0 = Math.max(Math.floor(vr[0]), ox), x1 = Math.min(Math.ceil(vr[0] + vr[2]), ox + sw), y0 = Math.max(Math.floor(vr[1]), oy), y1 = Math.min(Math.ceil(vr[1] + vr[3]), oy + sh); if (x1 > x0 && y1 > y0) g.drawImage(sc, x0 - ox, y0 - oy, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); }
  const inside = [], outside = [], p = PS(), pd = p.x + p.y + 0.35, hp = P(p.x, p.y), head = [hp[0], hp[1] - 70];
  for (const st of W.stations()) {
    if (hooks.ghost && hooks.ghost.st === st) continue;
    const t = W.tileOf(st), pl_ = geo[st.id] || placeAt(st, t);
    inside.push({ d: st.solid === false ? -1 : t[0] + t[2] + t[1] + t[3] - 0.6, bb: pl_.box, f: () => drawStation(st, pl_) });
  }
  if (hooks.ghost) { const gh = hooks.ghost, t = gh.tile, pg = placeAt(gh.st, t, gh.flip); inside.push({ d: t[0] + t[2] + t[1] + t[3], f: () => drawStation(gh.st, pg, gh) }); }
  (p.x > V().Nx ? outside : inside).push({ d: pd, f: drawPlayer });
  for (const it of propItems()) outside.push(it);
  for (const it of outsideItems(now, { cross: W.onCrosswalk(p.x, p.y) })) outside.push(it);
  runItems(inside, pd, head, vr); drawFront(g); runItems(outside, pd, head, vr);
  drawOutside(g); drawClouds(g, now, true);
}

/* ---------- hits and tags ---------- */
function applyCam() {
  const m = matrix(); if (m === camStr) return; camStr = m;
  if (camG) camG.setAttribute("transform", m); if (tags) tags.style.transform = m;
}
function buildHits() {
  W.refresh(); svg.innerHTML = ""; tags.innerHTML = ""; geo = {}; badgeCache = {};
  const back = document.createElementNS(NS, "rect"); back.setAttribute("x", 0); back.setAttribute("y", 0); back.setAttribute("width", 1920); back.setAttribute("height", 1080); back.setAttribute("class", "floorhit");
  camG = document.createElementNS(NS, "g"); svg.append(back, camG); camStr = "";
  for (const st of W.stations()) geo[st.id] = placeAt(st, W.tileOf(st));
  drawShell();
  const sorted = W.stations().slice().sort((a, b) => { const ta = W.tileOf(a), tb = W.tileOf(b); return (tb[0] + tb[1] + tb[2] + tb[3]) - (ta[0] + ta[1] + ta[2] + ta[3]); });
  for (const st of sorted) {
    const p = geo[st.id], lk = W.locked(st);
    const poly = document.createElementNS(NS, "polygon"); poly.setAttribute("points", p.hit.map(q => q.join(",")).join(" "));
    if (lk) poly.classList.add("lock"); if (st.deco) poly.classList.add("deco"); poly.dataset.id = st.id;
    let tag = null;
    if (!st.deco) tag = h("div", { class: "stag" + (lk ? " lock" : ""), style: { left: p.tag[0] + "px", top: p.tag[1] + "px" }, "data-id": st.id }, lk ? "🔒 " + st.label : st.label);
    if (tag) { poly.addEventListener("mouseenter", () => tag.classList.add("hl")); poly.addEventListener("mouseleave", () => tag.classList.remove("hl")); }
    poly.addEventListener("click", e => { e.stopPropagation(); if (hooks.editing()) { if (hooks.pick) hooks.pick(st); return; } walkToStation(st); });
    camG.append(poly); if (tag) tags.append(tag);
  }
  applyCam();
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
export const pointerTile = e => { const q = svgPoint(e), [wx, wy] = toWorld(q.x, q.y); return toTile(wx, wy); };

export function initRoom() {
  const root = document.getElementById("room");
  cv = h("canvas", { width: 1920, height: 1080 }); g = cv.getContext("2d");
  initShell(); setBounds(W.worldBox());
  svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 1920 1080");
  tags = h("div", { class: "tags" });
  shade = h("div", { class: "daynight" });
  root.append(cv, shade, svg, tags);
  initCameraInput(root); initJoystick(root);
  buildHits();
  loadSprites().then(() => buildHits()).catch(e => console.warn("sprites", e));
  svg.addEventListener("click", e => { if (justPinched()) { e.stopPropagation(); e.preventDefault(); } }, true);
  svg.addEventListener("click", e => { if (hooks.editing()) return; const [x, y] = pointerTile(e); walkTo(x, y); });
  window.addEventListener("keydown", e => {
    if (typing()) return; const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { pl.keys[k] = true; if (k.startsWith("arrow")) e.preventDefault(); }
    if ((k === "e" || k === " ") && modals === 0 && !hooks.editing()) { const st = nearestStation(); if (st) { e.preventDefault(); walkToStation(st); } }
  });
  window.addEventListener("keyup", e => { pl.keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", () => { pl.keys = {}; });
  for (const ev of ["gear:changed", "flag:changed", "layout:changed", "property:bought", "furniture:changed"]) on(ev, buildHits);
  on("newgame", () => { S.player = null; pl.path = []; cam.snap = true; buildHits(); });
  on("modal:open", () => { modals++; pl.keys = {}; }); on("modal:close", () => { modals = Math.max(0, modals - 1); });
  on("frame", () => {
    const dl = isDaylight(); if (dl !== lastDay) { lastDay = dl; drawShell(); }
    const m = tod(); shade.style.opacity = m < 1020 ? 0 : m < 1140 ? 0.12 : 0.26;
    updateBadges();
  });
  on("stock:changed", updateBadges);
  updateBadges();
  let last = performance.now(), lastNear = 0;
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (S.started) stepPlayer(dt, modals === 0 && !hooks.editing());
    const p = PS(), [sx, sy] = P(p.x, p.y); follow(sx, sy, dt); applyCam();
    if (S.started && now - lastNear > 120) { lastNear = now; const ns = nearestStation(); for (const t of tags.children) t.classList.toggle("near", !!ns && t.dataset.id === ns.id); }
    const t0 = performance.now(); draw(now); perf.ms = perf.ms * 0.9 + (performance.now() - t0) * 0.1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
export const redrawRoom = () => { if (g) buildHits(); };
