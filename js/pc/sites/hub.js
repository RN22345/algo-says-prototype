/* Seller Hub: a market-stats site (like a seller centre). Trending items by recent posts, the top sellers
   leaderboard (D-73), and what other sellers posted lately (virtual rivals, D-71). Counts only, no forecasts. */
import { D, S } from "../../state.js";
import { esc, shortNum } from "../util.js";
import { trendingList, leaderboard, rivalPosts } from "../../sim/trends.js";
import { shell } from "./common.js";
import { ACHIEVEMENTS, stickerFor } from "../../sim/achieve.js";

const SITE = { tiktik: "TikTik", youview: "YouView" };
const ago = t => { const s = Math.max(0, Math.round(S.clock - t)); return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago`; };

function trendingPage() {
  const PR = D.PR, list = trendingList(), max = Math.max(1, list[0].posts);
  return `<div class="lbl">Most posted items in the last few minutes, on both sites. This shows what is being posted now, not what will sell next.</div>
    <div class="hub-tr">${list.map((x, i) => `<div class="card hub-row"><b class="hub-no">${i + 1}</b><img src="img/${PR[x.p].icon}.png" alt=""><div><b>#${PR[x.p].n.toLowerCase().replace(/\s+/g, "")}</b><div class="hub-bar"><i style="width:${Math.round(x.posts / max * 100)}%"></i></div></div><span class="hub-n">${shortNum(x.posts)} posts</span></div>`).join("")}</div>`;
}

function boardPage() {
  const rows = leaderboard();
  return `<div class="lbl">Top sellers in your area, by orders so far.</div>
    <div class="hub-board">${rows.map((r, i) => `<div class="card hub-row ${r.me ? "me" : ""}"><b class="hub-no">${i + 1}</b><div><b>${esc(r.n)}</b>${r.habit ? `<div class="br-sub">${esc(r.habit)}</div>` : `<div class="br-sub">Your shop</div>`}</div><span class="hub-n">${shortNum(r.sales)} orders</span><span class="hub-n">${shortNum(r.fol)} followers</span></div>`).join("")}</div>`;
}

function postsPage() {
  const PR = D.PR, list = rivalPosts(null, 14);
  if (!list.length) return `<div class="br-sub">No posts from other sellers yet. Check back soon.</div>`;
  return `<div class="lbl">Latest posts by other sellers</div><div class="hub-posts">${list.map(x => `<div class="card hub-row"><img src="img/${PR[x.p].icon}.png" alt=""><div><b>${esc(x.name)}</b> posted <b>${PR[x.p].n}</b><div class="br-sub">on ${SITE[x.site]} · ${ago(x.at)}</div></div><span class="hub-n">${shortNum(x.views)} views</span></div>`).join("")}</div>`;
}

function achvPage() {
  return `<div class="lbl">Achievements open new cover stickers for TikTik posts.</div><div class="hub-board">${Object.entries(ACHIEVEMENTS).map(([id, a]) => {
    const done = S.achv && S.achv[id], st = stickerFor(id);
    return `<div class="card hub-row ${done ? "me" : ""}"><b class="hub-no">${done ? "✅" : "🔒"}</b><div><b>${esc(a.n)}</b><div class="br-sub">${esc(a.how)}</div></div><span class="hub-n">${st ? "Sticker: " + esc(st[1].label) : ""}</span><span class="hub-n">${done ? "Done" : ""}</span></div>`;
  }).join("")}</div>`;
}

export default {
  id: "hub", name: "Seller Hub", host: "sellerhub.example", icon: "📈", cat: "business", ac: "#3a6fd8", ac2: "#1d3f8c", c1: "#7aa8f7", c2: "#3a6fd8",
  pages: [{ id: "trending", label: "Trending items", path: "trending" }, { id: "board", label: "Top sellers", path: "top-sellers" }, { id: "posts", label: "Other sellers' posts", path: "posts" }, { id: "achv", label: "Achievements", path: "achievements" }],
  path(tab) { return (this.pages.find(x => x.id === tab.page) || this.pages[0]).path; },
  render(tab) { return shell(this, tab, tab.page === "board" ? boardPage() : tab.page === "posts" ? postsPage() : tab.page === "achv" ? achvPage() : trendingPage()); }
};
