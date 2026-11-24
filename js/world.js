/* Map, walls, furniture, solids, collision, zones. Layout comes from data/map.json. */
import { D, S, rt } from "./state.js";
import { P, poly, box, circ, getG, overlay, shade, faceText, CUT, NAVY, FONT } from "./iso.js";
import { sprite } from "./sprites.js";

export const world = {};

export function initWorld(M) {
  world.MW = M.size[0]; world.MH = M.size[1];
  world.tiles = M.tiles;
  world.walls = M.walls;
  world.furn = M.furniture;
  world.shelfProducts = M.shelfProducts;
  world.shelfZone = M.shelfZone;
  world.scenery = M.scenery || [];
  const store = world.scenery.find(o => o.kind === "store");
  world.sarisariZone = store ? store.zone : null;
  world.solids = [...M.walls, ...M.furniture.map(f => f.b), ...world.scenery.filter(o => o.solid !== false).map(o => o.b)];
}

export function tileCol(i, j) {
  for (const r of world.tiles) {
    const [i0, i1, j0, j1] = r.rect;
    if (i < i0 || i >= i1 || j < j0 || j >= j1) continue;
    if (r.mode === "solid") return r.colors[0];
    if (r.mode === "checker") return (i + j) % 2 ? r.colors[0] : r.colors[1];
    return (i * 7 + j * 3) % 5 ? r.colors[0] : r.colors[1];
  }
  return "#000";
}

export const inR = (z, x, y) => x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3];

export function blocked(x, y) {
  const r = D.T.shop.playerRadius;
  if (x < r || y < r || x > world.MW - r || y > world.MH - r) return true;
  return world.solids.some(b => x > b[0] - r && x < b[2] + r && y > b[1] - r && y < b[3] + r);
}

export function drawFurn(f) {
  const g = getG(), PR = D.PR;
  const [x0, y0, x1, y1] = f.b;
  switch (f.id) {
    case "desk":
      if (sprite("desk", f.b)) poly([P(2.2, .45, 88), P(3.4, .45, 88), P(3.4, .45, 140), P(2.2, .45, 140)], S.post ? "#d4b2ff" : "#c3cbe8", 2);
      else {
      box(x0, y0, x1, y1, 0, 70, "#e8b77d", "#c48a4b", "#a8723a");
      box(2.1, .2, 3.5, .45, 70, 76, "#3a4a8c", "#3a4a8c", NAVY);
      poly([P(2.2, .45, 80), P(3.4, .45, 80), P(3.4, .45, 140), P(2.2, .45, 140)], S.post ? "#d4b2ff" : "#c3cbe8", 2);
      box(2.3, .65, 3.3, .9, 70, 5, "#eef1ff", "#c9cde6", "#aab0d6", 2);
      box(3.6, .3, 3.95, .7, 70, 40, "#2cc8b6", "#139180", "#0f7266", 2); }
      if (S.post) { const p = P(2.8, .45, 114); g.fillStyle = "#6224a8"; g.font = `700 20px ${FONT}`; g.textAlign = "center"; g.fillText("tt", p[0], p[1] + 6); }
      break;
    case "light": {
      if (sprite("light", f.b)) break;
      const b = P(4.65, .55, 0), t = P(4.65, .55, 150); g.lineWidth = 5; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...b); g.lineTo(...t); g.stroke();
      g.beginPath(); g.ellipse(t[0], t[1], 22, 26, 0, 0, 7); g.lineWidth = 7; g.strokeStyle = "#fff6c8"; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = NAVY; g.beginPath(); g.ellipse(t[0], t[1], 26, 30, 0, 0, 7); g.stroke(); break;
    }
    case "algo": {
      const algoSpr = sprite("algo", f.b);
      if (!algoSpr) box(x0, y0, x1, y1, 0, 112, "#2cc8b6", "#1fae9d", "#139180");
      const fy0 = y0 + .18, fy1 = y1 - .18; poly([P(x1, fy0, 48), P(x1, fy1, 48), P(x1, fy1, 100), P(x1, fy0, 100)], "#1b2a66", 3);
      const blink = (rt.perf % 4) < .15; const e1 = P(x1, fy0 + .3, 80), e2 = P(x1, fy1 - .3, 80), m = P(x1, (fy0 + fy1) / 2, 62);
      g.fillStyle = "#7af7e6"; if (blink) { g.fillRect(e1[0] - 6, e1[1] - 2, 12, 4); g.fillRect(e2[0] - 6, e2[1] - 2, 12, 4); } else { circ(e1[0], e1[1], 6, "#7af7e6", 0); circ(e2[0], e2[1], 6, "#7af7e6", 0); }
      g.lineWidth = 4; g.strokeStyle = "#7af7e6"; g.beginPath(); g.moveTo(m[0] - 12, m[1] - 6); g.quadraticCurveTo(m[0], m[1] + 4, m[0] + 12, m[1] + 6); g.stroke();
      [["#ef3b4f", .3], ["#ffc928", .55], ["#9446e0", .8]].forEach(([c, t]) => { const q = P(x1, y0 + t * (y1 - y0), 26); circ(q[0], q[1], 5, c, 2); });
      const a = P((x0 + x1) / 2, (y0 + y1) / 2, 112), a2 = P((x0 + x1) / 2, (y0 + y1) / 2, 150); if (!algoSpr) { g.lineWidth = 4; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...a); g.lineTo(...a2); g.stroke(); } circ(a2[0], a2[1], 9, S.algoUnread && (rt.perf % 1 < .5) ? "#ffc928" : "#ef3b4f");
      break;
    }
    case "plant1": if (sprite("plant", f.b)) break; box(x0, y0, x1, y1, 0, 30, "#ff8a2a", "#e06d12", "#c25a08", 2); { const p = P((x0 + x1) / 2, (y0 + y1) / 2, 30);[[0, -30, 22], [-17, -15, 17], [17, -17, 17], [0, -52, 15]].forEach(([dx, dy, r]) => circ(p[0] + dx, p[1] + dy, r, "#3fbf6a")); } break;
    case "crates": if (sprite("crates", f.b)) break; box(x0, y0, x1, y1, 0, 44, "#d9a066", "#c08445", "#a26c33"); box(9.6, 3.5, 10.3, 4.2, 44, 36, "#e2ae74", "#c08445", "#a26c33", 2); break;
    case "table":
      if (!sprite("table", f.b)) box(x0, y0, x1, y1, 0, 62, "#f3d7a8", "#d6ad6c", "#bb9152");
      S.orders.slice(0, 4).forEach((o, i) => { const bx = 5.2 + i * .5; box(bx, 6.7, bx + .38, 7.1, 62, 22, "#fff8e8", PR[o.p].col, "#d9c9a6", 2); });
      S.table.slice(0, 6).forEach((o, i) => { const bx = 6.9 + (i % 2) * .32, bz = 62 + Math.floor(i / 2) * 22; box(bx, 6.9, bx + .3, 7.4, bz, 22, "#e2ae74", "#c08445", "#a26c33", 2); });
      break;
    case "sofa": if (sprite("sofa", f.b)) break; box(x0, y0, x1, y1, 0, 34, "#5b8def", "#4673c9", "#3a62ad"); box(x0, y0, x0 + .3, y1, 34, 40, "#6c9bf5", "#4673c9", "#3a62ad"); break;
    case "lamp": { if (sprite("lamp", f.b)) break; const b = P(13.37, 5.42), t = P(13.37, 5.42, 160); g.lineWidth = 6; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...b); g.lineTo(...t); g.stroke(); circ(t[0], t[1], 12, "#ffe06b"); break; }
    default:
      if (f.id.startsWith("tree")) drawTree(f.b);
      else if (f.id.startsWith("shelf")) {
        const k = +f.id[5], p = world.shelfProducts[k], n = Math.min(6, S.stock[p]);
        const shelfSpr = sprite("shelf", f.b);
        if (!shelfSpr) box(x0, y0, x1, y1, 0, 150, "#d9a066", "#b97a3d", "#9a6230");
        [10, 58, 106].forEach((z, r) => {
          if (!shelfSpr) { g.lineWidth = 3; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...P(x0, y1, z)); g.lineTo(...P(x1, y1, z)); g.stroke(); }
          for (let c = 0; c < 2; c++) { const idx = r * 2 + c; if (idx >= n) continue; const xa = x0 + .12 + c * .42; poly([P(xa, y1, z + 3), P(xa + .34, y1, z + 3), P(xa + .34, y1, z + 38), P(xa, y1, z + 38)], PR[p].col, 2); }
        });
        if (!shelfSpr) poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, 150), P(x0, y1, 150)], null, 3);
        if (S.stock[p] === 0) { g.globalAlpha = .85; overlay.bubbles.push([(x0 + x1) / 2, (y0 + y1) / 2, k % 2 ? 205 : 165, `${PR[p].n}: 0`, (S.flash[p] || 0) > 0 ? "#ff9aa8" : "#fff4b8"]); g.globalAlpha = 1; }
      }
  }
}

export function drawWallSeg(x0, y0, x1, y1) { box(x0, y0, x1, y1, 0, CUT, "#fffaf0", "#e9dcc4", "#d6c6a8", 2.5); }

function drawTree([x0, y0, x1, y1]) {
  if (sprite("tree", [x0, y0, x1, y1])) return;
  const g = getG(), c = P((x0 + x1) / 2, (y0 + y1) / 2);
  box(x0 + .15, y0 + .15, x1 - .15, y1 - .15, 0, 50, "#9a6230", "#8a5a2b", "#6f4520", 2);
  [[0, -80, 40], [-30, -60, 30], [30, -58, 30], [0, -112, 30]].forEach(([dx, dy, r]) => circ(c[0] + dx, c[1] + dy, r, "#4caf50"));
}

const wallQuad = (face, c, a, b, z0, z1, fill, lw = 2.5) =>
  poly(face === "y" ? [P(a, c, z0), P(b, c, z0), P(b, c, z1), P(a, c, z1)] : [P(c, a, z0), P(c, b, z0), P(c, b, z1), P(c, a, z1)], fill, lw);

/* Scenery from map.json: neighbour houses, the sari-sari store, the courier booth, signs, court, trees. */
export function drawScenery(s) {
  const g = getG(), [x0, y0, x1, y1] = s.b, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  switch (s.kind) {
    case "tree": drawTree(s.b); break;
    case "house": {
      const h = s.h, o = .25, A = P(cx, cy, h + 62);
      box(x0, y0, x1, y1, 0, h, "#fff", shade(s.wall, .96), shade(s.wall, .8));
      wallQuad("y", y1, x0 + .6, x0 + 1.5, 0, 58, "#8a5a2b");
      wallQuad("y", y1, x0 + 2.2, x0 + 3.3, 40, 72, "#cfeeff");
      wallQuad("x", x1, y0 + .6, y0 + 1.6, 40, 72, "#cfeeff");
      wallQuad("x", x1, y0 + 2.2, y0 + 3.2, 40, 72, "#cfeeff");
      poly([P(x0 - o, y1 + o, h), P(x1 + o, y1 + o, h), A], shade(s.roof, 1.0));
      poly([P(x1 + o, y1 + o, h), P(x1 + o, y0 - o, h), A], shade(s.roof, .78));
      break;
    }
    case "store": {
      const h = s.h, oy0 = y0 + .45, oy1 = y1 - .45;
      box(x0, y0, x1, y1, 0, h, "#fff7d6", shade(s.wall, 1), shade(s.wall, .82));
      wallQuad("x", x1, oy0, oy1, 26, 78, "#3a2a52", 3);
      const goods = ["#ef3b4f", "#ffc928", "#2cc8b6", "#9446e0", "#ff8a2a", "#5b8def"];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        const ya = oy0 + .1 + c * ((oy1 - oy0 - .2) / 6), yb = ya + (oy1 - oy0 - .2) / 6 - .06, za = 34 + r * 22;
        wallQuad("x", x1, ya, yb, za, za + 16, goods[(c + r * 2) % 6], 1.5);
      }
      box(x1, oy0 - .05, x1 + .22, oy1 + .05, 22, 6, "#d9a066", "#c08445", "#a26c33", 2);
      const n = 8, step = (oy1 - oy0 + .4) / n;
      for (let k = 0; k < n; k++) { const ya = oy0 - .2 + k * step; poly([P(x1, ya, 88), P(x1, ya + step, 88), P(x1 + .55, ya + step, 68), P(x1 + .55, ya, 68)], k % 2 ? "#fff" : "#ef3b4f", 2); }
      wallQuad("x", x1 + .02, y0 + .25, y1 - .25, 94, 134, "#2b3466", 3);
      faceText("x", x1 + .02, cy, 114, "SARI-SARI STORE", y1 - y0 - .6, 26, "#ffe06b");
      wallQuad("y", y1, x0 + 1, x0 + 2.4, 40, 78, "#cfeeff");
      wallQuad("y", y1, x0 + 2.8, x0 + 3.6, 0, 62, "#8a5a2b");
      break;
    }
    case "booth": {
      const h = s.h;
      box(x0, y0, x1, y1, 0, h, "#fff", "#f4f0e0", "#d8d2bc");
      wallQuad("x", x1, y0 + .3, y1 - .3, 34, 64, "#3a2a52", 3);
      box(x1, y0 + .2, x1 + .2, y1 - .2, 30, 5, "#d9a066", "#c08445", "#a26c33", 2);
      wallQuad("x", x1, y0 + .45, y0 + .8, 6, 24, "#d9a066", 2);
      box(x0 - .2, y0 - .2, x1 + .2, y1 + .2, h, 8, "#ff8a2a", "#e06d12", "#c25a08", 2.5);
      [y0 - .1, y1 + .1].forEach(y => box(x1 + .07, y - .05, x1 + .17, y + .05, h + 8, 30, "#c9cde6", "#aab0d6", "#8f96c4", 2));
      wallQuad("x", x1 + .12, y0 - .15, y1 + .15, h + 20, h + 60, "#ff8a2a", 3);
      faceText("x", x1 + .12, cy, h + 49, "COURIER", y1 - y0, 19, NAVY);
      faceText("x", x1 + .12, cy, h + 31, "DROP-OFF", y1 - y0, 19, NAVY);
      break;
    }
    case "sign": {
      [y0 + .2, y1 - .2].forEach(y => box(x0 + .04, y - .05, x0 + .14, y + .05, 0, 100, "#9a6230", "#8a5a2b", "#6f4520", 2));
      box(x0, y0, x1, y1, 58, 62, "#fff8e8", "#e2dcc8", "#fff3c4", 3);
      faceText("x", x1, cy, 103, "FOR FUTURE", y1 - y0, 30, NAVY);
      faceText("x", x1, cy, 77, "ROOMS", y1 - y0, 30, NAVY);
      break;
    }
    case "hoop": {
      box(x0, y0, x1, y1, 0, 172, "#c9cde6", "#aab0d6", "#8f96c4", 2);
      box(x0 - .22, cy - .55, x0 - .14, cy + .55, 150, 56, "#ffffff", "#e0e4f4", "#f4f6ff", 2.5);
      const r = P(x0 - .55, cy, 156); g.beginPath(); g.ellipse(r[0], r[1], 19, 9.5, 0, 0, 7); g.lineWidth = 5; g.strokeStyle = "#ff8a2a"; g.stroke();
      break;
    }
    case "bench": {
      box(x0, y0 + .08, x1, y1, 0, 16, "#c08445", "#a26c33", "#8a5a2b", 2.5);
      box(x0, y0, x1, y0 + .1, 16, 26, "#d9a066", "#c08445", "#a26c33", 2.5);
      break;
    }
    case "streetlamp": {
      if (sprite("lamp", s.b)) break;
      const b = P(cx, cy, 0), t = P(cx, cy, 160); g.lineWidth = 6; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...b); g.lineTo(...t); g.stroke(); circ(t[0], t[1], 12, "#ffe06b");
      break;
    }
    case "stake": box(x0, y0, x1, y1, 0, 26, "#ffe9a8", "#ffc928", "#d49a00", 2); break;
  }
}
