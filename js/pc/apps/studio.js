/* TikTik Studio app: make a video (studio view), then watch it run (running view). Same behaviour as the room windows before. */
import { D, S, sel } from "../../state.js";
import { peso } from "../../ui/format.js";
import { registerActions } from "../../ui/windows.js";
import { startPost } from "../../sim/post.js";
import { AV } from "../../sim/shop.js";
import { setHTML } from "../util.js";

let root = null, win = null, view = "studio";

const chipRow = (key, opts) => opts.map(([v, t]) => `<button type="button" class="chip ${sel[key] === v ? "on" : ""}" data-act="set" data-k="${key}" data-v="${v}">${t}</button>`).join("");

/* Sticker on the cover: built-in text or one of the player's own Paint stickers ("my:0" to "my:2"). */
export function stickerHTML(s) {
  if (!s || s === "none") return "";
  if (s.startsWith("my:")) { const u = S.stickers[+s.slice(3)]; return u ? `<img src="${u}" alt="Your sticker" style="position:absolute;left:3%;bottom:4%;width:36%;transform:rotate(-8deg)">` : ""; }
  return `<div style="position:absolute;left:4%;bottom:5%;background:var(--red);color:#fff;border:.14em solid var(--navy);border-radius:.5em;padding:0 .4em;font:700 .85em var(--display);transform:rotate(-8deg)">${s.toUpperCase()}</div>`;
}

function stickerChips() {
  const own = S.stickers.map((u, i) => `<button type="button" class="chip ${sel.sticker === "my:" + i ? "on" : ""}" data-act="set" data-k="sticker" data-v="my:${i}" title="Your sticker ${i + 1}"><img src="${u}" alt="Your sticker ${i + 1}" style="height:1.5em;width:1.5em;object-fit:contain"></button>`).join("");
  return chipRow("sticker", [["none", "None"], ["new", "New"], ["sale", "Sale"]]) + own;
}

function setLayout(cols, rows) { root.className = "dw-body wbody"; root.style.gridTemplateColumns = cols; root.style.gridTemplateRows = rows; }

export function renderStudio() {
  const PR = D.PR, CLIPS = D.CLIPS;
  if (sel.sticker.startsWith("my:") && !S.stickers[+sel.sticker.slice(3)]) sel.sticker = "none";
  setLayout("19% 1fr 27%", "minmax(0,1fr) auto");
  win.setTitle("TikTik Studio", "New short video");
  const prods = Object.entries(PR).map(([k, v]) => `<button type="button" class="pcard ${sel.p === k ? "on" : ""}" data-act="prod" data-v="${k}"><img src="img/${v.icon}.png" alt=""><span><b>${v.n}</b><span style="color:${S.stock[k] ? "var(--mute)" : "var(--red)"}">${peso(v.price)} · ${S.stock[k]} left</span></span></button>`).join("");
  const slots = [0, 1, 2].map(i => { const c = sel.clips[i]; return c ? `<button type="button" class="slot" data-act="unslot" data-v="${i}" title="Click to remove"><img src="img/${CLIPS[c][1]}.png" alt=""><div>${i + 1} · ${CLIPS[c][0]} <span style="color:var(--mute)">0:0${i * 5}</span></div></button>` : `<div class="slot empty">Slot ${i + 1}</div>`; }).join("");
  const lib = Object.entries(CLIPS).map(([k, [n, img]]) => `<button type="button" class="clip ${sel.clips.includes(k) ? "used" : ""}" data-act="clip" data-v="${k}"><img src="img/${img}.png" alt=""><div>${n}</div></button>`).join("");
  const photo = `img/${PR[sel.p].icon}.png`;
  setHTML(root, `
  <div style="display:grid;gap:.55em;align-content:start"><div class="lbl">1 · Product</div>${prods}<span style="font-size:.8em;font-weight:700;color:var(--mute)">You can post an item with no stock. Orders for it become missed sales.</span></div>
  <div style="display:grid;grid-template-rows:auto 1fr auto auto;gap:.6em;min-height:0">
    <div class="lbl">2 · Clips · click 3 in order</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.8em;min-height:0">${slots}</div>
    <div class="lbl">Clip library · ${PR[sel.p].n}</div>
    <div style="display:flex;gap:.5em;flex-wrap:wrap">${lib}</div>
  </div>
  <div style="display:grid;grid-template-rows:auto auto 1fr;gap:.6em;min-height:0">
    <div class="lbl">3 · Cover and caption</div>
    <div style="display:grid;grid-template-columns:42% 1fr;gap:.7em">
      <div class="card" id="cover" style="aspect-ratio:9/16;position:relative;overflow:hidden;background:url(img/mg_thumb_bg_sunny.png) center/cover">
        <img src="${photo}" alt="" style="position:absolute;left:14%;top:32%;width:72%">
        ${sel.shot === "face" ? `<img src="img/chat_avatar_05.png" alt="" style="position:absolute;right:4%;bottom:4%;width:42%;border-radius:50%">` : ""}
        ${sel.text === "price" ? `<img src="img/mg_thumb_sticker_price.png" alt="" style="position:absolute;left:6%;top:5%;width:88%">` : ""}
        ${sel.text === "question" ? `<div style="position:absolute;left:6%;right:6%;top:7%;background:#fff;border:.14em solid var(--navy);border-radius:.6em;text-align:center;font:700 .9em var(--display)">Sulit ba 'to?</div>` : ""}
        ${stickerHTML(sel.sticker)}
      </div>
      <div style="display:grid;gap:.35em;align-content:start">
        <span class="lbl">Shot</span><div style="display:flex;gap:.3em;flex-wrap:wrap">${chipRow("shot", [["product", "Product"], ["face", "Face + product"]])}</div>
        <span class="lbl">Text</span><div style="display:flex;gap:.3em;flex-wrap:wrap">${chipRow("text", [["none", "None"], ["price", "Price"], ["question", "Question"]])}</div>
        <span class="lbl">Sticker</span><div style="display:flex;gap:.3em;flex-wrap:wrap;align-items:center">${stickerChips()}</div>
        ${S.stickers.length < D.PC.stickerMax ? `<span style="font-size:.78em;font-weight:700;color:var(--mute)">Draw your own stickers in Paint.</span>` : ""}
      </div>
    </div>
    <div><div class="lbl" style="margin-bottom:.2em">Caption</div><textarea class="cap-in" id="caption" maxlength="120" placeholder="Type a caption">${sel.caption.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textarea></div>
  </div>
  <div style="grid-column:1/4;display:flex;justify-content:space-between;align-items:center">
    <span style="font-weight:700;color:var(--mute);font-size:.9em">No score before posting. You will see what happens.</span>
    <button class="cap p" data-act="post" type="button" ${sel.clips.length < 3 ? "disabled" : ""}>Post to TikTik</button>
  </div>`);
}

function hookCurve(L, W) { const x = L / W * 400; return `M0,10 L${x - 20},12 L${x + 8},62 L${x + 60},70 L400,92`; }

export function renderRunning() {
  const PR = D.PR, DUR = D.T.post.duration, W = D.T.post.swipeWindow;
  const p = S.post || S.last; if (!p) { view = "studio"; renderStudio(); return; }
  setLayout("20% 1fr 27%", "auto minmax(0,1fr) auto");
  win.setTitle("TikTik", S.post ? `Your post · ${PR[p.p].n} · ${Math.round(DUR - p.t)}s left` : `Post ended · ${PR[p.p].n}`);
  const max = Math.max(...p.samples, 1), pts = p.samples.map((v, i) => `${(i / DUR * 400).toFixed(1)},${(105 - v / max * 92).toFixed(1)}`).join(" ");
  const L = p.leftAt, sw = hookCurve(L, W);
  setHTML(root, `
   <div style="grid-column:1/4;display:grid;grid-template-columns:repeat(5,1fr);gap:.7em">
     <div class="card stat"><span class="lbl">Views</span><b>${Math.round(p.views).toLocaleString()}</b></div>
     <div class="card stat"><span class="lbl">Likes</span><b>${Math.round(p.views * D.T.post.likeRate).toLocaleString()}</b></div>
     <div class="card stat"><span class="lbl">Orders</span><b>${p.orders}</b></div>
     <div class="card stat"><span class="lbl">Missed sales</span><b style="color:${p.missed ? "var(--red)" : "inherit"}">${p.missed}</b></div>
     <div class="card stat"><span class="lbl">Watched to end</span><b>${S.post ? "…" : Math.round(p.endPct) + "%"}</b></div>
   </div>
   <div class="card" style="position:relative;overflow:hidden;border-radius:1.4em;background:url(img/mg_thumb_bg_sunny.png) center/cover">
     <img src="img/${PR[p.p].icon}.png" alt="" style="position:absolute;left:14%;top:30%;width:72%">
     ${stickerHTML(p.sticker)}
     <div style="position:absolute;left:0;right:0;bottom:0;padding:.6em;background:linear-gradient(transparent,rgba(27,42,102,.85));color:#fff;font-weight:800;font-size:.9em">${(p.caption || "(no caption)").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
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
     <button class="cap y" data-act="wclose" type="button">Close${S.post ? " (post keeps running)" : ""}</button>
     ${S.post ? "" : `<button class="cap p" data-act="new" type="button">Make a new video</button>`}
   </div>`);
}

function draw() {
  if (!root) return;
  if (view === "running" && !S.post && !S.last) view = "studio";
  if (view === "running") renderRunning(); else renderStudio();
}

registerActions({
  prod: (t, v) => { sel.p = v; draw(); },
  clip: (t, v) => { if (!sel.clips.includes(v) && sel.clips.length < 3) { sel.clips.push(v); draw(); } },
  unslot: (t, v) => { sel.clips.splice(+v, 1); draw(); },
  set: (t, v) => { sel[t.dataset.k] = v; draw(); },
  post: () => { if (sel.clips.length === 3 && !S.post) { startPost(sel); view = "running"; draw(); } },
  new: () => { if (S.last) sel.clips = []; view = "studio"; draw(); }
});

export default {
  id: "studio", title: "TikTik Studio", icon: "🎬", color: "p", w: 82, h: 92,
  mount(el, w) {
    root = el; win = w; view = S.post ? "running" : "studio";
    el.addEventListener("input", e => { if (e.target.id === "caption") sel.caption = e.target.value; });
    draw();
  },
  refresh() { if (view === "running" || document.activeElement?.id !== "caption") draw(); },
  unmount() { root = null; win = null; }
};
