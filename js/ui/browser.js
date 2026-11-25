/* DESK PC BROWSER. A window with one tab per website (data/sites.json "browser"): TikTik, YouView, Affiliate catalogue, Seller Hub, Tool Shop, Supplier.
   Each site page lives in js/ui/sites/. Pages re-render when state they show changes. The clock keeps running while the PC is open.
   Events in: open:browser {tab}. Events out: open:studio. */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { on } from "../core/bus.js";
import { h, clear, modal } from "./ui.js";
import * as social from "./sites/social.js";
import * as affiliate from "./sites/affiliate.js";
import * as hub from "./sites/hub.js";
import * as toolshop from "./sites/toolshop.js";
import * as supplier from "./sites/supplier.js";

const PAGES = { site: social, affiliate, hub, toolshop, supplier };
let win = null, tab = "tiktik", view = null, tabsEl = null, off = [];
const EVS = ["stock:changed", "cash:changed", "post:created", "order:paid", "order:new", "gear:changed", "sample:arrived", "sample:requested", "inbox:changed", "event:signal", "update:applied", "post:done"];

export function openBrowser(t) {
  if (t) tab = t;
  if (win && win.back.isConnected) { render(); return; }
  tabsEl = h("div", { class: "btabs" }); view = h("div", { class: "bview" });
  win = modal({ title: "🖥️  Desk PC", cls: "pcwin", body: [tabsEl, view], onClose: () => { off.forEach(f => f()); off = []; win = null; } });
  off = EVS.map(ev => on(ev, () => { if (win) render(true); }));
  render();
}
function render(keepScroll) {
  const sc = view.scrollTop;
  clear(tabsEl);
  for (const t of D.sites.browser) {
    if (t.flag && !flag(t.flag)) continue;
    tabsEl.append(h("button", { class: "btab" + (tab === t.id ? " sel" : ""), type: "button", onClick: () => { tab = t.id; render(); } }, t.label));
  }
  const def = D.sites.browser.find(t => t.id === tab) || D.sites.browser[0];
  clear(view); PAGES[def.kind].render(view, def, { rerender: () => render(true) });
  if (keepScroll) view.scrollTop = sc;
}
