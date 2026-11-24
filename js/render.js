/* Background cache, depth sorting, world labels, interaction prompt, developer overlays. */
import { D, S, pl, rt } from "./state.js";
import { LW, LH, WALLH, FONT, NAVY, P, poly, box, bubble, bar, setCtx, getG, overlay } from "./iso.js";
import { world, tileCol, drawFurn, drawWallSeg } from "./world.js";
import { drawPlayer, drawRider, drawVan, drawJeep, drawYardBox } from "./entities.js";
import { context } from "./sim/shop.js";

let cv = null, main = null, bgCanvas = null;

export function initRender(canvas) {
  cv = canvas; main = cv.getContext("2d");
  const fit = () => {
    const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d));
  };
  new ResizeObserver(fit).observe(cv); fit();
  setCtx(main);
}

function buildBg() {
  const M = D.MAP, MW = world.MW, MH = world.MH;
  bgCanvas = document.createElement("canvas"); bgCanvas.width = LW; bgCanvas.height = LH;
  const g = bgCanvas.getContext("2d"); setCtx(g);
  g.fillStyle = "#2b3466"; g.fillRect(0, 0, LW, LH);
  // ground tiles
  for (let i = 0; i < MW; i++) for (let j = 0; j < MH; j++) poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], tileCol(i, j), 1, "rgba(27,42,102,.22)");
  // road markings
  const rx = M.roadLineX;
  for (let j = 0; j < MH; j += 1.5) poly([P(rx - .06, j + .2), P(rx + .06, j + .2), P(rx + .06, j + .9), P(rx - .06, j + .9)], "#ffe9a8", 0);
  poly([P(0, 0), P(MW, 0), P(MW, MH), P(0, MH)], null, 5);
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
  g.lineWidth = 5; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...P(0, 9, WALLH)); g.lineTo(...P(0, 0, WALLH)); g.lineTo(...P(11, 0, WALLH)); g.moveTo(...P(0, 0, 0)); g.lineTo(...P(0, 0, WALLH));
  g.moveTo(...P(0, 9, 0)); g.lineTo(...P(0, 9, WALLH)); g.moveTo(...P(11, 0, 0)); g.lineTo(...P(11, 0, WALLH)); g.moveTo(...P(0, 5, 0)); g.lineTo(...P(0, 5, WALLH)); g.moveTo(...P(6, 0, 0)); g.lineTo(...P(6, 0, WALLH)); g.stroke();
  // hedges at the back of the yard
  M.hedges.forEach(([x0, y0, x1, y1]) => box(x0, y0, x1, y1, 0, 36, "#5fbf55", "#4aa842", "#3b9135"));
  // house number sign by the door
  poly([P(11.1, 5.4, 70), P(11.1, 5.9, 70), P(11.1, 5.9, 100), P(11.1, 5.4, 100)], "#ffc928", 2);
  setCtx(main);
}

function debugOverlay(g) {
  g.save(); g.lineWidth = 2;
  const rect = (b, col, fill) => { const [x0, y0, x1, y1] = b; poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], fill, 2, col); };
  world.solids.forEach(b => rect(b, "#ef3b4f", "rgba(239,59,79,.25)"));
  world.furn.forEach(f => { if (f.zone) rect(f.zone, "#139180", "rgba(44,200,182,.25)"); });
  rect(world.shelfZone, "#139180", "rgba(44,200,182,.25)");
  const T = D.T.shop;
  rect([T.handoverMinX, 0, D.MAP.size[0], world.MH], "#cf5e00", "rgba(255,138,42,.18)");
  g.restore();
}

export function render() {
  if (!cv) return;
  const g = main; setCtx(g);
  const s = cv.width / LW; g.setTransform(s, 0, 0, s, 0, 0);
  if (!bgCanvas) buildBg();
  g.drawImage(bgCanvas, 0, 0);
  overlay.bubbles = []; overlay.bars = [];
  const list = [];
  world.furn.forEach(f => { const b = f.b; list.push({ k: (b[0] + b[2]) / 2 + (b[1] + b[3]) / 2, d: () => drawFurn(f) }); });
  world.walls.forEach(w => {
    const horiz = w[2] - w[0] > w[3] - w[1]; const a = horiz ? w[0] : w[1], b = horiz ? w[2] : w[3];
    for (let t = a; t < b - 1e-6; t += 1) { const e = Math.min(b, t + 1); const seg = horiz ? [t, w[1], e, w[3]] : [w[0], t, w[2], e]; list.push({ k: (seg[0] + seg[2]) / 2 + (seg[1] + seg[3]) / 2, d: () => drawWallSeg(...seg) }); }
  });
  const st = D.MAP.street;
  S.yard.forEach(b => list.push({ k: b.x + b.y, d: () => drawYardBox(b) }));
  S.riders.forEach(r => { if (r.y > st.riderHideY) list.push({ k: r.x + r.y, d: () => drawRider(r) }); });
  if (S.van) list.push({ k: S.van.x + S.van.y + .3, d: () => drawVan(S.van) });
  if (S.jeep.y > st.jeepVisibleY) list.push({ k: st.jeepX + S.jeep.y, d: () => drawJeep({ x: st.jeepX, y: S.jeep.y }) });
  list.push({ k: pl.x + pl.y, d: drawPlayer });
  list.sort((a, b) => a.k - b.k).forEach(o => o.d());
  if (rt.showZones) debugOverlay(g);
  // world labels
  if (S.post) { const p = P(2.8, .3, 175); bubble(p[0], p[1], `TikTik: ${Math.round(S.post.views).toLocaleString()} views`, "#efe1ff"); }
  if (S.orders.length || S.table.length) { const p = P(6.3, 7.1, 110); bubble(p[0], p[1], [S.orders.length ? `${S.orders.length} to pack` : "", S.table.length ? `${S.table.length} ready` : ""].filter(Boolean).join(" · ")); }
  if (S.algoUnread && !S.ui) { const p = P(.6, 2.65, 170); bubble(p[0], p[1], "!", "#ffe06b"); }
  if (!S.algoMet && !S.ui) { const p = P(.6, 2.65, 170); bubble(p[0], p[1], "Hi!", "#c8fff6"); }
  overlay.bubbles.forEach(([x, y, z, t, c]) => { const p = P(x, y, z); bubble(p[0], p[1], t, c, NAVY, 18); });
  overlay.bars.forEach(([x, y, z, v, c]) => { const p = P(x, y, z); bar(p[0], p[1], 64, v, c); });
  if (S.deliveries.length) { const d = S.deliveries[0]; const p = P(14, .6, 40); bubble(p[0], p[1], `Van in ${Math.ceil(d.t)}s`, "#c8fff6", NAVY, 18); }
  // room labels
  g.font = `600 18px ${FONT}`; g.fillStyle = "rgba(27,42,102,.45)"; g.textAlign = "center";
  D.MAP.labels.forEach(([t, x, y]) => { const p = P(x, y); g.fillText(t, p[0], p[1]); });
  // prompt
  if (!S.ui && S.active) { const c = context(); if (c) { const [sx, sy] = P(pl.x, pl.y); bubble(sx, sy - 158 - (S.carry.length * 30), c.fn ? `E  ${c.label}` : c.label, c.fn ? "#ffe06b" : "#fff"); } }
  if (rt.showFps) { g.font = `700 22px ${FONT}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = "#fff"; g.strokeStyle = NAVY; g.lineWidth = 4; const t = `${Math.round(rt.fps)} FPS`; g.strokeText(t, 20, 150); g.fillText(t, 20, 150); g.textBaseline = "middle"; }
}
