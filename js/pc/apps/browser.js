/* Browser app: tabs, an address bar and five fictional sites (js/pc/sites/). One tab per site when opened from an icon. */
import { registerActions } from "../../ui/windows.js";
import { setHTML, esc } from "../util.js";
import { nav } from "../sites/nav.js";
import { reloadFeed } from "../sites/feeds.js";
import tiktik from "../sites/tiktik.js";
import youview from "../sites/youview.js";
import facebazaar from "../sites/facebazaar.js";
import supplier from "../sites/supplier.js";
import toolshop from "../sites/toolshop.js";
import hub from "../sites/hub.js";

export const SITES = [tiktik, youview, facebazaar, hub, supplier, toolshop];
export const bySite = Object.fromEntries(SITES.map(s => [s.id, s]));
const byHost = Object.fromEntries(SITES.map(s => [s.host, s]));

let root = null, win = null, tabsEl = null, pageEl = null, urlEl = null, backEl = null;
let tabs = [], cur = 0, nextId = 1;

const newTab = () => ({ id: nextId++, site: "newtab", page: "", arg: null, hist: [], fresh: true });
const here = () => { if (!tabs.length) tabs.push(newTab()); cur = Math.max(0, Math.min(cur, tabs.length - 1)); return tabs[cur]; };

function setPage(t, site, page, arg = null) {
  if (t.site !== site || t.page !== page || t.arg !== arg) { t.hist.push({ site: t.site, page: t.page, arg: t.arg }); if (t.hist.length > 30) t.hist.shift(); }
  t.site = site; t.page = page; t.arg = arg; t.fresh = true;
}

/* Show a page of a site. Reuses the tab of that site, or the blank tab you are on, or opens a new tab. */
export function showSite(site, page, arg = null) {
  const s = bySite[site]; if (!s) return;
  const c = here();
  let t = c.site === site ? c : tabs.find(x => x.site === site);
  if (!t) { if (c.site === "newtab" || c.site === "404") t = c; else { t = newTab(); tabs.push(t); } }
  setPage(t, site, page || (t.site === site && t.page) || s.pages[0].id, arg);
  cur = tabs.indexOf(t);
  draw();
}

export const openSite = (site, page) => showSite(site, page);

function addressOf(t) {
  const s = bySite[t.site];
  if (s) return `https://${s.host}/${s.path(t)}`;
  return t.site === "404" ? t.arg || "" : "";
}

function submitAddress(text) {
  const t = here(), a = text.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!a) return;
  const [host, path = ""] = a.split("/"), s = byHost[host];
  if (!s) { t.hist.push({ site: t.site, page: t.page, arg: t.arg }); t.site = "404"; t.page = ""; t.arg = a; t.fresh = true; }
  else setPage(t, s.id, (s.pages.find(pg => pg.path === path || pg.id === path) || s.pages[0]).id);
  draw();
}

/* ---------- drawing ---------- */
function drawTabs() {
  if (!tabsEl) return;
  setHTML(tabsEl, tabs.map((t, i) => {
    const s = bySite[t.site], name = s ? s.name : t.site === "404" ? "Not found" : "New tab";
    return `<span class="br-tab ${i === cur ? "on" : ""}" style="--tc:${s ? s.ac : "#8a7bb0"}"><button type="button" class="br-tabb" role="tab" aria-selected="${i === cur}" data-act="br-tab" data-v="${i}">${s ? s.icon : "＋"} ${name}</button><button type="button" class="br-tabx" data-act="br-tabx" data-v="${i}" aria-label="Close ${name}">✕</button></span>`;
  }).join("") + `<button type="button" class="br-newtab" data-act="br-newtab" aria-label="New tab" title="New tab">＋</button>`);
}

function drawBar() {
  const t = here();
  if (urlEl && document.activeElement !== urlEl) urlEl.value = addressOf(t);
  if (backEl) backEl.disabled = !t.hist.length;
  const s = bySite[t.site];
  if (win) win.setTitle("Browser", s ? s.name : "");
}

const newTabHTML = () => `<div class="br-new"><h2>Where to?</h2><p class="br-sub">Pick a site, or type an address above.</p><div class="br-tiles">${SITES.map(s => `<button type="button" class="card br-tile" data-act="br-go" data-v="${s.id}/${s.pages[0].id}" style="--ac:${s.ac}"><span class="ti" style="background:linear-gradient(${s.c1},${s.c2})">${s.icon}</span><b>${s.name}</b><small>${s.host}</small></button>`).join("")}</div></div>`;
const notFoundHTML = t => `<div class="br-new"><div class="lk-ic">🧭</div><h2>Page not found</h2><p class="br-sub">There is no site at <b>${esc(t.arg || "")}</b>. Check the address.</p><button type="button" class="cap sm" data-act="br-newtab">Open a new tab</button></div>`;

function drawPage() {
  if (!pageEl) return;
  const t = here(), s = bySite[t.site];
  pageEl.style.setProperty("--ac", s ? s.ac : "#7b5bd0");
  const html = s ? s.render(t) : t.site === "404" ? notFoundHTML(t) : newTabHTML();
  const top = pageEl.scrollTop;
  if (setHTML(pageEl, html) || t.fresh) pageEl.scrollTop = t.fresh ? 0 : top;
  t.fresh = false;
}

function draw() { drawTabs(); drawBar(); drawPage(); }

/* True when the player is typing in the page. A redraw then would drop the text cursor. */
const typing = () => { const a = document.activeElement; return !!(a && pageEl && pageEl.contains(a) && a.matches("input,textarea,select")); };

nav.redraw = () => { if (root) draw(); };
nav.go = (site, page, arg) => showSite(site, page, arg);
nav.reload = site => { reloadFeed(site); nav.redraw(); };

registerActions({
  "br-tab": (t, v) => { cur = +v; draw(); },
  "br-tabx": (t, v) => { tabs.splice(+v, 1); if (cur >= +v && cur > 0) cur--; draw(); },
  "br-newtab": () => { tabs.push(newTab()); cur = tabs.length - 1; draw(); if (urlEl) urlEl.focus(); },
  "br-back": () => { const t = here(), h = t.hist.pop(); if (!h) return; t.site = h.site; t.page = h.page; t.arg = h.arg; t.fresh = true; draw(); },
  "br-reload": () => { const t = here(); if (bySite[t.site] && t.page === "feed") reloadFeed(t.site); draw(); },
  "br-go": (t, v) => { const [site, page] = v.split("/"); showSite(site, page); }
});

export default {
  id: "browser", title: "Browser", icon: "🌐", color: "t", w: 84, h: 92, cat: null,
  mount(el, w) {
    root = el; win = w; el.className = "dw-body br";
    el.innerHTML = `<div class="br-top"><div class="br-tabs" role="tablist"></div>
      <form class="br-bar"><button type="button" class="chip" data-act="br-back" title="Back" aria-label="Back">←</button><button type="button" class="chip" data-act="br-reload" title="Reload" aria-label="Reload">⟳</button>
      <input class="br-url" type="text" spellcheck="false" autocomplete="off" aria-label="Address" placeholder="Type an address, like tiktik.example"></form></div>
      <div class="br-page" id="brPage"></div>`;
    tabsEl = el.querySelector(".br-tabs"); pageEl = el.querySelector(".br-page"); urlEl = el.querySelector(".br-url"); backEl = el.querySelector("[data-act=br-back]");
    el.querySelector(".br-bar").addEventListener("submit", e => { e.preventDefault(); const v = urlEl.value; urlEl.blur(); submitAddress(v); });
    pageEl.addEventListener("input", e => SITES.forEach(s => s.onInput && s.onInput(e)));
    draw();
  },
  refresh() { if (!root || typing()) return; drawBar(); drawPage(); },
  unmount() { root = win = tabsEl = pageEl = urlEl = backEl = null; }
};
