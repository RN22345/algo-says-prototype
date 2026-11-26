/* POSTS. Takes a finished video and runs the viewer model once (market context + video), then plays the result out over game time:
   waves of views (followers first, then strangers), search trickle on YouView, orders, followers. Posts keep earning while the player sleeps.
   Events in: post:submit {video, post}, tick. Events out: post:created, post:analysed, post:done, order:new, inbox:add, summary:add, followers:changed.
   Reads S.market, S.mods, S.followers, S.trust, S.shelves. Uses the pure viewerModel. */
import { D } from "../core/data.js";
import { S, uid, hashStr, clamp, priceConv } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { simulate, waveCum } from "./viewerModel.js";

const prod = id => D.P[id];

/* Build the market context for a video. Pure read of S. */
export function buildCtx(video) {
  const pid = video.pid, site = video.site, p = prod(pid), M = S.mods || {}, mk = S.market;
  const words = (video.title || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const hit = new Set(words.filter(w => p.searchWords.includes(w)));
  const tired = S.posts.filter(x => x.pid === pid && x.site === site && S.t - x.at < 720).length;
  const own = S.posts.filter(x => x.pid === pid && S.t - x.at < 180).length;
  return {
    heat: mk.heat[pid] ?? 0.2, crowd: (mk.crowd[pid] ?? 0) + own, followers: S.followers[site] || 0, trust: S.trust,
    reachMult: ((M.reach && M.reach[pid]) || 1) * ((M.reachSite && M.reachSite[site]) || 1) * Math.pow(0.7, tired),
    convMult: (M.conv && M.conv[pid]) || 1, dealSpend: M.dealSpend || 1, returnAdd: (M.returns && M.returns[pid]) || 0,
    patienceMult: (M.patience && M.patience[site]) || 1,
    titleMatch: clamp(hit.size / 3, 0, 1), tagHits: (video.tags || []).filter(t => p.tags.includes(t)).length,
    ownMode: video.mode === "own", stockLeft: S.shelves.reduce((a, sh) => a + sh.filter(x => x === pid).length, 0)
  };
}

export function init() {
  on("post:submit", payload => { payload.post = create(payload.video); });
  on("tick", onTick);
}

function create(video) {
  const id = uid("p"), p = prod(video.pid), ctx = buildCtx(video), seed = hashStr(id + ":" + Math.floor(S.t));
  const res = simulate(video, p, video.site, ctx, seed);
  const evs = [];
  for (const e of S.events.list) if (S.t >= e.start && S.t < e.end && (e.affects.products.includes(video.pid) || e.affects.sites.includes(video.site))) evs.push({ id: e.id, name: e.name, explain: e.explain });
  const post = {
    id, site: video.site, pid: video.pid, mode: video.mode, title: video.title || "", tags: video.tags || [], at: S.t, seed, video, res,
    ctx: { heat: +ctx.heat.toFixed(2), crowd: ctx.crowd, stage: S.market.stage[video.pid], siteFit: S.market.siteFit[video.site][video.pid], titleMatch: ctx.titleMatch, ownCount: S.posts.length },
    vf: 0, of: 0, ff: 0, views: 0, orders: 0, missed: 0, returns: 0, revenue: 0, profit: 0, folGained: 0,
    status: "live", analysed: false, done: false, events: evs, afterUpdate: S.updatesApplied.length > 0, searchViews: 0
  };
  S.posts.push(post); if (S.posts.length > 40) S.posts.shift();
  emit("post:created", post); emit("sfx", "whoosh");
  return post;
}

function onTick({ t0, t1, dt }) {
  for (const post of S.posts) {
    if (post.status === "ended") continue;
    const m0 = t0 - post.at, m1 = t1 - post.at, site = D.SITE[post.site], res = post.res;
    let dv = 0, dor = 0;
    for (const w of res.waves) { const d = waveCum(w, m1) - waveCum(w, m0); dv += w.views * d; dor += w.orders * d; }
    if (res.search && m1 > res.waves[0].at && m1 < res.search.days * 1440) {
      const rate = res.search.base * Math.max(res.search.floor, S.market.heat[post.pid] ?? 0.2) / 60 * dt;
      dv += rate; dor += rate * res.search.conv; post.searchViews += rate;
    }
    if (post.mode === "own") dor *= priceConv(post.pid);   // the listing price shifts how many viewers buy (MarketPlaza)
    post.vf += dv; post.of += dor;
    post.views = Math.floor(post.vf);
    if (res.viewers.total > 0) { post.ff += dv * res.followGain / res.viewers.total; const g = Math.floor(post.ff) - post.folGained; if (g > 0) { post.folGained += g; S.followers[post.site] = (S.followers[post.site] || 0) + g; emit("followers:changed", post.site); } }
    const target = Math.floor(post.of), have = post.orders + post.missed + (post._lost || 0);
    for (let i = have; i < target; i++) emit("order:new", { postId: post.id, pid: post.pid, mode: post.mode, site: post.site });
    if (!post.analysed && m1 >= D.time.analysisDelayMin) {
      post.analysed = true; emit("post:analysed", post);
      emit("inbox:add", { kind: "result", title: "First results are in", text: `${prod(post.pid).short} on ${site.name}: ${post.views} views so far. Open the results.`, link: post.id });
    }
    if (!post.done && m1 >= site.doneAfter) {
      post.done = true; post.status = "done"; emit("post:done", post);
      emit("inbox:add", { kind: "result", title: "Your post has ended", text: `${prod(post.pid).short} on ${site.name}: ${post.views} views, ${post.orders} orders. Mr. Algo has notes.`, link: post.id });
      emit("summary:add", `Your ${prod(post.pid).short} post on ${site.name} ended: ${post.views} views, ${post.orders} orders.`); emit("sfx", "ding");
    }
    if (post.done && !(res.search && m1 < res.search.days * 1440)) post.status = "ended";
  }
}
