/* The PC desktop: wallpaper, icon grid, draggable windows, taskbar, clock. Apps live in js/pc/apps/. */
import { D, S } from "../state.js";
import { $, registerWindow, registerActions, closeUI, openUI } from "../ui/windows.js";
import { peso } from "../ui/format.js";
import { clockText, setHTML } from "./util.js";
import { loadPrefs } from "./prefs.js";
import { unlock, stopLoop } from "./audio.js";
import studio from "./apps/studio.js";
import stats from "./apps/stats.js";
import supplier from "./apps/supplier.js";
import books from "./apps/books.js";
import notes from "./apps/notes.js";
import feeds from "./apps/feeds.js";
import youview from "./apps/youview.js";
import facebazaar from "./apps/facebazaar.js";
import toolshop from "./apps/toolshop.js";
import helpers from "./apps/helpers.js";
import home from "./apps/home.js";
import paint from "./apps/paint.js";
import catchGame from "./apps/catch.js";
import music from "./apps/music.js";
import bin from "./apps/bin.js";
import settings from "./apps/settings.js";

export const APPS = [studio, stats, supplier, books, notes, feeds, youview, facebazaar, toolshop, helpers, home, paint, catchGame, music, bin, settings];
const byId = Object.fromEntries(APPS.map(a => [a.id, a]));
const wins = new Map();
let z = 10, built = false, layer, tasks, icons;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const place = w => { Object.assign(w.el.style, { left: w.x + "%", top: w.y + "%", width: w.w + "%", height: w.h + "%" }); };
const visible = () => [...wins.values()].filter(w => !w.min);
const topWin = () => visible().sort((a, b) => b.z - a.z)[0];

function build() {
  if (built) return; built = true;
  $("#w-desktop").innerHTML = `<div class="dk-wall"></div><div class="dk-icons" id="dkIcons"></div><div class="dk-layer" id="dkLayer"></div>
    <div class="dk-bar"><button class="cap r sm" type="button" data-act="pc-shutdown">⏻ Shut down</button><div class="dk-tasks" id="dkTasks"></div>
    <span class="dk-tray"><span class="dk-cash" id="dkCash"></span><span class="dk-clock" id="dkClock" title="In-game time"></span></span></div>`;
  layer = $("#dkLayer"); tasks = $("#dkTasks"); icons = $("#dkIcons");
  $("#w-desktop").addEventListener("pointerdown", unlock, { capture: true });
}

function iconsHTML() {
  return APPS.map(a => `<button class="dk-ic" type="button" data-act="pc-open" data-v="${a.id}"><span class="tile c-${a.color}">${a.icon}${a.rank ? `<i class="lk">${S.rank < a.rank ? "🔒" : "⏳"}</i>` : ""}</span><span class="lb">${a.title}</span></button>`).join("");
}

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

export function openApp(id) {
  const app = byId[id]; if (!app) return;
  build();
  let w = wins.get(id);
  if (!w) {
    const n = wins.size, ww = app.w || 60, hh = app.h || 70;
    const el = document.createElement("section");
    el.className = `dw c-${app.color}`; el.dataset.id = id; el.setAttribute("aria-label", app.title);
    el.innerHTML = `<div class="wbar"><span class="dw-ic">${app.icon}</span><span class="dw-t">${app.title}</span><small class="dw-s"></small><span class="sp"></span><button class="x" type="button" data-act="wclose" aria-label="Close ${app.title}">✕</button></div><div class="dw-body"></div>`;
    const task = document.createElement("button");
    task.type = "button"; task.className = "dk-task"; task.dataset.act = "pc-task"; task.dataset.v = id; task.innerHTML = `<span>${app.icon}</span><b>${app.title}</b>`;
    w = { id, app, el, task, body: el.querySelector(".dw-body"), w: ww, h: hh, x: clamp(4 + (n % 6) * 3 + (100 - ww) / 6, 0, 100 - ww), y: clamp(3 + (n % 6) * 3.5, 0, 100 - hh), z: 0, min: false };
    place(w); layer.appendChild(el); tasks.appendChild(task); wins.set(id, w);
    el.addEventListener("pointerdown", () => { if (topWin() !== w) focusApp(id); });
    el.querySelector(".wbar").addEventListener("pointerdown", e => startDrag(e, w));
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

function startDrag(e, w) {
  if (e.button !== 0 || e.target.closest("button")) return;
  const bar = e.currentTarget, lr = layer.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
  try { bar.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  bar.classList.add("drag");
  const mv = ev => { w.x = clamp(ox + (ev.clientX - sx) / lr.width * 100, 12 - w.w, 88); w.y = clamp(oy + (ev.clientY - sy) / lr.height * 100, 0, 92); place(w); };
  const up = () => { bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up); bar.classList.remove("drag"); };
  bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
}

function closeAll() { [...wins.keys()].forEach(closeApp); }

/* Esc: close the top window first. Returns false when no window is left, so the desktop closes. */
function escDesktop() {
  const t = topWin() || [...wins.values()][0];
  if (!t) return false;
  closeApp(t.id); return true;
}

export function refreshDesktop() {
  if (S.ui !== "desktop" || !built) return;
  $("#dkClock").textContent = clockText(S.clock);
  $("#dkCash").innerHTML = `<img src="img/icon_hud_cash.png" alt="">${peso(S.cash)}`;
  setHTML(icons, iconsHTML());
  wins.forEach(w => { if (!w.min && w.app.refresh) w.app.refresh(); });
}

export async function initDesktop() {
  const r = await fetch("data/pc.json"); if (!r.ok) throw new Error("Could not load pc.json");
  D.PC = await r.json();
  loadPrefs();
  registerWindow("desktop", {
    open(arg) { build(); $("#frame").classList.add("pc-open"); refreshDesktop(); if (arg) openApp(arg); },
    close() { $("#frame").classList.remove("pc-open"); stopLoop(); },
    esc: escDesktop
  });
  registerActions({
    "pc-open": (t, v) => openApp(v),
    "pc-task": (t, v) => { const w = wins.get(v); if (!w) return; if (topWin() === w) { w.min = true; w.el.classList.add("min"); syncTop(); } else focusApp(v); },
    wclose: t => { const w = t.closest(".dw"); if (w) closeApp(w.dataset.id); },
    "pc-shutdown": () => { closeAll(); closeUI(true); }
  });
}

/* For tests and the console. */
export const pcApi = { open: id => { if (S.ui !== "desktop") openUI("desktop", id); else openApp(id); }, openApp, closeApp, focusApp, wins, byId, APPS, topWin, refresh: refreshDesktop };
