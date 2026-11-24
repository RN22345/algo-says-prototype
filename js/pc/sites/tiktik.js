/* TikTik: short-video site. For you (feed), Create (make a video), My posts (live and finished results). */
import { D, S, sel } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { startPost, activePosts } from "../../sim/post.js";
import { stockWarning } from "../../sim/shop.js";
import { playEdit } from "../../mini/edit.js";
import { esc } from "../util.js";
import { nav } from "./nav.js";
import { feedHTML } from "./feeds.js";
import { productRow, stickerHTML, shell, postList, postNo, isLive, resultsHTML } from "./common.js";

const AC = "#9446e0";
const st = { warn: null, busy: false };

const chipRow = (key, opts) => opts.map(([v, t]) => `<button type="button" class="chip ${sel[key] === v ? "on" : ""}" data-act="br-tt-set" data-k="${key}" data-v="${v}" aria-pressed="${sel[key] === v}">${t}</button>`).join("");

function stickerChips() {
  const own = S.stickers.map((u, i) => `<button type="button" class="chip ${sel.sticker === "my:" + i ? "on" : ""}" data-act="br-tt-set" data-k="sticker" data-v="my:${i}" title="Your sticker ${i + 1}"><img src="${u}" alt="Your sticker ${i + 1}" style="height:1.5em;width:1.5em;object-fit:contain"></button>`).join("");
  return chipRow("sticker", [["none", "None"], ["new", "New"], ["sale", "Sale"]]) + own;
}

function createPage() {
  const PR = D.PR, CLIPS = D.CLIPS;
  if (sel.sticker.startsWith("my:") && !S.stickers[+sel.sticker.slice(3)]) sel.sticker = "none";
  const prods = Object.keys(PR).map(k => productRow(k, "br-tt-prod", sel.p === k)).join("");
  const slots = [0, 1, 2].map(i => { const c = sel.clips[i]; return c ? `<button type="button" class="slot" data-act="br-tt-unslot" data-v="${i}" title="Click to remove"><img src="img/${CLIPS[c][1]}.png" alt=""><div>${i + 1} · ${CLIPS[c][0]} <span class="br-sub">0:0${i * 5}</span></div></button>` : `<div class="slot empty">Slot ${i + 1}</div>`; }).join("");
  const lib = Object.entries(CLIPS).map(([k, [n, img]]) => `<button type="button" class="clip ${sel.clips.includes(k) ? "used" : ""}" data-act="br-tt-clip" data-v="${k}"><img src="img/${img}.png" alt=""><div>${n}</div></button>`).join("");
  const photo = `img/${PR[sel.p].icon}.png`;
  const warn = st.warn ? `<div class="card br-warn" role="alert"><b>Before you post</b><p>${esc(st.warn)}</p><div class="br-row"><button type="button" class="cap sm" data-act="br-tt-anyway">Post anyway</button><button type="button" class="cap sm r" data-act="br-tt-back">Back</button></div></div>` : "";
  return `<div class="br-create">
    <section class="br-col"><div class="lbl">1 · Product</div>${prods}<span class="br-sub">You can post an item with no stock. Orders for it become missed sales.</span></section>
    <section class="br-col"><div class="lbl">2 · Clips · click 3 in order</div><div class="br-slots">${slots}</div>
      <div class="lbl">Clip library · ${PR[sel.p].n}</div><div class="br-wrap">${lib}</div></section>
    <section class="br-col"><div class="lbl">3 · Cover and caption</div>
      <div class="br-coverrow">
        <div class="card br-cover small"><img class="pimg" src="${photo}" alt="">
          ${sel.shot === "face" ? `<img src="img/chat_avatar_05.png" alt="" class="face">` : ""}
          ${sel.text === "price" ? `<img src="img/mg_thumb_sticker_price.png" alt="" class="ptag">` : ""}
          ${sel.text === "question" ? `<div class="qtag">Sulit ba 'to?</div>` : ""}
          ${stickerHTML(sel.sticker)}</div>
        <div class="br-opts">
          <span class="lbl">Shot</span><div class="br-wrap">${chipRow("shot", [["product", "Product"], ["face", "Face + product"]])}</div>
          <span class="lbl">Text</span><div class="br-wrap">${chipRow("text", [["none", "None"], ["price", "Price"], ["question", "Question"]])}</div>
          <span class="lbl">Sticker</span><div class="br-wrap">${stickerChips()}</div>
          ${S.stickers.length < D.PC.stickerMax ? `<span class="br-sub">Draw your own stickers in Paint.</span>` : ""}
        </div></div>
      <div><div class="lbl">Caption</div><textarea class="cap-in" id="br-caption" maxlength="120" placeholder="Type a caption">${esc(sel.caption)}</textarea></div>
    </section>
  </div>
  ${warn}
  <div class="br-actions"><span class="br-sub">No score before posting. You will see what happens.</span>
    <button class="cap ac" data-act="br-tt-post" type="button" ${sel.clips.length < 3 || st.busy || st.warn ? "disabled" : ""}>${st.busy ? "Editing…" : "Post to TikTik"}</button></div>`;
}

function minePage(tab) {
  const list = postList("tiktik");
  if (!list.length) return `<div class="card br-empty"><h2>No posts yet</h2><p>Make a video and it shows up here, with live numbers.</p><button type="button" class="cap ac sm" data-act="br-go" data-v="tiktik/create">Make a video</button></div>`;
  const cur = list.includes(tab.arg) ? tab.arg : (activePosts("tiktik").slice(-1)[0] || list[list.length - 1]);
  const rows = list.slice().reverse().map(p => `<button type="button" class="br-prow ${p === cur ? "on" : ""}" data-act="br-pick-post" data-v="${list.indexOf(p)}" aria-pressed="${p === cur}"><img src="img/${D.PR[p.p].icon}.png" alt=""><span><b>#${postNo(p)} · ${D.PR[p.p].n}</b><small>${isLive(p) ? "● live" : "ended"} · ${Math.round(p.views).toLocaleString()} views · ${p.orders} orders</small></span></button>`).join("");
  return `<div class="br-mine"><div class="br-plist" data-sk="ttl">${rows}</div><div class="br-pdet"><div class="br-ph">Post #${postNo(cur)} · ${D.PR[cur.p].n}</div>${resultsHTML(cur, AC)}</div></div>
    <div class="br-actions"><span></span><button type="button" class="cap ac sm" data-act="br-go" data-v="tiktik/create">Make a new video</button></div>`;
}

async function doPost() {
  if (st.busy || sel.clips.length < 3) return;
  st.warn = null; st.busy = true; nav.redraw();
  try { await playEdit({ site: "tiktik" }); } catch (e) { console.warn("edit minigame failed", e); }
  st.busy = false;
  const p = startPost({ ...sel, clips: [...sel.clips] }, "tiktik");
  sel.clips = [];
  nav.go("tiktik", "mine", p);
}

registerActions({
  "br-tt-prod": (t, v) => { sel.p = v; st.warn = null; nav.redraw(); },
  "br-tt-clip": (t, v) => { if (!sel.clips.includes(v) && sel.clips.length < 3) { sel.clips.push(v); nav.redraw(); } },
  "br-tt-unslot": (t, v) => { sel.clips.splice(+v, 1); nav.redraw(); },
  "br-tt-set": t => { sel[t.dataset.k] = t.dataset.v; nav.redraw(); },
  "br-tt-post": () => {
    if (st.busy || sel.clips.length < 3) return;
    const w = stockWarning(sel.p);
    if (w) { st.warn = w; nav.redraw(); } else doPost();
  },
  "br-tt-anyway": () => doPost(),
  "br-tt-back": () => { st.warn = null; nav.redraw(); },
  "br-pick-post": (t, v) => { const l = postList("tiktik"); if (l[+v]) nav.go("tiktik", "mine", l[+v]); }
});

export default {
  id: "tiktik", name: "TikTik", host: "tiktik.example", icon: "🎵", cat: "social", ac: AC, ac2: "#6224a8", c1: "#b06cf5", c2: "#9446e0",
  pages: [{ id: "feed", label: "For you", path: "for-you" }, { id: "create", label: "Create", path: "create" }, { id: "mine", label: "My posts", path: "my-posts" }],
  path(tab) { const pg = this.pages.find(x => x.id === tab.page) || this.pages[0]; return pg.id === "mine" && tab.arg ? `my-posts/${postNo(tab.arg)}` : pg.path; },
  render(tab) {
    const body = tab.page === "create" ? createPage() : tab.page === "mine" ? minePage(tab) : feedHTML("tiktik");
    return shell(this, tab, body, tab.page === "feed" ? `<button type="button" class="chip" data-act="br-reload" title="Show new posts">⟳ New posts</button>` : "");
  },
  onInput(e) { if (e.target.id === "br-caption") sel.caption = e.target.value; }
};
