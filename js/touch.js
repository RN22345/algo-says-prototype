/* Touch controls: a joystick that drives the same `keys` set as W A S D, an E button, zoom buttons, and a rotate notice in portrait.
   They show on touch devices (pointer: coarse), after the first touch, with ?touch=1, or when Settings says On. */
import { S, keys } from "./state.js";
import { $ } from "./ui/windows.js";
import { context } from "./interact.js";
import { setZoom } from "./camera.js";
import { prefs } from "./pc/prefs.js";
import { getScale, syncChrome } from "./fit.js";

const root = document.documentElement;
const coarse = window.matchMedia ? matchMedia("(pointer: coarse)") : { matches: false };
const forced = /[?&]touch=1\b/.test(location.search);
let seenTouch = false;

const wanted = () => prefs.touch === "on" || (prefs.touch !== "off" && (forced || coarse.matches || seenTouch));

function apply() {
  const on = wanted();
  if (root.classList.contains("tm") === on) return;
  root.classList.toggle("tm", on);
  if (!on) ["w", "a", "s", "d"].forEach(k => keys.delete(k));
  syncChrome();
}

const startPlay = () => { S.active = true; const s = $("#start"); if (s) s.hidden = true; };

function initJoystick() {
  const joy = $("#joy"), knob = $("#joyK");
  if (!joy || !knob) return;
  let id = null, cx = 0, cy = 0, R = 1;
  const stop = () => { id = null; ["w", "a", "s", "d"].forEach(k => keys.delete(k)); knob.style.transform = ""; joy.classList.remove("on"); };
  const steer = e => {
    const dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy) || 1;
    const nx = dx / m, ny = dy / m, go = m > R * 0.28;
    const want = { d: go && nx > 0.38, a: go && nx < -0.38, s: go && ny > 0.38, w: go && ny < -0.38 };
    for (const k in want) { if (want[k]) keys.add(k); else keys.delete(k); }
    const t = Math.min(m, R) * 0.62 / getScale(); // knob travel, in layout pixels
    knob.style.transform = `translate(${nx * t}px,${ny * t}px)`;
  };
  joy.addEventListener("pointerdown", e => {
    if (id !== null) return;
    e.preventDefault(); startPlay();
    const r = joy.getBoundingClientRect();
    id = e.pointerId; cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2;
    try { joy.setPointerCapture(id); } catch (err) { /* synthetic pointer */ }
    joy.classList.add("on"); steer(e);
  });
  joy.addEventListener("pointermove", e => { if (e.pointerId === id) steer(e); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(n => joy.addEventListener(n, e => { if (e.pointerId === id) stop(); }));
}

function initButtons() {
  const eb = $("#eBtn");
  eb.addEventListener("pointerdown", e => {
    e.preventDefault(); startPlay();
    if (S.ui) return;
    const c = context(); if (c && c.fn) c.fn();
  });
  $("#zIn").addEventListener("click", () => setZoom("close"));
  $("#zOut").addEventListener("click", () => setZoom("wide"));
  $("#rotOk").addEventListener("click", () => root.classList.add("rot-ok"));
  // The E button is dim when there is nothing to use here.
  setInterval(() => {
    if (!root.classList.contains("tm") || document.hidden) return;
    $("#touch").hidden = !!S.ui; // the controls would sit under a window: hide them
    const c = !S.ui && S.active ? context() : null, can = !!(c && c.fn);
    eb.classList.toggle("off", !can); eb.setAttribute("aria-label", can ? `Use: ${c.label}` : "Use (nothing here)");
  }, 150);
}

export function initTouch() {
  initJoystick(); initButtons();
  window.addEventListener("pointerdown", e => { if (e.pointerType === "touch" && !seenTouch) { seenTouch = true; apply(); } }, true);
  window.addEventListener("algo:prefs", apply);
  if (coarse.addEventListener) coarse.addEventListener("change", apply);
  apply();
}
