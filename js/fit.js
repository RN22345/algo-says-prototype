/* One picture at every size. The frame is laid out at a fixed 1920x1080 and scaled with transform to fit the stage (the window below the header).
   Also: browser full screen, with a fallback when the Fullscreen API is not allowed. Pointer maths: clientX and getBoundingClientRect are both in screen pixels,
   so a delta divided by a rect width stays right. A delta applied to a style in layout pixels must be divided by getScale(). */
import { toast } from "./state.js";
import { registerActions } from "./ui/windows.js";

export const LOGICAL_W = 1920, LOGICAL_H = 1080, BASE_FONT = 20.16;
const root = document.documentElement;
let k = 1, stage = null, frame = null;

export const getScale = () => k;

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export const isFull = () => !!fsEl() || root.classList.contains("pseudo-fs");

/* Recompute the scale. Called on resize, full screen change, and when touch mode changes. */
export function fit() {
  stage = stage || document.getElementById("stage"); frame = frame || document.getElementById("frame");
  if (!stage || !frame) return;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  if (!sw || !sh) return;
  const nk = Math.max(0.05, Math.min(sw / LOGICAL_W, sh / LOGICAL_H));
  const ox = Math.floor((sw - LOGICAL_W * nk) / 2), oy = Math.floor((sh - LOGICAL_H * nk) / 2);
  // Touch devices are small: grow the text a little (the layout is in em) so it stays readable. Desktop keeps one pure picture.
  const ui = root.classList.contains("tm") ? Math.min(1.5, Math.max(1, 0.546 / nk)) : 1;
  frame.style.transform = `translate(${ox}px,${oy}px) scale(${nk})`;
  frame.style.fontSize = (BASE_FONT * ui).toFixed(3) + "px";
  root.style.setProperty("--k", nk.toFixed(4));
  root.classList.toggle("portrait", window.innerHeight > window.innerWidth);
  root.classList.add("fit-ready");
  if (nk !== k) { k = nk; window.dispatchEvent(new Event("algo:scale")); }
}

function syncFs() {
  const full = isFull();
  root.classList.toggle("fs", full);
  root.classList.toggle("nohdr", full || root.classList.contains("tm"));
  document.querySelectorAll("[data-fs-label]").forEach(b => { b.textContent = b.dataset.fsLabel === "short" ? (full ? "⤢" : "⛶") : (full ? "Exit full screen" : "⛶ Full screen"); b.setAttribute("aria-pressed", String(full)); });
  fit();
}

/* Header and controls hide in full screen, and in touch mode (touch.js calls this when the mode changes). */
export function syncChrome() { syncFs(); }

export async function toggleFull() {
  if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  if (root.classList.contains("pseudo-fs")) { root.classList.remove("pseudo-fs"); syncFs(); return; }
  const rq = root.requestFullscreen || root.webkitRequestFullscreen;
  if (rq) {
    try { const p = rq.call(root, { navigationUI: "hide" }); if (p && p.then) await p; syncFs(); return; }
    catch (e) { /* not allowed here: use the large view below */ }
  }
  root.classList.add("pseudo-fs"); syncFs();
  toast("Full screen is not allowed here. Showing the large view.");
}

export function initFit() {
  stage = document.getElementById("stage"); frame = document.getElementById("frame");
  if (!stage || !frame) return;
  fit();
  new ResizeObserver(fit).observe(stage);
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 120));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  ["fullscreenchange", "webkitfullscreenchange"].forEach(n => document.addEventListener(n, syncFs));
  registerActions({ "fs-toggle": () => toggleFull() });
  syncFs();
}
