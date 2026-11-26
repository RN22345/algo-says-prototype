/* HUD (D-109, redesigned). Soft glass panels that sit lightly on the world and step back while you play.
   Top left: one stat strip (cash, followers on each site, trust, energy). Under it: the goal line (click to fold it to a chip).
   Top right: the clock (sun or moon, time, day) and round bell and settings buttons. Bottom right: a dock with Bag (I), Phone (P)
   and Move furniture (M). Hover any stat for what it means.
   Calm mode: while the player walks for a moment, the panels fade back; any change (cash, orders, messages) brings them up again.
   H hides the HUD down to the clock; H again brings it back (also in Settings).
   Unity: one UI Toolkit document; the stat strip, clock and dock are VisualElements styled from the same tokens (css/ui2.css :root).
   Events in: cash/energy/followers/trust/inbox/order/stock changes, frame, modal:open, layout:mode. Events out: phone:toggle, phone:open, bag:toggle, layout:toggle. */
import { D } from "../core/data.js";
import { S, flag, fmtMoney } from "../core/state.js";
import { fmt, dayNo, tod } from "../core/clock.js";
import { on, emit } from "../core/bus.js";
import { h } from "./ui.js";
import { ic } from "./icons.js";
import { pl } from "./player.js";
import { isMuted, setMuted, musicEnabled, setMusic } from "../core/sound.js";
import { toggleFull } from "../core/fit.js";
import { wipe } from "../core/save.js";

let el = {}, menuOpen = false, confirmNew = false, root = null, hidden = false, wakeUntil = 0, walkSince = 0, goalFold = false, lastGoal = "";

const stat = (icon, cls, tip, ...kids) => h("div", { class: "st " + cls, title: tip }, h("span", { class: "si" }, ic(icon)), h("div", { class: "sv" }, ...kids));
const rbtn = (icon, label, cls, fn) => h("button", { class: "gbtn " + cls, type: "button", "aria-label": label, title: label, onClick: fn }, ic(icon), h("span", { class: "nb", hidden: true }));

export function initHud() {
  root = document.getElementById("hud");
  el.cash = h("b", {}, ""); el.tt = h("b", {}, ""); el.yv = h("b", {}, ""); el.trust = h("b", {}, ""); el.en = h("i", {}); el.enT = h("b", {}, "");
  el.energy = stat("bolt", "energy", "Energy: what you can still do today. Rest at the bed.", h("div", { class: "ebar" }, el.en), el.enT);
  el.stats = h("div", { class: "hstats glass" },
    stat("coin", "cash", "Cash on hand", el.cash),
    stat("users", "fol", "Followers on TikTik and YouView", el.tt, h("small", {}, "TikTik"), h("span", { class: "dv" }), el.yv, h("small", {}, "YouView")),
    stat("shield", "trust", "Trust: buyers' faith in your shop", el.trust),
    el.energy);
  el.goalT = h("span", { class: "gt" });
  el.goal = h("button", { class: "hgoal glass", type: "button", title: "Your next step. Click to fold.", onClick: () => { goalFold = !goalFold; el.goal.classList.toggle("fold", goalFold); } }, h("span", { class: "gi" }, ic("flag")), el.goalT);
  el.sky = h("span", { class: "ci" }); el.clk = h("b", {}, ""); el.day = h("small", {}, "");
  el.clock = h("div", { class: "hclock glass", title: "Game time. Days run 6:00 to midnight." }, el.sky, h("div", { class: "cv" }, el.clk, el.day), h("div", { class: "dayarc" }, el.arc = h("i")));
  el.bell = rbtn("bell", "Messages", "bell", () => emit("phone:open", { tab: "inbox" }));
  el.set = rbtn("gear", "Settings", "set", () => toggleMenu());
  el.menu = h("div", { class: "hud-menu glass", hidden: true });
  el.tr = h("div", { class: "htr" }, el.clock, el.bell, el.set, el.menu);
  const dk = (icon, label, key, fn) => h("button", { class: "dk", type: "button", "aria-label": label, title: `${label} (${key})`, onClick: fn }, ic(icon), h("span", { class: "dl" }, label), h("span", { class: "nb", hidden: true }));
  el.bag = dk("bag", "Bag", "I", () => emit("bag:toggle"));
  el.phoneB = dk("phone", "Phone", "P", () => emit("phone:toggle"));
  el.move = dk("move", "Move", "M", () => emit("layout:toggle"));
  el.dock = h("div", { class: "hdock glass" }, el.bag, el.phoneB, el.move);
  root.append(h("div", { class: "htl" }, el.stats, el.goal), el.tr, el.dock);
  document.addEventListener("pointerdown", e => { if (menuOpen && !e.target.closest(".hud-menu") && !e.target.closest(".gbtn.set")) toggleMenu(false); });
  for (const ev of ["cash:changed", "energy:changed", "followers:changed", "trust:changed", "inbox:changed", "flag:changed", "newgame", "stock:changed", "post:created", "sample:taken", "gear:changed", "order:new", "order:packed", "order:paid"]) on(ev, () => { sync(); wake(); });
  on("frame", clock);
  on("modal:open", () => toggleMenu(false));
  on("layout:mode", m => el.move.classList.toggle("on", !!m));
  root.addEventListener("pointerenter", wake, true);
  window.addEventListener("keydown", e => {
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey || !S.started) return;
    const k = e.key.toLowerCase();
    if (k === "h") setHidden(!hidden);
    if (k === "p" && !document.querySelector("#modals .modal-back")) emit("phone:toggle");
    if (k === "m" && !document.querySelector("#modals .modal-back, #pc .modal-back")) emit("layout:toggle");
  });
  setInterval(calm, 250);
  sync(); clock();
}
function setHidden(v) { hidden = v; root.classList.toggle("hidden", hidden); if (menuOpen) drawMenu(); }
/* Fade the panels back after a moment of walking; wake them on any change. */
function wake() { wakeUntil = performance.now() + 2500; root.classList.remove("calm"); }
function calm() {
  const now = performance.now();
  if (pl.moving) { if (!walkSince) walkSince = now; } else walkSince = 0;
  root.classList.toggle("calm", !!walkSince && now - walkSince > 1200 && now > wakeUntil && !menuOpen);
}
function clock() {
  const t = fmt(), d = "Day " + dayNo(), m = tod(), dayT = m >= 360 && m < 1080;
  if (el.clk.textContent !== t) el.clk.textContent = t;
  if (el.day.textContent !== d) el.day.textContent = d;
  if (el.sky.dataset.k !== String(dayT)) { el.sky.dataset.k = String(dayT); el.sky.replaceChildren(ic(dayT ? "sun" : "moon")); el.clock.classList.toggle("night", !dayT); }
  el.arc.style.width = Math.max(0, Math.min(100, (m - 360) / (1440 - 360) * 100)) + "%";
}
function badge(btn, n) { const b = btn.querySelector(".nb"); b.hidden = !n; b.textContent = n || ""; }
function sync() {
  el.cash.textContent = fmtMoney(S.cash);
  el.tt.textContent = S.followers.tiktik; el.yv.textContent = S.followers.youview;
  el.trust.textContent = Math.round(S.trust);
  const max = D.time.energy.max;
  el.en.style.width = Math.max(0, S.energy / max * 100) + "%"; el.enT.textContent = Math.round(S.energy);
  el.energy.classList.toggle("low", S.energy < 20);
  el.energy.hidden = !flag("energy");
  const un = S.inbox.filter(m => !m.read).length;
  badge(el.bell, un); badge(el.phoneB, un);
  badge(el.bag, S.orders.filter(o => o.status === "toPack" || o.status === "picked").length + S.doorBoxes.length + S.doorSamples.length);
  const rent = S.rent.due > 0 && flag("rent") ? ` Rent due: ${fmtMoney(S.rent.due)}.` : "";
  const g = goalText() + rent;
  if (g !== lastGoal) { lastGoal = g; el.goalT.textContent = g; if (goalFold) { goalFold = false; el.goal.classList.remove("fold"); } el.goal.classList.remove("new"); void el.goal.offsetWidth; el.goal.classList.add("new"); }
}

/* ---------- settings ---------- */
function toggleMenu(force) {
  menuOpen = force === undefined ? !menuOpen : force; confirmNew = false; el.menu.hidden = !menuOpen;
  if (menuOpen) drawMenu();
}
function drawMenu() {
  el.menu.replaceChildren();
  const row = (icon, label, state, fn, cls = "") => h("button", { class: "mrow " + cls, type: "button", onClick: fn }, ic(icon), h("span", {}, label), state != null ? h("b", {}, state) : null);
  el.menu.append(h("div", { class: "mh" }, "Settings"),
    row("sound", "Sound effects", isMuted() ? "Off" : "On", () => { setMuted(!isMuted()); drawMenu(); }),
    row("music", "Music", musicEnabled() ? "On" : "Off", () => { setMusic(!musicEnabled()); drawMenu(); }),
    row("eye", "Show HUD (H)", hidden ? "Off" : "On", () => setHidden(!hidden)),
    row("expand", "Full screen", null, () => { toggleFull(); toggleMenu(false); }),
    confirmNew ? h("div", { class: "mconf" }, h("div", {}, "Erase this game and start again?"),
      h("div", { class: "row" }, h("button", { class: "btn b-red sm", type: "button", onClick: () => { wipe(); location.reload(); } }, "Yes, new game"), h("button", { class: "btn b-grey sm", type: "button", onClick: () => { confirmNew = false; drawMenu(); } }, "Keep playing")))
      : row("restart", "New game", null, () => { confirmNew = true; drawMenu(); }, "danger"));
}

/* A short line about what to do next. Not a grade. */
function goalText() {
  if (!S.posts.length && S.mode === "reseller") {
    const shelf = S.shelves.some(sh => sh.some(Boolean)), boxes = Object.values(S.boxes).some(v => v > 0);
    if (S.doorBoxes.length) return "The supplier left boxes at the door. Take them in.";
    if (shelf) return "Film a product at the filming corner and post it.";
    if (boxes) return "Put your stock on the shelves.";
    if (S.deliveries.length) return "Your stock arrives at 9:00. Browse the feeds meanwhile.";
    return "Order stock on the Supplier site at the desk PC.";
  }
  if (!S.posts.length) {
    if (!Object.keys(S.samples).length && !S.samplePending.length && !S.doorSamples.length) return "Request a free sample at the desk PC.";
    if (S.doorSamples.length) return "A sample is at the door. Take it in.";
    if (S.samplePending.length) return "Your sample is on its way. Browse the feeds.";
    return "Film your sample at the filming corner and post it.";
  }
  return "Grow. Read the market, post, and learn what works.";
}
