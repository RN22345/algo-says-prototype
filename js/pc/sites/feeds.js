/* Fake feeds for the two video sites. Cards are generated, not real. Seeded, so a feed stays put until Reload. */
import { D, S } from "../../state.js";
import { heat, rivalPosts } from "../../sim/trends.js";
import { AV } from "../../sim/shop.js";
import { rng, esc, shortNum } from "../util.js";

const IDX = { tiktik: 0, youview: 1 };
const spin = { tiktik: 0, youview: 0 }, cache = {};

/* Post styles per site. "trap" styles pull views but few sales ("viral trap"); the others sell with fewer views.
   Comments carry the pattern, never a label (teammate feedback 2026-11-24). Matches the post model: no price and
   bold covers get reach but convert less; hooks, visible prices, and honest reviews sell. */
const STYLES = {
  tiktik: { sell: ["Hook + price on cover", "Close-up demo", "Unboxing, price in caption"], trap: ["Flashy, no price", "Clickbait caption"] },
  youview: { sell: ["Honest review", "Demo and compare"], trap: ["Bold clickbait cover"] }
};
const TOP = {
  sell: { tiktik: ["Mine! Ordered na 🛒", "Add to cart done!", "Order ko po 2", "Sulit, nag-order ako"], youview: ["Bought it after this review, legit", "Thanks, ordered na", "Ito yung hinahanap ko, order na"] },
  trap: { tiktik: ["Clickbait naman haha", "HM? Di nilagay price 🙄", "Akala ko libre lol", "Ganda pero magkano??"], youview: ["Clickbait cover, iba pala", "Sayang oras, di naman sinabi price", "Thumbnail lang maganda haha"] }
};
const pct = (r, a, b) => Math.round(a + r() * (b - a));

/* 8 to 12 cards for one site. */
function gen(site) {
  const i = IDX[site], F = D.PC.feeds, r = rng(1000 * (i + 1) + 77 * spin[site]), pick = a => a[Math.floor(r() * a.length)];
  const keys = Object.keys(D.PR), n = 8 + Math.floor(r() * 5);
  // strangers post what buyers want: hot items show up more often (a trend signal, never labelled)
  const wts = keys.map(k => 0.12 + 3 * Math.pow(heat(k), 1.6)), tot = wts.reduce((a, b) => a + b, 0);
  const pickP = () => { let x = r() * tot; for (let j = 0; j < keys.length; j++) { if ((x -= wts[j]) < 0) return keys[j]; } return keys[0]; };
  const rv = rivalPosts(site, 3).map(x => ({ p: x.p, seller: x.name, views: x.views }));
  return [...rv, ...Array.from({ length: n }, () => ({ p: pickP() }))].map(base => {
    const p = base.p, name = D.PR[p].n, e = Math.exp(r() * 5), trap = r() < 0.32, kind = trap ? "trap" : "sell";
    const style = pick(STYLES[site][kind]), top = pick(TOP[kind][site]);
    const v0 = base.views || Math.round(200 * e * (0.5 + heat(p)) * (i === 1 ? 0.7 : 1) * (trap ? 2.4 : 1));
    let sig;
    if (site === "tiktik") sig = [`♥ ${shortNum(v0 * (trap ? 0.13 : 0.07))}`, `${trap ? pct(r, 8, 22) : pct(r, 34, 62)}% watched to the end`];
    else sig = [`${trap ? pct(r, 10, 25) : pct(r, 42, 70)}% average watch time`, `👍 ${trap ? pct(r, 52, 74) : pct(r, 88, 97)}% liked it`];
    return { style, trap, sig, top,
      p, seller: base.seller || pick(F.sellers), av: Math.floor(r() * 6), caption: pick(F.captions[p] || [name]),
      title: pick(F.titles).replace("{p}", name),
      views: v0, len: `${2 + Math.floor(r() * 12)}:${String(Math.floor(r() * 60)).padStart(2, "0")}`,
      price: D.PR[p].price + Math.round((r() - 0.5) * 4) * 10
    };
  });
}

export function reloadFeed(site) { spin[site]++; delete cache[site]; }

/* Cards for a site, regenerated every 45 game seconds so the feed follows the market. */
export function feedCards(site) {
  if (cache[site] && S.clock - cache[site].at > 45) { spin[site]++; delete cache[site]; }
  if (!cache[site]) { cache[site] = gen(site); cache[site].at = S.clock; }
  return cache[site];
}
/* Style, platform signals, and the top comment under a card. */
export const sigHTML = c => `<div class="fd-sig"><span class="fd-style">${esc(c.style)}</span><span>${c.sig.map(esc).join(" · ")}</span><span class="fd-top">💬 “${esc(c.top)}”</span></div>`;

export function feedHTML(site) {
  const cards = feedCards(site), PR = D.PR;
  if (site === "tiktik") return `<div class="fd-tt">${cards.map(c => `<div class="fd-tile"><div class="fd-cov"><img src="img/${PR[c.p].icon}.png" alt=""><span class="fd-heart">♥ ${shortNum(c.views)}</span></div><div class="fd-cap">${esc(c.caption)}</div><div class="fd-by"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div>${sigHTML(c)}</div>`).join("")}</div>`;
  return `<div class="fd-yv">${cards.map(c => `<div class="fd-row"><div class="fd-thumb"><img src="img/${PR[c.p].icon}.png" alt=""><span class="fd-len">${c.len}</span></div><div><b>${esc(c.title)}</b><div class="fd-meta"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div><div class="fd-meta">${shortNum(c.views)} views</div>${sigHTML(c)}</div></div>`).join("")}</div>`;
}
