/* MR. ALGO. A bottom-left bar: the robot (face by mood) and a speech bubble. say(lines, {mood}) shows lines one by one and returns a promise.
   The bubble never blocks clicks (only its buttons do). It advances by itself after a few seconds. A station click dismisses a hint bubble.
   The first-run guide (guide.js) speaks through say() with opts.intro, which adds a "Skip guide" button and keeps the bubble up
   on station clicks. Asking for a hint (tap his face or his station) emits algo:hint; guide.js answers it.
   Events in: station:click, studio:open, sample:taken, gear:changed, post:created, newgame. Events out: algo:hint, guide:skip.
   Unity: an AlgoBar UI element with a Say(lines, mood) coroutine. */
import { on, emit } from "../core/bus.js";
import { pause, resume } from "../core/clock.js";
import { h, clear } from "./ui.js";
import { artUrl } from "../core/assets.js";

const AUTO_MS = 9000, AUTO_WAIT_MS = 15000;
let face, bubbleBox, mood = "neutral", cur = null;

export function initAlgo() {
  const root = document.getElementById("algo");
  face = h("img", { class: "face", src: artUrl("algo_neutral"), alt: "Mr. Algo", draggable: false, onClick: () => emit("algo:hint") });
  bubbleBox = h("div", { style: { display: "contents" } });
  root.append(h("div", { class: "bar" }, face, bubbleBox));
  on("station:click", ({ id }) => { if (id === "algo") emit("algo:hint"); else dismissHint(); });
  for (const ev of ["studio:open", "sample:taken", "gear:changed", "post:created"]) on(ev, dismissHint);
  on("newgame", () => { setMood("neutral"); dismiss(); });
  on("guide:skip", () => { if (cur && cur.opts.intro) dismiss(); });
  on("post:created", p => { if (S_posts() === 1) say(["Posted! Now time does the work. Views come in waves.", "Followers see it first. Then strangers decide how far it goes."], { mood: "happy" }); });
}
let S_posts = () => 0;
export const setPostCount = f => { S_posts = f; };
export function setMood(m) { mood = m; face.src = artUrl("algo_" + m); }
/* Is a guide line on screen? (hints wait for it) */
export const busy = () => !!(cur && cur.opts.intro);

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
          opts.intro ? h("button", { class: "btn b-grey sm", type: "button", onClick: () => emit("guide:skip") }, "Skip guide") : null,
          h("button", { class: "btn b-blue sm", type: "button", onClick: () => { c.i++; show(); } }, last ? "Close ✓" : "Next ▸"))));
      c.timer = setTimeout(() => { c.i++; show(); }, opts.wait ? AUTO_WAIT_MS : AUTO_MS);
    };
    show();
  });
}
