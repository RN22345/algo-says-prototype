/* PHONE (D-107). A phone held in the hand: rounded body, bezel, camera notch, status bar (game clock, signal, battery), home screen with app icons,
   home bar. It slides up from the bottom right. Apps open full screen inside the phone with a back arrow; the home bar goes home (and closes the phone from home).
   Apps: Messages, TikTik, YouView, MarketPlaza (Orders before tier 2), Bank, Calendar, Playbook (js/ui/phone/*). Unread badges sit on the icons.
   Events in: phone:toggle, phone:open {tab|app}, modal:open (closes the phone unless keepPhone), inbox:changed, order:*, lesson:new, cash:changed, post:created, newgame, frame.
   Events out: open:results. Old tab ids map to apps: inbox, feeds, orders, wallet, playbook. */
import { S, flag, tier2On } from "../core/state.js";
import { fmt, dayNo } from "../core/clock.js";
import { on } from "../core/bus.js";
import { h, clear } from "./ui.js";
import { ic } from "./icons.js";

const ICON = { messages: "chat", tiktik: "play", youview: "video", orders: "box", shop: "bag", bank: "bank", calendar: "calendar", playbook: "book" };
import { messagesApp, ordersApp, bankApp, calendarApp, playbookApp } from "./phone/apps.js";
import { tiktikApp, youviewApp, feedCard } from "./phone/feedapp.js";
import { shopApp } from "./shopview.js";

export { feedCard };
const MAP = { inbox: "messages", feeds: "tiktik", orders: "shop", wallet: "bank", playbook: "playbook" };
let apps = [], el = {}, open = false, cur = null, backFn = null, lastClock = "";

const appList = () => [messagesApp, tiktikApp(), youviewApp(), ...(tier2On() ? [shopApp] : [ordersApp]), bankApp, calendarApp, ...(flag("playbook") ? [playbookApp] : [])];
export const isOpen = () => open;

export function initPhone() {
  const root = document.getElementById("phone");
  el.status = h("div", { class: "ph-status" }, el.clk = h("span", { class: "clk" }, fmt()),
    h("span", { class: "sys" }, h("span", { class: "sig" }, h("i"), h("i"), h("i"), h("i")), h("span", { class: "bat" }, h("i"))));
  el.app = h("div", { class: "ph-app" });
  el.home = h("div", { class: "ph-homebar", role: "button", "aria-label": "Home", onClick: homeBar }, h("i"));
  el.screen = h("div", { class: "ph-screen" }, h("div", { class: "ph-notch" }), el.status, el.app, el.home);
  el.phone = h("div", { class: "phone" }, h("div", { class: "ph-body" }, el.screen));
  root.append(el.phone);
  on("modal:open", (key, o) => { if (open && !(o && o.keepPhone)) toggle(false); });
  on("phone:toggle", () => toggle());
  on("phone:open", (o = {}) => {
    const id = o.app || MAP[o.tab] || o.tab;
    if (id && (id !== cur || id === "messages")) goApp(id, true); else if (!open && cur === null) goApp(null, true);
    toggle(true);
  });
  for (const ev of ["inbox:changed", "order:paid", "order:packed", "order:shipped", "order:new", "order:returned", "order:cancelled", "shop:changed", "courier:arrived", "courier:left", "lesson:new", "cash:changed", "post:created", "newgame", "stock:changed", "event:signal", "feed:post"]) on(ev, () => { if (open) render(); });
  on("frame", () => { if (!open) return; const t = fmt(); if (t !== lastClock) { lastClock = t; el.clk.textContent = t; if (cur === null) render(); } });
}
function toggle(force) {
  open = force === undefined ? !open : force; el.phone.classList.toggle("open", open);
  if (open) render();
}
function goApp(id, fromOutside) {
  const a = id && appList().find(x => x.id === id);
  if (a && a.enter && fromOutside) a.enter();
  cur = a ? a.id : null; render();
}
function homeBar() { if (cur === null) toggle(false); else goApp(null); }

function render() {
  const keep = el.scroll ? el.scroll.scrollTop : 0, sameApp = el.scroll && el.scroll.dataset.app === String(cur);
  apps = appList(); backFn = null; clear(el.app);
  if (cur !== null && !apps.some(a => a.id === cur)) cur = null;
  el.screen.classList.toggle("home", cur === null);
  if (cur === null) { drawHome(); return; }
  const a = apps.find(x => x.id === cur);
  el.head = h("div", { class: "ph-head" }); el.tabs = h("div", { class: "ph-tabs", hidden: true }); el.scroll = h("div", { class: "ph-scroll", "data-app": cur });
  el.app.append(el.head, el.tabs, el.scroll);
  const ctx = {
    scroll: el.scroll, refresh: render, go: id => goApp(id, true), setBack: fn => { backFn = fn; paintBack(); },
    setHead(title, o = {}) {
      el.head.style.background = o.bg || "#fff"; el.head.style.color = o.fg || "#fff"; el.screen.style.background = o.solid || "#fff"; el.screen.dataset.tone = o.fg === "#1c2452" ? "dark" : "light"; el.screen.classList.toggle("darkapp", !!o.dark);
      el.head.append(h("button", { class: "back", type: "button", "aria-label": "Back", onClick: () => (backFn ? backFn() : goApp(null)) }, ic("back")),
        h("div", { class: "ttl" + (o.brand ? " brand" : "") }, title, o.sub ? h("small", {}, o.sub) : null),
        ...(o.action ? [h("button", { class: "act", type: "button", onClick: o.action.fn }, o.action.label)] : []));
    },
    setTabs(list, curTab, pick) {
      el.tabs.hidden = false;
      for (const t of list) el.tabs.append(h("button", { class: "seg" + (t.id === curTab ? " on" : ""), type: "button", onClick: () => pick(t.id) }, t.label));
    }
  };
  a.draw(ctx);
  if (sameApp) el.scroll.scrollTop = keep;
}
function paintBack() { /* the back arrow always calls backFn when set; nothing to repaint */ }

function drawHome() {
  el.screen.style.background = ""; el.screen.dataset.tone = "light"; el.screen.classList.remove("darkapp"); el.scroll = null;
  const grid = h("div", { class: "ph-grid" });
  for (const a of apps) {
    const n = a.badge();
    grid.append(h("button", { class: "ph-ico", type: "button", "data-app": a.id, onClick: () => goApp(a.id, true) },
      h("span", { class: "itile", style: { background: `linear-gradient(150deg,${a.grad[0]},${a.grad[1]})` } }, ic(ICON[a.id] || "box"), n ? h("span", { class: "nb" }, n) : null),
      h("span", { class: "lb" }, a.label)));
  }
  el.app.append(h("div", { class: "ph-widget" }, h("div", { class: "t" }, fmt()), h("div", { class: "d" }, "Day " + dayNo())), grid,
    h("div", { class: "ph-foot" }, "Tap an app. The bar at the bottom goes home."));
}
