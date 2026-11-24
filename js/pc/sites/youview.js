/* YouView: long-video site. Home (feed), Upload (needs a camera), My videos (live and finished results). */
import { D, S, on } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { startPost, activePosts } from "../../sim/post.js";
import { stockWarning } from "../../sim/shop.js";
import { siteAccess } from "../../sim/gear.js";
import { playEdit } from "../../mini/edit.js";
import { esc } from "../util.js";
import { nav } from "./nav.js";
import { feedHTML } from "./feeds.js";
import { productRow, shell, postList, postNo, isLive, resultsHTML, closedCard, SEGS } from "./common.js";

const AC = "#ff8a2a";
/* Form state. Not saved, like the TikTik selection. */
const yv = { p: null, title: "", segs: [], thumb: "honest", warn: null, busy: false };
on("newgame", () => Object.assign(yv, { p: null, title: "", segs: [], thumb: "honest", warn: null, busy: false }));
const THUMBS = [["honest", "Plain", "Shows the product as it is."], ["bold", "Bold", "Big title text on a bright cover."]];

function uploadPage() {
  const acc = siteAccess("youview");
  if (!acc.open) return closedCard(acc.reason);
  const PR = D.PR;
  if (!yv.p || !PR[yv.p]) yv.p = Object.keys(PR)[0];
  const prods = Object.keys(PR).map(k => productRow(k, "br-yv-prod", yv.p === k)).join("");
  const segs = Object.entries(SEGS).map(([k, [n, what]]) => {
    const i = yv.segs.indexOf(k);
    return `<button type="button" class="br-seg ${i >= 0 ? "on" : ""}" data-act="br-yv-seg" data-v="${k}" aria-pressed="${i >= 0}"><span class="no">${i >= 0 ? i + 1 : ""}</span><span><b>${n}</b><small>${what}</small></span></button>`;
  }).join("");
  const thumbs = THUMBS.map(([k, n, what]) => `<button type="button" class="br-seg ${yv.thumb === k ? "on" : ""}" data-act="br-yv-thumb" data-v="${k}" aria-pressed="${yv.thumb === k}"><span class="no">${yv.thumb === k ? "✓" : ""}</span><span><b>${n}</b><small>${what}</small></span></button>`).join("");
  const ready = yv.segs.length >= 3 && yv.title.trim();
  const warn = yv.warn ? `<div class="card br-warn" role="alert"><b>Before you upload</b><p>${esc(yv.warn)}</p><div class="br-row"><button type="button" class="cap sm" data-act="br-yv-anyway">Upload anyway</button><button type="button" class="cap sm r" data-act="br-yv-back">Back</button></div></div>` : "";
  return `<div class="br-create yv">
    <section class="br-col"><div class="lbl">1 · Product</div>${prods}</section>
    <section class="br-col"><div class="lbl">2 · Title</div><input class="br-in" id="br-title" type="text" maxlength="80" placeholder="Type a title" value="${esc(yv.title)}" aria-label="Video title">
      <div class="lbl">3 · Segments · click at least 3, in order</div><div class="br-segs">${segs}</div></section>
    <section class="br-col"><div class="lbl">4 · Cover</div><div class="br-segs">${thumbs}</div>
      <div class="card br-thumb ${yv.thumb === "bold" ? "bold" : ""}"><img class="pimg" src="img/${PR[yv.p].icon}.png" alt=""><div class="br-ttl">${esc(yv.title || "Your title")}</div></div></section>
  </div>
  ${warn}
  <div class="br-actions"><span class="br-sub">${ready ? "No score before uploading. You will see what happens." : "Add a title and at least 3 segments."}</span>
    <button class="cap ac" data-act="br-yv-post" type="button" ${!ready || yv.busy || yv.warn ? "disabled" : ""}>${yv.busy ? "Editing…" : "Upload to YouView"}</button></div>`;
}

function minePage(tab) {
  const list = postList("youview");
  if (!list.length) return `<div class="card br-empty"><h2>No videos yet</h2><p>Upload a video and it shows up here, with live numbers.</p><button type="button" class="cap ac sm" data-act="br-go" data-v="youview/upload">Upload a video</button></div>`;
  const cur = list.includes(tab.arg) ? tab.arg : (activePosts("youview").slice(-1)[0] || list[list.length - 1]);
  const rows = list.slice().reverse().map(p => `<button type="button" class="br-prow ${p === cur ? "on" : ""}" data-act="br-pick-video" data-v="${list.indexOf(p)}" aria-pressed="${p === cur}"><img src="img/${D.PR[p.p].icon}.png" alt=""><span><b>#${postNo(p)} · ${esc(p.title || D.PR[p.p].n)}</b><small>${isLive(p) ? "● live" : "ended"} · ${Math.round(p.views).toLocaleString()} views · ${p.orders} orders</small></span></button>`).join("");
  return `<div class="br-mine"><div class="br-plist" data-sk="yvl">${rows}</div><div class="br-pdet"><div class="br-ph">Video #${postNo(cur)} · ${esc(cur.title || D.PR[cur.p].n)}</div>${resultsHTML(cur, AC)}</div></div>
    <div class="br-actions"><span></span><button type="button" class="cap ac sm" data-act="br-go" data-v="youview/upload">Upload another video</button></div>`;
}

async function doPost() {
  if (yv.busy || yv.segs.length < 3 || !yv.title.trim()) return;
  yv.warn = null; yv.busy = true; nav.redraw();
  try { await playEdit({ site: "youview" }); } catch (e) { console.warn("edit minigame failed", e); }
  yv.busy = false;
  const p = startPost({ p: yv.p, title: yv.title.trim(), segs: [...yv.segs], thumb: yv.thumb }, "youview");
  yv.segs = []; yv.title = "";
  nav.go("youview", "mine", p);
}

registerActions({
  "br-yv-prod": (t, v) => { yv.p = v; yv.warn = null; nav.redraw(); },
  "br-yv-seg": (t, v) => { yv.segs = yv.segs.includes(v) ? yv.segs.filter(s => s !== v) : [...yv.segs, v]; nav.redraw(); },
  "br-yv-thumb": (t, v) => { yv.thumb = v; nav.redraw(); },
  "br-yv-post": () => {
    if (yv.busy || yv.segs.length < 3 || !yv.title.trim()) return;
    const w = stockWarning(yv.p);
    if (w) { yv.warn = w; nav.redraw(); } else doPost();
  },
  "br-yv-anyway": () => doPost(),
  "br-yv-back": () => { yv.warn = null; nav.redraw(); },
  "br-pick-video": (t, v) => { const l = postList("youview"); if (l[+v]) nav.go("youview", "mine", l[+v]); }
});

export default {
  id: "youview", name: "YouView", host: "youview.example", icon: "▶️", cat: "social", ac: AC, ac2: "#cf5e00", c1: "#ffad66", c2: "#ff8a2a",
  pages: [{ id: "feed", label: "Home", path: "home" }, { id: "upload", label: "Upload", path: "upload" }, { id: "mine", label: "My videos", path: "my-videos" }],
  path(tab) { const pg = this.pages.find(x => x.id === tab.page) || this.pages[0]; return pg.id === "mine" && tab.arg ? `my-videos/${postNo(tab.arg)}` : pg.path; },
  render(tab) {
    const body = tab.page === "upload" ? uploadPage() : tab.page === "mine" ? minePage(tab) : feedHTML("youview");
    return shell(this, tab, body, tab.page === "feed" ? `<button type="button" class="chip" data-act="br-reload" title="Show new videos">⟳ New videos</button>` : "");
  },
  /* Typing must not redraw the page, so update the preview and the button by hand. */
  onInput(e) {
    if (e.target.id !== "br-title") return;
    yv.title = e.target.value;
    const site = e.target.closest(".br-site"), t = site.querySelector(".br-ttl"), b = site.querySelector("[data-act=br-yv-post]");
    if (t) t.textContent = yv.title || "Your title";
    const ready = yv.segs.length >= 3 && yv.title.trim(), hint = site.querySelector(".br-actions .br-sub");
    if (b) b.disabled = !ready || yv.busy || !!yv.warn;
    if (hint) hint.textContent = ready ? "No score before uploading. You will see what happens." : "Add a title and at least 3 segments.";
  }
};
