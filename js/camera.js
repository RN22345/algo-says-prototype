/* Camera: follows the player, clamps to the map, two zoom levels. Works in "world pixels" (the output of iso.P). */
import { D, pl } from "./state.js";
import { LW, LH, TW, TH, OX, OY, WALLH, P } from "./iso.js";
import { world } from "./world.js";

export const cam = { x: 0, y: 0, zoom: 1, target: "close", bounds: null };

const Z = () => D.T.camera;
const zoomValue = name => name === "wide" ? Z().zoomWide : Z().zoomClose;

/* Edges of the map in world pixels: the diamond's bounding box, plus room for the house walls. */
function computeBounds() {
  cam.bounds = {
    x0: OX - world.MH * TW - 20, x1: OX + world.MW * TW + 20,
    y0: OY - WALLH - 20, y1: OY + (world.MW + world.MH) * TH + 24
  };
}
export const getBounds = () => { if (!cam.bounds) computeBounds(); return cam.bounds; };

/* Pull a camera centre inside the map: inside the diamond first, then inside the bounding box for this zoom. */
export function clampCentre(x, y, zoom) {
  const B = getBounds();
  // keep the centre over the map (tile space)
  let a = (x - OX) / TW, b = (y - OY) / TH;           // a = i - j, b = i + j
  let i = (a + b) / 2, j = (b - a) / 2;
  i = Math.max(0, Math.min(world.MW, i)); j = Math.max(0, Math.min(world.MH, j));
  x = OX + (i - j) * TW; y = OY + (i + j) * TH;
  const hw = LW / 2 / zoom, hh = LH / 2 / zoom;
  x = B.x1 - B.x0 <= 2 * hw ? (B.x0 + B.x1) / 2 : Math.max(B.x0 + hw, Math.min(B.x1 - hw, x));
  y = B.y1 - B.y0 <= 2 * hh ? (B.y0 + B.y1) / 2 : Math.max(B.y0 + hh, Math.min(B.y1 - hh, y));
  return [x, y];
}

const followPoint = () => P(pl.x, pl.y, Z().anchorZ);

export function snapCamera() {
  cam.zoom = zoomValue(cam.target);
  const [tx, ty] = followPoint();
  [cam.x, cam.y] = clampCentre(tx, ty, cam.zoom);
}

export function updateCamera(dt) {
  const C = Z();
  const zt = zoomValue(cam.target);
  cam.zoom += (zt - cam.zoom) * (1 - Math.exp(-dt * C.zoomRate));
  if (Math.abs(zt - cam.zoom) < 0.002) cam.zoom = zt;
  const [tx, ty] = followPoint(), [cx, cy] = clampCentre(tx, ty, cam.zoom);
  if (Math.hypot(cx - cam.x, cy - cam.y) > C.snapDist) { cam.x = cx; cam.y = cy; return; }
  const k = 1 - Math.exp(-dt * C.follow);
  [cam.x, cam.y] = clampCentre(cam.x + (cx - cam.x) * k, cam.y + (cy - cam.y) * k, cam.zoom);
}

export function setZoom(name) { cam.target = name === "wide" ? "wide" : "close"; }
export function toggleZoom() { setZoom(cam.target === "wide" ? "close" : "wide"); }

/* The world rectangle (world pixels) the camera shows. */
export function viewRect() {
  const hw = LW / 2 / cam.zoom, hh = LH / 2 / cam.zoom;
  return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
}

/* Text and labels grow a little when zoomed out so they stay readable. */
export const labelScale = () => 1 / Math.sqrt(cam.zoom);

/* Pointer helpers for click hit-testing. Input is a point in CSS pixels inside the canvas box. */
export function screenToTile(px, py, rect) {
  const lx = px / rect.width * LW, ly = py / rect.height * LH;
  const wx = cam.x + (lx - LW / 2) / cam.zoom, wy = cam.y + (ly - LH / 2) / cam.zoom;
  const a = (wx - OX) / TW, b = (wy - OY) / TH;
  return [(a + b) / 2, (b - a) / 2];
}
export function tileToScreen(i, j, rect, z = 0) {
  const [wx, wy] = P(i, j, z);
  return [((wx - cam.x) * cam.zoom + LW / 2) / LW * rect.width, ((wy - cam.y) * cam.zoom + LH / 2) / LH * rect.height];
}
