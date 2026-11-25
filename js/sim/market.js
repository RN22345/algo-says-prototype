/* MARKET: hidden trend lifecycles. Each product runs calm -> whisper -> rising -> peak -> crowded -> afterglow -> calm.
   About 40% of whispers fizzle; a fizzling whisper shows signals from ONE source only. The player never sees the stage.
   Every tick this writes derived values into S.market (heat, stage, crowd, costMult, inDemand, siteFit) for other systems.
   Data: data/market.json. Events in: tick, newgame, market:push {p, stage}. Events out: inbox:add (buyer asks).
   Reads S.mods (from events.js): heatAdd, crowd, cost. */
import { D } from "../core/data.js";
import { S, rand, rr, pick, clamp } from "../core/state.js";
import { on, emit } from "../core/bus.js";

const NEXT = { whisper: "rising", rising: "peak", peak: "crowded", crowded: "afterglow", afterglow: "calm" };
const MK = () => D.market.trends;
const seg = a => rr(a[0], a[1]);

export function init() {
  on("newgame", seed);
  on("tick", onTick);
  on("market:push", ({ p, stage }) => pushTo(p, stage));
  ensure(); refresh();
}

function ensure() {
  for (const p of D.products) if (!S.trends[p.id]) S.trends[p.id] = { stage: "calm", t: 0, len: 0, fz: false, n: 0, src: null };
  if (S.trendNext == null) S.trendNext = seg(MK().startEvery);
}
function seed() {
  S.trends = {}; ensure();
  for (const s of D.config.start.seedTrends || []) {
    const tr = S.trends[s.p]; if (!tr) continue;
    tr.stage = s.stage; tr.len = seg(MK().stages[s.stage]); tr.t = tr.len * (s.t ?? 0); tr.fz = !!s.fz; tr.n++;
    if (tr.fz) tr.src = pick(D.market.creators);
  }
  refresh();
}
export function pushTo(p, stage) {
  const tr = S.trends[p]; if (!tr) return;
  tr.stage = stage; tr.t = 0; tr.fz = false; tr.len = stage === "calm" ? 0 : seg(MK().stages[stage]); tr.n++;
  refresh();
}

function baseHeat(p) {
  const tr = S.trends[p], H = MK().heat;
  if (tr.stage === "calm") return D.P[p].evergreen ? H.evergreen : H.calm;
  const h = H[tr.stage], f = tr.len ? Math.min(1, tr.t / tr.len) : 0;
  return Array.isArray(h) ? h[0] + (h[1] - h[0]) * f : h;
}

function advance(tr) {
  if (tr.stage === "whisper" && tr.fz) { tr.stage = "calm"; tr.t = 0; tr.len = 0; tr.src = null; return; }
  tr.stage = NEXT[tr.stage] || "calm"; tr.t = 0; tr.len = tr.stage === "calm" ? 0 : seg(MK().stages[tr.stage]);
}
function startOne() {
  const calm = D.products.filter(p => S.trends[p.id].stage === "calm" && !p.evergreen);
  if (!calm.length) return;
  const p = pick(calm), tr = S.trends[p.id];
  tr.stage = "whisper"; tr.t = 0; tr.len = seg(MK().stages.whisper); tr.fz = rand() < MK().fizzle; tr.n++; tr.src = tr.fz ? pick(D.market.creators) : null;
}

function onTick({ dt }) {
  ensure();
  for (const p of D.products) {
    const tr = S.trends[p.id]; if (tr.stage === "calm") continue;
    tr.t += dt; if (tr.t >= tr.len) advance(tr);
  }
  S.trendNext -= dt;
  if (S.trendNext <= 0) {
    S.trendNext = seg(MK().startEvery);
    if (Object.values(S.trends).filter(t => t.stage !== "calm").length < MK().maxActive) startOne();
  }
  refresh();
  // buyer asks, only during a real trend
  for (const p of D.products) {
    if (!S.market.inDemand[p.id]) continue;
    if (rand() < MK().askPerHour / 60 * dt * S.market.heat[p.id]) buyerAsk(p);
  }
}

function buyerAsk(p) {
  const unread = S.inbox.filter(m => m.kind === "ask" && !m.read).length; if (unread >= 5) return;
  const name = pick(D.market.askNames), text = pick(D.market.asks).replace("{n}", p.short.toLowerCase());
  emit("inbox:add", { kind: "ask", title: name, text, pid: p.id, site: "TikTik" });
}

/* Derived values. */
function refresh() {
  const M = S.mods || {}, mk = S.market;
  const win = MK().crowdWindow;
  for (const p of D.products) {
    const id = p.id, tr = S.trends[id]; if (!tr) continue;
    const heat = clamp(baseHeat(id) + ((M.heatAdd && M.heatAdd[id]) || 0), 0.05, 1.3);
    mk.heat[id] = heat; mk.stage[id] = tr.stage;
    mk.crowd[id] = S.feed.filter(f => f.r && f.p === id && S.t - f.at < win).length + ((M.crowd && M.crowd[id]) || 0);
    const hot = tr.stage === "rising" || tr.stage === "peak" || tr.stage === "crowded";
    mk.costMult[id] = (hot ? 1 + MK().costHeat * heat : 1) * ((M.cost && M.cost[id]) || 1);
    mk.inDemand[id] = tr.stage !== "calm" && tr.stage !== "afterglow" && !(tr.stage === "whisper" && tr.fz);
    for (const s of Object.keys(MK().siteFit)) { (mk.siteFit[s] = mk.siteFit[s] || {})[id] = MK().siteFit[s][tr.stage]; }
  }
}
export const stageOf = p => (S.trends[p] ? S.trends[p].stage : "calm");
