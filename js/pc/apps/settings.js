/* Settings app: text size, reduce motion, master volume. Saved on this device. */
import { registerActions } from "../../ui/windows.js";
import { prefs, setPref } from "../prefs.js";

let root = null;

function render() {
  if (!root) return;
  const chip = (k, v, t) => `<button type="button" class="chip ${prefs[k] === v ? "on" : ""}" data-act="se-set" data-k="${k}" data-v="${v}" aria-pressed="${prefs[k] === v}">${t}</button>`;
  root.querySelector(".se-opts").innerHTML = `
    <div class="se-row"><span class="lbl">Text size</span><div>${chip("textSize", "normal", "Normal")}${chip("textSize", "large", "Large")}</div></div>
    <div class="se-row"><span class="lbl">Reduce motion</span><div>${chip("reduceMotion", false, "Off")}${chip("reduceMotion", true, "On")}</div></div>`;
}

registerActions({
  "se-set": (t, v) => { setPref(t.dataset.k, t.dataset.k === "reduceMotion" ? v === "true" : v); render(); }
});

export default {
  id: "settings", title: "Settings", icon: "⚙️", color: "y", w: 34, h: 50,
  mount(el, win) {
    root = el; win.setTitle("Settings", "Saved on this device"); el.className = "dw-body se";
    el.innerHTML = `<div class="se-opts"></div><div class="se-row"><label class="lbl" for="se-vol">Master volume</label><input id="se-vol" type="range" min="0" max="1" step="0.05" value="${prefs.volume}"></div>`;
    el.querySelector("#se-vol").addEventListener("input", e => setPref("volume", +e.target.value));
    render();
  },
  unmount() { root = null; }
};
