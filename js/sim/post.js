/* Post model (teaching model, values in data/tuning.json). */
import { D, S, toast } from "../state.js";
import { makeOrder } from "./shop.js";

const R = Math.random;

export function startPost(sel) {
  const T = D.T.post, PR = D.PR;
  const hook = T.hookClips.includes(sel.clips[0]);
  const priceCover = sel.text === "price", priceCap = /₱|\d{2,}/.test(sel.caption), priceClip = sel.clips.includes("price");
  const priceShown = priceCover || priceCap;
  const last = S.posts[S.posts.length - 1];
  const fat = last && last.p === sel.p && last.clips[0] === sel.clips[0] ? T.repeatMult : 1;
  const first = S.posts.length === 0 ? T.firstPostMult : 1;
  const reach = (T.reachBase + R() * T.reachRange) * (hook ? T.hookMult : T.noHookMult) * (sel.shot === "face" ? T.faceMult : 1) * fat * first;
  const conv = T.convBase * (priceShown ? T.priceShownMult : priceClip ? T.priceClipMult : 1) * PR[sel.p].f;
  const [eb, er] = hook ? T.hookEndPct : T.noHookEndPct;
  S.post = {
    p: sel.p, clips: [...sel.clips], shot: sel.shot, text: sel.text, sticker: sel.sticker, caption: sel.caption, reach, conv, hook, priceShown,
    t: 0, views: 0, orders: 0, missed: 0, acc: 0, cacc: 0, comments: [], counts: {}, samples: [0],
    leftAt: hook ? T.hookLeftAt : T.noHookLeftAt, endPct: eb + R() * er, first: S.posts.length === 0
  };
  S.posted = true; toast("Posted on TikTik");
}

function commentFor(p) {
  const W = D.T.post.commentWeights;
  const w = [["price", p.priceShown ? W.price.shown : W.price.hidden], ["cod", W.cod], ["where", W.where], ["what", p.hook ? W.what.hook : W.what.noHook], ["praise", W.praise]];
  let r = R() * w.reduce((a, b) => a + b[1], 0), type = "praise"; for (const [k, v] of w) { if ((r -= v) < 0) { type = k; break; } }
  const T = { price: ["How much po?", "HM?", "Magkano?", "Price pls"], cod: ["COD po?", "Pwede COD?"], where: ["Saan location?", "Taga-saan po kayo?"], what: ["Ano 'to?", "Ano po yan?"], praise: D.PR[p.p].praise };
  return { type, text: T[type][Math.floor(R() * T[type].length)], av: Math.floor(R() * 6) };
}

export function updatePost(dt) {
  const p = S.post; if (!p) return;
  const T = D.T.post, PR = D.PR, TAU = T.tau, DUR = T.duration;
  const t0 = p.t; p.t = Math.min(DUR, p.t + dt);
  const dv = p.reach * (Math.exp(-t0 / TAU) - Math.exp(-p.t / TAU)); p.views += dv;
  p.acc += dv * p.conv * (S.rating / T.ratingRef) * (T.convJitterMin + R() * T.convJitterRange); while (p.acc >= 1) { p.acc--; makeOrder(p.p); }
  p.cacc += dv * T.commentRate; while (p.cacc >= 1) {
    p.cacc--; const c = commentFor(p); p.comments.unshift(c); p.comments.length = Math.min(p.comments.length, T.maxComments); p.counts[c.text] = (p.counts[c.text] || 0) + 1;
    if (c.type !== "what" && R() < T.chatChance && S.chats.filter(x => !x.done).length < T.maxOpenChats) {
      const name = D.T.chat.names[Math.floor(R() * D.T.chat.names.length)];
      const ask = { price: "Hi! How much po yung " + PR[p.p].n.toLowerCase() + "?", cod: "Pwede po COD?", where: "Saan po kayo located?", praise: "Available pa po?" }[c.type];
      S.chats.push({ name, av: c.av, type: c.type === "praise" ? "avail" : c.type, p: p.p, t: 0, done: false, log: [["in", ask]] });
    }
  }
  if (Math.floor(p.t) > p.samples.length - 1) p.samples.push(p.reach / TAU * Math.exp(-p.t / TAU));
  if (p.t >= DUR) { S.posts.push(p); S.last = p; S.post = null; S.algoUnread = true; toast(`TikTik post ended: ${Math.round(p.views).toLocaleString()} views. Mr. Algo has notes.`, "img/algo_unit_happy.png"); }
}

/* Developer helper: run the current post to its end. */
export function finishPostNow() {
  let guard = 0;
  while (S.post && guard++ < 200) updatePost(1);
}
