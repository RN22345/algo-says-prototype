/* HUD: stat pills (cash, followers, trust, energy), clock and day, phone button, sound, full screen, dev button, goal line.
   Updates on bus events (cash:changed, energy:changed, followers:changed, trust:changed, inbox:changed) and each frame for the clock. */
import { D } from "../core/data.js";
import { S, flag, fmtMoney } from "../core/state.js";
import { fmt, dayNo } from "../core/clock.js";
import { on, emit } from "../core/bus.js";
import { h } from "./ui.js";
import { isMuted, setMuted } from "../core/sound.js";
import { toggleFull } from "../core/fit.js";

let el = {};
export function initHud() {
  const root = document.getElementById("hud");
  el.cash = h("span", {}, ""); el.fol = h("span", {}, ""); el.trust = h("span", {}, ""); el.en = h("i", {}); el.enT = h("span", {}, "");
  el.clk = h("div", { class: "clk" }); el.day = h("div", { class: "day" });
  el.badge = h("span", { class: "badge", hidden: true });
  el.phone = h("button", { class: "rbtn o", type: "button", "aria-label": "Phone", onClick: () => emit("phone:toggle") }, "📱", el.badge);
  el.snd = h("button", { class: "rbtn g", type: "button", "aria-label": "Sound", onClick: () => { setMuted(!isMuted()); sync(); } }, "🔊");
  el.full = h("button", { class: "rbtn g", type: "button", "aria-label": "Full screen", onClick: toggleFull }, "⛶");
  el.energyPill = h("div", { class: "pill energy" }, h("span", { class: "ic", style: { background: "var(--green)" } }, "⚡"), h("div", { class: "ebar" }, el.en), el.enT);
  const tl = h("div", { class: "tl" },
    h("div", { class: "pill" }, h("span", { class: "ic" }, "₱"), el.cash),
    h("div", { class: "pill" }, h("span", { class: "ic", style: { background: "var(--teal)" } }, "👥"), el.fol),
    h("div", { class: "pill" }, h("span", { class: "ic", style: { background: "var(--red)", color: "#fff" } }, "♥"), el.trust, h("small", {}, "Trust")),
    el.energyPill);
  const tc = h("div", { class: "tc" }, el.clk, el.day);
  const tr = h("div", { class: "tr" }, el.full, el.snd, el.phone);
  el.goal = h("div", { class: "goal" });
  root.append(tl, tc, tr, el.goal);
  for (const ev of ["cash:changed", "energy:changed", "followers:changed", "trust:changed", "inbox:changed", "flag:changed", "newgame", "stock:changed", "post:created", "sample:taken", "gear:changed"]) on(ev, sync);
  on("frame", clock);
  sync(); clock();
}
function clock() {
  const t = fmt(), d = "Day " + dayNo();
  if (el.clk.textContent !== t) el.clk.textContent = t;
  if (el.day.textContent !== d) el.day.textContent = d;
}
function sync() {
  el.cash.textContent = fmtMoney(S.cash);
  el.fol.textContent = `${S.followers.tiktik} TikTik · ${S.followers.youview} YouView`;
  el.trust.textContent = Math.round(S.trust);
  const max = D.time.energy.max;
  el.en.style.width = Math.max(0, S.energy / max * 100) + "%"; el.enT.textContent = Math.round(S.energy);
  el.energyPill.classList.toggle("low", S.energy < 20);
  el.energyPill.style.display = flag("energy") ? "" : "none";
  const un = S.inbox.filter(m => !m.read).length;
  el.badge.hidden = un === 0; el.badge.textContent = un;
  el.snd.textContent = isMuted() ? "🔇" : "🔊";
  const rent = S.rent.due > 0 && flag("rent") ? ` Rent due: ${fmtMoney(S.rent.due)}.` : "";
  el.goal.innerHTML = goalText() + (rent ? `<br><b>${rent}</b>` : "");
}
/* A short line about what to do next. Not a grade. */
function goalText() {
  if (!S.posts.length) {
    if (!Object.keys(S.samples).length && !S.samplePending.length && !S.doorSamples.length) return "<b>Goal:</b> Request a free sample at the desk PC.";
    if (S.doorSamples.length) return "<b>Goal:</b> A sample is at the door. Take it in.";
    if (S.samplePending.length) return "<b>Goal:</b> Your sample is on its way. Browse the feeds.";
    return "<b>Goal:</b> Film your sample at the filming corner and post it.";
  }
  return "<b>Goal:</b> Grow. Read the market, post, and learn what works.";
}
