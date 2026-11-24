/* Settings app: text size, reduce motion, sound, touch controls, full screen. Saved on this device. */
import { registerActions } from "../../ui/windows.js";
import { prefs, setPref } from "../prefs.js";

let root = null;
const BOOL = { reduceMotion: 1, muted: 1, worldMusic: 1 };

function render() {
  if (!root) return;
  const chip = (k, v, t) => `<button type="button" class="chip ${prefs[k] === v ? "on" : ""}" data-act="se-set" data-k="${k}" data-v="${v}" aria-pressed="${prefs[k] === v}">${t}</button>`;
  const vol = (k, label) => `<div class="se-row"><label class="lbl" for="se-${k}">${label}</label><input id="se-${k}" data-pref="${k}" type="range" min="0" max="1" step="0.05" value="${prefs[k]}"></div>`;
  root.querySelector(".se-opts").innerHTML = `
    <div class="se-row"><span class="lbl">Text size</span><div>${chip("textSize", "normal", "Normal")}${chip("textSize", "large", "Large")}</div></div>
    <div class="se-row"><span class="lbl">Reduce motion</span><div>${chip("reduceMotion", false, "Off")}${chip("reduceMotion", true, "On")}</div></div>
    <div class="se-row"><span class="lbl">Sound</span><div>${chip("muted", false, "On")}${chip("muted", true, "Muted")}</div></div>
    ${vol("volume", "Master volume")}${vol("sfxVol", "Effects volume")}${vol("musicVol", "Music volume")}
    <div class="se-row"><span class="lbl">Music in the world</span><div>${chip("worldMusic", false, "Off")}${chip("worldMusic", true, "On")}</div></div>
    <div class="se-row"><span class="lbl">Touch controls</span><div>${chip("touch", "auto", "Auto")}${chip("touch", "on", "On")}${chip("touch", "off", "Off")}</div></div>
    <div class="se-row"><span class="lbl">Browser window</span><div><button type="button" class="chip" data-act="fs-toggle">Full screen</button></div></div>`;
}

/* The sound panel and this app share one set of prefs. Update controls in place, so a slider being dragged is not rebuilt. */
function onPrefs() {
  if (!root) return;
  root.querySelectorAll("input[data-pref]").forEach(i => { if (+i.value !== prefs[i.dataset.pref]) i.value = prefs[i.dataset.pref]; });
  root.querySelectorAll("[data-act=se-set]").forEach(c => { const on = String(prefs[c.dataset.k]) === c.dataset.v; c.classList.toggle("on", on); c.setAttribute("aria-pressed", String(on)); });
}

registerActions({
  "se-set": t => { const k = t.dataset.k, v = t.dataset.v; setPref(k, BOOL[k] ? v === "true" : v); }
});

export default {
  id: "settings", title: "Settings", icon: "⚙️", color: "y", cat: "misc", w: 36, h: 72,
  mount(el, win) {
    root = el; win.setTitle("Settings", "Saved on this device"); el.className = "dw-body se";
    el.innerHTML = `<div class="se-opts"></div>`;
    el.addEventListener("input", e => { const k = e.target.dataset && e.target.dataset.pref; if (k) setPref(k, +e.target.value); });
    window.addEventListener("algo:prefs", onPrefs);
    render();
  },
  unmount() { window.removeEventListener("algo:prefs", onPrefs); root = null; }
};
