/* Feeds app: a fake browser with three tabs. Each fictional site has its own layout and accent colour. Cards are generated, not real. */
import { D } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { AV } from "../../sim/shop.js";
import { rng, setHTML, esc, shortNum } from "../util.js";

const SITES = [
  { id: "tiktik", name: "TikTik", url: "tiktik.example/for-you", col: "#9446e0" },
  { id: "youview", name: "YouView", url: "youview.example/home", col: "#ff8a2a" },
  { id: "facebazaar", name: "FaceBazaar", url: "facebazaar.example/live", col: "#2cc8b6" }
];
let root = null, tab = 0, spin = [0, 0, 0], cache = {};

/* Generate 8 to 12 cards for one site. Seeded, so the feed stays put until Refresh. */
function gen(i) {
  const F = D.PC.feeds, r = rng(1000 * (i + 1) + 77 * spin[i]), pick = a => a[Math.floor(r() * a.length)];
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

function body() {
  const cards = cache[tab] || (cache[tab] = gen(tab)), PR = D.PR;
  if (tab === 0) return `<div class="fd-tt">${cards.map(c => `<div class="fd-tile"><div class="fd-cov"><img src="img/${PR[c.p].icon}.png" alt=""><span class="fd-heart">♥ ${shortNum(c.views)}</span></div><div class="fd-cap">${esc(c.caption)}</div><div class="fd-by"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div></div>`).join("")}</div>`;
  if (tab === 1) return `<div class="fd-yv">${cards.map(c => `<div class="fd-row"><div class="fd-thumb"><img src="img/${PR[c.p].icon}.png" alt=""><span class="fd-len">${c.len}</span></div><div><b>${esc(c.title)}</b><div class="fd-meta"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div><div class="fd-meta">${shortNum(c.views)} views</div></div></div>`).join("")}</div>`;
  return `<div class="fd-fb">${cards.map(c => `<div class="fd-live"><div class="fd-lv-top"><span class="fd-dot">● LIVE</span><span>👁 ${c.watching}</span></div><div class="fd-lv-main"><img src="img/${PR[c.p].icon}.png" alt=""><div><b>${esc(c.live)}</b><div class="fd-meta"><img src="${AV(c.av)}" alt="">${esc(c.seller)}</div></div></div><div class="fd-lv-bot"><span class="fd-price">₱${c.price}</span><span class="fd-say">💬 ${esc(c.chat)}</span></div></div>`).join("")}</div>`;
}

function render() {
  if (!root) return;
  const s = SITES[tab];
  root.style.setProperty("--ac", s.col);
  setHTML(root, `<div class="fd-top"><div class="fd-tabs" role="tablist">${SITES.map((x, i) => `<button type="button" role="tab" aria-selected="${i === tab}" class="fd-tab ${i === tab ? "on" : ""}" style="--tc:${x.col}" data-act="fd-tab" data-v="${i}">${x.name}</button>`).join("")}</div>
    <div class="fd-url"><button type="button" class="chip" data-act="fd-refresh" title="Show new posts">⟳</button><span>https://${s.url}</span></div></div>
    <div class="fd-page" data-sk="fd${tab}">${body()}</div>`);
}

registerActions({
  "fd-tab": (t, v) => { tab = +v; render(); },
  "fd-refresh": () => { spin[tab]++; delete cache[tab]; render(); }
});

export default {
  id: "feeds", title: "Feeds", icon: "🌐", color: "t", w: 70, h: 82,
  mount(el, win) { root = el; el.className = "dw-body fd"; win.setTitle("Feeds", "What other sellers post"); render(); },
  unmount() { root = null; }
};
