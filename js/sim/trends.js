/* Trends (D-64, D-69, D-72) and virtual rivals (D-71, D-73). Teaching model, values in data/tuning.json.
   Each product has a hidden lifecycle: calm -> whisper -> rising -> peak -> crowded -> afterglow -> calm.
   About 40% of whispers fizzle. A whisper that will fizzle shows only ONE kind of signal (stranger posts in
   the feeds); a real one also brings buyer questions and a supplier "in demand" tag. The player never sees
   the stage. They read signals: feeds, rival posts, buyer questions, supplier prices, the trending list.
   Rivals are numbers only (no characters in the world): each has one fixed habit. */
import { D, S, on, emit } from "../state.js";

const R = Math.random;
const rr = ([a, b]) => a + R() * (b - a);
const NEXT = { whisper: "rising", rising: "peak", peak: "crowded", crowded: "afterglow", afterglow: "calm" };
const NAMES = ["Ana", "Mark", "Joy", "Kiko", "Bea", "Jen", "Paolo", "Mika", "Rico", "Lea", "Trish", "Jomar"];

export function initTrends() {
  if (!D.T || !D.T.trends) return;
  S.trends = S.trends || {};
  for (const p in D.PR) if (!S.trends[p]) S.trends[p] = { stage: "calm", t: 0, len: 0, fz: false, n: 0 };
  if (!S.rivals) S.rivals = D.T.rivals.map(r => ({ id: r.id, fol: r.fol, sales: 0 }));
  S.rposts = S.rposts || [];
  if (S.trendNext == null) S.trendNext = rr(D.T.trends.startEvery) * 0.4;
  if (S.sold == null) S.sold = 0;
}
on("newgame", initTrends);

const T = () => D.T.trends;
export const isEvergreen = p => T().evergreen.includes(p);

/* How much buyers want a product right now, 0 to 1. Hidden from the player. */
export function heat(p) {
  const tr = S.trends && S.trends[p]; if (!tr) return 0.12;
  if (tr.stage === "calm") return isEvergreen(p) ? 0.3 : T().heat.calm;
  const h = T().heat[tr.stage], f = tr.len ? Math.min(1, tr.t / tr.len) : 0;
  return Array.isArray(h) ? h[0] + (h[1] - h[0]) * f : h;
}
export const stageOf = p => (S.trends && S.trends[p] ? S.trends[p].stage : "calm");

/* Rival posts about a product in the last 3 minutes. */
export const crowd = p => S.rposts.filter(r => r.p === p && S.clock - r.at < 180).length;

/* Multipliers the post model uses. */
export const reachMult = p => (T().reachBase + T().reachHeat * heat(p)) / (1 + T().crowdK * crowd(p));
export const convMult = p => T().convBase + T().convHeat * heat(p);
/* Supplier prices climb while a trend is hot. Buying early is cheaper. */
export const costMult = p => { const s = stageOf(p); return s === "rising" || s === "peak" || s === "crowded" ? 1 + T().costHeat * heat(p) : 1; };
/* The supplier lists an item as "in demand" during a real trend (a second signal source). */
export const inDemand = p => { const tr = S.trends && S.trends[p]; return !!tr && tr.stage !== "calm" && tr.stage !== "afterglow" && !(tr.stage === "whisper" && tr.fz); };

function advance(p, tr) {
  if (tr.stage === "whisper" && tr.fz) { tr.stage = "calm"; tr.t = 0; tr.len = 0; return; }
  tr.stage = NEXT[tr.stage] || "calm"; tr.t = 0;
  tr.len = tr.stage === "calm" ? 0 : rr(T().stages[tr.stage]);
}

function startOne() {
  const calm = Object.keys(D.PR).filter(p => S.trends[p].stage === "calm" && !isEvergreen(p));
  if (!calm.length) return;
  const p = calm[Math.floor(R() * calm.length)], tr = S.trends[p];
  tr.stage = "whisper"; tr.t = 0; tr.len = rr(T().stages.whisper); tr.fz = R() < T().fizzle; tr.n++;
}

/* A buyer asks the seller directly (only during a real trend). */
function buyerAsk(p) {
  const MAXC = D.T.post.maxOpenChats;
  if (S.chats.filter(c => !c.done).length >= MAXC) return;
  const name = NAMES[Math.floor(R() * NAMES.length)], n = D.PR[p].n.toLowerCase();
  const asks = [`Hi po! May ${n} po kayo?`, `Saan po makakabili ng ${n}?`, `Meron pa po ba kayong ${n}?`, `Nakita ko yung ${n} sa feed, available po?`];
  S.chats.push({ name, av: Math.floor(R() * 6), site: "TikTik", type: "avail", p, t: 0, done: false, log: [["in", asks[Math.floor(R() * asks.length)]]] });
  emit("sfx", "chat");
}

export function updateTrends(dt) {
  if (!S.trends) initTrends(); if (!S.trends) return;
  for (const p in S.trends) {
    const tr = S.trends[p]; if (tr.stage === "calm") continue;
    tr.t += dt; if (tr.t >= tr.len) advance(p, tr);
    if (inDemand(p) && R() < T().askRate * heat(p) * dt) buyerAsk(p);
  }
  S.trendNext -= dt;
  if (S.trendNext <= 0) {
    S.trendNext = rr(T().startEvery);
    if (Object.values(S.trends).filter(t => t.stage !== "calm").length < T().maxActive) startOne();
  }
  // virtual rivals post by habit
  D.T.rivals.forEach((r, i) => {
    const st = S.rivals[i]; if (!st) return;
    for (const p in S.trends) {
      const s = S.trends[p].stage;
      if (!r.stages.includes(s)) continue;
      if (s === "whisper" && S.trends[p].fz && r.id !== "kiko") continue;  // only the early mover chases every whisper
      if (R() < r.rate * dt * (T().rivalStage[s] || 1)) {
        const views = Math.round((st.fol * 0.3 + 200) * (0.5 + heat(p)) * (0.6 + R() * 0.8) / (1 + 0.1 * crowd(p)));
        S.rposts.push({ r: r.id, p, site: r.site, at: S.clock, views });
        st.sales += Math.round(views * 0.0025 * (0.7 + heat(p)));
        st.fol += Math.round(views * 0.01);
      }
    }
  });
  if (S.rposts.length > 400 || (S.rposts[0] && S.clock - S.rposts[0].at > 600)) S.rposts = S.rposts.filter(x => S.clock - x.at < 600).slice(-400);
}

/* What the sites show: the most posted items in the last 3 minutes (rivals plus strangers, from heat). A count, not a forecast. */
export function trendingList() {
  return Object.keys(D.PR).map(p => ({ p, posts: Math.round(crowd(p) * 7 + heat(p) * 60 + (stageOf(p) === "calm" ? 0 : 8)) }))
    .sort((a, b) => b.posts - a.posts);
}

/* Leaderboard rows: the player and the virtual rivals, by total sales. */
export function leaderboard() {
  const rows = D.T.rivals.map((r, i) => ({ n: r.n, habit: r.habit, sales: S.rivals[i].sales, fol: S.rivals[i].fol, me: false }));
  const fol = Object.values(S.followers || {}).reduce((a, b) => a + b, 0);
  rows.push({ n: "You", habit: "", sales: S.sold || 0, fol, me: true });
  return rows.sort((a, b) => b.sales - a.sales);
}

/* Rival posts for the feeds, newest first. */
export const rivalPosts = (site, n = 6) => S.rposts.filter(x => !site || x.site === site).slice(-n).reverse()
  .map(x => ({ ...x, name: (D.T.rivals.find(r => r.id === x.r) || {}).n || "Seller" }));
