/* Game sound: sound effects from the event bus, optional world music, the sound button and panel.
   The engine is js/pc/audio.js. Levels and mute live in js/pc/prefs.js (one source of truth, shared with the Settings app).
   Audio starts only after the first click, tap or key press. */
import { S, on } from "./state.js";
import { $, registerActions } from "./ui/windows.js";
import { prefs, setPref, loadPrefs } from "./pc/prefs.js";
import { unlock, ready, playSfx, playLoop, stopLoop, isWorldLoop, playing } from "./pc/audio.js";

const WORLD_LOOP = 0, WORLD_LEVEL = 0.45;
let loadingWorld = false;

/* ---------- sound panel and buttons ---------- */
function syncUI() {
  const off = prefs.muted;
  const sb = $("#sndBtn"); if (sb) { sb.textContent = off ? "🔇" : "🔊"; sb.setAttribute("aria-label", off ? "Sound is off. Open sound options" : "Sound is on. Open sound options"); }
  const hb = $("#hdrSnd"); if (hb) { hb.textContent = off ? "🔇 Sound off" : "🔊 Sound on"; hb.setAttribute("aria-pressed", String(off)); }
  const mc = $("#sndMute"); if (mc) { mc.textContent = off ? "Unmute" : "Mute"; mc.classList.toggle("on", off); mc.setAttribute("aria-pressed", String(off)); }
  const wc = $("#sndWorld"); if (wc) { wc.textContent = prefs.worldMusic ? "World music: On" : "World music: Off"; wc.classList.toggle("on", !!prefs.worldMusic); wc.setAttribute("aria-pressed", String(!!prefs.worldMusic)); }
  document.querySelectorAll("#snd input[data-pref]").forEach(i => { if (+i.value !== prefs[i.dataset.pref]) i.value = prefs[i.dataset.pref]; });
}

function togglePanel(force) {
  const p = $("#snd"), b = $("#sndBtn"); if (!p || !b) return;
  const open = force === undefined ? p.hidden : force;
  p.hidden = !open; b.setAttribute("aria-expanded", String(open));
}

/* ---------- world music ---------- */
async function worldTick() {
  const want = prefs.worldMusic && !prefs.muted && ready() && S.ui !== "desktop";
  if (want && playing() === -1 && !loadingWorld) {
    loadingWorld = true;
    try { await playLoop(WORLD_LOOP, { world: true, level: WORLD_LEVEL }); } finally { loadingWorld = false; }
  } else if (!want && isWorldLoop()) stopLoop();
}

export function initSound() {
  loadPrefs();
  // First gesture unlocks audio. Later gestures resume it if the browser suspended it.
  ["pointerdown", "keydown", "touchend"].forEach(n => document.addEventListener(n, () => { unlock(); }, { capture: true }));
  on("sfx", name => playSfx(name));
  // Every button press clicks. Sliders and minigame lanes are not buttons, so they stay quiet.
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("button, [data-act], .cap, .chip");
    if (b && !b.disabled && b.getAttribute("aria-disabled") !== "true") playSfx("click");
  }, true);
  registerActions({
    "snd-mute": () => setPref("muted", !prefs.muted),
    "snd-panel": () => togglePanel(),
    "snd-world": () => setPref("worldMusic", !prefs.worldMusic)
  });
  const panel = $("#snd");
  if (panel) panel.addEventListener("input", e => { const k = e.target.dataset && e.target.dataset.pref; if (k) setPref(k, +e.target.value); });
  document.addEventListener("pointerdown", e => { const t = e.target; if (!(t.closest && t.closest("#snd, #sndBtn"))) togglePanel(false); }, true);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") togglePanel(false);
    if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target.matches && e.target.matches("input,textarea"))) setPref("muted", !prefs.muted);
  });
  window.addEventListener("algo:prefs", syncUI);
  setInterval(worldTick, 300);
  syncUI();
}
