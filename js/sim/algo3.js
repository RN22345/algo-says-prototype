/* MR. ALGO'S 3 THINGS: one thing that worked, one that did not, one to try next, plus how sure he is, and any market event that explains the result.
   Pure read of a post (no state changes). Text comes from data/viewers.json "reasons". */
import { D } from "../core/data.js";
import { clamp } from "../core/state.js";

const R = () => D.viewers.reasons;

export function three(post) {
  const res = post.res, f = res.facts, drops = res.dropReasons, ctx = post.ctx;
  // candidates that went wrong, each with a severity 0..1
  const neg = [];
  for (const k of ["deadair", "what", "why", "works", "trust", "get"]) if (drops[k]) neg.push({ id: k, sev: drops[k] * (k === "get" && (post.video.edit.priceAt || "off") === "off" && !post.video.clips.some(c => c.action === "price") ? 1.1 : 1) });
  if ((drops.length || 0) > 0.3) neg.push({ id: "length", sev: drops.length });
  if (f.colourDoubt) neg.push({ id: "colour", sev: 0.75 });
  if (f.misleading) neg.push({ id: "honest", sev: post.returns > 0 ? 0.95 : 0.55 });
  if (ctx.heat < 0.3 || ctx.crowd >= 3) neg.push({ id: "market", sev: ctx.heat < 0.3 ? 0.7 : 0.5 });
  if ((ctx.siteFit ?? 1) < 0.5) neg.push({ id: "site", sev: 0.55 });
  if (post.missed >= 1) neg.push({ id: "stock", sev: 0.6 + Math.min(0.3, post.missed * 0.05) });
  if (post.views >= 300 && post.orders / Math.max(1, post.views) < 0.012) neg.push({ id: "sales", sev: 0.5 });
  neg.sort((a, b) => b.sev - a.sev);
  // candidates that went right, with a score 0..1
  const pos = [];
  for (const k of ["what", "why", "works", "trust", "get"]) pos.push({ id: k, sc: (res.answered[k] || 0) * (res.bestS[k] || 0) * (k === "get" ? 0.95 : 1) });
  pos.push({ id: "length", sc: f.finish > 0.3 ? 0.5 + f.finish * 0.4 : 0 });
  pos.push({ id: "deadair", sc: (drops.deadair || 0) < 0.04 ? 0.55 : 0 });
  if (ctx.heat >= 0.7 && ctx.crowd <= 1) pos.push({ id: "market", sc: 0.8 });
  if ((ctx.siteFit ?? 0) >= 0.9) pos.push({ id: "site", sc: 0.7 });
  if (!f.colourDoubt && D.P[post.pid].traits.includes("colour")) pos.push({ id: "colour", sc: 0.6 });
  pos.sort((a, b) => b.sc - a.sc);
  const worst = neg[0] && neg[0].sev >= 0.12 ? neg[0] : null, best = pos[0] && pos[0].sc >= 0.4 ? pos[0] : null;
  const context = (post.events || []).map(e => e.explain).filter(Boolean).slice(0, 2);
  return {
    worked: best ? { id: best.id, label: R()[best.id].goodLabel || R()[best.id].label, text: R()[best.id].good } : { id: "none", label: "You posted", text: "You made a real video and posted it. Every seller starts here." },
    notWorked: worst ? { id: worst.id, label: R()[worst.id].label, text: R()[worst.id].bad } : { id: "none", label: "Nothing big", text: "No big problem showed up this time." },
    tryNext: worst ? R()[worst.id].next : "Try a different product or the other site, and compare.",
    sure: sureness(post), context
  };
}

export function sureness(post) {
  const v = post.views;
  return Math.round(clamp(25 + 55 * v / (v + 250) + (post.done ? 12 : 0), 20, 95));
}
