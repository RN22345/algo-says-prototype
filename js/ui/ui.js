/* UI helpers: h() builds DOM, modal() opens a card on the modal layer, toasts and floating text from bus events.
   Modals can pause the game clock (pause:true). Esc closes the top modal. */
import { artEl } from "../core/assets.js";
import { on } from "../core/bus.js";
import { pause, resume } from "../core/clock.js";
import { getScale } from "../core/fit.js";

export const $ = (s, r = document) => r.querySelector(s);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(c)); }
  return el;
}
export const btn = (label, cls, onClick, attrs = {}) => h("button", { class: "btn " + (cls || "b-blue"), onClick, type: "button", ...attrs }, label);
export const art = (id, cls) => artEl(id, cls);
export const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/* ---------- modals ---------- */
const stack = [];
let nid = 0;
export const modalOpen = () => stack.length > 0;
export const modalCount = () => stack.length;

export function modal({ title, body, cls = "", pause: p = false, onClose, noClose = false, headerExtra, layer } = {}) {
  const id = ++nid, key = "modal" + id;
  const x = noClose ? null : h("button", { class: "x", type: "button", "aria-label": "Close", onClick: () => api.close() }, "×");
  const bodyEl = h("div", { class: "card-b" }, body);
  const card = h("div", { class: "card " + cls }, h("div", { class: "card-h" }, h("span", { class: "card-t" }, title || ""), headerExtra || null, x), bodyEl);
  const back = h("div", { class: "modal-back" }, card);
  back.addEventListener("pointerdown", e => { if (e.target === back && !noClose && !cls.includes("sticky")) api.close(); });
  (layer || document.getElementById("modals")).append(back);
  if (p) pause(key);
  const api = {
    el: card, body: bodyEl, back,
    setTitle: t => { card.querySelector(".card-t").textContent = t; },
    setBody: n => { clear(bodyEl); bodyEl.append(n); },
    close: () => { if (!back.isConnected) return; back.remove(); resume(key); const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); if (onClose) onClose(); }
  };
  stack.push(api); return api;
}
export const topModal = () => stack[stack.length - 1];
export function closeAll() { while (stack.length) stack[stack.length - 1].close(); }

/* ---------- toasts and floating text ---------- */
function toast(msg, kind = "") {
  const box = document.getElementById("toasts"); if (!box) return;
  const el = h("div", { class: "toast " + kind }, msg); box.append(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add("out"), 2800); setTimeout(() => el.remove(), 3300);
}
function floatText({ text, kind = "gold", x = 300, y = 150 }) {
  const fx = document.getElementById("fx"); if (!fx) return;
  const el = h("div", { class: "float " + kind, style: { left: x + "px", top: y + "px" } }, text); fx.append(el);
  setTimeout(() => el.remove(), 1500);
}
export function initUI() {
  on("toast", toast); on("fx:float", floatText);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && stack.length) { const t = stack[stack.length - 1]; if (!t.el.classList.contains("sticky")) t.close(); }
  });
}

/* ---------- pointer drag with scale correction ---------- */
/* Drag helper: calls move(dx, dy, e) in frame pixels, end(e) on release. */
export function drag(el, { start, move, end }) {
  el.addEventListener("pointerdown", e => {
    if (e.button != null && e.button > 0) return;
    e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, k = getScale();
    if (start && start(e) === false) return;
    const mv = ev => move && move((ev.clientX - sx) / k, (ev.clientY - sy) / k, ev);
    const up = ev => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); if (end) end(ev); };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  });
}
/* Convert a client point to frame coordinates. */
export function toFrame(clientX, clientY) {
  const r = document.getElementById("frame").getBoundingClientRect(), k = getScale();
  return [(clientX - r.left) / k, (clientY - r.top) / k];
}
