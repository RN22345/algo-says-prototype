/* VIEWER MODEL (pure). simulate(video, product, siteId, ctx, seed) -> result.
   Each viewer has five questions (what, why, works, trust, get) and some patience. Patience drains every second unless a clip answers a question
   (or a new clip shows something new). At zero the viewer leaves. A viewer who stays and has enough answered may buy.
   The market decides how many viewers come (waves, followers first, then strangers). The video decides how many stay and buy.
   No events, no state: same inputs and seed give the same result. All numbers come from data/shots.json, data/viewers.json and data/sites.json. */
import { D } from "../core/data.js";
import { mulberry, clamp } from "../core/state.js";

const Q = ["what", "why", "works", "trust", "get"];
const sum = a => a.reduce((x, y) => x + y, 0);

/* How strongly one shot answers each question, 0 to 1, plus its trait fit and clarity. */
export function clipStrengths(clip, product, cfg = D) {
  const sh = cfg.shots, act = sh.actions.find(a => a.id === clip.action), ang = sh.angles.find(a => a.id === clip.angle), lt = sh.lights.find(l => l.id === clip.light);
  const dl = cfg.time.daylight, night = !(clip.hour >= dl[0] && clip.hour < dl[1]);
  const fits = product.traits.map(t => {
    let f = (act.fits[t] ?? 0.3) * (ang.fitMul[t] ?? 1);
    f *= (night && lt.nightFitMul && lt.nightFitMul[t] != null) ? lt.nightFitMul[t] : (lt.fitMul[t] ?? 1);
    return clamp(f, 0, 1.15);
  });
  const fit = sum(fits) / fits.length;
  const clarity = night && lt.nightClarity ? lt.nightClarity : lt.clarity;
  const combo = sh.combos[clip.action + ":" + clip.angle] ?? 1;
  const s = {};
  for (const q of Q) {
    const w = sh.questionFit[q];
    let v = act.answers[q] * (ang.mod[q] ?? 1) * combo * (1 - w + w * fit);
    if (sh.clarityQuestions.includes(q)) v *= clamp(clarity, 0.5, 1.15);
    s[q] = clamp(v, 0, 1);
  }
  return { s, fit, clarity, shift: lt.shift || 0, act, ang, lt };
}

/* Build the final timeline from the clips and the edit choices. */
export function buildBlocks(video, product, cfg = D) {
  const sh = cfg.shots, M = cfg.viewers.model, e = video.edit;
  const byId = Object.fromEntries(video.clips.map(c => [c.id, c]));
  let t = 0; const blocks = []; let prevAction = null;
  for (const id of e.order) {
    const c = byId[id]; if (!c) continue;
    const [ts, te] = (e.trims && e.trims[id]) || [0, 0];
    const vis0 = ts, vis1 = c.dur - te, len = Math.max(0.5, vis1 - vis0);
    const act = sh.actions.find(a => a.id === c.action);
    const ansPos = c.d0 + act.ansAt * (c.dur - c.d0 - c.d1);
    let ansMult = 1;
    const margin = Math.min(ansPos - ts, (c.dur - te) - ansPos);
    if (margin < 0) ansMult = M.answerLostMult; else if (margin < M.answerEdge) ansMult = M.answerEdgeMult;
    const cs = clipStrengths(c, product, cfg);
    blocks.push({
      id, slot: c.slot, action: c.action, angle: c.angle, light: c.light, start: t, end: t + len, len,
      deadHead: Math.max(0, c.d0 - ts), deadTail: Math.max(0, c.d1 - te), ansT: t + Math.max(0, ansPos - ts), ansMult, s: cs.s, fit: cs.fit, shift: cs.shift, novelMult: prevAction === c.action ? 0.4 : 1
    });
    t += len; prevAction = c.action;
  }
  return { blocks, T: t };
}

/* The model. ctx: { heat, crowd, followers, trust, reachMult, convMult, dealSpend, returnAdd, patienceMult, titleMatch, tagHits, ownMode, stockLeft } */
export function simulate(video, product, siteId, ctx, seed, cfg = D) {
  const M = cfg.viewers.model, V = cfg.viewers, site = cfg.SITE[siteId], rng = mulberry(seed), e = video.edit;
  const { blocks, T } = buildBlocks(video, product, cfg);
  const hasColour = product.traits.includes("colour");
  const vivid = e.filter === "vivid", only2 = e.sticker === "only2" && !(ctx.ownMode && (ctx.stockLeft ?? 99) <= 2);

  // adjust strengths by edit choices
  for (const b of blocks) {
    const s = b.s;
    if (e.captions) { s.what = clamp(s.what * (1 + M.captionBoost), 0, 1); s.why = clamp(s.why * (1 + M.captionBoost), 0, 1); }
    if (e.filter === "bright") for (const q of cfg.shots.clarityQuestions) s[q] = clamp(s[q] * M.brightBoost, 0, 1);
    if (vivid) s.why = clamp(s.why * M.vividWhy, 0, 1);
    if (e.sticker === "only2") s.why = clamp(s.why * M.stickerWhy, 0, 1);
    for (const q of Q) s[q] = clamp(s[q] * b.ansMult, 0, 1);
  }
  // extra price overlay
  const overlay = [];
  if (e.priceAt === "first" && blocks.length) overlay.push({ t: blocks[0].start + Math.min(blocks[0].len * 0.5, 1.2), q: "get", s: M.priceOverlay });
  if (e.priceAt === "last" && blocks.length) { const b = blocks[blocks.length - 1]; overlay.push({ t: Math.max(b.start, b.end - 1.2), q: "get", s: M.priceOverlay }); }

  // events timeline
  const evs = [];
  for (const b of blocks) {
    evs.push({ t: b.start + b.deadHead + 0.01, nov: b.novMult ?? b.novelMult });
    evs.push({ t: b.ansT, s: b.s });
  }
  for (const o of overlay) evs.push({ t: o.t, s: { [o.q]: o.s } });
  evs.sort((a, b) => a.t - b.t);

  const soundMod = type => (V.soundMods[e.sound || "none"] || {})[type] ?? 1;
  const bins = Math.max(2, Math.ceil(T / 0.5) + 1);
  const deadAt = t => blocks.some(b => (t >= b.start && t < b.start + b.deadHead) || (t > b.end - b.deadTail && t <= b.end));

  function pickType(mix) { let r = rng(), a = 0; for (const [k, p] of Object.entries(mix)) { a += p; if (r <= a) return k; } return Object.keys(mix)[0]; }

  function cohort(n, mixKey, patMult) {
    const mix = V.mix[mixKey], alive = new Array(bins).fill(0), reasons = {}, leaveSecs = {};
    let buySum = 0, watchFrac = 0, hookLeft = 0, ansCount = { what: 0, why: 0, works: 0, trust: 0, get: 0 };
    for (let i = 0; i < n; i++) {
      const type = pickType(mix), ty = V.types[type], w = ty.w;
      let P = site.patience * ty.patience * patMult * (ctx.patienceMult ?? 1) * (M.patJitterMin + (M.patJitterMax - M.patJitterMin) * rng());
      const answered = {}, conf = {}; let t = 0, ei = 0, left = null;
      const interest = M.interestMin + (M.interestMax - M.interestMin) * rng();
      while (t < T - 1e-9) {
        const t2 = Math.min(T, t + M.step);
        while (ei < evs.length && evs[ei].t <= t2) {
          const ev = evs[ei++], sm = soundMod(type);
          if (ev.nov != null) P += site.novelty * ev.nov * sm;
          if (ev.s) for (const q of Q) {
            const st = ev.s[q] || 0; if (st < M.answerMin) continue;
            const rf = site.refill * M.refillScale * (M.refillBase + M.refillW * w[q]) * st * sm * interest * (answered[q] ? M.repeatAnswer : 1);
            P += rf; if (!answered[q]) { answered[q] = true; conf[q] = st; } else conf[q] = Math.max(conf[q], st);
          }
        }
        P -= M.drain * (answered.what ? M.drainCommitted : 1) * (t2 - t);
        if (P <= 0) { left = t2; break; }
        t = t2;
      }
      const leaveT = left ?? T;
      let reason = "end";
      if (left != null) {
        if (deadAt(left) && !answered.what) reason = "deadair";
        else {
          let best = null, bw = M.leaveWeightMin;
          for (const q of Q) if (!answered[q] && w[q] > bw) { best = q; bw = w[q]; }
          reason = best || "length";
          if (deadAt(left) && reason === "length") reason = "deadair";
        }
      }
      reasons[reason] = (reasons[reason] || 0) + 1; (leaveSecs[reason] = leaveSecs[reason] || []).push(leaveT);
      if (left != null && left <= 3.01 && !answered.what) hookLeft++;
      for (const q of Q) if (answered[q]) ansCount[q]++;
      const lastBin = left == null ? bins - 1 : Math.min(bins - 1, Math.floor(leaveT / 0.5));
      for (let b = 0; b <= lastBin; b++) alive[b]++;
      watchFrac += Math.min(1, leaveT / Math.max(T, 0.1));
      const score = sum(Q.map(q => w[q] * (conf[q] || 0)));
      buySum += M.buyBase * ty.buy * Math.pow(score, M.buyPower) * (answered.get ? 1 : M.noPriceMult) * (answered.what ? 1 : M.noWhatMult) * (type === "deal" ? (ctx.dealSpend ?? 1) : 1);
    }
    return { n, alive: alive.map(a => a / n), reasons, leaveSecs, buy: buySum / n, watch: watchFrac / n, hookLeft: hookLeft / n, ans: Object.fromEntries(Q.map(q => [q, ansCount[q] / n])) };
  }

  const R = site.reach, folls = ctx.followers ?? 0;
  const c1 = cohort(M.cohortFollowers, "followers", M.followersPatience);
  const perf = c1.watch;
  const tagMult = 1 + M.tagBonus * Math.min(M.tagCap, ctx.tagHits ?? 0);
  const V1 = Math.round(folls * R.followRate + R.seed);
  const V2 = Math.round(R.strangers * (R.heatBase + R.heatK * ctx.heat) / (1 + R.crowdK * ctx.crowd) * (R.perfBase + R.perfK * perf) * tagMult * (ctx.reachMult ?? 1));
  const c2 = cohort(M.cohortStrangers, siteId, 1);

  // conversion multipliers
  const trustMult = M.trustBase + M.trustSpan * (ctx.trust ?? 50) / 100;
  let mult = (M.convHeatBase + M.convHeat * ctx.heat) * trustMult * (ctx.convMult ?? 1) * (site.convMult ?? 1);
  if (vivid && hasColour) mult *= M.vividConv;
  if (only2) mult *= M.stickerConv;
  const o1 = V1 * c1.buy * mult * (0.9 + 0.2 * rng()), o2 = V2 * c2.buy * mult * (0.9 + 0.2 * rng());

  // waves
  const waves = [
    { id: site.waves[0].id, at: site.waves[0].at, dur: site.waves[0].dur, tau: site.waves[0].tau, views: V1, orders: o1 },
    { id: site.waves[1].id, at: site.waves[1].at, dur: site.waves[1].dur, tau: site.waves[1].tau, views: V2, orders: o2 }
  ];
  // search trickle (long video only)
  let search = null;
  if (site.search) {
    const cs = cohort(M.cohortSearch, "search", 1.1);
    const base = site.search.base * (ctx.titleMatch ?? 0) * (0.6 + 0.8 * perf) * (ctx.reachMult ?? 1);
    search = { base, floor: site.search.floor, days: site.search.days, conv: cs.buy * mult * 1.2 };
  }

  // combine retention and reasons by view weight
  const tot = Math.max(1, V1 + V2), w1 = V1 / tot, w2 = V2 / tot;
  const retention = Array.from({ length: bins }, (_, i) => +(c1.alive[i] * w1 + c2.alive[i] * w2).toFixed(3));
  const reasonShare = {}, secs = {};
  for (const [c, wt] of [[c1, w1], [c2, w2]]) for (const [k, v] of Object.entries(c.reasons)) { reasonShare[k] = (reasonShare[k] || 0) + (v / c.n) * wt; (secs[k] = secs[k] || []).push(...c.leaveSecs[k]); }
  const answered = Object.fromEntries(Q.map(q => [q, +(c1.ans[q] * w1 + c2.ans[q] * w2).toFixed(3)]));
  const hookLeft = c1.hookLeft * w1 + c2.hookLeft * w2;
  const avgWatch = c1.watch * w1 + c2.watch * w2;

  // honesty and colour
  const shifted = blocks.length ? sum(blocks.map(b => b.shift)) / blocks.length : 0;
  const colourSev = hasColour ? Math.max(shifted, vivid ? 0.9 : 0) : 0;
  const colourDoubt = colourSev >= 0.4;
  const traps = []; if (vivid && hasHonestyColour(hasColour)) traps.push("colour"); if (only2) traps.push("sticker");
  let returnRate = M.returnBase + (colourDoubt ? M.returnColour * Math.min(1, colourSev + 0.2) : 0) + (only2 ? M.returnSticker : 0) + (ctx.returnAdd ?? 0);
  returnRate = clamp(returnRate, 0, M.returnCap);
  const returnWhy = []; if (colourDoubt) returnWhy.push("colour"); if (only2) returnWhy.push("sticker");

  // comments
  const comments = []; const askText = V.askText;
  const pickT = (arr, k) => arr[Math.floor(rng() * arr.length)];
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
  for (const [k, share] of Object.entries(reasonShare)) {
    if (k === "end" || k === "length" || share < M.commentMinShare || !askText[k]) continue;
    const sec = Math.round(Math.max(0, med(secs[k])) * 2) / 2;
    comments.push({ sec, text: pickT(askText[k]), kind: k });
  }
  if (product.traits.includes("scale")) {
    const sf = blocks.length ? sum(blocks.map(b => (cfg.shots.actions.find(a => a.id === b.action).fits.scale ?? 0.3) * (cfg.shots.angles.find(a => a.id === b.angle).fitMul.scale ?? 1))) / blocks.length : 0;
    if (sf < 0.5) comments.push({ sec: Math.round(T * 0.45 * 2) / 2, text: pickT(askText.size), kind: "size" });
  }
  if (colourDoubt && product.colourLook) {
    const cb = blocks.find(b => b.shift >= 0.4) || blocks[0];
    const look = product.colourLook, txt = pickT(askText.colour).replace("{a}", look[0]).replace("{b}", look[1]);
    comments.push({ sec: Math.round(((cb ? cb.start : 0) + 1.5) * 2) / 2, text: txt, kind: "colour" });
  }
  const ordersTotal = o1 + o2;
  if (ordersTotal >= 1) { comments.push({ sec: Math.max(0, Math.round((T - 1) * 2) / 2), text: pickT(askText.thanks), kind: "thanks" }); if (ordersTotal >= 8) comments.push({ sec: Math.max(0, Math.round((T - 2) * 2) / 2), text: pickT(askText.thanks), kind: "thanks" }); }
  comments.sort((a, b) => a.sec - b.sec);
  const seen = new Set(); const cm = [];
  for (const c of comments) { if (seen.has(c.text)) continue; seen.add(c.text); c.who = 1 + Math.floor(rng() * 6); cm.push(c); if (cm.length >= M.maxComments) break; }

  const bestS = Object.fromEntries(Q.map(q => [q, +Math.max(0, ...blocks.map(b => b.s[q])).toFixed(2)]));
  return {
    T: +T.toFixed(1), blocks: blocks.map(b => ({ id: b.id, slot: b.slot, action: b.action, angle: b.angle, light: b.light, start: +b.start.toFixed(2), end: +b.end.toFixed(2), deadHead: +b.deadHead.toFixed(2), deadTail: +b.deadTail.toFixed(2), ans: +b.ansT.toFixed(2), lost: b.ansMult < 0.5 })),
    viewers: { total: V1 + V2, followers: V1, strangers: V2 }, waves, search,
    retention, dropReasons: Object.fromEntries(Object.entries(reasonShare).map(([k, v]) => [k, +v.toFixed(3)])), answered, bestS,
    comments: cm, orders: { total: +(o1 + o2).toFixed(2), followers: +o1.toFixed(2), strangers: +o2.toFixed(2) },
    returns: { rate: +returnRate.toFixed(3), why: returnWhy, expected: +(ordersTotal * returnRate).toFixed(2) },
    followGain: Math.round((V1 + V2) * 0.03 * (0.4 + avgWatch)),
    facts: { hookLeft: +hookLeft.toFixed(3), colourDoubt, misleading: traps.length > 0, traps, finish: retention[retention.length - 1], avgWatch: +avgWatch.toFixed(3), perf: +perf.toFixed(3), buyPer: +(((o1 + o2) / tot)).toFixed(4) }
  };
}
function hasHonestyColour(hasColour) { return hasColour; }

/* Cumulative share of a wave done m minutes after posting, 0 to 1. */
export function waveCum(w, m) {
  if (m <= w.at) return 0;
  const x = Math.min(m - w.at, w.dur);
  return (1 - Math.exp(-x / w.tau)) / (1 - Math.exp(-w.dur / w.tau));
}
