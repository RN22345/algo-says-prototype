/* Map, walls, furniture, solids, collision, zones. Layout comes from data/map.json. */
import { D, S, rt } from "./state.js";
import { P, poly, box, circ, getG, overlay, CUT, NAVY, FONT } from "./iso.js";

export const world = {};

export function initWorld(M) {
  world.MW = M.size[0]; world.MH = M.size[1];
  world.tiles = M.tiles;
  world.walls = M.walls;
  world.furn = M.furniture;
  world.shelfProducts = M.shelfProducts;
  world.shelfZone = M.shelfZone;
  world.solids = [...M.walls, ...M.furniture.map(f => f.b)];
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
      box(x0, y0, x1, y1, 0, 70, "#e8b77d", "#c48a4b", "#a8723a");
      box(2.1, .2, 3.5, .45, 70, 76, "#3a4a8c", "#3a4a8c", NAVY);
      poly([P(2.2, .45, 80), P(3.4, .45, 80), P(3.4, .45, 140), P(2.2, .45, 140)], S.post ? "#d4b2ff" : "#c3cbe8", 2);
      if (S.post) { const p = P(2.8, .45, 110); g.fillStyle = "#6224a8"; g.font = `700 20px ${FONT}`; g.textAlign = "center"; g.fillText("tt", p[0], p[1] + 6); }
      box(2.3, .65, 3.3, .9, 70, 5, "#eef1ff", "#c9cde6", "#aab0d6", 2);
      box(3.6, .3, 3.95, .7, 70, 40, "#2cc8b6", "#139180", "#0f7266", 2); break;
    case "light": {
      const b = P(4.65, .55, 0), t = P(4.65, .55, 150); g.lineWidth = 5; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...b); g.lineTo(...t); g.stroke();
      g.beginPath(); g.ellipse(t[0], t[1], 22, 26, 0, 0, 7); g.lineWidth = 7; g.strokeStyle = "#fff6c8"; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = NAVY; g.beginPath(); g.ellipse(t[0], t[1], 26, 30, 0, 0, 7); g.stroke(); break;
    }
    case "algo": {
      box(x0, y0, x1, y1, 0, 112, "#2cc8b6", "#1fae9d", "#139180");
      const fy0 = y0 + .18, fy1 = y1 - .18; poly([P(x1, fy0, 48), P(x1, fy1, 48), P(x1, fy1, 100), P(x1, fy0, 100)], "#1b2a66", 3);
      const blink = (rt.perf % 4) < .15; const e1 = P(x1, fy0 + .3, 80), e2 = P(x1, fy1 - .3, 80), m = P(x1, (fy0 + fy1) / 2, 62);
      g.fillStyle = "#7af7e6"; if (blink) { g.fillRect(e1[0] - 6, e1[1] - 2, 12, 4); g.fillRect(e2[0] - 6, e2[1] - 2, 12, 4); } else { circ(e1[0], e1[1], 6, "#7af7e6", 0); circ(e2[0], e2[1], 6, "#7af7e6", 0); }
      g.lineWidth = 4; g.strokeStyle = "#7af7e6"; g.beginPath(); g.moveTo(m[0] - 12, m[1] - 6); g.quadraticCurveTo(m[0], m[1] + 4, m[0] + 12, m[1] + 6); g.stroke();
      [["#ef3b4f", .3], ["#ffc928", .55], ["#9446e0", .8]].forEach(([c, t]) => { const q = P(x1, y0 + t * (y1 - y0), 26); circ(q[0], q[1], 5, c, 2); });
      const a = P((x0 + x1) / 2, (y0 + y1) / 2, 112), a2 = P((x0 + x1) / 2, (y0 + y1) / 2, 150); g.lineWidth = 4; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...a); g.lineTo(...a2); g.stroke(); circ(a2[0], a2[1], 9, S.algoUnread && (rt.perf % 1 < .5) ? "#ffc928" : "#ef3b4f");
      break;
    }
    case "plant1": box(x0, y0, x1, y1, 0, 30, "#ff8a2a", "#e06d12", "#c25a08", 2); { const p = P((x0 + x1) / 2, (y0 + y1) / 2, 30);[[0, -30, 22], [-17, -15, 17], [17, -17, 17], [0, -52, 15]].forEach(([dx, dy, r]) => circ(p[0] + dx, p[1] + dy, r, "#3fbf6a")); } break;
    case "crates": box(x0, y0, x1, y1, 0, 44, "#d9a066", "#c08445", "#a26c33"); box(9.6, 3.5, 10.3, 4.2, 44, 36, "#e2ae74", "#c08445", "#a26c33", 2); break;
    case "table":
      box(x0, y0, x1, y1, 0, 62, "#f3d7a8", "#d6ad6c", "#bb9152");
      S.orders.slice(0, 4).forEach((o, i) => { const bx = 5.2 + i * .5; box(bx, 6.7, bx + .38, 7.1, 62, 22, "#fff8e8", PR[o.p].col, "#d9c9a6", 2); });
      S.table.slice(0, 6).forEach((o, i) => { const bx = 6.9 + (i % 2) * .32, bz = 62 + Math.floor(i / 2) * 22; box(bx, 6.9, bx + .3, 7.4, bz, 22, "#e2ae74", "#c08445", "#a26c33", 2); });
      break;
    case "sofa": box(x0, y0, x1, y1, 0, 34, "#5b8def", "#4673c9", "#3a62ad"); box(x0, y0, x0 + .3, y1, 34, 40, "#6c9bf5", "#4673c9", "#3a62ad"); break;
    case "lamp": { const b = P(13.37, 5.42), t = P(13.37, 5.42, 160); g.lineWidth = 6; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...b); g.lineTo(...t); g.stroke(); circ(t[0], t[1], 12, "#ffe06b"); break; }
    default:
      if (f.id.startsWith("tree")) { const c = P((x0 + x1) / 2, (y0 + y1) / 2); box(x0 + .15, y0 + .15, x1 - .15, y1 - .15, 0, 50, "#9a6230", "#8a5a2b", "#6f4520", 2);[[0, -80, 40], [-30, -60, 30], [30, -58, 30], [0, -112, 30]].forEach(([dx, dy, r]) => circ(c[0] + dx, c[1] + dy, r, "#4caf50")); }
      else if (f.id.startsWith("shelf")) {
        const k = +f.id[5], p = world.shelfProducts[k], n = Math.min(6, S.stock[p]);
        box(x0, y0, x1, y1, 0, 150, "#d9a066", "#b97a3d", "#9a6230");
        [10, 58, 106].forEach((z, r) => {
          g.lineWidth = 3; g.strokeStyle = NAVY; g.beginPath(); g.moveTo(...P(x0, y1, z)); g.lineTo(...P(x1, y1, z)); g.stroke();
          for (let c = 0; c < 2; c++) { const idx = r * 2 + c; if (idx >= n) continue; const xa = x0 + .12 + c * .42; poly([P(xa, y1, z + 3), P(xa + .34, y1, z + 3), P(xa + .34, y1, z + 38), P(xa, y1, z + 38)], PR[p].col, 2); }
        });
        poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, 150), P(x0, y1, 150)], null, 3);
        if (S.stock[p] === 0) { g.globalAlpha = .85; overlay.bubbles.push([(x0 + x1) / 2, (y0 + y1) / 2, k % 2 ? 205 : 165, `${PR[p].n}: 0`, (S.flash[p] || 0) > 0 ? "#ff9aa8" : "#fff4b8"]); g.globalAlpha = 1; }
      }
  }
}

export function drawWallSeg(x0, y0, x1, y1) { box(x0, y0, x1, y1, 0, CUT, "#fffaf0", "#e9dcc4", "#d6c6a8", 2.5); }
