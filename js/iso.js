/* Isometric projection and canvas draw helpers. */
export const LW = 1920, LH = 1080, TW = 52, TH = 26, OX = 860, OY = 236, WALLH = 190, CUT = 34;
export const NAVY = "#1b2a66", FONT = '"Fredoka",system-ui,sans-serif';

let g = null; // current 2D context (main canvas, or the background cache while it builds)
export const setCtx = c => { g = c; };
export const getG = () => g;

/* Labels and bars queued during a frame and drawn on top of the world. */
export const overlay = { bubbles: [], bars: [] };

export const P = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z];

export function poly(pts, fill, lw = 3, stroke = NAVY) {
  g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.lineWidth = lw; g.lineJoin = "round"; g.strokeStyle = stroke; g.stroke(); }
}

export function box(x0, y0, x1, y1, z, h, top, left, right, lw = 3) {
  poly([P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + h), P(x0, y1, z + h)], left, lw);
  poly([P(x1, y0, z), P(x1, y1, z), P(x1, y1, z + h), P(x1, y0, z + h)], right, lw);
  poly([P(x0, y0, z + h), P(x1, y0, z + h), P(x1, y1, z + h), P(x0, y1, z + h)], top, lw);
}

export function circ(x, y, r, fill, lw = 3) {
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = NAVY; g.stroke(); }
}

export function bubble(x, y, text, col = "#fff", tc = NAVY, size = 21) {
  g.font = `600 ${size}px ${FONT}`;
  const w = g.measureText(text).width + 26, h = size + 15, bx = x - w / 2, by = y - h - 11;
  g.beginPath(); g.roundRect(bx, by, w, h, 11); g.fillStyle = col; g.fill(); g.lineWidth = 3; g.strokeStyle = NAVY; g.stroke();
  g.beginPath(); g.moveTo(x - 8, by + h); g.lineTo(x, by + h + 10); g.lineTo(x + 8, by + h); g.fillStyle = col; g.fill();
  g.beginPath(); g.moveTo(x - 8, by + h + 1.5); g.lineTo(x, by + h + 10); g.lineTo(x + 8, by + h + 1.5); g.stroke();
  g.fillStyle = tc; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, x, by + h / 2 + 1);
}

/* Darken (f < 1) or lighten (f > 1) a #rrggbb colour. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

/* Text laid flat on a wall, centred at position t along it and height z.
   face "x": the wall at x = c, text runs up-right. face "y": the wall at y = c, text runs down-right.
   `span` is the wall length in tiles. The text shrinks to fit it. */
export function faceText(face, c, t, z, text, span, size, col = NAVY) {
  const p = face === "x" ? P(c, t, z) : P(t, c, z);
  g.save(); g.translate(p[0], p[1]); g.transform(1, face === "x" ? -0.5 : 0.5, 0, 1, 0, 0);
  g.font = `700 100px ${FONT}`;
  const px = Math.min(size, span * TW * 0.92 / (g.measureText(text).width || 1) * 100);
  g.font = `700 ${px}px ${FONT}`; g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 0);
  g.restore();
}

export function bar(x, y, w, p, col) {
  g.beginPath(); g.roundRect(x - w / 2, y, w, 12, 6); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = NAVY; g.stroke();
  g.beginPath(); g.roundRect(x - w / 2 + 2, y + 2, Math.max(0, (w - 4) * p), 8, 4); g.fillStyle = col; g.fill();
}
