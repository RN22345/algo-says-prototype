/* Stats app: every post on every site with views, orders and missed sales. Filter by site. Select two to compare. Numbers only, no grades. */
import { D, S } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { SITE_NAME } from "../../sim/post.js";
import { setHTML, esc, shortNum } from "../util.js";
import { spark, isLive, SEGS } from "../sites/common.js";

let root = null, picked = [], filter = "all"; // picked: post objects

const siteOf = p => p.site || "tiktik";
const all = () => [...S.posts, ...S.running].sort((a, b) => (a.at || 0) - (b.at || 0));
const stk = s => !s || s === "none" ? "None" : s.startsWith("my:") ? "Own sticker" : s[0].toUpperCase() + s.slice(1);
const txt = t => ({ none: "None", price: "Price", question: "Question" }[t] || t);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const accent = s => s === "youview" ? "#ff8a2a" : s === "facebazaar" ? "#2cc8b6" : "#9446e0";
const firstOf = p => siteOf(p) === "youview" ? esc(p.title || "(no title)") : D.CLIPS[p.clips[0]] ? D.CLIPS[p.clips[0]][0] : "";

function detail(p, no) {
  const PR = D.PR, site = siteOf(p), done = !isLive(p);
  const common = [["Site", SITE_NAME[site] || site], ["Product", PR[p.p].n]];
  const extra = site === "youview"
    ? [["Title", esc(p.title || "(none)")], ["Segments", p.segs.map(s => (SEGS[s] || [s])[0]).join(" → ") || "(none)"], ["Cover", p.thumb === "bold" ? "Bold" : "Plain"]]
    : [["Clips", p.clips.map(c => D.CLIPS[c] ? D.CLIPS[c][0] : c).join(" → ")], ["Shot", p.shot === "face" ? "Face + product" : "Product"], ["Cover text", txt(p.text)], ["Sticker", stk(p.sticker)], ["Caption", p.caption ? esc(p.caption) : "(none)"], ["Swiped away at", mmss(p.leftAt)]];
  const nums = [["Views", Math.round(p.views).toLocaleString()], ["Likes", Math.round(p.views * D.T.post.likeRate).toLocaleString()], ["Orders", p.orders], ["Missed sales", p.missed], ["Watched to end", done ? Math.round(p.endPct) + "%" : "…"]];
  const rows = [...common, ...extra, ...nums].map(([k, v]) => `<div class="st-kv"><span class="lbl">${k}</span><b>${v}</b></div>`).join("");
  return `<div class="card st-det"><div class="st-title">Post ${no}${isLive(p) ? " · live" : ""}</div>${spark(p, accent(site))}${rows}</div>`;
}

function render() {
  if (!root) return;
  const list = all(), PR = D.PR;
  picked = picked.filter(p => list.includes(p));
  const sites = ["tiktik", "youview", "facebazaar"].filter(s => s !== "facebazaar" || list.some(p => siteOf(p) === s));
  if (filter !== "all" && !sites.includes(filter)) filter = "all";
  const shown = list.filter(p => filter === "all" || siteOf(p) === filter);
  const chips = [["all", "All"], ...sites.map(s => [s, SITE_NAME[s]])].map(([v, t]) => `<button type="button" class="chip ${filter === v ? "on" : ""}" data-act="st-site" data-v="${v}" aria-pressed="${filter === v}">${t}</button>`).join("");
  const rows = shown.map(p => {
    const on = picked.includes(p), no = list.indexOf(p) + 1, site = siteOf(p);
    return `<button type="button" class="st-row ${on ? "on" : ""}" data-act="st-pick" data-v="${no - 1}" aria-pressed="${on}">
      <span class="st-box">${on ? "✓" : ""}</span><span>${no}${isLive(p) ? " ●" : ""}</span><span><i class="st-dot" style="background:${accent(site)}"></i>${SITE_NAME[site]}</span><span><img src="img/${PR[p.p].icon}.png" alt="" class="st-pi"> ${PR[p.p].n}</span>
      <span>${shortNum(p.views)}</span><span>${p.orders}</span><span>${p.missed}</span><span class="st-first">${firstOf(p)}</span></button>`;
  }).reverse().join("");
  const cmp = picked.length ? `<div class="st-cmp" style="grid-template-columns:repeat(${picked.length},minmax(0,1fr))">${picked.map(p => detail(p, list.indexOf(p) + 1)).join("")}</div>` : "";
  setHTML(root, `
   <div class="card st-list">
     <div class="st-filter">${chips}</div>
     <div class="st-row st-head"><span></span><span>#</span><span>Site</span><span>Product</span><span>Views</span><span>Orders</span><span>Missed</span><span>First clip or title</span></div>
     <div data-sk="stl" class="st-scroll">${rows || `<div class="st-empty">No posts yet. Make one on TikTik or YouView.</div>`}</div>
   </div>
   <div data-sk="stc" class="st-side">
     <div class="lbl">${picked.length === 2 ? "Side by side" : "Pick two posts to compare them side by side"}</div>${cmp}
   </div>`);
}

registerActions({
  "st-pick": (t, v) => {
    const p = all()[+v]; if (!p) return;
    picked = picked.includes(p) ? picked.filter(x => x !== p) : [...picked, p].slice(-2);
    const l = all(); picked.sort((a, b) => l.indexOf(a) - l.indexOf(b)); render();
  },
  "st-site": (t, v) => { filter = v; render(); }
});

export default {
  id: "stats", title: "Stats", icon: "📊", color: "o", cat: "social", w: 90, h: 82,
  mount(el, win) { root = el; picked = []; el.className = "dw-body wbody st-app"; win.setTitle("Stats", "All your posts"); render(); },
  refresh: render,
  unmount() { root = null; }
};
