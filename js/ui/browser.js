/* DESK PC apps (D-107, D-76). Registers the desktop icons and builds the Browser window: tab strip, back and forward, an address bar with made-up addresses
   (data/sites.json "browser", field addr), a bookmark bar, and one page per site (js/ui/sites/*). Pages re-render when the state they show changes.
   Also registers the Stock Sheet window. Several browser windows can be open at once (up to 4).
   Exports: openBrowser(tab). Events in: open:browser (stations.js calls openBrowser). Events out: browser:opened {tab}, open:studio (from the site pages). */
import { D } from "../core/data.js";
import { flag, tier2On } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { h, clear } from "./ui.js";
import { registerApp, openWindow, listWindows, focusWindow, setTitle, openPC, renderIcons } from "./pc/desktop.js";
import { buildStock } from "./pc/stocksheet.js";
import { propList } from "./pc/helpers.js";
import * as social from "./sites/social.js";
import * as affiliate from "./sites/affiliate.js";
import * as hub from "./sites/hub.js";
import * as toolshop from "./sites/toolshop.js";
import * as supplier from "./sites/supplier.js";
import * as property from "./sites/property.js";
import * as shop from "./sites/shop.js";

const PAGES = { site: social, affiliate, hub, toolshop, supplier, property, shop };
const EVS = ["stock:changed", "cash:changed", "post:created", "order:paid", "order:new", "gear:changed", "sample:arrived", "sample:requested", "inbox:changed", "event:signal", "update:applied", "post:done", "property:bought", "furniture:bought", "layout:changed", "shop:changed", "order:packed", "order:shipped", "courier:arrived", "courier:left"];
const MAX_BROWSERS = 4;

const sites = () => D.sites.browser.filter(t => (!t.flag || flag(t.flag)) && (t.kind !== "property" || propList().length));
const siteDef = id => sites().find(t => t.id === id);
const addrOf = t => t.addr || (t.id + ".ph");

/* ---------- desktop icons ---------- */
const ICON = [
  { id: "browser", label: "Browser", emoji: "🌐", grad: ["#58b6ff", "#3a7bf0"], open: () => openBrowser("tiktik", true) },
  { id: "affiliate", label: "Affiliate", emoji: "🤝", grad: ["#2fd9cf", "#1d8c82"], show: () => flag("affiliate"), open: () => openBrowser("affiliate") },
  { id: "hub", label: "Seller Hub", emoji: "📊", grad: ["#b744c9", "#6a2ab0"], open: () => openBrowser("hub") },
  { id: "supplier", label: "Supplier", emoji: "🚚", grad: ["#3ec45a", "#26923b"], show: () => flag("tier2"), open: () => openBrowser("supplier") },
  { id: "shop", label: "Shofi", emoji: "🛍️", grad: ["#ff5fa2", "#e8344f"], show: () => tier2On(), open: () => openBrowser("shop") },
  { id: "toolshop", label: "Tool Shop", emoji: "🛠️", grad: ["#ffa23a", "#e8601a"], open: () => openBrowser("toolshop") },
  { id: "property", label: "Property", emoji: "🏠", grad: ["#ffd84a", "#e8a010"], show: () => propList().length > 0, open: () => openBrowser("property") },
  { id: "stock", label: "Stock Sheet", emoji: "📋", grad: ["#9be85a", "#3ec45a"], open: () => openStock() }
];
ICON.forEach(registerApp);

function openStock() { openWindow({ key: "stock", kind: "sheet", title: "Stock Sheet", emoji: "📋", color: "#26923b", w: 980, h: 580, x: 190, y: 30, build: buildStock }); }

/* ---------- the browser window ---------- */
export function openBrowser(t, fresh) {
  const bs = listWindows("browser");
  if (!t && listWindows().length) { openPC(); const top = bs[bs.length - 1]; if (top) focusWindow(top); emit("browser:opened", top ? top.data.tabs[top.data.cur] : "tiktik"); return top; }
  const def = (t && siteDef(t)) || sites()[0];
  let rec = fresh ? null : bs.find(w => w.data.tabs[w.data.cur] === def.id);
  if (!rec && bs.length >= MAX_BROWSERS) { rec = bs[bs.length - 1]; go(rec, def.id); }
  if (rec) { focusWindow(rec); openPC(); }
  else rec = openWindow({ kind: "browser", title: def.label + " - Browser", emoji: "🌐", color: "#3a7bf0", w: 1180, h: 680, data: { tabs: [def.id], cur: 0, hist: [def.id], hi: 0 }, build: buildBrowser });
  emit("browser:opened", def.id);
  return rec;
}
/* Navigate a window's current tab to a site. */
function go(rec, id) {
  const d = rec.data; d.tabs[d.cur] = id; d.hist = d.hist.slice(0, d.hi + 1); d.hist.push(id); d.hi = d.hist.length - 1;
  if (rec.inst && rec.inst.render) rec.inst.render();
}

function buildBrowser(body, rec) {
  const d = rec.data;
  const tabsEl = h("div", { class: "btabs2" }), addr = h("div", { class: "baddr" }), marks = h("div", { class: "bmarks" }), view = h("div", { class: "bview" });
  let menu = false;
  body.append(h("div", { class: "bchrome" }, tabsEl, addr, marks), view);
  const cur = () => siteDef(d.tabs[d.cur]) || sites()[0];
  const nav = id => { menu = false; go(rec, id); };
  function chrome() {
    const def = cur(); clear(tabsEl); clear(addr); clear(marks);
    d.tabs.forEach((id, i) => { const t = siteDef(id); if (!t) return; tabsEl.append(h("div", { class: "bt" + (i === d.cur ? " on" : ""), onClick: () => { d.cur = i; menu = false; render(); } }, h("span", { class: "tl" }, t.label),
      d.tabs.length > 1 ? h("button", { class: "tx", type: "button", "aria-label": "Close tab", onClick: e => { e.stopPropagation(); d.tabs.splice(i, 1); d.cur = Math.min(d.cur, d.tabs.length - 1); render(); } }, "×") : null)); });
    tabsEl.append(h("button", { class: "bplus", type: "button", "aria-label": "New tab", onClick: () => { menu = !menu; chrome(); } }, "+"));
    const bk = h("button", { class: "bnav", type: "button", "aria-label": "Back", disabled: d.hi <= 0, onClick: () => { d.hi--; d.tabs[d.cur] = d.hist[d.hi]; render(); } }, "‹");
    const fw = h("button", { class: "bnav", type: "button", "aria-label": "Forward", disabled: d.hi >= d.hist.length - 1, onClick: () => { d.hi++; d.tabs[d.cur] = d.hist[d.hi]; render(); } }, "›");
    addr.append(bk, fw, h("button", { class: "bnav", type: "button", "aria-label": "Reload", onClick: () => render() }, "⟳"), h("div", { class: "url" }, h("span", { class: "dot" }), h("span", { class: "dom" }, addrOf(def))));
    for (const t of sites()) marks.append(h("button", { class: "bm" + (t.id === def.id ? " on" : ""), type: "button", onClick: () => nav(t.id) }, t.label));
    if (menu) { const m = h("div", { class: "newtab" }, h("div", { class: "nh" }, "Open a new tab")); for (const t of sites()) m.append(h("button", { type: "button", onClick: () => { menu = false; d.tabs.push(t.id); d.cur = d.tabs.length - 1; d.hist.push(t.id); d.hi = d.hist.length - 1; render(); } }, h("span", { class: "a" }, addrOf(t)), t.label)); tabsEl.append(m); }
    setTitle(rec, def.label + " - Browser");
  }
  function page(keepScroll) {
    const def = cur(), sc = view.scrollTop;
    clear(view); PAGES[def.kind].render(view, def, { rerender: () => page(true) });
    if (keepScroll) view.scrollTop = sc;
  }
  function render() { chrome(); page(); }
  render();
  const offs = EVS.map(ev => on(ev, () => page(true)));
  return { render, destroy: () => offs.forEach(f => f()) };
}

export { renderIcons };
