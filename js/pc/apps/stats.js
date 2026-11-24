/* Stats app: every past post with views, orders, missed sales and first clip. Select two to compare. Numbers only, no grades. */
import { D, S } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { setHTML, esc, shortNum } from "../util.js";

let root = null, picked = []; // picked: indexes into the post list

const all = () => S.post ? [...S.posts, S.post] : S.posts;
const first = p => D.CLIPS[p.clips[0]][0];
const stk = s => !s || s === "none" ? "None" : s.startsWith("my:") ? "Own sticker" : s[0].toUpperCase() + s.slice(1);
const txt = t => ({ none: "None", price: "Price", question: "Question" }[t] || t);

function spark(p) {
  const DUR = D.T.post.duration, max = Math.max(...p.samples, 1);
  return `<svg viewBox="0 0 200 50" preserveAspectRatio="none" style="width:100%;height:3em" aria-hidden="true"><polyline points="0,48 ${p.samples.map((v, i) => `${(i / DUR * 200).toFixed(1)},${(47 - v / max * 44).toFixed(1)}`).join(" ")}" fill="none" stroke="#9446e0" stroke-width="2.5"/></svg>`;
}

function detail(i) {
  const p = all()[i], PR = D.PR;
  const rows = [
    ["Product", PR[p.p].n], ["Clips", p.clips.map(c => D.CLIPS[c][0]).join(" → ")], ["Shot", p.shot === "face" ? "Face + product" : "Product"], ["Cover text", txt(p.text)], ["Sticker", stk(p.sticker)],
    ["Caption", p.caption ? esc(p.caption) : "(none)"], ["Views", Math.round(p.views).toLocaleString()], ["Orders", p.orders], ["Missed sales", p.missed],
    ["Swiped away at", `0:0${p.leftAt}`], ["Watched to end", p.t >= D.T.post.duration ? Math.round(p.endPct) + "%" : "…"]
  ].map(([k, v]) => `<div class="st-kv"><span class="lbl">${k}</span><b>${v}</b></div>`).join("");
  return `<div class="card st-det"><div style="font:700 1.1em var(--display)">Post ${i + 1}${p === S.post ? " · live" : ""}</div>${spark(p)}${rows}</div>`;
}

function render() {
  if (!root) return;
  const list = all(); picked = picked.filter(i => i < list.length);
  const PR = D.PR;
  const rows = list.map((p, i) => `<button type="button" class="st-row ${picked.includes(i) ? "on" : ""}" data-act="st-pick" data-v="${i}" aria-pressed="${picked.includes(i)}">
      <span class="st-box">${picked.includes(i) ? "✓" : ""}</span><span>${i + 1}${p === S.post ? " ●" : ""}</span><span><img src="img/${PR[p.p].icon}.png" alt="" style="width:1.6em;vertical-align:middle"> ${PR[p.p].n}</span>
      <span>${shortNum(p.views)}</span><span>${p.orders}</span><span>${p.missed}</span><span>${first(p)}</span></button>`).reverse().join("");
  const cmp = picked.length ? `<div style="display:grid;grid-template-columns:repeat(${picked.length},1fr);gap:.7em">${picked.map(detail).join("")}</div>` : "";
  setHTML(root, `
   <div class="card" style="display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;overflow:hidden">
     <div class="st-row st-head"><span></span><span>#</span><span>Product</span><span>Views</span><span>Orders</span><span>Missed</span><span>First clip</span></div>
     <div data-sk="stl" style="overflow:auto">${rows || `<div style="padding:1em;color:var(--mute);font-weight:700">No posts yet. Post a video in TikTik Studio.</div>`}</div>
   </div>
   <div data-sk="stc" style="overflow:auto;min-height:0;display:grid;align-content:start;gap:.6em">
     <div class="lbl">${picked.length === 2 ? "Side by side" : "Pick two posts to compare them side by side"}</div>${cmp}
   </div>`);
}

registerActions({
  "st-pick": (t, v) => {
    const i = +v; picked = picked.includes(i) ? picked.filter(x => x !== i) : [...picked, i].slice(-2);
    picked.sort((a, b) => a - b); render();
  }
});

export default {
  id: "stats", title: "Stats", icon: "📊", color: "o", w: 88, h: 80,
  mount(el, win) { root = el; picked = []; el.className = "dw-body wbody"; el.style.gridTemplateColumns = "1.05fr 1.2fr"; win.setTitle("Stats", "All your posts"); render(); },
  refresh: render,
  unmount() { root = null; }
};
