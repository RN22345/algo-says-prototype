/* MR. ALGO. A bottom-left bar: the robot (face by mood) and a speech bubble. say(lines, {mood}) shows lines one by one and returns a promise.
   The bubble never blocks clicks (only its Next button does). It advances by itself after a few seconds, and goes away when the goal changes
   (post, sample, studio, gear). A station click always opens the station and dismisses a hint bubble.
   Also: the guided start (data/intro.json) with a spotlight (on a station, then on the Request sample button while the PC is open),
   and hints on request (Mr. Algo station or tap his face).
   Events in: station:click, studio:open, sample:*, post:created, modal:open, modal:close, browser:opened. */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { pause, resume } from "../core/clock.js";
import { h, clear, modalCount, toFrame } from "./ui.js";
import { stationRect, nudge } from "./room.js";
import { artUrl } from "../core/assets.js";

const AUTO_MS = 9000, AUTO_WAIT_MS = 15000;
let face, bubbleBox, mood = "neutral", cur = null;

export function initAlgo() {
  const root = document.getElementById("algo");
  face = h("img", { class: "face", src: artUrl("algo_neutral"), alt: "Mr. Algo", draggable: false, onClick: () => hint() });
  bubbleBox = h("div", { style: { display: "contents" } });
  root.append(h("div", { class: "bar" }, face, bubbleBox));
  on("station:click", ({ id }) => { if (id === "algo") hint(); else dismissHint(); });
  for (const ev of ["studio:open", "sample:taken", "gear:changed", "post:created"]) on(ev, dismissHint);
  on("studio:open", () => advanceIntro("studio:open"));
  on("sample:requested", () => advanceIntro("sample:requested"));
  on("sample:taken", () => advanceIntro("sample:taken"));
  on("stock:order", o => { if (o && o.ok) advanceIntro("stock:ordered"); });
  on("browser:opened", () => { if (waiting === "stock:ordered") { elOverride = () => document.querySelector(".bview .btn.b-gold.sm"); setTimeout(drawSpot, 350); } });
  on("newgame", () => { setMood("neutral"); dismiss(); });
  on("post:created", () => { if (S.posts.length === 1) say(["Posted! Now time does the work. Views come in waves.", "Followers see it first. Then strangers decide how far it goes.", "Results show up on your phone in about half an hour of game time."], { mood: "happy" }); });
  on("modal:open", () => { if (!elOverride) hideSpot(); });
  on("modal:close", () => { if (modalCount() === 0) { elOverride = null; drawSpot(); } });
  on("browser:opened", () => { if (waiting === "sample:requested") { elOverride = () => document.querySelector(".bview .tile .btn.b-orange"); setTimeout(drawSpot, 350); } });
  setInterval(() => { if (elOverride) drawSpot(); }, 300);
  on("sample:arrived", () => { if (!S.intro.done && waiting == null && S.mode !== "reseller" && S.intro.step === 3) runStep(); });
}
export function setMood(m) { mood = m; face.src = artUrl("algo_" + m); }

/* ---------- bubble ---------- */
function dismiss() {
  if (!cur) return; const c = cur; cur = null; clearTimeout(c.timer); clear(bubbleBox); setMood("neutral");
  if (c.key) resume(c.key); c.res();
}
function dismissHint() { if (cur && !cur.opts.intro) dismiss(); }

/* Show lines. Resolves when the last line is dismissed. opts: mood, pause, intro, wait */
export function say(lines, opts = {}) {
  dismiss();
  return new Promise(res => {
    lines = Array.isArray(lines) ? lines : [lines];
    const c = cur = { res, opts, i: 0, key: null, timer: null };
    if (opts.pause) { c.key = "algo" + Math.random(); pause(c.key); }
    const show = () => {
      if (cur !== c) return;
      clearTimeout(c.timer); clear(bubbleBox);
      if (c.i >= lines.length) { dismiss(); return; }
      setMood(opts.mood || "talk");
      const last = c.i >= lines.length - 1;
      bubbleBox.append(h("div", { class: "bubble" }, h("span", { class: "nm" }, "Mr. Algo"), lines[c.i],
        h("div", { class: "brow" },
          opts.intro ? h("button", { class: "btn b-grey sm", type: "button", onClick: () => skipIntro() }, "Skip intro") : null,
          h("button", { class: "btn b-blue sm", type: "button", onClick: () => { c.i++; show(); } }, last ? "Close ✓" : "Next ▸"))));
      c.timer = setTimeout(() => { c.i++; show(); }, opts.wait ? AUTO_WAIT_MS : AUTO_MS);
    };
    show();
  });
}

/* ---------- spotlight ---------- */
let spotStation = null, elOverride = null, spotHidden = false;
const spot = () => document.getElementById("spot");
export function spotlight(id) { spotStation = id; drawSpot(); }
function hideSpot() { const s = spot(); clear(s); s.hidden = true; }
function drawSpot() {
  const s = spot(); let r = null;
  if (elOverride) {
    const el = elOverride();
    if (el) { const b = el.getBoundingClientRect(), [x0, y0] = toFrame(b.left, b.top), [x1, y1] = toFrame(b.right, b.bottom); r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
  } else if (spotStation && modalCount() === 0) r = stationRect(spotStation);
  if (!r) { hideSpot(); return; }
  clear(s); s.hidden = false; const pad = 12;
  s.append(h("div", { class: "hole", style: { left: r.x - pad + "px", top: r.y - pad + "px", width: r.w + pad * 2 + "px", height: r.h + pad * 2 + "px" } }),
    h("div", { class: "hand", style: { left: r.x + r.w / 2 - 20 + "px", top: r.y + r.h / 2 - 10 + "px" } }, "👆"));
  if (spotStation && !elOverride) nudge(spotStation, true);
}
export function endSpotlight() { D.room.stations.forEach(st => nudge(st.id, false)); spotStation = null; elOverride = null; hideSpot(); }

/* ---------- guided start ---------- */
let waiting = null;
export async function startIntro() {
  if (!flag("intro") || S.intro.done) return;
  await runStep();
}
async function runStep() {
  const steps = introSteps(), i = S.intro.step;
  if (S.intro.done || i >= steps.length) { S.intro.done = true; endSpotlight(); return; }
  const st = steps[i];
  if (st.when === "doorSample" && !S.doorSamples.length) { if (Object.keys(S.samples).length) { S.intro.step++; return runStep(); } waiting = null; return; }
  waiting = st.wait || null;
  if (st.spot) spotlight(st.spot); else endSpotlight();
  await say(st.say, { mood: st.mood, pause: !st.wait, intro: true, wait: !!st.wait });
  if (!st.wait && !S.intro.done) { S.intro.step++; endSpotlight(); runStep(); }
}
function advanceIntro(ev) {
  if (!waiting || waiting !== ev || S.intro.done) return;
  waiting = null; endSpotlight(); S.intro.step++;
  setTimeout(runStep, 600);
}
const introSteps = () => (S.mode === "reseller" && D.intro.stepsReseller) ? D.intro.stepsReseller : D.intro.steps;
export function skipIntro() { S.intro.done = true; waiting = null; endSpotlight(); dismiss(); }

/* ---------- hints ---------- */
const CONDS = {
  hasSampleEver: () => Object.keys(S.samples).length > 0, samplePending: () => S.samplePending.length > 0,
  doorItems: () => S.doorSamples.length + S.doorBoxes.length > 0, hasPost: () => S.posts.length > 0, hasProduct: () => Object.keys(S.samples).length > 0 || Object.values(S.boxes).some(v => v > 0),
  livePost: () => S.posts.some(p => !p.done), donePost: () => S.posts.some(p => p.done && !p.looked), lowEnergy: () => flag("energy") && S.energy < 25
};
export function hint() {
  if (cur && cur.opts.intro) return;
  const hs = D.intro.hints;
  const m = hs.find(x => x.if.every(c => (c.startsWith("!") ? !CONDS[c.slice(1)]() : CONDS[c](c))));
  say([m ? m.text : "Keep reading the feeds."], { mood: m ? m.mood : "neutral" });
}
