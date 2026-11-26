/* DRAW KIT. Small canvas helpers shared by the world files, and the code-drawn fallbacks for props that have no sprite yet
   (so the world is complete without any art). Everything draws in world pixels through P(). */
import { P } from "./proj.js";

export function polyOn(c, pts, fill, stroke, lw = 0) {
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = "round"; c.stroke(); }
}
export function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, v + k)); return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); }
/* A box with its back corner at tile (x, y), width w along x, depth d along y, height hgt in tiles. */
export function prism(g, x, y, w, d, hgt, top, left, right, z0 = 0) {
  const q = (a, b, z) => P(a, b, z0 + z);
  polyOn(g, [q(x, y + d, 0), q(x + w, y + d, 0), q(x + w, y + d, hgt), q(x, y + d, hgt)], left, "#1c2452", 2);
  polyOn(g, [q(x + w, y, 0), q(x + w, y + d, 0), q(x + w, y + d, hgt), q(x + w, y, hgt)], right, "#1c2452", 2);
  polyOn(g, [q(x, y, hgt), q(x + w, y, hgt), q(x + w, y + d, hgt), q(x, y + d, hgt)], top, "#1c2452", 2);
}
export function label(g, x, y, z, text, col = "#1c2452") {
  const [sx, sy] = P(x, y, z); g.font = "600 17px Fredoka, sans-serif"; const w = g.measureText(text).width + 18;
  g.fillStyle = "#fff"; g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(sx - w / 2, sy - 30, w, 26, 13) : g.rect(sx - w / 2, sy - 30, w, 26); g.fill(); g.stroke();
  g.fillStyle = col; g.textAlign = "center"; g.fillText(text, sx, sy - 11);
}
export function shadow(g, cx, cy, rx = 0.45, ry = 0.28) {
  const [x, y] = P(cx, cy); g.fillStyle = "rgba(28,36,82,.2)"; g.beginPath(); g.ellipse(x, y, rx * 80, ry * 46, 0, 0, Math.PI * 2); g.fill();
}
const blob = (g, x, y, rx, ry, col) => { g.fillStyle = col; g.strokeStyle = "#1c2452"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke(); };

/* Default footprints (tiles) of the code-drawn props. */
export const FB = { od_tree_round: [1, 1], od_tree_ball: [1, 1], od_tree_pine: [1, 1], od_bush: [0.7, 0.7], od_mailbox: [0.35, 0.35], od_lamp_post: [0.4, 0.4], od_lamp_old: [0.4, 0.4],
  od_bench: [1.3, 0.6], od_bin: [0.45, 0.45], od_sale_sign: [1.3, 0.6], od_fence_x: [1, 0.3], od_fence_y: [0.3, 1], od_house_a: [3.6, 3.6], od_house_b: [3.6, 3.6] };

/* Code-drawn stand-in for a prop id, centred on footprint centre (cx, cy). */
export function fallbackProp(g, id, cx, cy, fw, fd) {
  const [fw0, fd0] = FB[id] || [1, 1], w = fw || fw0, d = fd || fd0, x = cx - w / 2, y = cy - d / 2, [sx, sy] = P(cx, cy);
  if (id.startsWith("od_tree")) { prism(g, cx - 0.1, cy - 0.1, 0.2, 0.2, 0.9, "#8a5a2b", "#7a4d22", "#946232"); blob(g, sx, sy - 120, 60, 54, "#3ec45a"); blob(g, sx - 12, sy - 130, 38, 34, "#5fd873"); }
  else if (id === "od_bush") { blob(g, sx, sy - 18, 34, 24, "#3ec45a"); blob(g, sx + 14, sy - 26, 20, 16, "#5fd873"); }
  else if (id === "od_lamp_post" || id === "od_lamp_old") { prism(g, cx - 0.06, cy - 0.06, 0.12, 0.12, 2.3, "#46508c", "#2c3a82", "#3a4799"); blob(g, sx, sy - 2.4 * 92, 16, 14, "#ffe27a"); }
  else if (id === "od_bench") { prism(g, x, y + d * 0.35, w, d * 0.65, 0.32, "#d9a066", "#a8692f", "#c98f3a"); prism(g, x, y, w, d * 0.2, 0.7, "#d9a066", "#a8692f", "#c98f3a"); }
  else if (id === "od_bin") prism(g, x, y, w, d, 0.55, "#7d86b3", "#515a85", "#6a73a0");
  else if (id === "od_mailbox") { prism(g, cx - 0.05, cy - 0.05, 0.1, 0.1, 0.7, "#8a5a2b", "#7a4d22", "#946232"); prism(g, cx - 0.17, cy - 0.12, 0.34, 0.24, 0.26, "#e8344f", "#a01c33", "#c92b43", 0.7); }
  else if (id === "od_sale_sign") {
    prism(g, cx - 0.05, cy - 0.05, 0.1, 0.1, 1.0, "#8a5a2b", "#7a4d22", "#946232");
    const [bx, by] = P(cx, cy, 1.1); g.fillStyle = "#fff"; g.strokeStyle = "#1c2452"; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(bx - 46, by - 26, 92, 44, 8) : g.rect(bx - 46, by - 26, 92, 44); g.fill(); g.stroke();
    g.fillStyle = "#e8344f"; g.font = "400 18px 'Lilita One', sans-serif"; g.textAlign = "center"; g.fillText("FOR SALE", bx, by + 4);
  }
  else if (id === "od_fence_x" || id === "od_fence_y") {
    const alongX = id === "od_fence_x", n = 4;
    for (let i = 0; i <= n; i++) { const t = i / n; prism(g, alongX ? x + t * w - 0.03 : cx - 0.04, alongX ? cy - 0.04 : y + t * d - 0.03, 0.07, 0.07, 0.6, "#fff", "#cfd6ea", "#e3e9f7"); }
    for (const z of [0.2, 0.42]) { const a = alongX ? P(x, cy, z) : P(cx, y, z), b = alongX ? P(x + w, cy, z) : P(cx, y + d, z); g.strokeStyle = "#cfd6ea"; g.lineWidth = 5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  }
  else if (id.startsWith("od_house")) {
    const hh = 1.7, rf = id.endsWith("a") ? "#ff6b5e" : "#3a7bf0"; prism(g, x, y, w, d, hh, "#fff7e0", "#f4ead0", "#d9ccaa");
    polyOn(g, [P(x - 0.2, y + d + 0.2, hh), P(x + w + 0.2, y + d + 0.2, hh), P(x + w + 0.2, y - 0.2, hh), P(x + w * 0.5, y - 0.2, hh + 1.1), P(x - 0.2, y + d * 0.5, hh + 1.1)], rf, "#1c2452", 3);
  }
  else prism(g, x, y, w, d, 0.6, "#c0c8e6", "#8a96c8", "#a3aedb");
}
