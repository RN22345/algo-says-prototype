/* MR. ALGO. A bottom-left bar: the robot (face by mood) and a speech bubble. say(lines, {mood}) shows lines one by one, tap to advance, returns a promise.
   Also: the guided start (data/intro.json) with a spotlight on the next station, and hints on request (Mr. Algo station or tap his face).
   Events in: station:click {id:"algo"}, lesson:new, sample:*, studio:open. */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { on, emit, once } from "../core/bus.js";
import { pause, resume } from "../core/clock.js";
import { h, btn, art, clear, modal } from "./ui.js";
import { stationRect, nudge } from "./room.js";
import { artUrl } from "../core/assets.js";

let root, face, bubbleBox, queue = null, mood = "neutral", activeKey = null;

export function initAlgo() {
  root = document.getElementById("algo");
  face = h("img", { class: "face", src: artUrl("algo_neutral"), alt: "Mr. Algo", draggable: false, onClick: () => hint() });
  bubbleBox = h("div", { style: { display: "contents" } });
  root.append(h("div", { class: "bar" }, face, bubbleBox));
  on("station:click", ({ id }) => { if (id === "algo") hint(); });
  on("studio:open", () => advanceIntro("studio:open"));
  on("sample:requested", () => advanceIntro("sample:requested"));
  on("sample:taken", () => advanceIntro("sample:taken"));
  on("newgame", () => { setMood("neutral"); clear(bubbleBox); });
  on("post:created", p => { if (S.posts.length === 1) say(["Posted! Now time does the work. Views come in waves.", "Followers see it first. Then strangers decide how far it goes.", "Results show up on your phone in about half an hour of game time."], { mood: "happy" }); });
}
export function setMood(m) { mood = m; face.src = artUrl("algo_" + m); }

/* Show lines. Resolves when the last line is dismissed. opts: mood, pause (default false), name */
export function say(lines, opts = {}) {
  return new Promise(res => {
    lines = Array.isArray(lines) ? lines : [lines]; let i = 0;
    const key = "algo" + Math.random();
    if (opts.pause) { pause(key); activeKey = key; }
    const show = () => {
      clear(bubbleBox);
      if (i >= lines.length) { setMood("neutral"); if (opts.pause) { resume(key); if (activeKey === key) activeKey = null; } res(); return; }
      setMood(opts.mood || "talk");
      const b = h("div", { class: "bubble", onClick: () => { i++; show(); } }, h("span", { class: "nm" }, "Mr. Algo"), lines[i], h("span", { class: "next" }, i < lines.length - 1 ? "Tap to continue ▸" : "Tap to close ✓"),
        opts.intro ? h("button", { class: "btn b-grey sm", type: "button", style: { marginTop: ".3em", marginBottom: "0" }, onClick: e => { e.stopPropagation(); skipIntro(); res(); } }, "Skip intro") : null);
      bubbleBox.append(b);
    };
    show();
  });
}
export const sayNow = (text, mood_ = "talk") => say([text], { mood: mood_ });

/* ---------- spotlight ---------- */
const spot = () => document.getElementById("spot");
export function spotlight(id) {
  const s = spot(); clear(s); if (!id) { s.hidden = true; return; }
  const r = stationRect(id); if (!r) { s.hidden = true; return; }
  s.hidden = false; const pad = 16;
  s.append(h("div", { class: "hole", style: { left: r.x - pad + "px", top: r.y - pad + "px", width: r.w + pad * 2 + "px", height: r.h + pad * 2 + "px" } }),
    h("div", { class: "hand", style: { left: r.x + r.w / 2 - 20 + "px", top: r.y + r.h / 2 - 10 + "px" } }, "👆"));
  nudge(id, true);
}
export function endSpotlight() { const s = spot(); clear(s); s.hidden = true; D.room.stations.forEach(st => nudge(st.id, false)); }

/* ---------- guided start ---------- */
let waiting = null;
export async function startIntro() {
  if (!flag("intro") || S.intro.done) return;
  await runStep();
}
async function runStep() {
  const steps = D.intro.steps, i = S.intro.step;
  if (S.intro.done || i >= steps.length) { S.intro.done = true; endSpotlight(); return; }
  const st = steps[i];
  if (st.when === "doorSample" && !S.doorSamples.length) { if (Object.keys(S.samples).length) { S.intro.step++; return runStep(); } waiting = null; return; }
  waiting = st.wait || null;
  if (st.spot) spotlight(st.spot); else endSpotlight();
  await say(st.say, { mood: st.mood, pause: !st.wait, intro: true });
  if (!st.wait) { S.intro.step++; endSpotlight(); runStep(); }
}
function advanceIntro(ev) {
  if (!waiting || waiting !== ev || S.intro.done) return;
  waiting = null; endSpotlight(); S.intro.step++;
  setTimeout(runStep, 600);
}
export function skipIntro() { S.intro.done = true; waiting = null; endSpotlight(); clear(bubbleBox); if (activeKey) { resume(activeKey); activeKey = null; } }
/* The next sample step needs the sample to have arrived. */
on("sample:arrived", () => { if (!S.intro.done && waiting == null && S.intro.step === 3) runStep(); });

/* ---------- hints ---------- */
const CONDS = {
  hasSampleEver: () => Object.keys(S.samples).length > 0, samplePending: () => S.samplePending.length > 0,
  doorItems: () => S.doorSamples.length + S.doorBoxes.length > 0, hasPost: () => S.posts.length > 0, hasProduct: () => Object.keys(S.samples).length > 0 || Object.values(S.boxes).some(v => v > 0),
  livePost: () => S.posts.some(p => !p.done), donePost: () => S.posts.some(p => p.done && !p.looked), lowEnergy: () => flag("energy") && S.energy < 25
};
export function hint() {
  const hs = D.intro.hints;
  const m = hs.find(x => x.if.every(c => (c.startsWith("!") ? !CONDS[c.slice(1)]() : CONDS[c](c))));
  say([m ? m.text : "Keep reading the feeds."], { mood: m ? m.mood : "neutral" });
}
