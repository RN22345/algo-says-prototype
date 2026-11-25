/* EDITOR. One interface: editVideo(draft, ui) -> Promise<edit>. Swap the implementation with config.editorMode ("blocks" | "auto").
   draft = { site, pid, clips:[{id,slot,action,angle,light,hour,dur,d0,d1}], edit? }. ui = { mount: Element }.
   edit = { order:[clipId], trims:{clipId:[trimStart,trimEnd] in seconds}, captions, sound, priceAt, filter, sticker }.
   "blocks": a full-width horizontal timeline. Drag a block's title bar to reorder (or use the arrows). Drag a gold handle to trim dead air;
   trimming too far can cut the answer. Play runs the edit in the preview: a playhead crosses the timeline, each clip shows in turn, and the caption,
   price text and sticker appear when they would. Options: captions, sound, where the price shows, filter (vivid = honesty trap), sticker (Only 2 left = honesty trap).
   Exporting costs energy and game time. Uses scene.js for pictures. No grades are shown. */
import { D } from "../core/data.js";
import { flag } from "../core/state.js";
import { skipBy } from "../core/clock.js";
import { energyCheck, energySpend, sfx } from "../core/actions.js";
import { h, btn, clear, drag } from "./ui.js";
import { sceneEl, actionOf } from "./scene.js";

export const defaultEdit = draft => ({ order: draft.clips.map(c => c.id), trims: {}, captions: false, sound: "none", priceAt: "off", filter: "none", sticker: "none" });

export function editVideo(draft, ui) {
  if (D.config.editorMode === "auto") return Promise.resolve(draft.edit || defaultEdit(draft));
  return blocksEditor(draft, ui);
}

const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const CAPTION = { holdup: "Look at this", closeup: "Look closer", demo: "Watch it work", beforeafter: "Before and after", inuse: "In real life", unbox: "Unboxing time", talk: "Real talk" };

function blocksEditor(draft, ui) {
  return new Promise(resolve => {
    const E = JSON.parse(JSON.stringify(draft.edit || defaultEdit(draft))), byId = Object.fromEntries(draft.clips.map(c => [c.id, c]));
    const product = D.P[draft.pid], tt = draft.site === "tiktik";
    let PPS = tt ? 60 : 36, selId = E.order[0], playing = false, raf = 0, lastKey = "";
    const mount = ui.mount; clear(mount);
    const prev = h("div", { class: "cam " + (tt ? "tt" : "yv"), style: tt ? { width: "270px", height: "480px" } : { width: "640px", height: "360px" } });
    const tl = h("div", { class: "timeline", style: { minHeight: "250px" } }), total = h("span", { class: "big-num" }), opts = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: ".5em 1.2em" } });
    const playhead = h("div", { class: "playhead", hidden: true });
    const trimOf = id => E.trims[id] || (E.trims[id] = [0, 0]);
    const len = id => Math.max(0.6, byId[id].dur - trimOf(id)[0] - trimOf(id)[1]);
    const totalLen = () => E.order.reduce((a, id) => a + len(id), 0);
    const ansPos = c => c.d0 + actionOf(c.action).ansAt * (c.dur - c.d0 - c.d1);

    /* ----- preview ----- */
    function drawPreview(o) {
      const c = byId[(o && o.id) || selId] || byId[E.order[0]], idx = E.order.indexOf(c.id);
      const cap = o ? o.cap : E.captions, price = o ? o.price : (E.priceAt === "first" && idx === 0 || E.priceAt === "last" && idx === E.order.length - 1), stk = o ? o.stk : E.sticker === "only2";
      clear(prev);
      const sc = sceneEl(c, product, { filter: E.filter }); sc.style.fontSize = tt ? "13px" : "20px"; prev.append(sc);
      if (cap) prev.append(h("div", { style: { position: "absolute", left: "6%", right: "6%", bottom: "9%", textAlign: "center", color: "#fff", font: "400 " + (tt ? "20px" : "28px") + " var(--lil)", WebkitTextStroke: "4px #000", paintOrder: "stroke fill" } }, c.action === "price" ? "₱" + product.price : (CAPTION[c.action] || "")));
      if (price) prev.append(h("div", { class: "tag gold", style: { position: "absolute", left: "8%", top: "7%", fontSize: tt ? "20px" : "30px" } }, "₱" + product.price));
      if (stk) prev.append(h("div", { class: "tag", style: { position: "absolute", right: "6%", top: "7%", fontSize: tt ? "18px" : "28px", transform: "rotate(6deg)" } }, "Only 2 left!"));
      prev.append(h("div", { style: { position: "absolute", left: "8px", top: "8px", background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: "10px", padding: "0 .5em", font: "600 14px var(--body)" } }, `Clip ${idx + 1} of ${E.order.length}`));
    }
    function setSel(id) { selId = id; tl.querySelectorAll(".blk").forEach(b => { b.style.outline = b.dataset.id === id ? "4px solid var(--gold)" : "none"; }); }

    /* ----- play ----- */
    const playBtn = btn("▶ Play", "b-teal sm", () => (playing ? stop() : play()));
    function layout() { let t = 0; return E.order.map(id => { const o = { id, start: t, len: len(id) }; t += o.len; return o; }); }
    function play() {
      stop(); playing = true; playBtn.textContent = "■ Stop"; playhead.hidden = false; lastKey = "";
      const lay = layout(), T = totalLen(), t0 = performance.now(); sfx("rec");
      const tick = now => {
        if (!playing) return;
        const t = (now - t0) / 1000;
        if (t >= T) { stop(); return; }
        let i = lay.findIndex(b => t < b.start + b.len); if (i < 0) i = lay.length - 1;
        const b = lay[i], c = byId[b.id], local = t - b.start, src = trimOf(b.id)[0] + local, ap = ansPos(c);
        const cap = E.captions && src >= ap - 0.2 && src <= ap + 1.6;
        const price = (E.priceAt === "first" && i === 0 && local >= Math.min(b.len * 0.5, 1.2) && local <= Math.min(b.len * 0.5, 1.2) + 2) || (E.priceAt === "last" && i === lay.length - 1 && local >= b.len - 2.2);
        const stk = E.sticker === "only2" && t >= 1;
        const key = [b.id, cap, price, stk].join("|");
        if (key !== lastKey) { lastKey = key; setSel(b.id); drawPreview({ id: b.id, cap, price, stk }); }
        const el = tl.querySelector(`[data-id="${b.id}"]`);
        if (el) { const x = el.offsetLeft + (local / b.len) * el.offsetWidth; playhead.style.left = x + "px"; if (x < tl.scrollLeft + 20 || x > tl.scrollLeft + tl.clientWidth - 40) tl.scrollLeft = x - tl.clientWidth / 2; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function stop() { if (!playing) return; playing = false; cancelAnimationFrame(raf); playBtn.textContent = "▶ Play"; playhead.hidden = true; drawPreview(); }

    /* ----- timeline ----- */
    const thumbSize = tt ? [84, 150] : [200, 112];
    function blockEl(id) {
      const c = byId[id], [ts, te] = trimOf(id), l = len(id), w = l * PPS, a = actionOf(c.action);
      const headDead = Math.max(0, c.d0 - ts), tailDead = Math.max(0, c.d1 - te);
      const thumb = h("div", { class: "thumb", style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: thumbSize[0] + "px", height: thumbSize[1] + "px" } }, sceneEl(c, product, {}));
      thumb.firstChild.style.fontSize = "6px";
      const bw = h("div", { class: "bw", style: { minHeight: "170px" } }, thumb,
        headDead ? h("div", { class: "dead", style: { left: 0, width: headDead * PPS + "px" } }) : null,
        tailDead ? h("div", { class: "dead", style: { right: 0, width: tailDead * PPS + "px" } }) : null);
      const hl = h("div", { class: "handle l", title: "Trim the start" }, "⟨"), hr = h("div", { class: "handle r", title: "Trim the end" }, "⟩");
      bw.append(hl, hr);
      const blk = h("div", { class: "blk", "data-id": id, style: { width: Math.max(w, 96) + "px", outline: selId === id ? "4px solid var(--gold)" : "none" } },
        h("div", { class: "bt" }, h("span", {}, D.sites.slotInfo[c.slot] ? D.sites.slotInfo[c.slot].label : c.slot), h("span", {}, l.toFixed(1) + "s")), bw,
        h("div", { class: "bb" }, h("button", { type: "button", onClick: () => move(id, -1) }, "◀"), h("span", { class: "tiny", style: { color: "#cfd6ff" } }, a.label), h("button", { type: "button", onClick: () => move(id, 1) }, "▶")));
      blk.addEventListener("pointerdown", () => { if (selId !== id) { stop(); setSel(id); drawPreview(); } });
      for (const [el, side] of [[hl, 0], [hr, 1]]) {
        let t0 = 0;
        drag(el, {
          start: () => { stop(); t0 = trimOf(id)[side]; },
          move: dx => { const t = trimOf(id), other = t[1 - side]; t[side] = Math.max(0, Math.min(byId[id].dur - other - 0.6, t0 + (side === 0 ? dx : -dx) / PPS)); t[side] = Math.round(t[side] * 20) / 20; refresh(false); },
          end: () => { sfx("tap"); refresh(true); }
        });
      }
      let lastDx = 0;
      drag(blk.querySelector(".bt"), {
        start: () => { stop(); blk.classList.add("drag"); lastDx = 0; },
        move: dx => { lastDx = dx; blk.style.transform = `translateX(${dx}px)`; },
        end: () => {
          blk.classList.remove("drag"); const mid = blk.offsetLeft + blk.offsetWidth / 2 + lastDx;
          const others = [...tl.querySelectorAll(".blk")].filter(b => b !== blk), at = others.filter(b => b.offsetLeft + b.offsetWidth / 2 < mid).length;
          E.order = E.order.filter(x => x !== id); E.order.splice(at, 0, id); sfx("pop"); refresh(true);
        }
      });
      return blk;
    }
    function move(id, d) { stop(); const i = E.order.indexOf(id), j = i + d; if (j < 0 || j >= E.order.length) return; E.order.splice(i, 1); E.order.splice(j, 0, id); sfx("pop"); refresh(true); }
    /* rebuild=true redraws the whole timeline, false only updates widths and lengths while a handle is dragged */
    function refresh(rebuild) {
      if (rebuild) { clear(tl); E.order.forEach(id => tl.append(blockEl(id))); tl.append(playhead); }
      else for (const id of E.order) {
        const blk = tl.querySelector(`[data-id="${id}"]`); if (!blk) continue; const c = byId[id], [ts, te] = trimOf(id), l = len(id);
        blk.style.width = Math.max(l * PPS, 96) + "px"; blk.querySelector(".bt span:last-child").textContent = l.toFixed(1) + "s";
        const hd = Math.max(0, c.d0 - ts), td = Math.max(0, c.d1 - te), bw = blk.querySelector(".bw");
        blk.querySelectorAll(".dead").forEach(d => d.remove());
        if (hd) bw.prepend(h("div", { class: "dead", style: { left: 0, width: hd * PPS + "px" } })); if (td) bw.prepend(h("div", { class: "dead", style: { right: 0, width: td * PPS + "px" } }));
      }
      total.textContent = mmss(totalLen());
      drawPreview();
    }

    const chips = (list, key, label) => h("div", {}, h("div", { class: "opt-h" }, label), h("div", { class: "opts" }, list.filter(o => !(o.trap && !flag("honestyTrap"))).map(o =>
      h("button", { class: "chip" + (E[key] === o.id ? " sel" : ""), type: "button", onClick: () => { stop(); E[key] = o.id; drawOpts(); drawPreview(); sfx("tap"); } }, o.label))));
    function drawOpts() {
      clear(opts);
      opts.append(
        h("div", {}, h("div", { class: "opt-h" }, "Captions"), h("div", { class: "opts" }, [[false, "Off"], [true, "On"]].map(([v, l]) => h("button", { class: "chip" + (E.captions === v ? " sel" : ""), type: "button", onClick: () => { stop(); E.captions = v; drawOpts(); drawPreview(); sfx("tap"); } }, l)))),
        chips(D.sites.sounds, "sound", "Sound"),
        chips([{ id: "off", label: "No price text" }, { id: "first", label: "First clip" }, { id: "last", label: "Last clip" }], "priceAt", "Show the price"),
        chips(D.sites.filters, "filter", "Filter"),
        chips(D.sites.stickers, "sticker", "Sticker"));
    }
    const exportBtn = btn("Export video", "b-gold big", async () => {
      if (!energyCheck()) return;
      stop(); exportBtn.disabled = true; exportBtn.textContent = "Rendering...";
      energySpend(D.time.energy.edit); skipBy(D.time.editMinutes, "skip"); sfx("rec");
      await new Promise(r => setTimeout(r, 900));
      resolve(JSON.parse(JSON.stringify(E)));
    });
    mount.append(h("div", { style: { display: "flex", flexDirection: "column", gap: ".6em", padding: ".7em 1.2em", flex: "1", minHeight: 0, overflow: "auto" } },
      h("div", { style: { display: "flex", gap: "1.2em", alignItems: "flex-start" } },
        h("div", { style: { flex: "none" } }, prev),
        h("div", { class: "side", style: { flex: "1", width: "auto", borderRadius: "16px" } }, h("h3", {}, "Look and sound"), opts)),
      h("div", { class: "row", style: { justifyContent: "space-between" } },
        h("div", { class: "row" }, h("h3", {}, "Timeline"), playBtn, h("span", { class: "small", style: { opacity: ".85" } }, "Drag a title bar to reorder. Drag a gold handle to trim the hatched dead air. Trim too far and you cut the good part.")),
        h("div", { class: "row" }, h("span", { class: "small" }, "Length"), total)),
      tl,
      h("div", { class: "row", style: { justifyContent: "space-between" } }, h("div", { class: "small", style: { opacity: ".85" } }, `Export takes ${D.time.editMinutes} minutes of game time and ${D.time.energy.edit} energy.`), exportBtn)));
    // use the full width: pixels per second from the timeline width
    const sumDur = draft.clips.reduce((a, c) => a + c.dur, 0), avail = tl.clientWidth - 24 - draft.clips.length * 6;
    if (avail > 200) PPS = Math.max(36, Math.min(130, avail / sumDur));
    drawOpts(); refresh(true);
  });
}
