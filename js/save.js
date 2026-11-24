/* Save and load with localStorage. Every storage call is wrapped: the game works without storage. */
import { S, pl, resetState, emit } from "./state.js";

const KEY = "algosays.save";
export const SAVE_VERSION = 3;
const TRANSIENT = new Set(["ui", "active", "busy", "edit"]); // not saved

export function saveGame() {
  try {
    const s = {};
    for (const k in S) if (!TRANSIENT.has(k)) s[k] = S[k];
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, t: Date.now(), S: s, pl: { x: pl.x, y: pl.y, face: pl.face } }));
    return true;
  } catch (e) { return false; }
}

/* Returns true when a save was found and restored. A save with another version is ignored. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const o = JSON.parse(raw);
    if (!o || o.v !== SAVE_VERSION || !o.S || typeof o.S !== "object") return false;
    resetState(o);
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ }
}

export function newGame() {
  clearSave();
  resetState(null, true);
  saveGame();
  emit("refresh");
}

export function initSave() {
  setInterval(saveGame, 10000);
  window.addEventListener("pagehide", saveGame);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveGame(); });
}
