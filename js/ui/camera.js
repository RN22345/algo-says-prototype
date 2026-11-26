/* CAMERA. The world is bigger than the 1920x1080 stage. The camera has a centre in world pixels and a zoom (0.7 to 1.3).
   follow() eases toward the player with a small dead zone and clamps to the world box. Wheel or pinch changes the zoom.
   toWorld/toScreen convert between stage pixels and world pixels. matrix() is the same transform for CSS or SVG.
   Events out: camera:moved (throttled). */
import { emit } from "../core/bus.js";

export const cam = { cx: 0, cy: 0, z: 1, snap: true, pinchAt: 0 };
const VW = 1920, VH = 1080, ZMIN = 0.7, ZMAX = 1.3;
let box = { x0: 0, y0: 0, x1: 1920, y1: 1080 }, lastEmit = 0;
export const setBounds = b => { box = b; clamp(); };
export const toWorld = (sx, sy) => [cam.cx + (sx - VW / 2) / cam.z, cam.cy + (sy - VH / 2) / cam.z];
export const toScreen = (wx, wy) => [VW / 2 + (wx - cam.cx) * cam.z, VH / 2 + (wy - cam.cy) * cam.z];
export const tx = () => VW / 2 - cam.cx * cam.z;
export const ty = () => VH / 2 - cam.cy * cam.z;
export const matrix = () => `matrix(${cam.z},0,0,${cam.z},${tx()},${ty()})`;
export const apply = g => g.setTransform(cam.z, 0, 0, cam.z, tx(), ty());
export const viewRect = () => { const w = VW / cam.z, h = VH / cam.z; return [cam.cx - w / 2, cam.cy - h / 2, w, h]; };
function clamp() {
  const hw = VW / cam.z / 2, hh = VH / cam.z / 2;
  cam.cx = box.x1 - box.x0 <= hw * 2 ? (box.x0 + box.x1) / 2 : Math.max(box.x0 + hw, Math.min(box.x1 - hw, cam.cx));
  cam.cy = box.y1 - box.y0 <= hh * 2 ? (box.y0 + box.y1) / 2 : Math.max(box.y0 + hh, Math.min(box.y1 - hh, cam.cy));
}
export function follow(px, py, dt) {
  const ox = cam.cx, oy = cam.cy;
  if (cam.snap) { cam.cx = px; cam.cy = py - 60; cam.snap = false; }
  else {
    const k = 1 - Math.exp(-dt * 5), dzx = 90, dzy = 60, dx = px - cam.cx, dy = py - 60 - cam.cy;
    if (Math.abs(dx) > dzx) cam.cx += (dx - Math.sign(dx) * dzx) * k;
    if (Math.abs(dy) > dzy) cam.cy += (dy - Math.sign(dy) * dzy) * k;
  }
  clamp();
  if ((Math.abs(cam.cx - ox) > 0.4 || Math.abs(cam.cy - oy) > 0.4) && performance.now() - lastEmit > 80) { lastEmit = performance.now(); emit("camera:moved"); }
}
export function zoomTo(z) { const o = cam.z; cam.z = Math.max(ZMIN, Math.min(ZMAX, z)); if (cam.z !== o) { clamp(); emit("camera:moved"); } }
export const zoomBy = f => zoomTo(cam.z * f);
/* Wheel zoom and two-finger pinch on an element. A pinch sets cam.pinchAt so the lifted finger does not count as a click. */
export function initCameraInput(el) {
  el.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
  const pts = new Map(); let d0 = 0, z0 = 1;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  el.addEventListener("pointerdown", e => { if (e.pointerType !== "touch") return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { d0 = dist(); z0 = cam.z; cam.pinchAt = performance.now(); } });
  el.addEventListener("pointermove", e => {
    const p = pts.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && d0 > 0) { zoomTo(z0 * dist() / d0); cam.pinchAt = performance.now(); }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) d0 = 0; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
}
export const justPinched = () => performance.now() - cam.pinchAt < 450;
