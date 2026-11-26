/* UI helpers: h() builds DOM, modal() opens a card on the modal layer, toasts and floating text from bus events.
   Modals can pause the game clock (pause:true). Esc closes the top modal. */
import { artEl } from "../core/assets.js";
import { on, emit } from "../core/bus.js";
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

/* ---------- artist HUD kit (img/v/*.png). Missing files fall back to emoji. The list comes from img/_have.json "v"
   (python tools/make_have.py). If the list has no "v" key, each file is probed once. ---------- */
let vSet;
const vList = () => vSet || (vSet = fetch("img/_have.json", { cache: "no-cache" }).then(r => r.json()).then(j => (j.v ? new Set(j.v) : null)).catch(() => null));
const vOk = {};                                  // id -> true/false once known
export const vHas = id => vList().then(set => {
  if (id in vOk) return vOk[id];
  if (set) return (vOk[id] = set.has(id));
  return new Promise(res => { const i = new Image(); i.onload = () => res(vOk[id] = true); i.onerror = () => res(vOk[id] = false); i.src = `img/v/${id}.png`; });
});
/* A span with an emoji, replaced by img/v/<id>.png when that file exists. ids: one id or a list of ids to try in order. */
export function vimg(ids, emoji = "", cls = "") {
  ids = [].concat(ids).filter(Boolean);
  const s = h("span", { class: "ico " + cls }, emoji);
  const put = id => { s.textContent = ""; s.classList.add("img"); s.append(Object.assign(new Image(), { src: `img/v/${id}.png`, alt: "", draggable: false })); };
  const known = ids.find(id => vOk[id]); if (known) { put(known); return s; }
  (async () => { for (const id of ids) if (await vHas(id)) { put(id); return; } })();
  return s;
}
export const icon = (id, emoji, cls) => vimg("ic_" + id, emoji, cls);

/* ---------- modals ---------- */
const stack = [];
let nid = 0;
export const modalOpen = () => stack.length > 0;
export const modalCount = () => stack.length;

export function modal({ title, body, cls = "", pause: p = false, onClose, noClose = false, headerExtra, layer, keepPhone = false } = {}) {
  const id = ++nid, key = "modal" + id;
  const x = noClose ? null : h("button", { class: "x", type: "button", "aria-label": "Close", onClick: () => api.close() }, "×");
  const bodyEl = h("div", { class: "card-b" }, body);
  const card = h("div", { class: "card " + cls }, h("div", { class: "card-h" }, h("span", { class: "card-t" }, title || ""), headerExtra || null, x), bodyEl);
  const back = h("div", { class: "modal-back" }, card);
  back.addEventListener("pointerdown", e => { if (e.target === back && !noClose && !cls.includes("sticky")) api.close(); });
  (layer || document.getElementById("modals")).append(back);
  if (p) pause(key);
  const api = {
    el: card, body: bodyEl, back, key,
    setTitle: t => { card.querySelector(".card-t").textContent = t; },
    setBody: n => { clear(bodyEl); bodyEl.append(n); },
    close: () => { if (!back.isConnected) return; back.remove(); resume(key); const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); if (onClose) onClose(); emit("modal:close", key); }
  };
  stack.push(api); emit("modal:open", key, { keepPhone }); return api;
}
export const topModal = () => stack[stack.length - 1];
export function closeAll() { while (stack.length) stack[stack.length - 1].close(); }

/* ---------- toasts and floating text ---------- */
function toast(msg, kind = "") {
  const box = document.getElementById("toasts"); if (!box) return;
  const el = h("div", { class: "toast " + kind }, msg); box.append(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add("out"), 2800); setTimeout(() => { el.hidden = true; el.remove(); }, 3400);
}
function floatText({ text, kind = "gold", x = 300, y = 150 }) {
  const fx = document.getElementById("fx"); if (!fx) return;
  const el = h("div", { class: "float " + kind, style: { left: x + "px", top: y + "px" } }, text); fx.append(el);
  el.addEventListener("animationend", () => el.remove()); setTimeout(() => el.remove(), 1700);
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
