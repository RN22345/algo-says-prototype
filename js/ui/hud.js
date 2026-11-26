/* HUD (D-109), styled after the artist's mockup. Top left: pills for cash, followers, trust and energy, each with a round icon badge on its left end.
   Under them: the goal board (ui_board.png). Top right: DAY pill, clock pill, round bell (opens the phone on Messages) and settings (sound, music, full screen, new game).
   Right edge: Parcel (opens the bag, js/ui/inventory.js) and Phone buttons with labels. Icons come from img/v/ic_*.png and fall back to emoji.
   Updates on bus events and each frame for the clock. Events out: phone:toggle, phone:open, bag:toggle. */
import { D } from "../core/data.js";
import { S, flag, fmtMoney } from "../core/state.js";
import { fmt, dayNo } from "../core/clock.js";
import { on, emit } from "../core/bus.js";
import { h, icon, vHas } from "./ui.js";
import { isMuted, setMuted, musicEnabled, setMusic } from "../core/sound.js";
import { toggleFull } from "../core/fit.js";
import { wipe } from "../core/save.js";

let el = {}, menuOpen = false, confirmNew = false;

/* A chunky pill with a round icon badge. kids go in the body. */
const pill = (ic, emoji, cls, ...kids) => h("div", { class: "hp " + cls }, h("span", { class: "hp-badge" }, icon(ic, emoji)), h("div", { class: "hp-body" }, ...kids));
const rbtn = (ic, emoji, label, cls, fn) => h("button", { class: "hr " + cls, type: "button", "aria-label": label, title: label, onClick: fn }, icon(ic, emoji), h("span", { class: "nb", hidden: true }));
const big = (ic, emoji, label, cls, fn) => h("button", { class: "hb " + cls, type: "button", "aria-label": label, onClick: fn }, h("span", { class: "hb-i" }, icon(ic, emoji), h("span", { class: "nb", hidden: true })), h("span", { class: "hb-l" }, label));

export function initHud() {
  const root = document.getElementById("hud");
  el.cash = h("b", {}, ""); el.tt = h("b", {}, ""); el.yv = h("b", {}, ""); el.trust = h("b", {}, ""); el.en = h("i", {}); el.enT = h("b", {}, "");
  el.clk = h("b", {}, ""); el.day = h("b", {}, "");
  el.energy = pill("energy", "⚡", "energy", h("div", { class: "ebar" }, el.en), el.enT);
  const tl = h("div", { class: "tl" },
    pill("cash", "₱", "cash", el.cash),
    pill("followers", "👥", "fol", el.tt, h("small", {}, "TikTik"), el.yv, h("small", {}, "YouView")),
    pill("trust", "🤝", "trust", el.trust, h("small", {}, "Trust")),
    el.energy);
  el.bell = rbtn("bell", "🔔", "Messages", "bell", () => emit("phone:open", { tab: "inbox" }));
  el.set = rbtn("settings", "⚙️", "Settings", "set", () => toggleMenu());
  el.menu = h("div", { class: "hud-menu", hidden: true });
  const tr = h("div", { class: "tr" }, pill("day", "📅", "day", el.day), pill("clock", "⏰", "clock", el.clk), el.bell, el.set, el.menu);
  el.parcel = big("parcel", "📦", "Parcel", "parcel", () => emit("bag:toggle"));
  el.phoneB = big("phone", "📱", "Phone", "phoneb", () => emit("phone:toggle"));
  const rail = h("div", { class: "hrail" }, el.parcel, el.phoneB);
  el.goal = h("div", { class: "goalb css" }, h("div", { class: "goal" }));
  root.append(tl, tr, rail, el.goal);
  vHas("ui_board").then(ok => { if (ok) el.goal.classList.remove("css"); });
  vHas("ui_pill").then(ok => { if (ok) root.classList.add("pillart"); });
  document.addEventListener("pointerdown", e => { if (menuOpen && !e.target.closest(".hud-menu") && !e.target.closest(".hr.set")) toggleMenu(false); });
  for (const ev of ["cash:changed", "energy:changed", "followers:changed", "trust:changed", "inbox:changed", "flag:changed", "newgame", "stock:changed", "post:created", "sample:taken", "gear:changed", "order:new", "order:packed", "order:paid"]) on(ev, sync);
  on("frame", clock);
  on("modal:open", () => toggleMenu(false));
  sync(); clock();
}
function clock() {
  const t = fmt(), d = "DAY " + dayNo();
  if (el.clk.textContent !== t) el.clk.textContent = t;
  if (el.day.textContent !== d) el.day.textContent = d;
}
function badge(btn, n) { const b = btn.querySelector(".nb"); b.hidden = !n; b.textContent = n || ""; }
function sync() {
  el.cash.textContent = fmtMoney(S.cash);
  el.tt.textContent = S.followers.tiktik; el.yv.textContent = S.followers.youview;
  el.trust.textContent = Math.round(S.trust);
  const max = D.time.energy.max;
  el.en.style.width = Math.max(0, S.energy / max * 100) + "%"; el.enT.textContent = Math.round(S.energy);
  el.energy.classList.toggle("low", S.energy < 20);
  el.energy.style.display = flag("energy") ? "" : "none";
  const un = S.inbox.filter(m => !m.read).length;
  badge(el.bell, un); badge(el.phoneB, un);
  badge(el.parcel, S.orders.filter(o => o.status === "toPack" || o.status === "picked").length + S.doorBoxes.length + S.doorSamples.length);
  const rent = S.rent.due > 0 && flag("rent") ? ` Rent due: ${fmtMoney(S.rent.due)}.` : "";
  el.goal.firstChild.innerHTML = goalText() + (rent ? `<br><b>${rent}</b>` : "");
}

/* ---------- settings ---------- */
function toggleMenu(force) {
  menuOpen = force === undefined ? !menuOpen : force; confirmNew = false; el.menu.hidden = !menuOpen;
  if (menuOpen) drawMenu();
}
function drawMenu() {
  el.menu.replaceChildren();
  const row = (label, state, fn, cls = "") => h("button", { class: "mrow " + cls, type: "button", onClick: fn }, h("span", {}, label), state != null ? h("b", {}, state) : null);
  el.menu.append(h("div", { class: "mh" }, "Settings"),
    row("Sound effects", isMuted() ? "Off" : "On", () => { setMuted(!isMuted()); drawMenu(); }),
    row("Music", musicEnabled() ? "On" : "Off", () => { setMusic(!musicEnabled()); drawMenu(); }),
    row("Full screen", null, () => { toggleFull(); toggleMenu(false); }),
    confirmNew ? h("div", { class: "mconf" }, h("div", {}, "Erase this game and start again?"),
      h("div", { class: "row" }, h("button", { class: "btn b-red sm", type: "button", onClick: () => { wipe(); location.reload(); } }, "Yes, new game"), h("button", { class: "btn b-grey sm", type: "button", onClick: () => { confirmNew = false; drawMenu(); } }, "Keep playing")))
      : row("New game", null, () => { confirmNew = true; drawMenu(); }, "danger"));
}

/* A short line about what to do next. Not a grade. */
function goalText() {
  if (!S.posts.length && S.mode === "reseller") {
    const shelf = S.shelves.some(sh => sh.some(Boolean)), boxes = Object.values(S.boxes).some(v => v > 0);
    if (S.doorBoxes.length) return "<b>Goal:</b> The supplier left boxes at the door. Take them in.";
    if (shelf) return "<b>Goal:</b> Film a product at the filming corner and post it.";
    if (boxes) return "<b>Goal:</b> Put your stock on the shelves.";
    if (S.deliveries.length) return "<b>Goal:</b> Your stock arrives at 9:00. Browse the feeds meanwhile.";
    return "<b>Goal:</b> Order stock on the Supplier site at the desk PC.";
  }
  if (!S.posts.length) {
    if (!Object.keys(S.samples).length && !S.samplePending.length && !S.doorSamples.length) return "<b>Goal:</b> Request a free sample at the desk PC.";
    if (S.doorSamples.length) return "<b>Goal:</b> A sample is at the door. Take it in.";
    if (S.samplePending.length) return "<b>Goal:</b> Your sample is on its way. Browse the feeds.";
    return "<b>Goal:</b> Film your sample at the filming corner and post it.";
  }
  return "<b>Goal:</b> Grow. Read the market, post, and learn what works.";
}
