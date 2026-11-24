/* Window open/close and the one click dispatcher. Each window module registers itself and its actions. */
import { S, keys, on } from "../state.js";

const wins = {};
const actions = {};

export const $ = s => document.querySelector(s);

export function registerWindow(id, hooks = {}) { wins[id] = hooks; }
export function registerActions(map) { Object.assign(actions, map); }

export function openUI(id, arg) {
  const prev = wins[S.ui]; if (prev && prev.close && S.ui !== id) prev.close();
  S.ui = id;
  document.querySelectorAll(".ov").forEach(o => { o.hidden = o.id !== "w-" + id; });
  keys.clear();
  const w = wins[id]; if (w && w.open) w.open(arg);
}

/* A window can handle Esc itself (`esc` returns true). `force` skips that. */
export function closeUI(force) {
  const cur = wins[S.ui];
  if (!force && cur && cur.esc && cur.esc()) return;
  if (cur && cur.close) cur.close();
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

registerActions({ close: () => closeUI(true) });
