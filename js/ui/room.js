/* ROOM. Draws the world (house, bought rooms, yard, street) and handles clicks. The world is placed only from data/room.json and
   data/world.json; what exists comes from world.js, the ground from terrain.js (lazy chunks), the camera from camera.js.
   Every frame: ground, a ring where a click-walk is heading, then the depth-sorted items (stations, props, player, people, vehicles),
   the front walls, the indoor mask (outside fades away while the player is inside), dust puffs, night lamp glow and clouds. An item in front of the player that covers them is drawn faded.
   Clicks are pixel accurate: a station is hit only where its art is painted (alpha mask), front-most first, so the floor around
   furniture stays walkable by click. The station under the pointer gets a soft white outline; the one in reach gets a gold one.
   Name tags show only on hover, in reach, with a count badge, or when the guide points at them (diegetic, not a label cloud).
   Stations that appear (a bought room, placed furniture) pop in with a bounce.
   Keys: WASD or arrows walk, E or Space uses the station in reach. Move furniture mode lives in layout.js.
   Events in: gear:changed, flag:changed, newgame, layout:changed, property:bought, furniture:changed, modal:open/close, stock:changed.
   Events out: station:click {id, locked}. Exports: P, toTile, perf, hooks, tileOf, flipOf, stations, placeAt, stationRect, nudge, svgEl, pointerTile, redrawRoom, hitStation. */
import { courierHere } from "../sim/shop.js";
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { artImg, artSize, isPlaceholder } from "../core/assets.js";
import { isDaylight, tod } from "../core/clock.js";
import { on } from "../core/bus.js";
import { h } from "./ui.js";
import { P, toTile } from "./proj.js";
import * as W from "./world.js";
import { loadSprites, spr, sprBoxAt } from "./art.js";
import { fallbackProp, polyOn } from "./drawkit.js";
import { initShell, drawShell, drawGround, drawFront, propItems, drawClouds, drawInterior, exteriorParts, houseRect, houseHit } from "./terrain.js";
import { cam, setBounds, follow, apply, matrix, toWorld, toScreen, viewRect, initCameraInput, justPinched, setInner } from "./camera.js";
import { pl, PS, walkTo, walkToStation, nearestStation, stepPlayer, drawPlayer, typing, walkTarget } from "./player.js";
import { initJoystick } from "./joystick.js";
import { drawOutside, outsideItems } from "./outside.js";
import { appear, forget, drawPuffs, puff } from "./fx.js";

export { P, toTile };
export const tileOf = W.tileOf, flipOf = W.flipOf, stations = W.stations;
let cv, g, svg, tags, shade, lastDay = null, geo = {}, badgeCache = {}, modals = 0, camStr = "", hoverId = null, nearId = null, built = false;
const NS = "http://www.w3.org/2000/svg";
const V = () => D.room.view;
export const perf = { ms: 0 };   // smoothed draw time per frame, for testing (window.__algo.perf)
export const hooks = { editing: () => false, ghost: null, pick: null };   // set by layout.js

/* ---------- image masks and outlines (cached per image) ---------- */
const masks = new WeakMap(), glows = new WeakMap();
function maskOf(img) {
  let m = masks.get(img); if (m) return m;
  const w = Math.max(1, Math.round(img.naturalWidth / 2)), hh = Math.max(1, Math.round(img.naturalHeight / 2)), c = document.createElement("canvas"); c.width = w; c.height = hh;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, hh);
  try { const d = x.getImageData(0, 0, w, hh).data, a = new Uint8Array(w * hh); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; m = { a, w, h: hh }; } catch (e) { m = { a: null, w, h: hh }; }
  masks.set(img, m); return m;
}
function glowOf(img, col) {
  let byCol = glows.get(img); if (!byCol) glows.set(img, byCol = {});
  if (byCol[col]) return byCol[col];
  const pad = 10, w = img.naturalWidth, hh = img.naturalHeight, sil = document.createElement("canvas"); sil.width = w; sil.height = hh;
  const s = sil.getContext("2d"); s.drawImage(img, 0, 0); s.globalCompositeOperation = "source-in"; s.fillStyle = col; s.fillRect(0, 0, w, hh);
  const c = document.createElement("canvas"); c.width = w + pad * 2; c.height = hh + pad * 2; const x = c.getContext("2d");
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.drawImage(sil, pad + Math.cos(a) * 7, pad + Math.sin(a) * 7); }
  return (byCol[col] = { c, pad });
}
function imgIn(g2, img, box, flip) {
  const [bx, by, bw, bh] = box;
  if (flip) { g2.save(); g2.translate(bx + bw / 2, 0); g2.scale(-1, 1); g2.drawImage(img, -bw / 2, by, bw, bh); g2.restore(); } else g2.drawImage(img, bx, by, bw, bh);
}
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

/* ---------- station placement ---------- */
const bbox = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
export function placeAt(st, tile, flip = W.flipOf(st)) {
  const [gx, gy, fw, fd] = tile, c = P(gx + fw / 2, gy + fd / 2), diamond = [P(gx, gy + fd), P(gx, gy), P(gx + fw, gy), P(gx + fw, gy + fd)];
  const sid = W.spriteId(st), k = (st.scale || 1) * (V().artScale || 1);
  let box, img = null;
  if (sid) { box = sprBoxAt(sid, c[0], c[1], { flip }); img = spr(sid).img; }
  else {
    const [iw, ih] = artSize(st.art), im = artImg(st.art), w = (im ? im.naturalWidth : iw) * k, hh = (im ? im.naturalHeight : ih) * k;
    box = [c[0] - w / 2, c[1] + 0.45 * (fw + fd) / 2 * V().th + (st.dy || 0) * (V().artScale || 1) - hh, w, hh];
    if (im && !(st.id === "door" && isPlaceholder(st.art))) img = im;
  }
  const top = Math.min(...diamond.map(q => q[1]));
  const hitBox = img ? box : bbox(diamond.concat(st.sign ? [[c[0] - 50, c[1] - 130]] : []));
  return { box, hitBox, diamond, img, flip, tag: [c[0], (img ? Math.max(box[1] + box[3] * 0.06, top - 250) : top - 30) - 8], sid, tile, c };
}
export function stationRect(id) {
  const p = geo[id]; if (!p) return null; const b = p.hitBox, [x0, y0] = toScreen(b[0], b[1]);
  return { x: x0, y: y0, w: b[2] * cam.z, h: b[3] * cam.z };
}
const depthOf = st => { const t = W.tileOf(st); return st.solid === false ? -1 : t[0] + t[2] + t[1] + t[3] - 0.6; };
/* The station under world pixel (wx, wy): front-most first, by painted pixels (or the floor diamond when there is no art). */
export function hitStation(wx, wy) {
  if (!indoors() && !hooks.editing() && houseHit(wx, wy)) return W.stationById ? W.stationById("door") : W.stations().find(st => st.id === "door");
  const io = indoors() || hooks.editing();
  const list = W.stations().filter(st => (!st.deco || hooks.editing()) && (io ? !outdoorSt(st) : outdoorSt(st))).sort((a, b) => depthOf(b) - depthOf(a));
  for (const st of list) {
    const p = geo[st.id]; if (!p) continue;
    if (p.img) {
      const [bx, by, bw, bh] = p.box; if (wx < bx || wx > bx + bw || wy < by || wy > by + bh) continue;
      const m = maskOf(p.img); let u = (wx - bx) / bw; if (p.flip) u = 1 - u;
      if (!m.a) return st;
      const ix = Math.min(m.w - 1, Math.floor(u * m.w)), iy = Math.min(m.h - 1, Math.floor((wy - by) / bh * m.h));
      let hit = false; for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) { const x = ix + dx, y = iy + dy; if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.a[x + y * m.w] > 60) { hit = true; break; } }
      if (hit) return st;
    } else if (inPoly(wx, wy, p.diamond) || (st.sign && inPoly(wx, wy, [[p.c[0] - 50, p.c[1] - 130], [p.c[0] + 50, p.c[1] - 130], [p.c[0] + 50, p.c[1]], [p.c[0] - 50, p.c[1]]]))) return st;
  }
  return null;
}

/* ---------- drawing ---------- */
function drawStation(st, p, ghost, now) {
  g.save();
  const ap = ghost ? { s: 1, a: 1 } : appear("st:" + st.id, now);
  if (ghost) g.globalAlpha = 0.72; else if (W.locked(st)) g.globalAlpha = 0.5; else g.globalAlpha = ap.a;
  if (ghost) polyOn(g, p.diamond, ghost.ok ? "rgba(47,217,207,.3)" : "rgba(232,52,79,.35)", ghost.ok ? "rgba(47,217,207,.9)" : "rgba(232,52,79,.9)", 2);
  const flip = ghost ? ghost.flip : p.flip, [cx, cy] = [p.tile[0] + p.tile[2] / 2, p.tile[1] + p.tile[3] / 2];
  let box = p.box; if (ap.s !== 1) box = [p.c[0] + (box[0] - p.c[0]) * ap.s, p.c[1] + (box[1] - p.c[1]) * ap.s, box[2] * ap.s, box[3] * ap.s];
  const lit = !ghost && (st.id === hoverId ? "rgba(255,255,255,.95)" : st.id === nearId ? "rgba(255,206,84,.95)" : null);
  if (p.img) {
    if (lit) { const gl = glowOf(p.img, lit), kx = box[2] / p.img.naturalWidth, ky = box[3] / p.img.naturalHeight; imgIn(g, gl.c, [box[0] - gl.pad * kx, box[1] - gl.pad * ky, box[2] + 2 * gl.pad * kx, box[3] + 2 * gl.pad * ky], flip); }
    imgIn(g, p.img, box, flip);
  } else if (st.id === "door") { polyOn(g, p.diamond, lit ? "rgba(255,206,84,.55)" : "rgba(192,112,58,.55)", lit ? "#ffce54" : "rgba(138,90,43,.6)", 2); }
  else if (st.sign) fallbackProp(g, "od_sale_sign", cx, cy);
  else if (st.piece || st.deco) fallbackProp(g, st.furniture || "piece", cx, cy, p.tile[2], p.tile[3]);
  g.restore();
}
function onScreen(bb, vr) { return !bb || (bb[0] < vr[0] + vr[2] + 100 && bb[0] + bb[2] > vr[0] - 100 && bb[1] < vr[1] + vr[3] + 100 && bb[1] + bb[3] > vr[1] - 100); }
function runItems(list, pd, hp, vr, fade = 1) {
  if (fade <= 0.01) return;
  list.sort((a, b) => a.d - b.d);
  for (const it of list) {
    if (!onScreen(it.bb, vr)) continue;
    const hide = it.bb && it.d > pd && it.bb[3] > 90 && hp[0] > it.bb[0] + it.bb[2] * 0.12 && hp[0] < it.bb[0] + it.bb[2] * 0.88 && hp[1] > it.bb[1] && hp[1] < it.bb[1] + it.bb[3] * 0.85;
    const a = (hide ? 0.42 : 1) * fade;
    if (a < 1) { g.globalAlpha = a; it.f(g); g.globalAlpha = 1; } else it.f(g);
  }
}
/* ---------- two scenes: outdoor and indoor ----------
   Outdoors: ground, props, people, cars and the house as a closed building (walls, door, roof); the furniture is not drawn.
   Indoors: a calm backdrop, the interior layer (floors, back walls), the furniture and the low front wall; the street is not drawn,
   and the camera leans in. Passing the door crossfades the two (the outgoing scene is drawn to a buffer and faded).
   Unity: two layers (Exterior, Interior) on one camera; entering the house swaps the culling mask and eases the zoom. */
let ia = 0, buf = null, tagsIn = null;
export const indoors = () => ia >= 0.5;
const isIn = p => W.rooms().some(r => { const [x, y, w, d] = r.rect; return p.x > x + 0.02 && p.x < x + w - 0.02 && p.y > y + 0.02 && p.y < y + d - 0.02; });
const outdoorSt = st => !!st.sign;
function backdrop() {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(960, 520, 200, 960, 540, 1150); gr.addColorStop(0, "#3a4590"); gr.addColorStop(1, "#161c48");
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); g.restore();
}
function drawOutdoor(now, vr, p, pin, oitems) {
  apply(g); drawClouds(g, now, false); drawGround(g, vr); if (!pin) drawTarget(now);
  const pd = p.x + p.y + 0.35, hp = P(p.x, p.y), head = [hp[0], hp[1] - 70], [hx0, hy0, hx1, hy1] = houseRect();
  const behind = [], front = [];
  const place = it => { const a = it.at; (a && a[0] <= hx1 - 0.02 && a[1] <= hy1 - 0.02 ? behind : front).push(it); };
  for (const st of W.stations()) if (outdoorSt(st)) { const t = W.tileOf(st), pl_ = geo[st.id] || placeAt(st, t); place({ at: [t[0] + t[2] / 2, t[1] + t[3] / 2], d: depthOf(st), bb: pl_.box, f: () => drawStation(st, pl_, null, now) }); }
  if (!pin) place({ at: [p.x, p.y], d: pd, f: drawPlayer });
  for (const it of propItems()) place(it);
  for (const it of oitems) place(it);
  runItems(behind, pd, head, vr);
  for (const part of exteriorParts()) part.f(g);
  if (hoverId === "door" && !indoors()) { const dr = D.room.front.door, X = V().Nx, q = [P(X, dr[0], 0), P(X, dr[1], 0), P(X, dr[1], 2.0), P(X, dr[0], 2.0)]; polyOn(g, q, null, "rgba(255,255,255,.95)", 6); }
  runItems(front, pd, head, vr);
  drawPuffs(g, now); lampGlow(vr); drawClouds(g, now, true);
}
function drawIndoor(now, vr, p, pin) {
  backdrop(); apply(g); drawInterior(g); if (pin) drawTarget(now);
  const pd = p.x + p.y + 0.35, hp = P(p.x, p.y), head = [hp[0], hp[1] - 70], items = [];
  for (const st of W.stations()) {
    if (outdoorSt(st) || (hooks.ghost && hooks.ghost.st === st)) continue;
    const t = W.tileOf(st), pl_ = geo[st.id] || placeAt(st, t);
    items.push({ d: depthOf(st), bb: pl_.box, f: () => drawStation(st, pl_, null, now) });
  }
  if (hooks.ghost) { const gh = hooks.ghost, t = gh.tile, pg = placeAt(gh.st, t, gh.flip); items.push({ d: t[0] + t[2] + t[1] + t[3], f: () => drawStation(gh.st, pg, gh, now) }); }
  if (pin) items.push({ d: pd, f: drawPlayer });
  runItems(items, pd, head, vr); drawOutside(g, now); drawFront(g); drawPuffs(g, now);
}
function drawTarget(now) {
  const t = walkTarget(); if (!t) return;
  const [x, y] = P(t[0], t[1]), k = 1 + 0.12 * Math.sin(now / 160);
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 22 * k, 12 * k, 0, 0, Math.PI * 2); g.stroke();
}
function lampGlow(vr) {
  const m = tod(); if (m >= 1050 && m < 1440 || m < 375) {
    const a = m >= 1050 ? Math.min(1, (m - 1050) / 60) : 1;
    g.save(); g.globalCompositeOperation = "lighter";
    for (const p of W.props()) {
      if (!p.id.includes("lamp")) continue; const [x, y] = P(p.cx, p.cy, p.id === "od_lamp_post" ? 2.6 : 2.2);
      if (x < vr[0] - 200 || x > vr[0] + vr[2] + 200 || y < vr[1] - 200 || y > vr[1] + vr[3] + 400) continue;
      const gr = g.createRadialGradient(x, y, 6, x, y + 40, 170); gr.addColorStop(0, `rgba(255,214,120,${0.55 * a})`); gr.addColorStop(1, "rgba(255,214,120,0)");
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 60, 170, 130, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}
function draw(now) {
  const vr = viewRect(), p = PS(), pin = isIn(p), oitems = outsideItems(now, { player: p });   // outside sims step every frame
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1920, 1080);
  if (ia <= 0.001) drawOutdoor(now, vr, p, pin, oitems);
  else if (ia >= 0.999) drawIndoor(now, vr, p, pin);
  else {                                                   // crossfade: indoor underneath, outdoor faded on top from a buffer
    drawIndoor(now, vr, p, pin);
    if (!buf) { buf = document.createElement("canvas"); buf.width = 1920; buf.height = 1080; }
    const main = g; g = buf.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1920, 1080);
    drawOutdoor(now, vr, p, pin, oitems); g = main;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1 - ia; g.drawImage(buf, 0, 0); g.restore();
  }
  const na = nightAlpha(); if (na > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(18,24,78,${na})`; g.fillRect(0, 0, 1920, 1080); g.restore(); }
}
/* Evening darkens the world gradually; lamps and headlights stay bright on top. */
function nightAlpha() { const m = tod(); return m < 360 ? 0.42 : m < 390 ? 0.14 * (1 - (m - 360) / 30) : m < 1020 ? 0 : m < 1110 ? (m - 1020) / 90 * 0.22 : m < 1260 ? 0.22 + (m - 1110) / 150 * 0.2 : 0.42; }

/* ---------- input, tags ---------- */
function applyCam() { const m = matrix(); if (m === camStr) return; camStr = m; if (tags) tags.style.transform = m; }
function buildHits() {
  W.refresh(); tags.innerHTML = ""; badgeCache = {};
  const before = new Set(Object.keys(geo)); geo = {};
  for (const st of W.stations()) geo[st.id] = placeAt(st, W.tileOf(st));
  drawShell();
  const alive = new Set(W.stations().map(st => "st:" + st.id));
  if (built) { for (const st of W.stations()) if (!before.has(st.id)) { const t = W.tileOf(st); puff(t[0] + t[2] / 2, t[1] + t[3] / 2, "255,236,190"); } forget("st:", alive); }
  else for (const k of alive) appear(k, -1e9);
  built = true;
  for (const st of W.stations()) {
    if (st.deco) continue;
    const p = geo[st.id], lk = W.locked(st);
    tags.append(h("div", { class: "stag" + (lk ? " lock" : "") + (outdoorSt(st) || st.id === "door" ? " out" : ""), style: { left: p.tag[0] + "px", top: p.tag[1] + "px" }, "data-id": st.id }, h("span", { class: "tl" }, lk ? "🔒 " + st.label : st.label), h("kbd", {}, "E")));
  }
  applyCam(); syncTags();
}
function syncTags() {
  for (const t of tags.children) { const id = t.dataset.id; t.classList.toggle("hl", id === hoverId); t.classList.toggle("near", id === nearId); }
}
function svgPoint(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : pt; }
const worldAt = e => { const q = svgPoint(e); return toWorld(q.x, q.y); };
function updateBadges() {
  const counts = { door: S.doorSamples.length + S.doorBoxes.length + (courierHere() ? S.orders.filter(o => o.status === "packed").length || 1 : 0), packing: S.orders.filter(o => o.status === "toPack").length, shelves: Object.values(S.boxes).reduce((a, b) => a + b, 0) };
  for (const id of Object.keys(counts)) {
    const tag = tags.querySelector(`[data-id="${id}"]`); if (!tag) continue;
    if (badgeCache[id] === counts[id]) continue; badgeCache[id] = counts[id];
    const old = tag.querySelector(".badge"); if (old) old.remove();
    tag.classList.toggle("hasb", counts[id] > 0);
    if (counts[id] > 0) tag.append(h("span", { class: "badge" }, String(counts[id])));
  }
}
export function nudge(id, on_ = true) { const t = tags && tags.querySelector(`[data-id="${id}"]`); if (t) t.classList.toggle("nudge", on_); }
export const svgEl = () => svg;
export const pointerTile = e => { const [wx, wy] = worldAt(e); return toTile(wx, wy); };

export function initRoom() {
  const root = document.getElementById("room");
  cv = h("canvas", { width: 1920, height: 1080 }); g = cv.getContext("2d");
  initShell(); setBounds(W.worldBox());
  svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 1920 1080");
  const back = document.createElementNS(NS, "rect"); back.setAttribute("x", 0); back.setAttribute("y", 0); back.setAttribute("width", 1920); back.setAttribute("height", 1080); back.setAttribute("class", "floorhit"); svg.append(back);
  tags = h("div", { class: "tags outdoors" }); tagsIn = false;
  shade = h("div", { class: "daynight" });
  root.append(cv, shade, svg, tags);
  initCameraInput(root); initJoystick(root);
  buildHits();
  loadSprites().then(() => buildHits()).catch(e => console.warn("sprites", e));
  svg.addEventListener("click", e => { if (justPinched()) { e.stopPropagation(); e.preventDefault(); } }, true);
  svg.addEventListener("click", e => {
    const [wx, wy] = worldAt(e), st = hitStation(wx, wy);
    if (hooks.editing()) { if (!hooks.ghost && st && hooks.pick) { hooks.pick(st); e.stopImmediatePropagation(); } return; }
    if (!indoors() && houseHit(wx, wy)) { const dr = D.room.front.door; walkTo(V().Nx - 0.7, (dr[0] + dr[1]) / 2); return; }   // the building: walk in
    if (st) walkToStation(st); else { const [x, y] = toTile(wx, wy); walkTo(x, y); }
  });
  svg.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    const [wx, wy] = worldAt(e), st = hitStation(wx, wy), id = st ? st.id : null;
    if (id !== hoverId) { hoverId = id; svg.style.cursor = st ? (W.locked(st) ? "not-allowed" : "pointer") : ""; syncTags(); }
  });
  svg.addEventListener("pointerleave", () => { if (hoverId) { hoverId = null; syncTags(); } });
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
    updateBadges();
  });
  on("stock:changed", updateBadges);
  updateBadges();
  let last = performance.now(), lastNear = 0;
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (S.started) stepPlayer(dt, modals === 0 && !hooks.editing());
    const p = PS(), [sx, sy] = P(p.x, p.y), tgt = S.started && (isIn(p) || hooks.editing()) ? 1 : 0;
    ia += (tgt - ia) * (1 - Math.exp(-dt * 7)); if (Math.abs(tgt - ia) < 0.002) ia = tgt;
    setInner(ia); follow(sx, sy, dt); applyCam();
    const io = indoors(); if (tags && io !== tagsIn) { tagsIn = io; tags.classList.toggle("outdoors", !io); }
    if (S.started && now - lastNear > 120) { lastNear = now; const ns = nearestStation(), id = ns ? ns.id : null; if (id !== nearId) { nearId = id; syncTags(); } }
    const t0 = performance.now(); draw(now); perf.ms = perf.ms * 0.9 + (performance.now() - t0) * 0.1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
export const redrawRoom = () => { if (g) buildHits(); };
