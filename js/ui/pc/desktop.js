/* DESK PC shell (D-107, D-76). A monitor on the modal layer #pc: wallpaper, desktop icons in a column, a taskbar (own "A" start button, window buttons, clock),
   and real-feeling windows (title bar with minimise, maximise and close, drag by the title, resize by the corner, several open at once).
   Window records survive closing the PC, so the desk keeps its windows. Apps register themselves with registerApp (js/ui/browser.js does it).
   Exports: registerApp, openPC, closePC, pcOpen, openWindow, listWindows, focusWindow, closeWindow.
   Events out: pc:opened, pc:closed. Events in: frame (clock). The game clock keeps running while the PC is open. */
import { S } from "../../core/state.js";
import { fmt, dayNo } from "../../core/clock.js";
import { on, emit } from "../../core/bus.js";
import { h, clear, modal, drag } from "../ui.js";
import { ic } from "../icons.js";

const ICON = { browser: "globe", affiliate: "handshake", hub: "chart", supplier: "truck", toolshop: "tool", property: "home", stock: "sheet" };
const icOf = a => ic(ICON[a.id] || a.icon || "box");

const apps = [], wins = [];
let mon = null, dom = {}, zTop = 10, nid = 1, offFrame = null, menuOpen = false;

export const registerApp = a => { if (!apps.some(x => x.id === a.id)) apps.push(a); };
export const pcOpen = () => !!(mon && mon.back.isConnected);
export const listWindows = kind => wins.filter(w => !kind || w.kind === kind);
const visibleApps = () => apps.filter(a => !a.show || a.show());

const WALL = `<svg viewBox="0 0 1480 780" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="pcsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset=".75" stop-color="#d4efff"/><stop offset="1" stop-color="#f1faff"/></linearGradient>
<radialGradient id="pcglow" cx=".78" cy=".2" r=".5"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient></defs>
<rect width="1480" height="780" fill="url(#pcsky)"/><rect width="1480" height="780" fill="url(#pcglow)"/>
<g fill="#fff" opacity=".7"><ellipse cx="380" cy="150" rx="120" ry="30"/><ellipse cx="450" cy="134" rx="70" ry="28"/><ellipse cx="1000" cy="240" rx="140" ry="32"/><ellipse cx="1080" cy="224" rx="80" ry="28"/></g>
<g transform="translate(1000 520)">
 <path d="M0 -150 L300 0 L0 150 L-300 0Z" fill="#a8dc86"/><path d="M-300 0 L0 150 L0 190 L-300 40Z" fill="#c69a6a"/><path d="M300 0 L0 150 L0 190 L300 40Z" fill="#a97f53"/>
 <path d="M-40 -100 L80 -40 L80 -150 L-40 -210Z" fill="#dde9fb"/><path d="M80 -40 L170 -85 L170 -195 L80 -150Z" fill="#bcd0ef"/>
 <path d="M-50 -205 L80 -140 L180 -190 L50 -255Z" fill="#ff8a7a"/><path d="M-50 -205 L80 -140 L80 -128 L-50 -193Z" fill="#e5675a"/>
 <path d="M10 -95 L40 -80 L40 -125 L10 -140Z" fill="#f2b26b"/><path d="M110 -70 L140 -85 L140 -120 L110 -105Z" fill="#9fd4ff"/>
 <circle cx="-170" cy="-40" r="44" fill="#5fbf5f"/><circle cx="-195" cy="-60" r="30" fill="#7ed37a"/><rect x="-176" y="-6" width="12" height="30" rx="4" fill="#8a5a2b"/>
 <circle cx="190" cy="40" r="34" fill="#5fbf5f"/><rect x="185" y="66" width="10" height="22" rx="4" fill="#8a5a2b"/>
</g>
</svg>`;

/* ---------- open and close ---------- */
export function openPC() {
  if (pcOpen()) return;
  const frame = document.getElementById("frame");
  mon = modal({ title: "Desk PC", cls: "pcmon", layer: document.getElementById("pc"), keepPhone: true, body: buildMonitor(), onClose: teardown });
  mon.back.classList.add("pcback"); frame.classList.add("pc-open");
  renderIcons(); renderTask(); wins.forEach(mount); clock();
  offFrame = on("frame", clock);
  emit("pc:opened");
}
export function closePC() { if (pcOpen()) mon.close(); }
function teardown() {
  wins.forEach(unmount); if (offFrame) offFrame(); offFrame = null; mon = null; dom = {}; menuOpen = false;
  document.getElementById("frame").classList.remove("pc-open"); emit("pc:closed");
}
function clock() { if (!dom.clk) return; const t = fmt(), d = "Day " + dayNo(); if (dom.clk.textContent !== t) dom.clk.textContent = t; if (dom.day.textContent !== d) dom.day.textContent = d; }

/* ---------- monitor ---------- */
function buildMonitor() {
  dom.wall = h("div", { class: "wall", html: WALL });
  dom.icons = h("div", { class: "icons" });
  dom.area = h("div", { class: "wins" });
  dom.tasks = h("div", { class: "tasks" });
  dom.clk = h("div", { class: "tm" }); dom.day = h("div", { class: "dy" });
  dom.menu = h("div", { class: "startmenu", hidden: true });
  dom.start = h("button", { class: "startbtn", type: "button", "aria-label": "Start", onClick: () => toggleMenu() }, h("span", { class: "alogo" }, "A"), h("span", { class: "sl" }, "Start"));
  const task = h("div", { class: "task" }, dom.start, dom.tasks, h("div", { class: "tray" }, ic("sound"), ic("wifi"), h("div", { class: "clockbox" }, dom.clk, dom.day)));
  dom.scr = h("div", { class: "scr" }, dom.wall, dom.icons, dom.area, dom.menu, task);
  dom.scr.addEventListener("pointerdown", e => { if (menuOpen && !e.target.closest(".startmenu") && !e.target.closest(".startbtn")) toggleMenu(false); });
  const chin = h("div", { class: "chin" }, h("span", { class: "badge-a" }, "A"), h("span", { class: "brand" }, "ALGO PC"), h("span", { class: "grow" }), h("span", { class: "led" }), h("button", { class: "power", type: "button", "aria-label": "Close the PC", title: "Close the PC (Esc)", onClick: closePC }, ic("power")));
  return h("div", { class: "monitor" }, h("div", { class: "bezel" }, dom.scr, chin), h("div", { class: "neck" }), h("div", { class: "foot" }));
}
function toggleMenu(force) {
  menuOpen = force === undefined ? !menuOpen : force; dom.menu.hidden = !menuOpen;
  if (!menuOpen) return;
  clear(dom.menu); dom.menu.append(h("div", { class: "mh" }, h("span", { class: "alogo" }, "A"), "Algo PC"));
  for (const a of visibleApps()) dom.menu.append(h("button", { class: "mi", type: "button", onClick: () => { toggleMenu(false); a.open(); } }, h("span", { class: "e", style: { background: `linear-gradient(150deg,${a.grad[0]},${a.grad[1]})` } }, icOf(a)), a.label));
  dom.menu.append(h("button", { class: "mi off", type: "button", onClick: closePC }, h("span", { class: "e" }, ic("power")), "Close the PC"));
}
export function renderIcons() {
  if (!dom.icons) return; clear(dom.icons);
  for (const a of visibleApps()) dom.icons.append(h("button", { class: "dico", type: "button", "data-app": a.id, onClick: () => { toggleMenu(false); a.open(); } },
    h("span", { class: "itile", style: { background: `linear-gradient(150deg,${a.grad[0]},${a.grad[1]})` } }, icOf(a)), h("span", { class: "lb" }, a.label)));
}

/* ---------- windows ---------- */
const areaW = () => (dom.area ? dom.area.clientWidth : 1480), areaH = () => (dom.area ? dom.area.clientHeight : 728);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const activeRec = () => wins.filter(w => !w.min).sort((a, b) => b.z - a.z)[0];

/* def: { key?, kind, title, emoji, color, w, h, x?, y?, data?, build(body, rec) -> {refresh?, destroy?} } */
export function openWindow(def) {
  let rec = def.key && wins.find(w => w.key === def.key);
  if (rec) { rec.min = false; focusWindow(rec); return rec; }
  const n = wins.length, w = Math.min(def.w || 1000, 1440), hh = Math.min(def.h || 640, 700);
  rec = { id: nid++, key: def.key || null, kind: def.kind || "app", title: def.title, emoji: def.emoji || "🗔", color: def.color || "#3a7bf0", build: def.build,
    data: def.data || {}, w, h: hh, x: def.x ?? 150 + (n % 5) * 30, y: def.y ?? 12 + (n % 5) * 28, max: false, min: false, z: ++zTop, el: null, inst: null };
  rec.x = clamp(rec.x, 8, Math.max(8, areaW() - w - 10)); rec.y = clamp(rec.y, 4, Math.max(4, areaH() - hh - 8));
  wins.push(rec);
  if (!pcOpen()) openPC(); else mount(rec);
  focusWindow(rec); renderTask();
  return rec;
}
function place(rec) {
  const e = rec.el; if (!e) return;
  if (rec.max) { e.classList.add("max"); e.style.cssText = `z-index:${rec.z}`; } else { e.classList.remove("max"); e.style.cssText = `left:${rec.x}px;top:${rec.y}px;width:${rec.w}px;height:${rec.h}px;z-index:${rec.z}`; }
  e.classList.toggle("min", rec.min);
}
function mount(rec) {
  if (!dom.area || rec.el) return;
  const body = h("div", { class: "wbody" });
  rec.titleEl = h("span", { class: "tt grow", title: "Drag to move. Double-click to maximise." }, h("span", { class: "we", style: { background: rec.color } }, ic(ICON[rec.kind === "browser" ? "browser" : rec.key] || "box")), h("span", { class: "wt" }, rec.title));
  const mk = (cls, label, icon, fn) => h("button", { class: "wb " + cls, type: "button", "aria-label": label, title: label, onClick: e => { e.stopPropagation(); fn(); } }, ic(icon));
  const bar = h("div", { class: "wbar" }, rec.titleEl,
    mk("mn", "Minimise", "min", () => { rec.min = true; place(rec); renderTask(); }),
    mk("mx", "Maximise", "max", () => { rec.max = !rec.max; place(rec); }),
    mk("cl", "Close", "close", () => closeWindow(rec)));
  const rz = h("div", { class: "rz" });
  rec.el = h("div", { class: "win" }, bar, body, rz);
  rec.el.addEventListener("pointerdown", () => { if (activeRec() !== rec) focusWindow(rec); }, true);
  rec.titleEl.addEventListener("dblclick", () => { rec.max = !rec.max; place(rec); });
  let x0 = 0, y0 = 0, w0 = 0, h0 = 0;
  drag(rec.titleEl, { start: () => { if (rec.max) return false; x0 = rec.x; y0 = rec.y; }, move: (dx, dy) => { rec.x = clamp(x0 + dx, 140 - rec.w, areaW() - 140); rec.y = clamp(y0 + dy, 0, areaH() - 44); place(rec); } });
  drag(rz, { start: () => { if (rec.max) return false; w0 = rec.w; h0 = rec.h; }, move: (dx, dy) => { rec.w = clamp(w0 + dx, 520, areaW() - rec.x); rec.h = clamp(h0 + dy, 340, areaH() - rec.y); place(rec); } });
  dom.area.append(rec.el); place(rec);
  rec.inst = rec.build(body, rec) || {};
}
function unmount(rec) { if (rec.inst && rec.inst.destroy) { try { rec.inst.destroy(); } catch (e) { console.error(e); } } rec.inst = null; rec.el = null; rec.titleEl = null; }
export function setTitle(rec, t) { rec.title = t; const n = rec.titleEl && rec.titleEl.querySelector(".wt"); if (n) n.textContent = t; renderTask(); }
export function focusWindow(rec) {
  rec.min = false; rec.z = ++zTop; place(rec);
  wins.forEach(w => w.el && w.el.classList.toggle("active", w === rec)); renderTask();
}
export function closeWindow(rec) {
  const e = rec.el; unmount(rec); if (e) e.remove();
  const i = wins.indexOf(rec); if (i >= 0) wins.splice(i, 1);
  const a = activeRec(); if (a) focusWindow(a); else renderTask();
}
function renderTask() {
  if (!dom.tasks) return; clear(dom.tasks); const act = activeRec();
  for (const w of wins) dom.tasks.append(h("button", { class: "tb" + (w === act ? " on" : "") + (w.min ? " min" : ""), type: "button", title: w.title, onClick: () => { if (w.min || w !== act) focusWindow(w); else { w.min = true; place(w); renderTask(); } } },
    h("span", { class: "e", style: { background: w.color } }, ic(ICON[w.kind === "browser" ? "browser" : w.key] || "box")), h("span", { class: "t" }, w.title)));
}
