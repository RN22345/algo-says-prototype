/* STUDIO (the key mechanic). Four steps at the filming corner: 1 Plan (shot board: drag or tap clip cards into slots), 2 Shoot (action, angle, light,
   live preview, record each slot), 3 Edit (editor.js, behind editVideo), 4 Post (site, caption or search title, tags, stock warning that never blocks).
   Each clip costs game time and energy. The clock is paused while this window is open, except for those costs. No grades, only plain camera notes.
   The draft is kept in S.draft so closing the window does not lose recorded clips. Events out: studio:open, post:submit. */
import { D } from "../core/data.js";
import { S, flag, hasGear, siteOpen, tier2On, mulberry, hashStr, uid, clamp, fmtMoney } from "../core/state.js";
import { tod, skipBy, isDaylight } from "../core/clock.js";
import { energyCheck, energySpend, toast, sfx } from "../core/actions.js";
import { emit } from "../core/bus.js";
import { h, btn, art, clear, modal } from "./ui.js";
import { getScale } from "../core/fit.js";
import { sceneEl, flawNotes, actionOf, angleOf, lightOf } from "./scene.js";
import { editVideo } from "./editor.js";

let win = null, main = null, foot = null, stepsEl = null;
const STEPS = [["board", "1 Plan"], ["shoot", "2 Shoot"], ["edit", "3 Edit"], ["post", "4 Post"]];

export const availableProducts = () => D.products.filter(p => S.samples[p.id] || shelfTotal(p.id) > 0);
const shelfTotal = id => S.shelves.reduce((a, sh) => a + sh.filter(x => x === id).length, 0) + (S.boxes[id] || 0);
const shelfOnly = id => S.shelves.reduce((a, sh) => a + sh.filter(x => x === id).length, 0);
const gearMult = () => D.gear.reduce((m, g) => m * (S.gear[g.id] && g.effects && g.effects.shootMult ? g.effects.shootMult : 1), 1);

function newDraft(pid, site) { return { site: site || "tiktik", pid, step: "board", slots: {}, setup: {}, clips: {}, edit: null, title: "", tags: [], mode: "affiliate", sel: null }; }

export function openStudio(siteHint) {
  if (win && win.back.isConnected) return;
  if (!energyCheck()) return;
  const avail = availableProducts();
  if (!S.draft && !avail.length) { toast("You have nothing to film yet. Request a sample on the Affiliate site (desk PC)."); sfx("error"); return; }
  if (!S.draft) S.draft = newDraft(avail[0].id, siteHint && siteOpen(siteHint) ? siteHint : "tiktik");
  if (siteHint && siteOpen(siteHint) && !Object.keys(S.draft.clips).length) S.draft.site = siteHint;
  stepsEl = h("div", { class: "steps" }); main = h("div", { class: "stu-main" }); foot = h("div", { class: "stu-foot" });
  win = modal({ title: "🎬 Filming corner", cls: "studio", pause: true, headerExtra: stepsEl, body: [main, foot], onClose: () => { win = null; } });
  emit("studio:open");
  go(S.draft.step || "board");
}

function go(step) {
  const d = S.draft; d.step = step;
  clear(stepsEl); const order = STEPS.map(s => s[0]);
  STEPS.forEach(([k, l]) => stepsEl.append(h("span", { class: "stepchip" + (k === step ? " on" : order.indexOf(k) < order.indexOf(step) ? " done" : "") }, l)));
  clear(main); clear(foot);
  ({ board, shoot, edit, post })[step]();
}
const slotsOf = () => D.SITE[S.draft.site].slots;
const slotLabel = s => (D.sites.slotInfo[s] || { label: s }).label;
const allPlanned = () => slotsOf().every(s => S.draft.slots[s]);
const allShot = () => slotsOf().every(s => S.draft.clips[s]);
const anyShot = () => Object.keys(S.draft.clips).length > 0;

/* ================= 1 PLAN ================= */
function board() {
  const d = S.draft, site = D.SITE[d.site], slots = slotsOf(), locked = anyShot();
  const prodRow = h("div", { class: "opts" }, availableProducts().map(p => h("button", { class: "chip" + (d.pid === p.id ? " sel" : "") + (locked ? " dis" : ""), type: "button", onClick: () => { if (locked) return toast("Start over to change the product."); d.pid = p.id; board2(); } }, art(p.icon, "mini"), p.short)));
  const siteRow = h("div", { class: "opts" }, Object.keys(D.SITE).map(s => {
    const ok = siteOpen(s);
    return h("button", { class: "chip" + (d.site === s ? " sel" : "") + (!ok || locked ? " dis" : ""), type: "button", onClick: () => { if (!ok) return toast(`${D.SITE[s].name} needs a ${D.G[D.SITE[s].needsGear].name}. Buy it in the Tool Shop.`); if (locked) return toast("Start over to change the site."); d.site = s; d.slots = {}; board2(); } }, D.SITE[s].name + " · " + D.SITE[s].format, ok ? "" : " 🔒");
  }));
  const grid = h("div", { class: "slots", style: { gridTemplateColumns: `repeat(${slots.length},1fr)` } }, slots.map(s => slotBox(s)));
  const cards = h("div", { class: "cliprow" }, D.shots.actions.map(a => clipCard(a)));
  main.append(h("div", { class: "board" },
    h("div", { class: "row" }, h("span", { class: "opt-h" }, "Product"), prodRow),
    h("div", { class: "row" }, h("span", { class: "opt-h" }, "Site"), siteRow),
    h("div", { class: "row" }, h("h3", {}, "Shot board"), h("span", { class: "small", style: { opacity: ".85" } }, site.format === "Short video" ? "A short video has 4 shots." : "A long video has 6 shots and a search title.")),
    grid, h("h3", {}, "Clip cards"), h("div", { class: "small", style: { opacity: ".85" } }, "Drag a card into a slot, or tap a slot and then a card."), cards));
  foot.append(btn("Start over", "b-red sm", () => { S.draft = newDraft(d.pid, d.site); go("board"); }),
    h("div", { class: "row" }, btn("Fill with a basic plan", "b-teal sm", () => { slots.forEach(s => { d.slots[s] = D.shots.defaultActions[s] || "holdup"; }); board2(); }),
      btn(anyShot() ? "Next: Shoot" : "Next: Shoot", allPlanned() ? "b-gold big" : "b-grey big", () => { if (!allPlanned()) return toast("Fill every slot first."); slots.forEach(s => { d.setup[s] = d.setup[s] || {}; d.setup[s].action = d.slots[s]; d.setup[s].angle = d.setup[s].angle || "medium"; d.setup[s].light = d.setup[s].light || "ceiling"; if (d.clips[s] && d.clips[s].action !== d.slots[s]) delete d.clips[s]; }); d.sel = slots.find(s => !d.clips[s]) || slots[0]; go("shoot"); })));
}
const board2 = () => go("board");

function slotBox(s) {
  const d = S.draft, a = d.slots[s] && actionOf(d.slots[s]), tt = d.site === "tiktik";
  const box = h("div", { class: "bslot" + (d.sel === s ? " sel" : ""), "data-slot": s, onClick: () => { d.sel = s; board2(); } },
    h("h4", {}, slotLabel(s)), h("div", { class: "hint" }, (D.sites.slotInfo[s] || {}).hint || ""));
  if (a) {
    const th = h("div", { class: "thumb", style: { width: tt ? "84px" : "200px", height: tt ? "150px" : "112px", marginTop: ".2em" } }, (() => { const sc = sceneEl({ action: a.id, angle: "medium", light: "window", hour: 600 }, D.P[d.pid]); sc.style.fontSize = tt ? "5.5px" : "9px"; return sc; })());
    box.append(th, h("b", { class: "lil", style: { fontSize: ".8em" } }, a.label), h("button", { class: "chip sm", type: "button", style: { fontSize: ".6em" }, onClick: e => { e.stopPropagation(); delete d.slots[s]; delete d.clips[s]; board2(); } }, "Clear"));
  } else box.append(h("div", { style: { margin: "auto", opacity: ".6", fontSize: ".7em" } }, "Drop a card here"));
  return box;
}
function assign(slot, actionId) {
  const d = S.draft; d.slots[slot] = actionId; if (d.clips[slot] && d.clips[slot].action !== actionId) delete d.clips[slot];
  const nxt = slotsOf().find(s => !d.slots[s]); d.sel = nxt || slot; sfx("pop"); board2();
}
function clipCard(a) {
  const el = h("div", { class: "cardclip", "data-a": a.id }, h("b", {}, a.label), h("span", {}, a.hint));
  el.addEventListener("pointerdown", e => {
    if (e.button > 0) return; e.preventDefault();
    const k = getScale(), r = el.getBoundingClientRect(); let ghost = null, moved = false; const sx = e.clientX, sy = e.clientY;
    const mv = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { moved = true; ghost = el.cloneNode(true); ghost.classList.add("ghost"); ghost.style.width = el.offsetWidth + "px"; ghost.style.transformOrigin = "0 0"; document.body.append(ghost); }
      if (ghost) { ghost.style.left = ev.clientX - 30 + "px"; ghost.style.top = ev.clientY - 20 + "px"; ghost.style.transform = `rotate(-4deg) scale(${k})`; document.querySelectorAll(".bslot").forEach(b => b.classList.remove("over")); const t = document.elementFromPoint(ev.clientX, ev.clientY), b = t && t.closest && t.closest(".bslot"); if (b) b.classList.add("over"); }
    };
    const up = ev => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      document.querySelectorAll(".bslot").forEach(b => b.classList.remove("over"));
      if (ghost) { const t = document.elementFromPoint(ev.clientX, ev.clientY), b = t && t.closest && t.closest(".bslot"); ghost.remove(); if (b) assign(b.dataset.slot, a.id); }
      else { const d = S.draft, s = (d.sel && !d.slots[d.sel]) ? d.sel : (slotsOf().find(x => !d.slots[x]) || d.sel || slotsOf()[0]); assign(s, a.id); }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  return el;
}

/* ================= 2 SHOOT ================= */
function shoot() {
  const d = S.draft, slots = slotsOf(), tt = d.site === "tiktik", p = D.P[d.pid];
  if (!d.sel) d.sel = slots[0];
  const su = d.setup[d.sel] = d.setup[d.sel] || { action: d.slots[d.sel], angle: "medium", light: "ceiling" };
  const cam = h("div", { class: "cam " + (tt ? "tt" : "yv") });
  const rail = h("div", { class: "rail" }, h("h3", {}, "Shots"), slots.map(s => h("div", { class: "railslot" + (d.sel === s ? " sel" : "") + (d.clips[s] ? " rec" : ""), onClick: () => { d.sel = s; shoot2(); } },
    h("span", { class: "dot" }, d.clips[s] ? "✓" : "•"), h("div", {}, h("b", { class: "lil" }, slotLabel(s)), h("div", { class: "tiny" }, actionOf((d.setup[s] || {}).action || d.slots[s]).label)))));
  const clip = { action: su.action, angle: su.angle, light: su.light, hour: tod() };
  const sc = sceneEl(clip, p); sc.style.fontSize = tt ? "14px" : "22px"; cam.append(sc);
  const notes = flawNotes(clip, p); if (notes.length) cam.append(h("div", { class: "notes" }, notes.map(n => h("span", {}, n))));
  const recDot = h("div", { class: "rec", hidden: true }, h("i"), "REC"); cam.append(recDot);
  const A = actionOf(su.action), mult = gearMult(), mins = Math.round(A.minutes * mult), en = Math.ceil(A.energy * mult);
  const opt = (list, key, extra) => h("div", { class: "opts" }, list.map(o => {
    const r = extra ? extra(o) : null, dis = !!r;
    return h("button", { class: "chip" + (su[key] === o.id ? " sel" : "") + (dis ? " dis" : ""), type: "button", title: r || o.sub || "", onClick: () => { if (dis) return toast(r); su[key] = o.id; if (key === "action") { d.slots[d.sel] = o.id; if (d.clips[d.sel] && d.clips[d.sel].action !== o.id) delete d.clips[d.sel]; } shoot2(); } }, o.label);
  }));
  const lightWhy = l => (l.daylightOnly && !isDaylight()) ? "Too dark outside for window light." : (l.gear && !hasGear(l.gear)) ? `Needs the ${D.G[l.gear].name} (Tool Shop).` : null;
  const recBtn = btn(d.clips[d.sel] ? "Re-shoot" : "REC", "b-red big", async () => {
    if (!energyCheck()) return;
    recBtn.disabled = true; recDot.hidden = false; sfx("rec");
    await new Promise(r => setTimeout(r, 1100));
    energySpend(en); skipBy(mins, "skip");
    const id = uid("c"), rng = mulberry(hashStr(id + A.id)), kk = tt ? 1 : 1.4;
    d.clips[d.sel] = { id, slot: d.sel, action: su.action, angle: su.angle, light: su.light, hour: clip.hour, dur: +(A.dur[0] + rng() * (A.dur[1] - A.dur[0])).toFixed(1), d0: +((0.5 + rng() * 0.9) * kk).toFixed(1), d1: +((0.3 + rng() * 0.6) * kk).toFixed(1) };
    d.edit = null; toast(`Clip recorded. −${en} energy, +${mins} min.`);
    const nxt = slots.find(s => !d.clips[s]); if (nxt) d.sel = nxt;
    shoot2();
  });
  const side = h("div", { class: "side" },
    h("div", { class: "opt-h" }, `Shot: ${slotLabel(d.sel)}`),
    h("div", { class: "opt-h" }, "Action"), opt(D.shots.actions, "action"),
    h("div", { class: "opt-h" }, "Angle"), opt(D.shots.angles, "angle"),
    h("div", { class: "opt-h" }, "Light"), opt(D.shots.lights, "light", lightWhy),
    h("div", { class: "small", style: { opacity: ".9" } }, A.hint),
    h("div", { class: "row", style: { marginTop: ".3em" } }, recBtn, h("span", { class: "small" }, `${mins} min · ${flag("energy") ? en + " energy" : ""}`)));
  main.append(rail, h("div", { style: { flex: 1, display: "grid", placeItems: "center", padding: ".6em" } }, cam), side);
  foot.append(btn("◀ Plan", "b-grey sm", () => go("board")), h("div", { class: "small" }, `${Object.keys(d.clips).length} of ${slots.length} shots recorded.`),
    btn("Next: Edit", allShot() ? "b-gold big" : "b-grey big", () => { if (!allShot()) return toast("Record every shot first."); go("edit"); }));
}
const shoot2 = () => go("shoot");

/* ================= 3 EDIT ================= */
async function edit() {
  const d = S.draft, clips = slotsOf().map(s => d.clips[s]);
  foot.append(btn("◀ Shoot", "b-grey sm", () => go("shoot")), h("div", { class: "small" }, "Edit the clips, then export."), h("span"));
  const e = await editVideo({ site: d.site, pid: d.pid, clips, edit: d.edit }, { mount: main });
  if (!win || !win.back.isConnected) return;
  d.edit = e; go("post");
}

/* ================= 4 POST ================= */
function post() {
  const d = S.draft, p = D.P[d.pid], site = D.SITE[d.site], tt = d.site === "tiktik", own = tier2On();
  if (!d.title) d.title = tt ? "" : "";
  const input = h("input", { class: "field", type: "text", maxlength: 70, placeholder: tt ? "Write a caption" : "Write a search title buyers would type", value: d.title, onInput: e => { d.title = e.target.value; } });
  const sugg = tt ? [] : [p.short + " review", "is it worth it?", "unboxing", "honest", "cheap", "vs"];
  const tagList = [...p.tags, "#fyp", "#sale", "#viral"].filter((v, i, a) => a.indexOf(v) === i);
  const tagsEl = h("div", { class: "opts" }, tagList.map(t => h("button", { class: "chip dark" + (d.tags.includes(t) ? " sel" : ""), type: "button", onClick: () => { if (d.tags.includes(t)) d.tags = d.tags.filter(x => x !== t); else if (d.tags.length < 3) d.tags.push(t); else return toast("Three tags at most."); post2(); } }, t)));
  const stockN = shelfOnly(d.pid), noStock = d.mode === "own" && stockN <= 0;
  const clips = slotsOf().map(s => d.clips[s]);
  const totalLen = d.edit.order.reduce((a, id) => { const c = clips.find(x => x.id === id), t = (d.edit.trims[id] || [0, 0]); return a + Math.max(0.6, c.dur - t[0] - t[1]); }, 0);
  const left = h("div", { class: "col" }, h("div", { class: "cam " + (tt ? "tt" : "yv"), style: tt ? { width: "270px", height: "480px" } : { width: "420px", height: "236px" } }, (() => { const sc = sceneEl(clips.find(c => c.id === d.edit.order[0]), p, { filter: d.edit.filter }); sc.style.fontSize = tt ? "13px" : "13px"; return sc; })()),
    h("div", { class: "small" }, `${site.name} · ${Math.round(totalLen)} seconds · ${p.name}`));
  const right = h("div", { class: "col" }, h("h3", {}, tt ? "Caption" : "Search title"), input,
    sugg.length ? h("div", { class: "opts" }, sugg.map(t => h("button", { class: "chip", type: "button", onClick: () => { d.title = (d.title ? d.title + " " : "") + t; input.value = d.title; } }, "+ " + t))) : null,
    !tt ? h("div", { class: "small", style: { opacity: ".85" } }, "People find long videos by search. Use words buyers would type.") : null,
    h("h3", {}, "Tags (up to 3)"), tagsEl,
    h("h3", {}, "How do you sell it?"),
    h("div", { class: "opts" }, h("button", { class: "chip" + (d.mode === "affiliate" ? " sel" : ""), type: "button", onClick: () => { d.mode = "affiliate"; post2(); } }, `Affiliate link (earn ${Math.round(p.commission * 100)}%)`),
      own ? h("button", { class: "chip" + (d.mode === "own" ? " sel" : ""), type: "button", onClick: () => { d.mode = "own"; post2(); } }, `My stock (${stockN} on shelf)`) : null),
    noStock ? h("div", { class: "warnbox" }, "You have no stock on the shelf. Buyers who want it will be missed sales. You can still post.") : null);
  main.append(h("div", { class: "postform" }, left, right));
  foot.append(btn("◀ Edit", "b-grey sm", () => go("edit")), h("div", { class: "small" }, `Posting costs ${D.time.energy.post} energy.`),
    btn("POST", "b-gold big", () => {
      if (!energyCheck()) return;
      energySpend(D.time.energy.post);
      const title = d.title.trim() || (tt ? p.short + "!" : p.name);
      const payload = { video: { site: d.site, pid: d.pid, clips, edit: d.edit, title, tags: d.tags.slice(), mode: own ? d.mode : "affiliate" }, post: null };
      emit("post:submit", payload); S.draft = null; win.close(); sfx("coin");
      if (payload.post) { toast("Posted! Watch it grow."); emit("studio:posted", payload.post); }
    }));
}
const post2 = () => go("post");
