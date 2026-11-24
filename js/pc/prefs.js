/* Preferences (text size, reduce motion, sound levels and mute, world music, touch controls, arcade high score, monitor or full-frame mode, desktop icon places).
   Kept apart from the save file so New game does not reset them. One source of truth: the sound button, the sound panel and the Settings app all read and write these. */
import { setLevels } from "./audio.js";

const KEY = "algosays.prefs";
export const prefs = { textSize: "normal", reduceMotion: false, volume: 0.7, musicVol: 0.8, sfxVol: 0.8, muted: false, worldMusic: false, touch: "auto", catchHigh: 0, pcFull: false, iconPos: {} };

export function applyPrefs() {
  const f = document.getElementById("frame");
  if (f) { f.classList.toggle("tl", prefs.textSize === "large"); f.classList.toggle("rm", !!prefs.reduceMotion); f.classList.toggle("pcfull", !!prefs.pcFull); }
  const d = document.getElementById("w-desktop");
  if (d) d.classList.toggle("full", !!prefs.pcFull);
  setLevels(prefs.volume, prefs.musicVol, prefs.sfxVol, prefs.muted);
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(prefs, JSON.parse(raw));
    else if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) prefs.reduceMotion = true;
  } catch (e) { /* no storage */ }
  applyPrefs();
  window.dispatchEvent(new Event("algo:prefs"));
}

export function setPref(k, v) {
  prefs[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* no storage */ }
  applyPrefs();
  window.dispatchEvent(new Event("algo:prefs"));
}
