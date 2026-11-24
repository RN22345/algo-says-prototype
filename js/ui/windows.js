/* Window open/close and the one click dispatcher. Each window module registers itself and its actions. */
import { S, keys, on } from "../state.js";

const wins = {};
const actions = {};

export const $ = s => document.querySelector(s);

export function registerWindow(id, { open } = {}) { wins[id] = { open }; }
export function registerActions(map) { Object.assign(actions, map); }

export function openUI(id) {
  S.ui = id;
  document.querySelectorAll(".ov").forEach(o => { o.hidden = o.id !== "w-" + id; });
  keys.clear();
  const w = wins[id]; if (w && w.open) w.open();
}

export function closeUI() {
  S.ui = null;
  document.querySelectorAll(".ov").forEach(o => { o.hidden = true; });
  const cv = $("#iso"); if (cv) cv.focus();
}

export function initWindows() {
  on("openUI", openUI);
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    const fn = actions[t.dataset.act]; if (fn) fn(t, t.dataset.v, e);
  });
}

registerActions({ close: () => closeUI() });
