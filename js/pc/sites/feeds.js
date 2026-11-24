/* Fake feeds for the three sites. Cards are generated, not real. Seeded, so a feed stays put until Reload. */
import { D } from "../../state.js";
import { AV } from "../../sim/shop.js";
import { rng, esc, shortNum } from "../util.js";

const IDX = { tiktik: 0, youview: 1, facebazaar: 2 };
const spin = { tiktik: 0, youview: 0, facebazaar: 0 }, cache = {};

/* 8 to 12 cards for one site. */
function gen(site) {
  const i = IDX[site], F = D.PC.feeds, r = rng(1000 * (i + 1) + 77 * spin[site]), pick = a => a[Math.floor(r() * a.length)];
  const keys = Object.keys(D.PR), n = 8 + Math.floor(r() * 5);
  return Array.from({ length: n }, () => {
    const p = pick(keys), name = D.PR[p].n, e = Math.exp(r() * 5);
    return {
      p, seller: pick(F.sellers), av: Math.floor(r() * 6), caption: pick(F.captions[p]),
      title: pick(F.titles).replace("{p}", name), live: pick(F.liveTitles).replace("{p}", name), chat: pick(F.liveChats),
      views: Math.round(200 * e * (i === 1 ? 0.7 : 1)), watching: 12 + Math.floor(r() * r() * 900), len: `${2 + Math.floor(r() * 12)}:${String(Math.floor(r() * 60)).padStart(2, "0")}`,
      price: D.PR[p].price + Math.round((r() - 0.5) * 4) * 10
    };
  });
}

export function reloadFeed(site) { spin[site]++; delete cache[site]; }

export function feedHTML(site) {
  const cards = cache[site] || (cache[site] = gen(site)), PR = D.PR;
  if (site === "tiktik") return `<div class="fd-tt">${cards.map(c => `<div class="fd-tile"><div class="fd-cov"><img src="img/${PR[c.p].icon}.png" alt=""><span class="fd-heart">♥ ${shortNum(c.views)}</span></div><div class="fd-cap">${esc(c.caption)}</div><div class="fd-by"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div></div>`).join("")}</div>`;
  if (site === "youview") return `<div class="fd-yv">${cards.map(c => `<div class="fd-row"><div class="fd-thumb"><img src="img/${PR[c.p].icon}.png" alt=""><span class="fd-len">${c.len}</span></div><div><b>${esc(c.title)}</b><div class="fd-meta"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div><div class="fd-meta">${shortNum(c.views)} views</div></div></div>`).join("")}</div>`;
  return `<div class="fd-fb">${cards.map(c => `<div class="fd-live"><div class="fd-lv-top"><span class="fd-dot">● LIVE</span><span>👁 ${c.watching}</span></div><div class="fd-lv-main"><img src="img/${PR[c.p].icon}.png" alt=""><div><b>${esc(c.live)}</b><div class="fd-meta"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div></div></div><div class="fd-lv-bot"><span class="fd-price">₱${c.price}</span><span class="fd-say">💬 ${esc(c.chat)}</span></div></div>`).join("")}</div>`;
}
