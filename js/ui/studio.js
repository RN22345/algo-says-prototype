/* TikTik Studio window: product, clips, cover, caption, post. */
import { D, S, sel } from "../state.js";
import { peso } from "./format.js";
import { $, registerWindow, registerActions, openUI } from "./windows.js";
import { startPost } from "../sim/post.js";

function chipRow(key, opts) { return opts.map(([v, t]) => `<button type="button" class="chip ${sel[key] === v ? "on" : ""}" data-act="set" data-k="${key}" data-v="${v}">${t}</button>`).join(""); }

export function renderStudio() {
  const PR = D.PR, CLIPS = D.CLIPS;
  const st = $("#studio");
  const prods = Object.entries(PR).map(([k, v]) => `<button type="button" class="pcard ${sel.p === k ? "on" : ""}" data-act="prod" data-v="${k}"><img src="img/${v.icon}.png" alt=""><span><b>${v.n}</b><span style="color:${S.stock[k] ? "var(--mute)" : "var(--red)"}">${peso(v.price)} · ${S.stock[k]} left</span></span></button>`).join("");
  const slots = [0, 1, 2].map(i => { const c = sel.clips[i]; return c ? `<button type="button" class="slot" data-act="unslot" data-v="${i}" title="Click to remove"><img src="img/${CLIPS[c][1]}.png" alt=""><div>${i + 1} · ${CLIPS[c][0]} <span style="color:var(--mute)">0:0${i * 5}</span></div></button>` : `<div class="slot empty">Slot ${i + 1}</div>`; }).join("");
  const lib = Object.entries(CLIPS).map(([k, [n, img]]) => `<button type="button" class="clip ${sel.clips.includes(k) ? "used" : ""}" data-act="clip" data-v="${k}"><img src="img/${img}.png" alt=""><div>${n}</div></button>`).join("");
  const photo = `img/${PR[sel.p].icon}.png`;
  st.innerHTML = `
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
      <div class="card" style="aspect-ratio:9/16;position:relative;overflow:hidden;background:url(img/mg_thumb_bg_sunny.png) center/cover">
        <img src="${photo}" alt="" style="position:absolute;left:14%;top:32%;width:72%">
        ${sel.shot === "face" ? `<img src="img/chat_avatar_05.png" alt="" style="position:absolute;right:4%;bottom:4%;width:42%;border-radius:50%">` : ""}
        ${sel.text === "price" ? `<img src="img/mg_thumb_sticker_price.png" alt="" style="position:absolute;left:6%;top:5%;width:88%">` : ""}
        ${sel.text === "question" ? `<div style="position:absolute;left:6%;right:6%;top:7%;background:#fff;border:.14em solid var(--navy);border-radius:.6em;text-align:center;font:700 .9em var(--display)">Sulit ba 'to?</div>` : ""}
        ${sel.sticker !== "none" ? `<div style="position:absolute;left:4%;bottom:5%;background:var(--red);color:#fff;border:.14em solid var(--navy);border-radius:.5em;padding:0 .4em;font:700 .85em var(--display);transform:rotate(-8deg)">${sel.sticker.toUpperCase()}</div>` : ""}
      </div>
      <div style="display:grid;gap:.35em;align-content:start">
        <span class="lbl">Shot</span><div style="display:flex;gap:.3em;flex-wrap:wrap">${chipRow("shot", [["product", "Product"], ["face", "Face + product"]])}</div>
        <span class="lbl">Text</span><div style="display:flex;gap:.3em;flex-wrap:wrap">${chipRow("text", [["none", "None"], ["price", "Price"], ["question", "Question"]])}</div>
        <span class="lbl">Sticker</span><div style="display:flex;gap:.3em;flex-wrap:wrap">${chipRow("sticker", [["none", "None"], ["new", "New"], ["sale", "Sale"]])}</div>
      </div>
    </div>
    <div><div class="lbl" style="margin-bottom:.2em">Caption</div><textarea class="cap-in" id="caption" maxlength="120" placeholder="Type a caption">${sel.caption.replace(/</g, "&lt;")}</textarea></div>
  </div>
  <div style="grid-column:1/4;display:flex;justify-content:space-between;align-items:center">
    <span style="font-weight:700;color:var(--mute);font-size:.9em">No score before posting. You will see what happens.</span>
    <button class="cap p" data-act="post" type="button" ${sel.clips.length < 3 ? "disabled" : ""}>Post to TikTik</button>
  </div>`;
}

export function initStudio() {
  registerWindow("studio", { open: renderStudio });
  $("#studio").addEventListener("input", e => { if (e.target.id === "caption") sel.caption = e.target.value; });
  registerActions({
    prod: (t, v) => { sel.p = v; renderStudio(); },
    clip: (t, v) => { if (!sel.clips.includes(v) && sel.clips.length < 3) { sel.clips.push(v); renderStudio(); } },
    unslot: (t, v) => { sel.clips.splice(+v, 1); renderStudio(); },
    set: (t, v) => { sel[t.dataset.k] = v; renderStudio(); },
    post: () => { if (sel.clips.length === 3 && !S.post) { startPost(sel); openUI("running"); } },
    new: () => { if (S.last) sel.clips = []; openUI("studio"); }
  });
}
