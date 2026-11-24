/* Mr. Algo: after a post ends, he says what happened, the likely causes, and one thing to try for each (D-80).
   Before results he never hints (fail first, FOUNDATION §2). Causes come from what the post model actually used. */
import { D, S } from "../state.js";
import { $, registerWindow, closeUI } from "./windows.js";
import { SITE_NAME, sitePosts } from "../sim/post.js";

let lines = [], idx = 0;
const pct = x => Math.round(x * 100);

/* Causes for one finished post, strongest first. Each: [what happened, what to try]. */
export function analyse(p) {
  const PR = D.PR, CLIPS = D.CLIPS, w = p.why || {}, n = PR[p.p].n, out = [], good = [];
  const avgMult = p.mT ? p.mSum / p.mT : 1;
  if (p.missed) out.push([`${p.missed} buyer${p.missed > 1 ? "s" : ""} wanted the ${n.toLowerCase()}, but nothing was left to sell.`, `Fill a shelf with ${n} before you post, and keep a box in storage for when it sells out.`]);
  if (w.stage === "calm" && w.heat < 0.2) out.push([`Not many people were looking for ${n.toLowerCase()} when you posted.`, `Scroll the feeds and the trending list first. Post items you see showing up again and again.`]);
  if (w.stage === "afterglow") out.push([`Talk about ${n.toLowerCase()} was already fading when you posted.`, `Catch items earlier: when a few strangers post them and buyers start asking "where to buy?".`]);
  if (w.crowd >= 4 || w.stage === "crowded") out.push([`${w.crowd} other sellers posted ${n.toLowerCase()} around the same time, so they split the buyers.`, `Get in before the crowd, or pick an item fewer sellers are posting.`]);
  if (w.repeat) out.push([`You posted the ${n.toLowerCase()} again soon after your last one. Viewers were tired of it.`, `Wait a while, or post a different product in between.`]);
  if (p.site === "tiktik") {
    if (!p.hook) out.push([`Most viewers swiped away at 0:0${p.leftAt}. Your first clip was "${CLIPS[p.clips[0]][0]}".`, `Start with a hook or a close-up so people stop scrolling in the first 2 seconds.`]);
    else good.push(`Your first clip kept people watching until about 0:0${p.leftAt}.`);
    const priceQs = Object.entries(p.counts).filter(([t]) => /much|HM|Magkano|Price/i.test(t)).reduce((a, [, c]) => a + c, 0);
    if (!p.priceShown && priceQs >= 2) out.push([`${priceQs} comments asked for the price.`, `Put the price on the cover or in the caption. People who must ask often leave.`]);
    else if (p.priceShown) good.push("The price was easy to find, so fewer people had to ask.");
  }
  if (p.site === "youview") {
    if (!w.searchable) out.push([`Your title "${p.title}" does not say what the product is.`, `Put the product name or words like "review" in the title. YouView buyers search for them.`]);
    else good.push("Your title has words buyers search for, so it keeps getting found.");
    if (p.segs.length < 3) out.push([`The video had only ${p.segs.length} segments.`, `Use at least 3: for example intro, demo, and price.`]);
    if (p.thumb === "bold") out.push(["The bold cover pulled clicks, but fewer viewers bought.", "A plain cover that shows the real product can bring buyers who are sure."]);
  }
  if (p.first) out.push([`This was your first ${SITE_NAME[p.site]} post, so the site showed it to few people.`, `Keep posting. Followers see your next post first.`]);
  if (avgMult > 1.25) good.push(`People were talking about ${n.toLowerCase()} while your post ran. That gave it extra reach.`);
  return { out, good };
}

function startAlgo() {
  const PR = D.PR, L = [];
  if (!S.algoMet) { S.algoMet = true; L.push("Hi! I'm Mr. Algo.", "I can't tell you what will work before you post. Nobody outside the sites knows that for sure.", "After a post ends, come back. I'll tell you what happened, what held it back, and what you could try next."); }
  const p = S.last;
  if (p) {
    S.algoUnread = false;
    const site = SITE_NAME[p.site] || "TikTik", { out, good } = analyse(p);
    L.push(`Your last ${site} post showed the ${PR[p.p].n.toLowerCase()}: ${Math.round(p.views).toLocaleString()} views, ${p.orders} orders${p.missed ? `, ${p.missed} missed sales` : ""}.`);
    good.slice(0, 2).forEach(g => L.push("What helped: " + g));
    out.slice(0, 3).forEach(([what, tryIt]) => L.push(`What held it back: ${what}\nTry: ${tryIt}`));
    if (!out.length) L.push("Nothing big held this one back. Try the same idea with another product, and compare them in Stats.");
    const same = sitePosts(p.site), prev = same[same.length - 2];
    if (prev) L.push(`Your ${site} post before it got ${Math.round(prev.views).toLocaleString()} views and ${prev.orders} orders.`);
  } else if (S.running.length) L.push(`Your post is still running: ${Math.round(S.running[0].views).toLocaleString()} views so far. Come back when it ends.`);
  else if (!L.length) L.push("Make a video on the computer. Then come back.");
  lines = L; idx = 0; showAlgo();
}

function showAlgo() {
  const t = $("#algoText"); t.textContent = lines[idx]; t.style.whiteSpace = "pre-line";
  $("#algoNext").textContent = idx < lines.length - 1 ? "Next" : "OK";
  $("#algoImg").src = idx % 2 ? "img/algo_unit_neutral.png" : "img/algo_unit_talk_1.png";
}

export function initAlgo() {
  registerWindow("algo", { open: startAlgo });
  $("#algoNext").onclick = () => { if (idx < lines.length - 1) { idx++; showAlgo(); } else closeUI(); };
}
