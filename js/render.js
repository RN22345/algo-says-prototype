/* Background cache, camera transform, depth sorting, world labels, interaction prompt, developer overlays. */
import { D, S, pl, rt } from "./state.js";
import { LW, LH, WALLH, TW, FONT, NAVY, P, poly, box, bubble, bar, setCtx, overlay } from "./iso.js";
import { world, tileCol, drawFurn, drawWallSeg, drawScenery } from "./world.js";
import { drawPlayer, drawRider, drawVan, drawJeep, drawYardBox } from "./entities.js";
import { npcs, drawNpc } from "./npcs.js";
import { cam, getBounds, viewRect, labelScale } from "./camera.js";
import { context } from "./interact.js";

const VOID = "#2b3466";
let cv = null, main = null, bgCanvas = null, statics = null;

export function initRender(canvas) {
  cv = canvas; main = cv.getContext("2d");
  // The frame is scaled with a CSS transform, so the box on screen (getBoundingClientRect) is the logical size times the scale.
  // Backing size = screen size x device pixel ratio (at most 2), capped at 3840 wide, always 16:9.
  const fit = () => {
    const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(16, Math.min(3840, Math.round(r.width * d)));
    cv.width = w; cv.height = Math.round(w * LH / LW);
  };
  new ResizeObserver(fit).observe(cv); window.addEventListener("algo:scale", fit); fit();
  setCtx(main);
}

const arc = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return P(cx - r * Math.cos(a), cy + r * Math.sin(a)); });
const line = (g, pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };

/* The whole map as one image at 1x. Only the part in view is blitted each frame. */
function buildBg() {
  const M = D.MAP, MW = world.MW, MH = world.MH, B = getBounds();
  bgCanvas = document.createElement("canvas"); bgCanvas.width = Math.ceil(B.x1 - B.x0); bgCanvas.height = Math.ceil(B.y1 - B.y0);
  const g = bgCanvas.getContext("2d"); setCtx(g);
  g.translate(-B.x0, -B.y0);
  g.fillStyle = VOID; g.fillRect(B.x0, B.y0, bgCanvas.width, bgCanvas.height);
  // ground tiles
  for (let i = 0; i < MW; i++) for (let j = 0; j < MH; j++) poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], tileCol(i, j), 1, "rgba(27,42,102,.22)");
  // road markings and crossings
  const rx = M.roadLineX;
  for (let j = 0; j < MH; j += 1.5) poly([P(rx - .06, j + .2), P(rx + .06, j + .2), P(rx + .06, j + .9), P(rx - .06, j + .9)], "#ffe9a8", 0);
  (M.crossings || []).forEach(([x0, x1, y0, y1]) => { for (let x = x0 + .1; x < x1 - .1; x += .5) poly([P(x, y0), P(x + .27, y0), P(x + .27, y1), P(x, y1)], "#f4f6ff", 0); });
  poly([P(0, 0), P(MW, 0), P(MW, MH), P(0, MH)], null, 5);
  // lot lines for the empty land
  if (M.lot) {
    const [x0, y0, x1, y1] = M.lot.rect;
    g.save(); g.setLineDash([16, 12]); g.lineWidth = 4; g.strokeStyle = "#fffdf0"; g.lineCap = "round";
    line(g, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), P(x0, y0)]); g.restore();
  }
  // basketball half-court lines
  if (M.court) {
    const [x0, x1, y0, y1] = M.court.rect, [hx, hy] = M.court.hoop, bx = x1 - .2;
    g.save(); g.lineWidth = 3; g.strokeStyle = "#fff8e8"; g.lineJoin = "round";
    line(g, [P(x0 + .2, y0 + .2), P(bx, y0 + .2), P(bx, y1 - .2), P(x0 + .2, y1 - .2), P(x0 + .2, y0 + .2)]);
    line(g, [P(bx, hy - 1.5), P(bx - 3.6, hy - 1.5), P(bx - 3.6, hy + 1.5), P(bx, hy + 1.5)]);        // the key
    line(g, arc(bx - 3.6, hy, 1.5, -Math.PI / 2, Math.PI / 2).map(p => p));                              // free-throw circle
    const a = 1.3, r = 4.5, cxm = hx - .45; line(g, [P(bx, hy - r * Math.sin(a)), P(cxm - r * Math.cos(a), hy - r * Math.sin(a))]);
    line(g, arc(cxm, hy, r, -a, a, 32)); line(g, [P(cxm - r * Math.cos(a), hy + r * Math.sin(a)), P(bx, hy + r * Math.sin(a))]);
    line(g, [P(x0 + .2, hy - 1.2), P(x0 + .2, hy + 1.2)]);
    g.restore();
  }
  // rugs
  M.rugs.forEach(r => { const [x0, y0, x1, y1] = r.b; poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], r.col, r.lw); });
  // back walls of house
  M.backWalls.forEach(w => {
    const { a, b, axis } = w;
    const pts = axis === "x" ? [P(0, a, 0), P(0, b, 0), P(0, b, WALLH), P(0, a, WALLH)] : [P(a, 0, 0), P(b, 0, 0), P(b, 0, WALLH), P(a, 0, WALLH)]; poly(pts, w.col, 0);
    const bp = axis === "x" ? [P(0, a, 0), P(0, b, 0), P(0, b, 40), P(0, a, 40)] : [P(a, 0, 0), P(b, 0, 0), P(b, 0, 40), P(a, 0, 40)]; poly(bp, w.base, 0);
  });
  // windows
  M.windows.forEach(({ a, b, axis, z0, z1 }) => {
    const Q = (t, z) => axis === "y" ? P(t, 0, z) : P(0, t, z);
    poly([Q(a, z0), Q(b, z0), Q(b, z1), Q(a, z1)], "#cfeeff", 4);
    g.lineWidth = 3; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...Q((a + b) / 2, z0)); g.lineTo(...Q((a + b) / 2, z1)); g.moveTo(...Q(a, (z0 + z1) / 2)); g.lineTo(...Q(b, (z0 + z1) / 2)); g.stroke();
  });
  // cork board in studio
  poly([P(0, 0.6, 85), P(0, 1.6, 85), P(0, 1.6, 150), P(0, 0.6, 150)], "#d9a066", 3);
  [["#ffe06b", .7], ["#b06cf5", 1.05], ["#5fe3d3", 1.3]].forEach(([c, y]) => poly([P(0, y, 100), P(0, y + .25, 100), P(0, y + .25, 135), P(0, y, 135)], c, 2));
  // bunting in studio
  const bc = ["#ef3b4f", "#ffc928", "#2cc8b6", "#9446e0", "#ff8a2a"];
  for (let i = 0; i < 12; i++) { const x = i / 2 + .05; poly([P(x, 0, WALLH - 4), P(x + .4, 0, WALLH - 4), P(x + .2, 0, WALLH - 34)], bc[i % 5], 2); }
  for (let i = 0; i < 10; i++) { const y = i / 2 + .05; poly([P(0, y, WALLH - 4), P(0, y + .4, WALLH - 4), P(0, y + .2, WALLH - 34)], bc[(i + 2) % 5], 2); }
  // wall top edges
  g.lineWidth = 5; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...P(0, 15, WALLH)); g.lineTo(...P(0, 0, WALLH)); g.lineTo(...P(11, 0, WALLH)); g.moveTo(...P(0, 0, 0)); g.lineTo(...P(0, 0, WALLH));
  g.moveTo(...P(0, 9, 0)); g.lineTo(...P(0, 9, WALLH)); g.moveTo(...P(0, 15, 0)); g.lineTo(...P(0, 15, WALLH)); g.moveTo(...P(11, 0, 0)); g.lineTo(...P(11, 0, WALLH)); g.moveTo(...P(0, 5, 0)); g.lineTo(...P(0, 5, WALLH)); g.moveTo(...P(6, 0, 0)); g.lineTo(...P(6, 0, WALLH)); g.stroke();
  // hedges at the back of the yard and along the lot
  M.hedges.forEach(([x0, y0, x1, y1]) => box(x0, y0, x1, y1, 0, 36, "#5fbf55", "#4aa842", "#3b9135"));
  // house number sign by the door
  poly([P(11.1, 5.4, 70), P(11.1, 5.9, 70), P(11.1, 5.9, 100), P(11.1, 5.4, 100)], "#ffc928", 2);
  setCtx(main);
}

/* Things that never move, sorted once by depth. `r` is a generous screen radius for culling. */
function buildStatics() {
  const list = [], add = (k, x, y, r, d) => { const [ax, ay] = P(x, y); list.push({ k, ax, ay, r, d }); };
  world.furn.forEach(f => { const b = f.b; add((b[0] + b[2]) / 2 + (b[1] + b[3]) / 2, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 320 + (b[2] - b[0] + b[3] - b[1]) * TW / 2, () => drawFurn(f)); });
  world.scenery.forEach(s => { const b = s.b; add((b[0] + b[2]) / 2 + (b[1] + b[3]) / 2, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 320 + (b[2] - b[0] + b[3] - b[1]) * TW / 2, () => drawScenery(s)); });
  world.walls.forEach(w => {
    const horiz = w[2] - w[0] > w[3] - w[1]; const a = horiz ? w[0] : w[1], b = horiz ? w[2] : w[3];
    for (let t = a; t < b - 1e-6; t += 1) { const e = Math.min(b, t + 1); const seg = horiz ? [t, w[1], e, w[3]] : [w[0], t, w[2], e]; add((seg[0] + seg[2]) / 2 + (seg[1] + seg[3]) / 2, (seg[0] + seg[2]) / 2, (seg[1] + seg[3]) / 2, 140, () => drawWallSeg(...seg)); }
  });
  statics = list.sort((a, b) => a.k - b.k);
}

function debugOverlay(g) {
  g.save(); g.lineWidth = 2;
  const rect = (b, col, fill) => { const [x0, y0, x1, y1] = b; poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], fill, 2, col); };
  world.solids.forEach(b => rect(b, "#ef3b4f", "rgba(239,59,79,.25)"));
  world.furn.forEach(f => { if (f.zone) rect(f.zone, "#139180", "rgba(44,200,182,.25)"); });
  (world.places || []).forEach(o => rect(o.zone, "#139180", "rgba(44,200,182,.25)"));
  rect(world.shelfZone, "#139180", "rgba(44,200,182,.25)");
  const T = D.T.shop;
  rect([T.handoverMinX, 0, T.handoverMaxX, world.MH], "#cf5e00", "rgba(255,138,42,.18)");
  g.restore();
}

/* A label drawn at a world position, scaled up a little when zoomed out. */
function bub(V, x, y, text, col, tc = NAVY, size = 21) {
  if (x < V.x0 - 200 || x > V.x1 + 200 || y < V.y0 - 200 || y > V.y1 + 200) return;
  const g = main, k = labelScale();
  g.save(); g.translate(x, y); g.scale(k, k); bubble(0, 0, text, col, tc, size); g.restore();
}

export function render() {
  if (!cv) return;
  const g = main; setCtx(g);
  const s = cv.width / LW, z = cam.zoom;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = VOID; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(s * z, 0, 0, s * z, s * (LW / 2 - cam.x * z), s * (LH / 2 - cam.y * z));
  if (!bgCanvas) buildBg();
  if (!statics) buildStatics();
  const V = viewRect(), B = getBounds();
  // background: blit only the visible part
  const sx0 = Math.floor(Math.max(V.x0, B.x0)), sy0 = Math.floor(Math.max(V.y0, B.y0)), sx1 = Math.ceil(Math.min(V.x1, B.x1)), sy1 = Math.ceil(Math.min(V.y1, B.y1));
  if (sx1 > sx0 && sy1 > sy0) g.drawImage(bgCanvas, sx0 - B.x0, sy0 - B.y0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
  overlay.bubbles = []; overlay.bars = [];
  const seen = (ax, ay, r) => ax + r > V.x0 && ax - r < V.x1 && ay + r > V.y0 && ay - r < V.y1;
  const list = statics.filter(o => seen(o.ax, o.ay, o.r));
  const add = (k, x, y, d) => { const [ax, ay] = P(x, y); if (seen(ax, ay, 340)) list.push({ k, d }); };
  const st = D.MAP.street, MH = world.MH;
  S.yard.forEach(b => add(b.x + b.y, b.x, b.y, () => drawYardBox(b)));
  S.riders.forEach(r => { if (r.y > st.riderHideY && r.y < MH + .6) add(r.x + r.y, r.x, r.y, () => drawRider(r)); });
  if (S.van && S.van.y > st.vanHideY && S.van.y < MH + 1.3) add(S.van.x + S.van.y + .3, S.van.x, S.van.y, () => drawVan(S.van));
  if (S.jeep.y > st.jeepVisibleY && S.jeep.y < MH + 1.6) add(st.jeepX + S.jeep.y, st.jeepX, S.jeep.y, () => drawJeep({ x: st.jeepX, y: S.jeep.y }));
  npcs.forEach(n => add(n.x + n.y, n.x, n.y, () => drawNpc(n)));
  list.push({ k: pl.x + pl.y, d: drawPlayer });
  list.sort((a, b) => a.k - b.k).forEach(o => o.d());
  if (rt.showZones) debugOverlay(g);
  // world labels
  if (S.running.length) { const p = P(2.8, .3, 175); bub(V, p[0], p[1], S.running.map(r => `${r.site === "youview" ? "YouView" : "TikTik"}: ${Math.round(r.views).toLocaleString()}`).join(" · ") + " views", "#efe1ff"); }
  if (S.orders.length || S.table.length) { const p = P(8.5, 7.0, 110); bub(V, p[0], p[1], [S.orders.length ? `${S.orders.length} to pack` : "", S.table.length ? `${S.table.length} ready` : ""].filter(Boolean).join(" · "), "#fff"); }
  if (S.algoUnread && !S.ui) { const p = P(.6, 2.65, 170); bub(V, p[0], p[1], "!", "#ffe06b"); }
  if (!S.algoMet && !S.ui) { const p = P(.6, 2.65, 170); bub(V, p[0], p[1], "Hi!", "#c8fff6"); }
  overlay.bubbles.forEach(([x, y, zz, t, c]) => { const p = P(x, y, zz); bub(V, p[0], p[1], t, c, NAVY, 18); });
  overlay.bars.forEach(([x, y, zz, v, c]) => {
    const p = P(x, y, zz); if (p[0] < V.x0 - 100 || p[0] > V.x1 + 100 || p[1] < V.y0 - 100 || p[1] > V.y1 + 100) return;
    const k = labelScale(); g.save(); g.translate(p[0], p[1]); g.scale(k, k); bar(0, 0, 64, v, c); g.restore();
  });
  if (S.deliveries.length) { const d = S.deliveries[0]; const p = P(14, .6, 40); bub(V, p[0], p[1], `Van in ${Math.ceil(d.t)}s`, "#c8fff6", NAVY, 18); }
  // room labels
  const lk = labelScale();
  g.font = `600 ${18 * lk}px ${FONT}`; g.fillStyle = "rgba(27,42,102,.45)"; g.textAlign = "center";
  D.MAP.labels.forEach(([t, x, y]) => { const p = P(x, y); if (p[0] > V.x0 - 200 && p[0] < V.x1 + 200 && p[1] > V.y0 - 100 && p[1] < V.y1 + 100) g.fillText(t, p[0], p[1]); });
  // prompt
  if (!S.ui && S.active) { const c = context(); if (c) { const [px, py] = P(pl.x, pl.y); bub(V, px, py - 158 - S.carry.length * 30, c.fn ? `E  ${c.label}` : c.label, c.fn ? "#ffe06b" : "#fff"); } }
  // screen-space overlays
  g.setTransform(s, 0, 0, s, 0, 0);
  if (rt.showFps) { g.font = `700 22px ${FONT}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = "#fff"; g.strokeStyle = NAVY; g.lineWidth = 4; const t = `${Math.round(rt.fps)} FPS`; g.strokeText(t, 20, 150); g.fillText(t, 20, 150); g.textBaseline = "middle"; }
  zoomHint(g);
}

function zoomHint(g) {
  const t = `Z close · X wide: ${cam.target}`;
  g.font = `700 20px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
  const w = g.measureText(t).width + 28, x = LW - 30 - w, y = 925;
  g.beginPath(); g.roundRect(x, y, w, 36, 18); g.fillStyle = "rgba(255,255,255,.88)"; g.fill(); g.lineWidth = 3; g.strokeStyle = NAVY; g.stroke();
  g.fillStyle = NAVY; g.fillText(t, x + 14, y + 19);
}
