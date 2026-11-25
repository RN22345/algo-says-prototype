/* RESULTS page for one post: live numbers, the retention line drawn over the block timeline, comments pinned at their seconds, where people left,
   and Mr. Algo's 3 Things (worked, did not work, try next, "ALGO is N% sure"), plus any market event that explains the result.
   Numbers update while the post runs. The retention data and 3 Things are available after the first analysis (about 30 game minutes). */
import { D } from "../core/data.js";
import { S, fmtMoney } from "../core/state.js";
import { fmtDay } from "../core/clock.js";
import { three } from "../sim/algo3.js";
import { artUrl } from "../core/assets.js";
import { h, btn, art, clear, modal } from "./ui.js";

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const COLORS = ["#3a7bf0", "#2fd9cf", "#ee7a30", "#b744c9", "#3ec45a", "#e8344f"];
let win = null, timer = null;

export function openResults(postId) {
  const post = S.posts.find(p => p.id === postId); if (!post) return;
  if (win && win.back.isConnected) win.close();
  post.looked = post.done || post.looked;
  const box = h("div", { class: "col" });
  win = modal({ title: `Results: ${D.P[post.pid].name} on ${D.SITE[post.site].name}`, cls: "results", body: box, onClose: () => { clearInterval(timer); win = null; } });
  const draw = () => { const sc = win.body.scrollTop; clear(box); build(box, post); win.body.scrollTop = sc; };
  draw(); timer = setInterval(() => { if (win && win.back.isConnected) draw(); else clearInterval(timer); }, 1500);
}

function build(box, post) {
  const res = post.res, pr = D.P[post.pid], site = D.SITE[post.site];
  const earned = post.mode === "affiliate" ? "Commission" : "Profit";
  box.append(h("div", { class: "rstat" },
    stat(post.views.toLocaleString(), "views"), stat(post.orders, "orders"), stat(fmtMoney(post.profit), earned.toLowerCase() + " so far"),
    stat(Math.round(post.views * (0.03 + 0.12 * res.facts.avgWatch)).toLocaleString(), "likes"), stat("+" + post.folGained, "followers"), stat(post.returns, "returns"),
    h("div", { class: "stat" }, h("b", { style: { fontSize: "1.1em" } }, post.done ? "Ended" : "Live"), h("span", {}, "posted " + fmtDay(post.at)))));
  if (post.missed) box.append(h("div", { class: "warnbox" }, `${post.missed} buyer${post.missed > 1 ? "s" : ""} wanted this but you had no stock on the shelf (missed sales).`));
  if (!post.analysed) { box.append(h("div", { class: "panel" }, "First results come in about 30 game minutes after posting. Time keeps moving. Check the feeds, or nap and come back.")); return; }
  box.append(chart(post));
  // reasons
  const reasons = Object.entries(res.dropReasons).filter(([k, v]) => k !== "end" && v >= 0.04).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const rwrap = h("div", { class: "grid g2" },
    h("div", { class: "panel" }, h("h3", {}, "Where people left"),
      reasons.length ? reasons.map(([k, v]) => h("div", { style: { marginBottom: ".25em" } }, h("div", { class: "small" }, `${D.viewers.reasons[k] ? D.viewers.reasons[k].label : k}: ${Math.round(v * 100)}%`), h("div", { class: "sure" }, h("i", { style: { width: Math.min(100, v * 100) + "%" } })))) : h("div", {}, "Most people watched to the end."),
      res.dropReasons.end ? h("div", { class: "small", style: { marginTop: ".3em" } }, `Watched to the end: ${Math.round(res.dropReasons.end * 100)}%`) : null),
    h("div", { class: "panel" }, h("h3", {}, "Comments"), res.comments.length ? res.comments.map(c => h("div", { class: "cmt", style: { marginBottom: ".2em" } }, h("img", { src: artUrl("viewer_0" + c.who), alt: "" }), h("span", { class: "ts" }, mmss(c.sec)), h("span", {}, c.text))) : h("div", {}, "No comments yet.")));
  box.append(rwrap);
  if (post.returns > 0 || res.returns.expected >= 0.5) box.append(h("div", { class: "panel" }, post.returns > 0 ? `${post.returns} order${post.returns > 1 ? "s were" : " was"} returned. Returns come in days after the sale.` : "Some buyers may return this later."));
  // 3 things
  const t = three(post), sure = t.sure;
  box.append(h("div", { class: "row", style: { alignItems: "flex-start" } },
    h("img", { src: artUrl(sure >= 60 ? "algo_happy" : "algo_unsure"), alt: "Mr. Algo", style: { width: "150px", height: "150px", objectFit: "contain" } }),
    h("div", { class: "grow col" }, h("div", { class: "row" }, h("h3", {}, "Mr. Algo's 3 Things"), h("span", { class: "tag gold" }, `ALGO is ${sure}% sure`), !post.done ? h("span", { class: "small", style: { opacity: ".85" } }, "The post is still running. I will be surer when it ends.") : null),
      h("div", { class: "algo3" },
        a3("g", "What worked", t.worked.label, t.worked.text), a3("r", "What did not", t.notWorked.label, t.notWorked.text), a3("b", "Try next", "One thing", t.tryNext)),
      t.context.length ? h("div", { class: "panel" }, h("b", { class: "lil" }, "In the news: "), t.context.join(" ")) : null)));
}
const stat = (v, l) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l));
const a3 = (cls, head, lab, text) => h("div", { class: "a3 " + cls }, h("h4", {}, head), h("div", { class: "lab" }, lab), h("div", {}, text));

/* Retention line over the block timeline, with comment pins. */
function chart(post) {
  const res = post.res, T = Math.max(res.T, 1), W = 1500, Hh = 320, x0 = 70, x1 = 1470, yTop = 20, yBase = 230, stripY = 244, stripH = 50;
  const X = t => x0 + (t / T) * (x1 - x0), Y = p => yBase - p * (yBase - yTop);
  const ns = "http://www.w3.org/2000/svg", el = (n, a, ...k) => { const e = document.createElementNS(ns, n); for (const [kk, v] of Object.entries(a || {})) e.setAttribute(kk, v); k.forEach(c => e.append(c)); return e; };
  const svg = el("svg", { viewBox: `0 0 ${W} ${Hh}` });
  const defs = el("defs", {}, el("pattern", { id: "hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("rect", { width: 5, height: 10, fill: "rgba(0,0,0,.35)" })));
  svg.append(defs);
  for (const p of [0, 0.5, 1]) { svg.append(el("line", { x1: x0, x2: x1, y1: Y(p), y2: Y(p), stroke: "#c9cfe8", "stroke-width": 2, "stroke-dasharray": p === 0 ? "" : "6 6" })); const t = el("text", { x: x0 - 10, y: Y(p) + 7, "text-anchor": "end", "font-size": 20, fill: "#6a73a0", "font-family": "Fredoka" }); t.textContent = Math.round(p * 100) + "%"; svg.append(t); }
  const pts = res.retention.map((p, i) => `${X(Math.min(i * 0.5, T)).toFixed(1)},${Y(p).toFixed(1)}`);
  svg.append(el("polygon", { points: `${x0},${yBase} ${pts.join(" ")} ${x1},${yBase}`, fill: "rgba(58,123,240,.22)" }), el("polyline", { points: pts.join(" "), fill: "none", stroke: "#3a7bf0", "stroke-width": 5, "stroke-linejoin": "round" }));
  res.blocks.forEach((b, i) => {
    const xa = X(b.start), xb = X(b.end);
    svg.append(el("rect", { x: xa + 1, y: stripY, width: Math.max(2, xb - xa - 2), height: stripH, rx: 8, fill: COLORS[i % COLORS.length], stroke: "#1c2452", "stroke-width": 3 }));
    if (b.deadHead > 0) svg.append(el("rect", { x: xa + 1, y: stripY, width: X(b.start + b.deadHead) - xa, height: stripH, fill: "url(#hatch)" }));
    if (b.deadTail > 0) svg.append(el("rect", { x: X(b.end - b.deadTail), y: stripY, width: X(b.end) - X(b.end - b.deadTail) - 2, height: stripH, fill: "url(#hatch)" }));
    const lab = el("text", { x: (xa + xb) / 2, y: stripY + 31, "text-anchor": "middle", "font-size": 20, fill: "#fff", "font-family": "Lilita One", stroke: "#1c2452", "stroke-width": 4, "paint-order": "stroke" }); lab.textContent = (D.sites.slotInfo[b.slot] || { label: b.slot }).label; svg.append(lab);
    if (b.lost) { const c = el("text", { x: (xa + xb) / 2, y: stripY - 6, "text-anchor": "middle", "font-size": 18, fill: "#e8344f", "font-family": "Fredoka", "font-weight": 700 }); c.textContent = "✂ cut the answer"; svg.append(c); }
  });
  for (let s = 0; s <= T; s += T > 40 ? 10 : 5) { const t = el("text", { x: X(s), y: 312, "text-anchor": "middle", "font-size": 18, fill: "#6a73a0", "font-family": "Fredoka" }); t.textContent = mmss(s); svg.append(t); }
  const wrap = h("div", { class: "chart" }, svg);
  const detail = h("div", { class: "small", style: { position: "absolute", left: "1em", top: ".3em", color: "#6a73a0" } }, "Share of viewers still watching. Tap a pin to read the comment.");
  wrap.append(detail);
  res.comments.forEach(c => {
    const ci = Math.min(res.retention.length - 1, Math.round(c.sec / 0.5)), p = res.retention[ci];
    const pin = h("div", { class: "pin", style: { left: X(c.sec) / W * 100 + "%", top: (Y(p) / Hh * 100) * 0.96 + "%" }, title: c.text, onClick: () => { wrap.querySelectorAll(".pin").forEach(x => x.classList.remove("on")); pin.classList.add("on"); detail.textContent = `${mmss(c.sec)}  "${c.text}"`; detail.style.color = "#1c2452"; } }, h("i", {}, "💬"));
    wrap.append(pin);
  });
  return wrap;
}
