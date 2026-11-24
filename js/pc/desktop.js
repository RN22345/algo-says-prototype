/* The PC: a monitor (or full-frame) screen with a wallpaper, draggable desktop icons, a Start launcher, a taskbar,
   and windows you can move, resize, minimise and maximise. Apps live in js/pc/apps/. The sites live in js/pc/sites/ and open in the Browser app. */
import { D, S } from "../state.js";
import { $, registerWindow, registerActions, closeUI, openUI } from "../ui/windows.js";
import { peso } from "../ui/format.js";
import { clockText, setHTML } from "./util.js";
import { loadPrefs, prefs, setPref } from "./prefs.js";
import { getScale } from "../fit.js";
import { unlock, stopLoop } from "./audio.js";
import browser, { SITES, showSite } from "./apps/browser.js";
import stats from "./apps/stats.js";
import books from "./apps/books.js";
import notes from "./apps/notes.js";
import helpers from "./apps/helpers.js";
import home from "./apps/home.js";
import paint from "./apps/paint.js";
import catchGame from "./apps/catch.js";
import music from "./apps/music.js";
import bin from "./apps/bin.js";
import settings from "./apps/settings.js";

export const APPS = [browser, stats, books, notes, helpers, home, paint, catchGame, music, bin, settings];
const byId = Object.fromEntries(APPS.map(a => [a.id, a]));
/* Old app ids still open the right site page. Site ids open the browser on that site. */
const ALIAS = { ...Object.fromEntries(SITES.map(s => [s.id, [s.id, undefined]])), studio: ["tiktik", "create"], feeds: ["tiktik", "feed"] };

const CATS = [["all", "All"], ["social", "Social media"], ["business", "Business"], ["games", "Games"], ["misc", "Misc"]];
const ORDER = ["tiktik", "youview", "hub", "stats", "supplier", "toolshop", "helpers", "books", "home", "catch", "paint", "music", "notes", "bin", "settings"];
const CW = 7, CH = 6.8; // icon cell size in em

const wins = new Map();
let z = 10, built = false, layer, tasks, grid, startEl, startOpen = false, startCat = "all", dragIc = false, pressedAt = 0, icClickBlock = 0;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const place = w => { Object.assign(w.el.style, { left: w.x + "%", top: w.y + "%", width: w.w + "%", height: w.h + "%" }); };
const visible = () => [...wins.values()].filter(w => !w.min);
const topWin = () => visible().sort((a, b) => b.z - a.z)[0];
const pressed = () => pressedAt && performance.now() - pressedAt < 2500;

/* Everything that can be launched: the sites and the apps that have a category. */
function items() {
  const all = [
    ...SITES.map(s => ({ id: s.id, title: s.name, icon: s.icon, cat: s.cat, style: `--c1:${s.c1};--c2:${s.c2}` })),
    ...APPS.filter(a => a.cat).map(a => ({ id: a.id, title: a.title, icon: a.icon, cat: a.cat, cls: `c-${a.color}`, rank: a.rank }))
  ];
  return all.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

const tile = it => `<span class="tile ${it.cls || ""}" style="${it.style || ""}">${it.icon}${it.rank ? `<i class="lk">${S.rank < it.rank ? "🔒" : "⏳"}</i>` : ""}</span>`;

function build() {
  if (built) return; built = true;
  $("#w-desktop").innerHTML = `<div class="dk-mon"><div class="dk-screen" id="dkScreen">
    <div class="dk-wall"></div><div class="dk-grid" id="dkIcons"></div><div class="dk-layer" id="dkLayer"></div>
    <div class="smenu" id="dkStart" hidden></div>
    <div class="dk-bar"><button class="cap dk-startbtn" id="dkStartBtn" type="button" data-act="pc-start" aria-haspopup="true" aria-expanded="false">⊞ Start</button><div class="dk-tasks" id="dkTasks"></div>
      <span class="dk-tray"><button class="chip" id="dkMode" type="button" data-act="pc-mode"></button><span class="dk-cash" id="dkCash"></span><span class="dk-clock" id="dkClock" title="In-game time"></span><button class="dk-pw" type="button" data-act="pc-shutdown" aria-label="Shut down" title="Shut down">⏻</button></span></div>
    </div><i class="dk-led" aria-hidden="true"></i></div>`;
  layer = $("#dkLayer"); tasks = $("#dkTasks"); grid = $("#dkIcons"); startEl = $("#dkStart");
  const d = $("#w-desktop");
  d.addEventListener("pointerdown", e => {
    unlock(); pressedAt = performance.now();
    if (startOpen && !e.target.closest("#dkStart, #dkStartBtn")) closeStart();
  }, { capture: true });
  ["pointerup", "pointercancel"].forEach(n => window.addEventListener(n, () => { pressedAt = 0; }, true));
  grid.addEventListener("pointerdown", startIconDrag);
  syncMode();
}

/* ---------- monitor mode ---------- */
function syncMode() {
  const b = $("#dkMode"); if (!b) return;
  b.textContent = prefs.pcFull ? "▭ Monitor" : "⛶ Full screen";
  b.title = prefs.pcFull ? "Show the PC as a monitor again" : "Fill the whole frame";
}

/* ---------- desktop icons ---------- */
function gridSize() {
  const fs = parseFloat(getComputedStyle(grid).fontSize) || 14;
  return { fs, cols: Math.max(1, Math.floor(grid.clientWidth / (CW * fs))), rows: Math.max(1, Math.floor(grid.clientHeight / (CH * fs))) };
}

/* Tidy places: one column per category, in launcher order. */
function tidyPos() {
  const pos = {}, count = {};
  items().forEach(it => { const c = CATS.findIndex(x => x[0] === it.cat) - 1; pos[it.id] = [c, count[it.cat] = (count[it.cat] || 0)]; count[it.cat]++; });
  return pos;
}

/* Saved places, fixed so that nothing is off the grid and no two icons share a cell. */
function layout() {
  const { cols, rows } = gridSize(), tidy = tidyPos(), taken = new Set(), out = {};
  items().forEach(it => {
    const want = (prefs.iconPos && prefs.iconPos[it.id]) || tidy[it.id];
    let c = clamp(want[0] | 0, 0, cols - 1), r = clamp(want[1] | 0, 0, rows - 1);
    if (taken.has(c + "," + r)) {
      let best = null;
      for (let cc = 0; cc < cols; cc++) for (let rr = 0; rr < rows; rr++) {
        if (taken.has(cc + "," + rr)) continue;
        const d = Math.hypot(cc - c, rr - r); if (!best || d < best[0]) best = [d, cc, rr];
      }
      if (best) { c = best[1]; r = best[2]; }
    }
    taken.add(c + "," + r); out[it.id] = [c, r];
  });
  return out;
}

function iconsHTML() {
  const pos = layout();
  return items().map(it => `<button class="dk-ico" type="button" data-act="pc-open" data-v="${it.id}" data-ic="${it.id}" style="left:${pos[it.id][0] * CW}em;top:${pos[it.id][1] * CH}em">${tile(it)}<span class="lb">${it.title}</span></button>`).join("");
}

/* Drag an icon. It snaps to the grid when you let go. If another icon is there, the two swap. */
function startIconDrag(e) {
  const el = e.target.closest(".dk-ico"); if (!el || e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY, l0 = el.offsetLeft, t0 = el.offsetTop, id = el.dataset.ic;
  let moved = false;
  try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  const mv = ev => {
    const k = getScale(), dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k; // the frame is scaled: screen pixels to layout pixels
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true; dragIc = true; el.classList.add("drag");
    el.style.left = l0 + dx + "px"; el.style.top = t0 + dy + "px";
  };
  const up = () => {
    el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
    el.classList.remove("drag");
    if (!moved) return;
    icClickBlock = performance.now();
    const { fs, cols, rows } = gridSize(), pos = layout(), old = pos[id];
    const c = clamp(Math.round(el.offsetLeft / (CW * fs)), 0, cols - 1), r = clamp(Math.round(el.offsetTop / (CH * fs)), 0, rows - 1);
    const other = Object.keys(pos).find(k => k !== id && pos[k][0] === c && pos[k][1] === r);
    pos[id] = [c, r]; if (other) pos[other] = old;
    dragIc = false; setPref("iconPos", pos); setHTML(grid, iconsHTML());
  };
  el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
}

/* ---------- Start launcher ---------- */
function renderStart() {
  const list = items().filter(it => startCat === "all" || it.cat === startCat);
  startEl.innerHTML = `<div class="sm-cats" role="tablist" aria-label="Categories">${CATS.map(([k, n]) => `<button type="button" role="tab" class="sm-cat ${k === startCat ? "on" : ""}" aria-selected="${k === startCat}" data-act="pc-cat" data-v="${k}">${n}</button>`).join("")}</div>
    <div class="sm-apps">${list.map(it => `<button type="button" class="sm-app" data-act="pc-open" data-v="${it.id}">${tile(it)}<span>${it.title}</span></button>`).join("")}</div>
    <div class="sm-foot"><button type="button" class="cap sm" data-act="pc-tidy">Tidy icons</button><button type="button" class="cap sm r" data-act="pc-shutdown">⏻ Shut down</button></div>`;
}
function openStart() { startOpen = true; renderStart(); startEl.hidden = false; $("#dkStartBtn").setAttribute("aria-expanded", "true"); }
function closeStart() { if (!built) return; startOpen = false; startEl.hidden = true; $("#dkStartBtn").setAttribute("aria-expanded", "false"); }

/* ---------- windows ---------- */
function api(w) {
  return {
    setTitle(t, small = "") { w.el.querySelector(".dw-t").textContent = t; w.el.querySelector(".dw-s").textContent = small; const tk = w.task.querySelector("b"); if (tk) tk.textContent = t; },
    close: () => closeApp(w.id),
    isTop: () => topWin() === w,
    isVisible: () => S.ui === "desktop" && !w.min
  };
}

export function focusApp(id) {
  const w = wins.get(id); if (!w) return;
  w.min = false; w.el.classList.remove("min"); w.z = ++z; w.el.style.zIndex = w.z;
  syncTop();
}

function syncTop() {
  const t = topWin();
  wins.forEach(w => { w.el.classList.toggle("top", w === t); w.task.classList.toggle("on", w === t); w.task.classList.toggle("min", w.min); w.task.setAttribute("aria-pressed", String(w === t)); });
}

function minimise(w) { w.min = true; w.el.classList.add("min"); syncTop(); }
function toggleMax(w) { w.max = !w.max; w.el.classList.toggle("max", w.max); w.el.querySelector("[data-act=pc-max]").setAttribute("aria-label", w.max ? "Restore" : "Maximise"); focusApp(w.id); }

export function openApp(id, page) {
  const al = ALIAS[id];
  if (al) { build(); showSite(al[0], page || al[1]); openApp("browser"); return; }
  const app = byId[id]; if (!app) return;
  build(); closeStart();
  let w = wins.get(id);
  if (!w) {
    const n = wins.size, ww = app.w || 60, hh = app.h || 70;
    const el = document.createElement("section");
    el.className = `dw c-${app.color}`; el.dataset.id = id; el.setAttribute("aria-label", app.title);
    el.innerHTML = `<div class="wbar"><span class="dw-ic">${app.icon}</span><span class="dw-pill"><b class="dw-t">${app.title}</b></span><small class="dw-s"></small><span class="sp"></span>
      <button class="wb" type="button" data-act="pc-min" aria-label="Minimise">–</button><button class="wb" type="button" data-act="pc-max" aria-label="Maximise">□</button><button class="x" type="button" data-act="wclose" aria-label="Close ${app.title}">✕</button></div>
      <div class="dw-body"></div><i class="dw-rs" aria-hidden="true"></i>`;
    const task = document.createElement("button");
    task.type = "button"; task.className = "dk-task"; task.dataset.act = "pc-task"; task.dataset.v = id; task.innerHTML = `<span>${app.icon}</span><b>${app.title}</b>`;
    w = { id, app, el, task, body: el.querySelector(".dw-body"), w: ww, h: hh, minW: Math.min(ww, 24), minH: Math.min(hh, 28), x: clamp(4 + (n % 6) * 3 + (100 - ww) / 6, 0, 100 - ww), y: clamp(3 + (n % 6) * 3.5, 0, 100 - hh), z: 0, min: false, max: false };
    place(w); layer.appendChild(el); tasks.appendChild(task); wins.set(id, w);
    el.addEventListener("pointerdown", () => { if (topWin() !== w) focusApp(id); });
    const bar = el.querySelector(".wbar");
    bar.addEventListener("pointerdown", e => startDrag(e, w));
    bar.addEventListener("dblclick", e => { if (!e.target.closest("button")) toggleMax(w); });
    el.querySelector(".dw-rs").addEventListener("pointerdown", e => startResize(e, w));
    w.api = api(w);
    app.mount(w.body, w.api);
  }
  focusApp(id);
}

export function closeApp(id) {
  const w = wins.get(id); if (!w) return;
  if (w.app.unmount) w.app.unmount();
  w.el.remove(); w.task.remove(); wins.delete(id); syncTop();
}

function drag(e, w, onMove) {
  const h = e.currentTarget, lr = layer.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  h.classList.add("drag");
  const mv = ev => { onMove((ev.clientX - sx) / lr.width * 100, (ev.clientY - sy) / lr.height * 100); place(w); };
  const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); h.classList.remove("drag"); };
  h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
}

function startDrag(e, w) {
  if (e.button !== 0 || w.max || e.target.closest("button")) return;
  const ox = w.x, oy = w.y;
  drag(e, w, (dx, dy) => { w.x = clamp(ox + dx, 12 - w.w, 88); w.y = clamp(oy + dy, 0, 92); });
}

/* Resize from the bottom-right corner. */
function startResize(e, w) {
  if (e.button !== 0 || w.max) return;
  e.preventDefault(); e.stopPropagation(); focusApp(w.id);
  const ow = w.w, oh = w.h;
  drag(e, w, (dx, dy) => { w.w = clamp(ow + dx, w.minW, Math.max(w.minW, 100 - w.x)); w.h = clamp(oh + dy, w.minH, Math.max(w.minH, 100 - w.y)); });
}

function closeAll() { [...wins.keys()].forEach(closeApp); }

/* Esc: close the Start menu, then the top window. Returns false when nothing is left, so the desktop closes. */
function escDesktop() {
  if (startOpen) { closeStart(); return true; }
  const t = topWin() || [...wins.values()][0];
  if (!t) return false;
  closeApp(t.id); return true;
}

export function refreshDesktop() {
  if (S.ui !== "desktop" || !built) return;
  $("#dkClock").textContent = clockText(S.clock);
  setHTML($("#dkCash"), `<img src="img/icon_hud_cash.png" alt="">${peso(S.cash)}`);
  if (pressed()) return; // a press in progress: do not rebuild the DOM, so the click lands
  if (!dragIc) setHTML(grid, iconsHTML());
  wins.forEach(w => { if (!w.min && w.app.refresh) w.app.refresh(); });
}

export async function initDesktop() {
  const r = await fetch("data/pc.json", { cache: "no-cache" }); if (!r.ok) throw new Error("Could not load pc.json");
  D.PC = await r.json();
  loadPrefs();
  registerWindow("desktop", {
    open(arg) {
      build(); $("#frame").classList.add("pc-open"); syncMode(); refreshDesktop();
      if (arg) { if (typeof arg === "string") openApp(arg); else openApp(arg.id, arg.page); }
    },
    close() { closeStart(); $("#frame").classList.remove("pc-open"); stopLoop(); },
    esc: escDesktop
  });
  registerActions({
    "pc-open": (t, v) => { if (performance.now() - icClickBlock < 200) return; openApp(v); },
    "pc-task": (t, v) => { const w = wins.get(v); if (!w) return; if (topWin() === w) minimise(w); else focusApp(v); },
    "pc-min": t => { const w = wins.get(t.closest(".dw").dataset.id); if (w) minimise(w); },
    "pc-max": t => { const w = wins.get(t.closest(".dw").dataset.id); if (w) toggleMax(w); },
    wclose: t => { const w = t.closest(".dw"); if (w) closeApp(w.dataset.id); },
    "pc-start": () => { if (startOpen) closeStart(); else openStart(); },
    "pc-cat": (t, v) => { startCat = v; renderStart(); },
    "pc-tidy": () => { setPref("iconPos", {}); setHTML(grid, iconsHTML()); closeStart(); },
    "pc-mode": () => { setPref("pcFull", !prefs.pcFull); syncMode(); },
    "pc-shutdown": () => { closeStart(); closeAll(); closeUI(true); }
  });
}

/* For tests and the console. */
export const pcApi = {
  open: id => { if (S.ui !== "desktop") openUI("desktop", id); else openApp(id); },
  openSite: (site, page) => { if (S.ui !== "desktop") openUI("desktop", { id: site, page }); else openApp(site, page); },
  openApp, closeApp, focusApp, wins, byId, APPS, topWin, refresh: refreshDesktop
};
