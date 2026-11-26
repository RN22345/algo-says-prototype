/* JOYSTICK. A virtual stick, bottom-left, on touch devices (pointer: coarse) or with ?joy=1 in the address.
   It writes joy.x and joy.y (screen directions, -1 to 1) that player.js reads like the WASD keys. */
import { h } from "./ui.js";
import { getScale } from "../core/fit.js";

export const joy = { x: 0, y: 0 };
export function initJoystick(root) {
  if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches) && !/[?&]joy=1/.test(location.search)) return;
  const knob = h("div", { class: "knob" }), base = h("div", { class: "joy" }, knob); root.append(base);
  const R = 70; let id = null, c = null;
  const set = e => {
    const k = getScale() || 1; let dx = (e.clientX - c[0]) / k, dy = (e.clientY - c[1]) / k; const l = Math.hypot(dx, dy);
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const m = Math.hypot(dx, dy) / R; joy.x = m < 0.15 ? 0 : dx / R; joy.y = m < 0.15 ? 0 : dy / R;
  };
  const end = () => { id = null; joy.x = 0; joy.y = 0; knob.style.transform = ""; };
  base.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; try { base.setPointerCapture(id); } catch (err) { /* synthetic pointer */ } const r = base.getBoundingClientRect(); c = [r.left + r.width / 2, r.top + r.height / 2]; set(e); });
  base.addEventListener("pointermove", e => { if (e.pointerId === id) set(e); });
  base.addEventListener("pointerup", e => { if (e.pointerId === id) end(); });
  base.addEventListener("pointercancel", end);
}
