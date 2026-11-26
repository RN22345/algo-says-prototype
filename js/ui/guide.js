/* GUIDE. The first-run tutorial, from data/guide.json.
   A step is {id, goal, say, target, done, ready, waitGoal}. The current step is the first one whose done condition has not held yet
   (a held condition is latched in S.intro.ok, so the guide only moves forward, and a loaded game resumes in place).
   The guide never pauses the clock and never dims the screen: it sets the HUD goal line, says each step's line once, and pulses the
   thing to use (a station tag, the Phone button or an app icon, or a button inside a PC site or phone app).
   Hints: when the player asks Mr. Algo (algo:hint), the first hint in guide.json whose conditions hold is said.
   Events in: newgame, game:start, guide:skip, algo:hint, flag:changed. Events out: guide:changed.
   Unity: TutorialStep ScriptableObjects (same fields) and a TutorialRunner MonoBehaviour that polls a condition registry
   (Dictionary<string, Func<bool>>) and toggles a Highlight component on the target. */
import { D } from "../core/data.js";
import { S, flag, tier2On, isListed } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { fmt } from "../core/clock.js";
import { courierHere } from "../sim/shop.js";
import { say, busy } from "./algo.js";
import { nudge, indoors } from "./room.js";

const anyBox = () => Object.values(S.boxes).some(v => v > 0);
const shelfAny = () => S.shelves.some(sh => sh.some(Boolean));
const toPack = () => S.orders.some(o => o.status === "toPack" || o.status === "picked");

/* Condition registry. Each id is used by guide.json steps (done, ready) and hints (if). */
export const COND = {
  sampleAsked: () => S.samplePending.length + S.doorSamples.length + Object.keys(S.samples).length > 0,
  sampleHereOrIn: () => S.doorSamples.length + Object.keys(S.samples).length > 0,
  sampleIn: () => Object.keys(S.samples).length > 0,
  posted: () => S.posts.length > 0,
  postedOwn: () => S.posts.some(p => p.mode === "own"),
  analysed: () => S.posts.some(p => p.analysed),
  looked: () => (S.stats.looked || 0) > 0 || S.posts.some(p => p.looked),
  tier2: () => tier2On(),
  stockOrdered: () => S.deliveries.length + S.doorBoxes.length > 0 || anyBox() || shelfAny(),
  stockHereOrIn: () => S.doorBoxes.length > 0 || anyBox() || shelfAny(),
  stockIn: () => anyBox() || shelfAny(),
  shelfStocked: () => shelfAny(),
  listed: () => Object.values(S.shop.listings).some(l => l.on),
  orderWaiting: () => toPack(),
  packedEver: () => (S.stats.packed || 0) > 0,
  bookedEver: () => (S.stats.booked || 0) > 0,
  courierHere: () => !!courierHere(),
  shippedEver: () => (S.stats.shipped || 0) > 0,
  // hints
  hasSampleEver: () => Object.keys(S.samples).length > 0,
  samplePending: () => S.samplePending.length > 0,
  doorItems: () => S.doorSamples.length + S.doorBoxes.length > 0,
  hasPost: () => S.posts.length > 0,
  hasProduct: () => Object.keys(S.samples).length > 0 || anyBox() || shelfAny(),
  livePost: () => S.posts.some(p => !p.done),
  donePost: () => S.posts.some(p => p.done && !p.looked),
  lowEnergy: () => flag("energy") && S.energy < 25,
  unlistedStock: () => S.shelves.some(sh => sh.some(pid => pid && !isListed(pid)))
};
const test = c => c.startsWith("!") ? !COND[c.slice(1)]() : COND[c]();

/* Where a button lives inside the PC sites and phone apps. */
const UI = {
  "supplier.order": ".bview .sp-order", "affiliate.request": ".bview .aff-req", "toolshop.shelves": ".bview .ts-shelves",
  "shop.list": ".mp-list", "shop.pickup": ".mp-book"
};
const OUTDOOR = new Set(["door"]);

const steps = () => S.mode === "reseller" ? D.guide.reseller : [...D.guide.affiliate, ...D.guide.reseller];
const active = () => S.started && flag("intro") && !S.intro.done;
const fill = s => s.replace(/\{(\w+)\}/g, (m, k) => D.shop.pickup[k] != null ? fmt(D.shop.pickup[k]) : m);

let cur = null, ready = false, nudged = null, pulsed = new Set();

function current() {
  if (!S.intro.ok) S.intro.ok = {};
  for (const st of steps()) {
    if (S.intro.ok[st.id]) continue;
    if (COND[st.done]()) { S.intro.ok[st.id] = true; continue; }
    return st;
  }
  return null;
}

/* The HUD goal line while the guide runs, else null. */
export function guideGoal() {
  if (!active() || !cur) return null;
  return fill(ready ? cur.goal : (cur.waitGoal || cur.goal));
}

function evaluate() {
  if (!active()) { if (cur) { cur = null; unhighlight(); emit("guide:changed"); } return; }
  const st = current();
  if (!st) { finish(); return; }
  const rd = !st.ready || COND[st.ready]();
  if (st !== cur || rd !== ready) {
    cur = st; ready = rd; emit("guide:changed");
    if (ready) speak(st);
  }
  highlight();
}

function speak(st) {
  const lines = [];
  if (!S.intro.said.welcome) { S.intro.said.welcome = true; lines.push(...(D.guide.welcome[S.mode] || D.guide.welcome.affiliate)); }
  if (st.say && !S.intro.said[st.id]) { S.intro.said[st.id] = true; lines.push(fill(st.say)); }
  if (lines.length) say(lines, { mood: "talk", intro: true });
}

function finish() {
  S.intro.done = true; cur = null; unhighlight(); emit("guide:changed");
  say([D.guide.end], { mood: "happy" });
}

/* ---------- highlights ---------- */
function pulse(els) {
  for (const e of pulsed) if (!els.includes(e)) e.classList.remove("gpulse");
  for (const e of els) e.classList.add("gpulse");
  pulsed = new Set(els);
}
function setNudge(id) { if (nudged && nudged !== id) nudge(nudged, false); nudged = id; if (id) nudge(id, true); }
function unhighlight() { pulse([]); setNudge(null); }

function highlight() {
  if (!ready) { unhighlight(); return; }
  const t = cur.target || {};
  const pcOpen = !!document.querySelector("#frame.pc-open"), phoneOpen = !!document.querySelector("#phone .phone.open");
  const shown = e => e && (e.closest("#phone") ? phoneOpen : true) && e.getClientRects().length > 0;
  const uiEl = t.ui && [...document.querySelectorAll(UI[t.ui])].find(shown);
  if (uiEl) { pulse([uiEl]); setNudge(null); return; }
  if (t.app) {
    const ico = phoneOpen && document.querySelector(`#phone .ph-ico[data-app="${t.app}"]`);
    if (ico) { pulse([ico]); setNudge(null); return; }
    if (!t.station && !phoneOpen && !pcOpen) { const b = document.querySelector("#hud .dk.phone"); pulse(b ? [b] : []); setNudge(null); return; }
  }
  pulse([]);
  if (t.station && !pcOpen) setNudge(!indoors() && !OUTDOOR.has(t.station) ? "door" : t.station);
  else setNudge(null);
}

/* ---------- hints ---------- */
function hint() {
  if (busy()) return;
  if (active() && cur && ready) { say([fill(cur.goal)], { mood: "talk" }); return; }
  const m = D.guide.hints.find(x => x.if.every(test));
  say([m ? m.text : "Keep reading the feeds."], { mood: m ? m.mood : "neutral" });
}

export function skipGuide() { S.intro.done = true; cur = null; unhighlight(); emit("guide:changed"); }

export function initGuide() {
  on("newgame", () => { cur = null; ready = false; unhighlight(); });
  on("guide:skip", skipGuide);
  on("algo:hint", hint);
  on("flag:changed", n => { if (n === "intro") evaluate(); });
  setInterval(evaluate, 400);
}
