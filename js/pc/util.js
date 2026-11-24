/* Small helpers for the PC desktop. */
import { D } from "../state.js";

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* In-game clock text from game seconds. The loop has no days, so the clock just wraps. */
export function clockText(sec) {
  const C = D.PC.clock, m = Math.floor(C.startHour * 60 + sec * C.minutesPerSecond) % 1440;
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const shortNum = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(Math.round(n));

/* Small seeded random generator (mulberry32). */
export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Set innerHTML only when it changed, and keep the scroll of [data-sk] boxes. Avoids lost clicks on live windows. */
export function setHTML(el, html) {
  if (!el || el._h === html) return false;
  const keep = [...el.querySelectorAll("[data-sk]")].map(n => [n.dataset.sk, n.scrollTop]);
  el.innerHTML = html; el._h = html;
  keep.forEach(([k, v]) => { const n = el.querySelector(`[data-sk="${k}"]`); if (n) n.scrollTop = v; });
  return true;
}
