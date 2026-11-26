/* MOVE FURNITURE. A button on the room toggles edit mode. Click a station to pick it up; it follows the pointer, snapped to
   half tiles. R or the Rotate button turns it (mirrors the art, swaps width and depth). Click to put it down where the
   footprint is green (inside the house, not on other furniture or the player). Esc or Done ends. Positions are saved in
   S.layout {id: {gx, gy, flip}}. Stations with "fixed": true (the door mat) cannot move.
   Events out: layout:changed. Uses room.js hooks (editing, ghost, pick). */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { h } from "./ui.js";
import { hooks, tileOf, stations, svgEl, pointerTile } from "./room.js";
import { toast, sfx } from "../core/actions.js";

let editing = false, bar = null, btnEl = null;
const snap = v => Math.round(v * 2) / 2;
function valid(st, t) {
  const v = D.room.view, p = S.player;
  if (t[0] < 0.1 || t[1] < 0.1 || t[0] + t[2] > v.Nx - 0.1 || t[1] + t[3] > v.Ny - 0.1) return false;
  for (const o of stations()) {
    if (o === st || o.solid === false) continue; const u = tileOf(o);
    if (t[0] < u[0] + u[2] - 0.05 && u[0] < t[0] + t[2] - 0.05 && t[1] < u[1] + u[3] - 0.05 && u[1] < t[1] + t[3] - 0.05) return false;
  }
  if (p && p.x > t[0] - 0.2 && p.x < t[0] + t[2] + 0.2 && p.y > t[1] - 0.2 && p.y < t[1] + t[3] + 0.2) return false;
  return true;
}
function setGhostAt(x, y) {
  const gh = hooks.ghost; if (!gh) return;
  const base = gh.st.tile, fw = gh.flip ? base[3] : base[2], fd = gh.flip ? base[2] : base[3];
  gh.tile = [snap(x - fw / 2), snap(y - fd / 2), fw, fd]; gh.ok = valid(gh.st, gh.tile);
}
function pick(st) {
  if (hooks.ghost) return drop();
  if (st.fixed) { toast("The door stays where it is."); return; }
  const L = S.layout && S.layout[st.id];
  hooks.ghost = { st, flip: !!(L && L.flip), tile: tileOf(st).slice(), ok: true };
  sfx("tap");
}
function drop() {
  const gh = hooks.ghost; if (!gh) return;
  if (!gh.ok) { toast("It does not fit there."); sfx("error"); return; }
  S.layout = S.layout || {}; S.layout[gh.st.id] = { gx: gh.tile[0], gy: gh.tile[1], flip: gh.flip };
  hooks.ghost = null; emit("layout:changed"); sfx("coin");
}
function rotate() { const gh = hooks.ghost; if (!gh) return; gh.flip = !gh.flip; const c = [gh.tile[0] + gh.tile[2] / 2, gh.tile[1] + gh.tile[3] / 2]; setGhostAt(c[0], c[1]); }
function cancel() { hooks.ghost = null; }
function setMode(onOff) {
  editing = onOff; cancel();
  btnEl.classList.toggle("sel", editing); bar.hidden = !editing;
  document.getElementById("room").classList.toggle("editing", editing);
}
export function initLayout() {
  hooks.editing = () => editing; hooks.pick = pick;
  const root = document.getElementById("room");
  btnEl = h("button", { class: "btn b-teal sm movebtn", type: "button", onClick: () => setMode(!editing) }, "🛠 Move furniture");
  bar = h("div", { class: "movebar", hidden: true },
    h("span", {}, "Click furniture to pick it up. Click again to put it down."),
    h("button", { class: "btn b-blue sm", type: "button", onClick: rotate }, "Rotate (R)"),
    h("button", { class: "btn b-gold sm", type: "button", onClick: () => setMode(false) }, "Done"));
  root.append(btnEl, bar);
  const svg = svgEl();
  svg.addEventListener("pointermove", e => { if (editing && hooks.ghost) { const [x, y] = pointerTile(e); setGhostAt(x, y); } });
  svg.addEventListener("click", e => { if (editing && hooks.ghost) { const [x, y] = pointerTile(e); setGhostAt(x, y); drop(); } });
  window.addEventListener("keydown", e => {
    if (!editing) return; const k = e.key.toLowerCase();
    if (k === "r") rotate(); if (k === "escape") { if (hooks.ghost) cancel(); else setMode(false); }
  });
  on("modal:open", () => { if (editing) setMode(false); });
  on("newgame", () => { S.layout = {}; if (editing) setMode(false); });
}
