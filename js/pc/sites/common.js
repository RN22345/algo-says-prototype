/* Shared parts for the site pages: stock line, product list, post results, site shell. */
import { D, S } from "../../state.js";
import { peso } from "../../ui/format.js";
import { incoming, AV } from "../../sim/shop.js";
import { sitePosts, activePosts, SITE_NAME } from "../../sim/post.js";
import { esc } from "../util.js";

/* "Shelf 3 · Storage 6 · On the way 6" for one product. */
export function stockLine(p) {
  const n = S.stock[p] || 0, b = (S.back || {})[p] || 0, w = incoming(p);
  return `<span class="br-stock ${n ? "" : "none"}">Shelf ${n} · Storage ${b} · On the way ${w}</span>`;
}

/* One product row for a picker. `on` marks the picked one(s). `act` is the data-act name. */
export function productRow(k, act, on, extra = "", disabled = false) {
  const v = D.PR[k];
  return `<button type="button" class="pcard ${on ? "on" : ""}" data-act="${act}" data-v="${k}" aria-pressed="${on}" ${disabled ? "disabled" : ""}><img src="img/${v.icon}.png" alt=""><span><b>${v.n}</b><span class="br-sub">${peso(v.price)}</span>${stockLine(k)}${extra}</span></button>`;
}

/* Sticker on the cover: built-in text or one of the player's own Paint stickers ("my:0" to "my:2"). */
export function stickerHTML(s) {
  if (!s || s === "none") return "";
  if (s.startsWith("my:")) { const u = S.stickers[+s.slice(3)]; return u ? `<img src="${u}" alt="Your sticker" style="position:absolute;left:3%;bottom:4%;width:36%;transform:rotate(-8deg)">` : ""; }
  const k = D.STK && D.STK[s]; return `<div class="br-stk"${k ? ` style="background:${k.col}"` : ""}>${esc(k ? k.label : s.toUpperCase())}</div>`;
}

/* ---------- post lists and results ---------- */
export const postList = site => [...sitePosts(site), ...activePosts(site)];
export const postNo = p => postList(p.site).indexOf(p) + 1;
export const isLive = p => S.running.includes(p);

const pts = (p, W, H) => {
  const max = Math.max(...p.samples, 1), step = D.T.post.sampleEvery || 2;
  return p.samples.map((v, i) => `${Math.min(W, i * step / p.dur * W).toFixed(1)},${(H - 5 - v / max * (H - 18)).toFixed(1)}`).join(" ");
};

export function spark(p, color) {
  return `<svg viewBox="0 0 200 50" preserveAspectRatio="none" class="br-spark" aria-hidden="true"><polyline points="0,48 ${pts(p, 200, 52)}" fill="none" stroke="${color}" stroke-width="2.5"/></svg>`;
}

function hookCurve(L, W) { const x = L / W * 400; return `M0,10 L${x - 20},12 L${x + 8},62 L${x + 60},70 L400,92`; }

export const nameOf = p => p.site === "youview" ? (p.title || "(no title)") : D.PR[p.p].n;

/* Live results view for one post of any site: numbers, cover, curves, comments. Numbers only, no grades. */
export function resultsHTML(p, color) {
  const PR = D.PR, T = D.T.post, live = isLive(p), W = T.swipeWindow;
  const left = Math.max(0, Math.round(p.dur - p.t));
  const stats = [
    ["Views", Math.round(p.views).toLocaleString()], ["Likes", Math.round(p.views * T.likeRate).toLocaleString()], ["Orders", p.orders],
    ["Missed sales", `<span style="color:${p.missed ? "var(--red)" : "inherit"}">${p.missed}</span>`], ["Watched to end", live ? "…" : Math.round(p.endPct) + "%"]
  ].map(([k, v]) => `<div class="card stat"><span class="lbl">${k}</span><b>${v}</b></div>`).join("");
  const tt = p.site === "tiktik";
  const cover = tt
    ? `<div class="card br-cover"><img class="pimg" src="img/${PR[p.p].icon}.png" alt="">${stickerHTML(p.sticker)}<div class="br-capt">${esc(p.caption || "(no caption)")}</div></div>`
    : `<div class="card br-thumb ${p.thumb === "bold" ? "bold" : ""}"><img class="pimg" src="img/${PR[p.p].icon}.png" alt=""><div class="br-ttl">${esc(p.title || "(no title)")}</div></div>`;
  const chart = `<div class="card br-chart"><div class="br-chd"><span class="lbl">Viewers over time</span>${live ? `<b class="br-live" style="color:${color}">● live</b>` : ""}</div>
    <svg viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,105 ${pts(p, 400, 110)}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round"/><line x1="0" y1="108" x2="400" y2="108" stroke="#2a1650" stroke-width="2"/></svg></div>`;
  const L = p.leftAt;
  const swipe = tt ? `<div class="card br-chart"><div class="br-chd"><span class="lbl">Where viewers swiped away · 0:00 to 0:${W}</span></div>
    <svg viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true"><path d="${hookCurve(L, W)}" fill="none" stroke="#ef3b4f" stroke-width="3.5"/><line x1="${L / W * 400}" y1="0" x2="${L / W * 400}" y2="110" stroke="#2a1650" stroke-width="2" stroke-dasharray="6 5"/><line x1="0" y1="108" x2="400" y2="108" stroke="#2a1650" stroke-width="2"/></svg>
    <div class="br-note">Most viewers left at 0:0${L}</div></div>`
    : `<div class="card br-facts"><span class="lbl">This video</span>${[["Title", esc(p.title || "(none)")], ["Cover", p.thumb === "bold" ? "Bold" : "Plain"], ["Segments", p.segs.map(s => (SEGS[s] || [s])[0]).join(" → ") || "(none)"]].map(([k, v]) => `<div class="st-kv"><span class="lbl">${k}</span><b>${v}</b></div>`).join("")}</div>`;
  const cm = `<div class="card br-cmts"><span class="lbl">Comments</span>${p.comments.map(c => `<div class="cmt"><img src="${AV(c.av)}" alt=""><div>${esc(c.text)}</div></div>`).join("") || '<span class="br-sub">No comments yet</span>'}</div>`;
  return `<div class="br-res"><div class="br-statrow">${stats}</div><div class="br-resgrid">${cover}<div class="br-charts">${chart}${swipe}</div>${cm}</div>
    <div class="br-sub">${live ? `Live now · ${left}s left` : "This post has ended. Old posts keep a small trickle of views."}</div></div>`;
}

/* YouView segment names and what each one does. Neutral words. */
export const SEGS = {
  intro: ["Intro", "You greet viewers and name the product."],
  demo: ["Demo", "You show the product working."],
  compare: ["Compare", "You put it next to another product."],
  review: ["Review", "You give your own opinion of it."],
  price: ["Price", "You say the price and what the buyer gets."]
};

/* Page frame for a site: header with logo and links, then the body. */
export function shell(site, tab, body, extra = "") {
  const links = site.pages.map(pg => `<button type="button" class="br-nv ${tab.page === pg.id ? "on" : ""}" data-act="br-go" data-v="${site.id}/${pg.id}">${pg.label}</button>`).join("");
  return `<div class="br-site br-${site.id}" style="--ac:${site.ac};--ac2:${site.ac2}"><header class="br-hd"><b class="br-logo">${site.name}</b><nav aria-label="${site.name} pages">${links}</nav>${extra}</header><div class="br-bd">${body}</div></div>`;
}

/* Shown in place of a form when the site is closed to the player. */
export const closedCard = (reason, toolLink = true) => `<div class="card br-closed"><div class="lk-ic">🔒</div><h2>Not open yet</h2><p>${esc(reason)}</p>${toolLink ? `<button type="button" class="cap sm" data-act="br-go" data-v="toolshop/shop">Go to Tool Shop</button>` : ""}</div>`;

export { SITE_NAME };
