/* Music app: three short original loops made with WebAudio. Starts only after a click. */
import { registerActions } from "../../ui/windows.js";
import { LOOPS, playLoop, stopLoop, playing } from "../audio.js";
import { prefs, setPref } from "../prefs.js";

let root = null;

function render() {
  if (!root) return;
  const now = playing();
  root.querySelector(".mu-list").innerHTML = LOOPS.map((l, i) => `<div class="card mu-track ${now === i ? "on" : ""}"><b>${l.name}</b><small>${l.bpm} bpm loop</small>
    <button type="button" class="cap ${now === i ? "r" : "t"} sm" data-act="mu-play" data-v="${i}" aria-pressed="${now === i}">${now === i ? "Stop" : "Play"}</button></div>`).join("");
  root.querySelector(".mu-bars").classList.toggle("go", now >= 0);
}

registerActions({
  "mu-play": async (t, v) => { const i = +v; if (playing() === i) stopLoop(); else { const p = playLoop(i); render(); await p; } render(); }
});

export default {
  id: "music", title: "Music", icon: "🎵", color: "t", w: 36, h: 62,
  mount(el, win) {
    root = el; win.setTitle("Music", "Three loops"); el.className = "dw-body mu";
    el.innerHTML = `<div class="mu-bars" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--d:${(i * 0.13).toFixed(2)}s"></i>`).join("")}</div>
      <div class="mu-list"></div>
      <label class="mu-vol">Volume <input type="range" min="0" max="1" step="0.05" value="${prefs.musicVol}" aria-label="Music volume"></label>`;
    el.querySelector("input").addEventListener("input", e => setPref("musicVol", +e.target.value));
    render();
  },
  unmount() { stopLoop(); root = null; }
};
