/* Running-post window: stats, charts, comments. */
import { D, S } from "../state.js";
import { $, registerWindow, closeUI } from "./windows.js";
import { AV } from "../sim/shop.js";

function hookCurve(L, W) { const x = L / W * 400; return `M0,10 L${x - 20},12 L${x + 8},62 L${x + 60},70 L400,92`; }

export function renderRunning() {
  const PR = D.PR, DUR = D.T.post.duration, W = D.T.post.swipeWindow;
  const p = S.post || S.last; if (!p) { closeUI(); return; }
  $("#rtitle").textContent = S.post ? `Your post · ${PR[p.p].n} · ${Math.round(DUR - p.t)}s left` : `Post ended · ${PR[p.p].n}`;
  const max = Math.max(...p.samples, 1), pts = p.samples.map((v, i) => `${(i / DUR * 400).toFixed(1)},${(105 - v / max * 92).toFixed(1)}`).join(" ");
  const L = p.leftAt, sw = hookCurve(L, W);
  $("#running").innerHTML = `
   <div style="grid-column:1/4;display:grid;grid-template-columns:repeat(5,1fr);gap:.7em">
     <div class="card stat"><span class="lbl">Views</span><b>${Math.round(p.views).toLocaleString()}</b></div>
     <div class="card stat"><span class="lbl">Likes</span><b>${Math.round(p.views * D.T.post.likeRate).toLocaleString()}</b></div>
     <div class="card stat"><span class="lbl">Orders</span><b>${p.orders}</b></div>
     <div class="card stat"><span class="lbl">Missed sales</span><b style="color:${p.missed ? "var(--red)" : "inherit"}">${p.missed}</b></div>
     <div class="card stat"><span class="lbl">Watched to end</span><b>${S.post ? "…" : Math.round(p.endPct) + "%"}</b></div>
   </div>
   <div class="card" style="position:relative;overflow:hidden;border-radius:1.4em;background:url(img/mg_thumb_bg_sunny.png) center/cover">
     <img src="img/${PR[p.p].icon}.png" alt="" style="position:absolute;left:14%;top:30%;width:72%">
     <div style="position:absolute;left:0;right:0;bottom:0;padding:.6em;background:linear-gradient(transparent,rgba(27,42,102,.85));color:#fff;font-weight:800;font-size:.9em">${(p.caption || "(no caption)").replace(/</g, "&lt;")}</div>
   </div>
   <div style="display:grid;grid-template-rows:1fr 1fr;gap:1em;min-height:0">
     <div class="card" style="padding:.6em 1em;display:grid;grid-template-rows:auto 1fr;min-height:0"><div style="display:flex;justify-content:space-between"><span class="lbl">Viewers over time</span>${S.post ? '<span style="font:700 .9em var(--display);color:var(--purple)">● live</span>' : ""}</div>
       <svg viewBox="0 0 400 110" preserveAspectRatio="none" style="width:100%;height:100%" aria-hidden="true"><polyline points="0,105 ${pts}" fill="none" stroke="#9446e0" stroke-width="3.5" stroke-linejoin="round"/><line x1="0" y1="108" x2="400" y2="108" stroke="#1b2a66" stroke-width="2"/></svg></div>
     <div class="card" style="padding:.6em 1em;display:grid;grid-template-rows:auto 1fr auto;min-height:0"><span class="lbl">Where viewers swiped away · 0:00 to 0:${W}</span>
       <svg viewBox="0 0 400 110" preserveAspectRatio="none" style="width:100%;height:100%" aria-hidden="true"><path d="${sw}" fill="none" stroke="#ef3b4f" stroke-width="3.5"/><line x1="${L / W * 400}" y1="0" x2="${L / W * 400}" y2="110" stroke="#1b2a66" stroke-width="2" stroke-dasharray="6 5"/><line x1="0" y1="108" x2="400" y2="108" stroke="#1b2a66" stroke-width="2"/></svg>
       <div style="font:700 .85em var(--display);color:var(--red)">Most viewers left at 0:0${L}</div></div>
   </div>
   <div class="card" style="padding:.6em .8em;display:grid;grid-template-rows:auto 1fr;gap:.45em;min-height:0;overflow:hidden"><span class="lbl">Comments</span>
     <div style="display:grid;gap:.45em;align-content:start">${p.comments.map(c => `<div class="cmt"><img src="${AV(c.av)}" alt=""><div>${c.text}</div></div>`).join("") || '<span style="color:var(--mute);font-weight:700">No comments yet</span>'}</div></div>
   <div style="grid-column:1/4;display:flex;justify-content:space-between;align-items:center">
     <button class="cap y" data-act="close" type="button">← Room${S.post ? " (keeps running)" : ""}</button>
     ${S.post ? "" : `<button class="cap p" data-act="new" type="button">Make a new video</button>`}
   </div>`;
}

export function initRunning() { registerWindow("running", { open: renderRunning }); }
