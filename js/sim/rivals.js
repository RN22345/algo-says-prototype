/* RIVALS and FEED. Virtual rivals post by fixed habits (never chance of habit, only timing). They are seen only as feed posts, stats and a leaderboard.
   Ambient posts from other creators add noise. A fizzling whisper has one creator only (one place). Events add news posts.
   Data: data/market.json. Events in: tick, newgame, feed:post {by,text,p,news,site}. Reads S.market, S.mods.
   Exports (read only helpers for the UI): feedFor(site), trendingList(), leaderboard(). */
import { D } from "../core/data.js";
import { S, rand, rr, pick, uid } from "../core/state.js";
import { on } from "../core/bus.js";

export function init() {
  on("newgame", seed);
  on("tick", onTick);
  on("feed:post", p => addPost({ ...p, style: p.style || "News", views: p.views || Math.round(rr(300, 1200)), likes: p.likes || Math.round(rr(30, 120)), top: p.top || (p.p && S.mods.comment && S.mods.comment[p.p] ? pick(S.mods.comment[p.p]) : "") }));
  if (!S.rivals.length) seed();
}
function seed() {
  S.rivals = D.market.rivals.map(r => ({ id: r.id, fol: r.fol, sales: Math.round(r.fol * 0.01) }));
  S.feed = [];
}

function addPost(f) {
  S.feed.push({ id: uid("f"), at: S.t, site: "tiktik", likes: 0, views: 0, ...f });
  if (S.feed.length > 160) S.feed = S.feed.slice(-120);
}

function topComment(p) {
  const M = S.mods;
  if (M.comment && M.comment[p] && rand() < 0.7) return pick(M.comment[p]);
  const tr = S.trends[p], C = D.market.topComments;
  if (!tr) return pick(C.calm);
  if (tr.stage === "whisper" && tr.fz) return pick(C.fizzle);
  if (tr.stage === "whisper" || tr.stage === "rising") return pick(C.real);
  if (tr.stage === "peak") return pick(C.peak);
  if (tr.stage === "crowded") return pick(C.crowded);
  return pick(C.calm);
}

function onTick({ dt }) {
  const MK = D.market.trends, hr = dt / 60;
  D.market.rivals.forEach((r, i) => {
    const st = S.rivals[i]; if (!st) return;
    for (const p of D.products) {
      const tr = S.trends[p.id], s = tr.stage; if (!r.stages.includes(s)) continue;
      if (s === "whisper" && tr.fz && r.id !== "kiko") continue;
      if (rand() < r.rate * hr * (MK.rivalStage[s] || 1)) {
        const heat = S.market.heat[p.id] || 0.2;
        const views = Math.round((st.fol * 0.3 + 200) * (0.5 + heat) * (0.6 + rand() * 0.8) / (1 + 0.1 * S.market.crowd[p.id]));
        addPost({ by: r.n, r: r.id, p: p.id, site: r.site, views, likes: Math.round(views * rr(0.04, 0.09)), style: pick(D.market.styles), top: topComment(p.id) });
        st.sales += Math.round(views * 0.0025 * (0.7 + heat)); st.fol += Math.round(views * 0.01);
      }
    }
  });
  // ambient creators
  for (const p of D.products) {
    const tr = S.trends[p.id];
    const live = tr.stage !== "calm" || p.evergreen; if (!live) continue;
    const heat = S.market.heat[p.id];
    if (rand() < MK.ambientPerHour * hr * (tr.stage === "calm" ? 0.2 : heat + 0.3)) {
      const by = tr.stage === "whisper" && tr.fz && tr.src ? tr.src : pick(D.market.creators);
      const views = Math.round(rr(80, 600) * (0.5 + heat));
      addPost({ by, p: p.id, site: rand() < 0.7 ? "tiktik" : "youview", views, likes: Math.round(views * rr(0.04, 0.1)), style: pick(D.market.styles), top: topComment(p.id) });
    }
  }
}

export const feedFor = (site, n = 14) => S.feed.filter(f => !site || f.site === site).slice(-n).reverse();

/* Most posted products in the last 3 hours. A count, not a forecast. */
export function trendingList() {
  const win = D.market.trends.crowdWindow;
  return D.products.map(p => {
    const posts = S.feed.filter(f => f.p === p.id && S.t - f.at < win).length;
    return { p: p.id, posts: Math.round(posts * 7 + S.market.heat[p.id] * 40 + (S.market.stage[p.id] === "calm" ? 0 : 8)) };
  }).sort((a, b) => b.posts - a.posts);
}

export function leaderboard() {
  const rows = D.market.rivals.map((r, i) => ({ n: r.n, habit: r.habit, sales: (S.rivals[i] || {}).sales || 0, fol: (S.rivals[i] || {}).fol || 0, me: false }));
  rows.push({ n: "You", habit: "", sales: S.stats.sold || 0, fol: (S.followers.tiktik || 0) + (S.followers.youview || 0), me: true });
  return rows.sort((a, b) => b.sales - a.sales);
}
