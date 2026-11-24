/* Keyboard and pointer input. */
import { S, keys } from "./state.js";
import { $, openUI, closeUI } from "./ui/windows.js";
import { context } from "./interact.js";
import { setZoom } from "./camera.js";
import { toggleDev } from "./dev.js";

const KM = { w: "w", arrowup: "w", a: "a", arrowleft: "a", s: "s", arrowdown: "s", d: "d", arrowright: "d" };

export function initInput() {
  const cv = $("#iso");
  $("#phoneBtn").onclick = () => { if (S.ui === "phone") closeUI(); else openUI("phone"); };
  const startPlay = () => { S.active = true; $("#start").hidden = true; };
  $("#start").onclick = () => { startPlay(); cv.focus(); };
  cv.addEventListener("pointerdown", startPlay); // a tap on the world starts play too
  cv.addEventListener("wheel", e => { if (S.ui) return; e.preventDefault(); setZoom(e.deltaY < 0 ? "close" : "wide"); }, { passive: false });
  document.addEventListener("mousedown", e => { if (!e.target.closest("#frame, #stage, .keepactive")) { S.active = false; keys.clear(); } });
  document.addEventListener("keydown", e => {
    if (e.key === "F1") { e.preventDefault(); toggleDev(); return; }
    if (e.target.matches && e.target.matches("input,textarea")) { if (e.key === "Escape") e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (k === "escape" && S.ui) { closeUI(); return; }
    if (!S.active) return;
    if (k === "q") { if (S.ui === "phone") closeUI(); else if (!S.ui) openUI("phone"); return; }
    if (S.ui) return;
    if (k === "z") { setZoom("close"); return; }
    if (k === "x") { setZoom("wide"); return; }
    if (KM[k]) { keys.add(KM[k]); e.preventDefault(); }
    if (k === "e") { const c = context(); if (c && c.fn) c.fn(); }
  });
  document.addEventListener("keyup", e => { const k = KM[e.key.toLowerCase()]; if (k) keys.delete(k); });
  window.addEventListener("blur", () => keys.clear());
}
