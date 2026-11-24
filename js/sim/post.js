/* Post model (teaching model, values in data/tuning.json).
   Several posts can run at once (S.running). Each site has its own curve:
   TikTik  - fast spike, fades fast.
   YouView - slow start, long run, then a small search trickle (catalogue).
   Followers only seed the start of a post (FOUNDATION §5). */
import { D, S, toast, emit } from "../state.js";
import { makeOrder } from "./shop.js";
import { reachMult, convMult, heat, crowd, stageOf } from "./trends.js";

const R = Math.random;

export const SITE_NAME = { tiktik: "TikTik", youview: "YouView", facebazaar: "FaceBazaar" };
export const activePosts = site => S.running.filter(p => !site || p.site === site);
export const lastPost = site => [...S.posts].reverse().find(p => !site || p.site === site) || null;
export const sitePosts = site => S.posts.filter(p => p.site === site);

/* Views per second at time t for a post (shape only, scaled by reach). */
function rate(p, t) {
  if (p.site === "youview") { const k = p.tau; return p.reach * (t / (k * k)) * Math.exp(-t / k); }
  return p.reach / p.tau * Math.exp(-t / p.tau);
}

/* sel: { p, clips, shot, text, sticker, caption } for TikTik;
        { p, title, segs: [ids], thumb: "honest"|"bold" } for YouView. */
export function startPost(sel, site = "tiktik") {
  const T = D.T.post, S2 = T.sites[site], PR = D.PR;
  const prev = sitePosts(site), last = prev[prev.length - 1];
  let quality = 1, priceShown = false, hook = true, searchable = true;
  if (site === "tiktik") {
    hook = T.hookClips.includes(sel.clips[0]);
    priceShown = sel.text === "price" || /₱|\d{2,}/.test(sel.caption || "");
    quality = (hook ? T.hookMult : T.noHookMult) * (sel.shot === "face" ? T.faceMult : 1);
    if (!priceShown && sel.clips.includes("price")) priceShown = true;
  } else if (site === "youview") {
    const title = (sel.title || "").toLowerCase(), name = PR[sel.p].n.toLowerCase();
    searchable = title.includes(name.split(" ")[0]) || /review|unbox|sulit|legit|test/.test(title);
    quality = (searchable ? T.searchMult : 1) * (sel.segs && sel.segs.length >= 3 ? 1 : T.fewSegsMult) * (sel.thumb === "bold" ? T.boldThumbReach : 1);
    priceShown = sel.segs && sel.segs.includes("price");
  }
  const fat = last && last.p === sel.p && S.clock - last.at < T.repeatWindow ? T.repeatMult : 1;
  const first = prev.length === 0 ? T.firstPostMult : 1;
  const fol = S.followers[site] || 0;
  const reach = (S2.reachBase + R() * S2.reachRange + fol * T.followerSeed) * quality * fat * first;
  const conv = T.convBase * S2.convMult * (priceShown ? T.priceShownMult : 1) * PR[sel.p].f * (sel.thumb === "bold" ? T.boldThumbConv : 1);
  const [eb, er] = hook ? T.hookEndPct : T.noHookEndPct;
  const p = {
    site, p: sel.p, clips: [...(sel.clips || [])], shot: sel.shot, text: sel.text, sticker: sel.sticker, caption: sel.caption || "",
    title: sel.title || "", segs: [...(sel.segs || [])], thumb: sel.thumb || "",
    reach, conv, hook, priceShown, tau: S2.tau, dur: S2.duration, at: S.clock,
    t: 0, views: 0, orders: 0, missed: 0, acc: 0, cacc: 0, comments: [], counts: {}, samples: [0],
    leftAt: hook ? T.hookLeftAt : T.noHookLeftAt, endPct: eb + R() * er, first: prev.length === 0, done: false,
    why: { heat: heat(sel.p), crowd: crowd(sel.p), stage: stageOf(sel.p), repeat: fat < 1, searchable, stock: S.stock[sel.p], fol }, mSum: 0, mT: 0
  };
  S.running.push(p);
  S.posted = true; toast(`Posted on ${SITE_NAME[site]}`); emit("sfx", "post");
  return p;
}

function commentFor(p) {
  const W = D.T.post.commentWeights;
  const w = [["price", p.priceShown ? W.price.shown : W.price.hidden], ["cod", W.cod], ["where", W.where], ["what", p.hook ? W.what.hook : W.what.noHook], ["praise", W.praise]];
  let r = R() * w.reduce((a, b) => a + b[1], 0), type = "praise"; for (const [k, v] of w) { if ((r -= v) < 0) { type = k; break; } }
  const T = { price: ["How much po?", "HM?", "Magkano?", "Price pls"], cod: ["COD po?", "Pwede COD?"], where: ["Saan location?", "Taga-saan po kayo?"], what: ["Ano 'to?", "Ano po yan?"], praise: D.PR[p.p].praise };
  return { type, text: T[type][Math.floor(R() * T[type].length)], av: Math.floor(R() * 6) };
}

function addViews(p, dv) {
  const T = D.T.post, PR = D.PR;
  p.views += dv;
  p.acc += dv * p.conv * convMult(p.p) * (S.rating / T.ratingRef) * (T.convJitterMin + R() * T.convJitterRange);
  while (p.acc >= 1) { p.acc--; makeOrder(p.p, false, p); }
  p.cacc += dv * T.commentRate; while (p.cacc >= 1) {
    p.cacc--; const c = commentFor(p); p.comments.unshift(c); p.comments.length = Math.min(p.comments.length, T.maxComments); p.counts[c.text] = (p.counts[c.text] || 0) + 1;
    if (c.type !== "what" && R() < T.chatChance && S.chats.filter(x => !x.done).length < T.maxOpenChats) {
      const name = D.T.chat.names[Math.floor(R() * D.T.chat.names.length)];
      const ask = { price: "Hi! How much po yung " + PR[p.p].n.toLowerCase() + "?", cod: "Pwede po COD?", where: "Saan po kayo located?", praise: "Available pa po?" }[c.type];
      emit("sfx", "chat"); S.chats.push({ name, av: c.av, site: SITE_NAME[p.site], type: c.type === "praise" ? "avail" : c.type, p: p.p, t: 0, done: false, log: [["in", ask]] });
    }
  }
}

export function updatePost(dt) {
  const T = D.T.post;
  for (const p of S.running) {
    const t0 = p.t; p.t = Math.min(p.dur, p.t + dt);
    // integrate the rate with two half steps (smooth enough for both curve shapes)
    const m = reachMult(p.p); p.mSum += m * dt; p.mT += dt;
    const dv = (rate(p, t0) + rate(p, p.t)) / 2 * (p.t - t0) * m;
    addViews(p, dv);
    if (Math.floor(p.t / T.sampleEvery) > p.samples.length - 1) p.samples.push(rate(p, p.t));
    if (p.t >= p.dur) {
      p.done = true; p.base = p.views;
      const gain = Math.round(p.views * T.followRate);
      S.followers[p.site] = (S.followers[p.site] || 0) + gain;
      S.posts.push(p); S.last = p; S.algoUnread = true;
      toast(`${SITE_NAME[p.site]} post ended: ${Math.round(p.views).toLocaleString()} views, ${p.orders} orders, +${gain} followers. Mr. Algo has notes.`, "img/algo_unit_happy.png");
    }
  }
  S.running = S.running.filter(p => !p.done);
  // Back catalogue: finished YouView posts keep a small search trickle while stock lasts.
  S.trickleAcc = (S.trickleAcc || 0) + dt;
  if (S.trickleAcc >= 5) {
    const step = S.trickleAcc; S.trickleAcc = 0;
    const yv = sitePosts("youview"), cap = 1 + T.catalogueK * yv.length;
    yv.forEach(p => { if (S.stock[p.p] > 0) addViews(p, (p.base || p.views) * T.trickle * step / cap * (0.3 + heat(p.p))); });
  }
}

/* Developer helper: run every running post to its end. */
export function finishPostNow() {
  let guard = 0;
  while (S.running.length && guard++ < 2000) updatePost(1);
}
