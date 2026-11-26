/* MOVE FURNITURE. A button on the room toggles edit mode. Click a piece to pick it up; it follows the pointer, snapped to half
   tiles. R or the Rotate button turns it (mirrors the art, swaps width and depth). Click to put it down where the footprint is
   green (inside a room, not on other furniture, the player or a doorway). Esc or Done ends. Positions are saved in S.layout
   {id: {gx, gy, flip}}. Stations with "fixed": true (the door mat, for-sale signs) cannot move.
   Tray: furniture bought in the Tool Shop waits in S.furniture (a list of piece ids). The tray lists it; pick a piece to place
   it. It becomes {uid, id} in S.placed with its position in S.layout[uid]. Decor can go back in the tray; shelf units can be
   moved but not put back (their shelves stay in S.shelves).
   Events in: layout:place {id}, furniture:changed. Events out: layout:changed, furniture:placed {uid, id}, furniture:changed.
   Uses room.js hooks (editing, ghost, pick). */
import { D } from "../core/data.js";
import { S, uid } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { h, clear } from "./ui.js";
import { hooks, tileOf, stations, svgEl, pointerTile } from "./room.js";
import * as W from "./world.js";
import { toast, sfx } from "../core/actions.js";

let editing = false, bar = null, btnEl = null, tray = null, putBtn = null;
const snap = v => Math.round(v * 2) / 2;
function valid(st, t) {
  const p = S.player;
  if (!W.fitsRoom(t) || !W.clearOfDoors(t)) return false;
  for (const o of stations()) {
    if (o === st || o.solid === false) continue; const u = tileOf(o);
    if (t[0] < u[0] + u[2] - 0.05 && u[0] < t[0] + t[2] - 0.05 && t[1] < u[1] + u[3] - 0.05 && u[1] < t[1] + t[3] - 0.05) return false;
  }
  if (p && p.x > t[0] - 0.2 && p.x < t[0] + t[2] + 0.2 && p.y > t[1] - 0.2 && p.y < t[1] + t[3] + 0.2) return false;
  return true;
}
function setGhostAt(x, y) {
  const gh = hooks.ghost; if (!gh) return;
  const base = W.baseTile(gh.st), fw = gh.flip ? base[3] : base[2], fd = gh.flip ? base[2] : base[3];
  let tx = snap(x - fw / 2), ty = snap(y - fd / 2); const r = W.roomAt(x, y);
  if (r) { const [rx, ry, rw, rd] = r.rect; tx = Math.max(rx + 0.1, Math.min(rx + rw - 0.1 - fw, tx)); ty = Math.max(ry + 0.1, Math.min(ry + rd - 0.1 - fd, ty)); }   // keep it inside the room
  gh.tile = [tx, ty, fw, fd]; gh.ok = valid(gh.st, gh.tile);
}
function syncBar() { if (putBtn) putBtn.hidden = !(hooks.ghost && hooks.ghost.st.piece && !hooks.ghost.fromTray); }
function pick(st) {
  if (hooks.ghost) return drop();
  if (st.fixed) { toast(st.sign ? "The sign stays where it is." : "The door stays where it is."); return; }
  const L = S.layout && S.layout[st.id];
  hooks.ghost = { st, flip: !!(L && L.flip), tile: tileOf(st).slice(), ok: true }; syncBar(); sfx("tap");
}
function startPlace(id) {
  const st = W.pieceStation(id); if (!st || !S.furniture.includes(id)) return;
  const p = S.player || { x: 4, y: 4 };
  hooks.ghost = { st, flip: false, tile: [0, 0, 1, 1], ok: false, fromTray: id }; setGhostAt(p.x + 1.2, p.y + 1.2); syncBar(); sfx("tap");
}
function drop() {
  const gh = hooks.ghost; if (!gh) return;
  if (!gh.ok) { toast("It does not fit there."); sfx("error"); return; }
  S.layout = S.layout || {};
  if (gh.fromTray) {
    const id = gh.fromTray, i = S.furniture.indexOf(id), u = uid("fp"); if (i >= 0) S.furniture.splice(i, 1);
    S.placed.push({ uid: u, id }); S.layout[u] = { gx: gh.tile[0], gy: gh.tile[1], flip: gh.flip };
    hooks.ghost = null; syncBar(); emit("furniture:placed", { uid: u, id }); emit("furniture:changed", { id }); emit("layout:changed"); sfx("coin"); return;
  }
  S.layout[gh.st.id] = { gx: gh.tile[0], gy: gh.tile[1], flip: gh.flip };
  hooks.ghost = null; syncBar(); emit("layout:changed"); sfx("coin");
}
function putBack() {
  const gh = hooks.ghost; if (!gh || !gh.st.piece || gh.fromTray) return;
  if (gh.st.shelves) { toast("Shelf units stay in the house. You can move them."); return; }
  const i = S.placed.findIndex(p => p.uid === gh.st.id); if (i < 0) return;
  const pc = S.placed.splice(i, 1)[0]; delete S.layout[pc.uid]; S.furniture.push(pc.id);
  hooks.ghost = null; syncBar(); emit("furniture:changed", { id: pc.id }); emit("layout:changed"); toast(`${D.F[pc.id].name} is back in the tray.`); sfx("pop");
}
function rotate() { const gh = hooks.ghost; if (!gh) return; gh.flip = !gh.flip; const c = [gh.tile[0] + gh.tile[2] / 2, gh.tile[1] + gh.tile[3] / 2]; setGhostAt(c[0], c[1]); }
function cancel() { hooks.ghost = null; syncBar(); }
function drawTray() {
  if (!tray) return; clear(tray);
  const counts = {}; for (const id of S.furniture) counts[id] = (counts[id] || 0) + 1;
  const ids = Object.keys(counts);
  tray.hidden = !editing || !ids.length;
  if (!ids.length) return;
  tray.append(h("span", { class: "tt" }, "Tray"));
  for (const id of ids) tray.append(h("button", { class: "btn b-gold sm", type: "button", onClick: () => startPlace(id) }, `${D.F[id].emoji || ""} ${D.F[id].name}${counts[id] > 1 ? " x" + counts[id] : ""}`));
}
function setMode(onOff) {
  editing = onOff; cancel();
  btnEl.classList.toggle("sel", editing); bar.hidden = !editing;
  document.getElementById("room").classList.toggle("editing", editing); drawTray();
}
export function initLayout() {
  hooks.editing = () => editing; hooks.pick = pick;
  const root = document.getElementById("room");
  btnEl = h("button", { class: "btn b-teal sm movebtn", type: "button", onClick: () => setMode(!editing) }, "🛠 Move furniture");
  putBtn = h("button", { class: "btn b-red sm", type: "button", hidden: true, onClick: putBack }, "Put back in tray");
  bar = h("div", { class: "movebar", hidden: true },
    h("span", {}, "Click furniture to pick it up. Click again to put it down."),
    h("button", { class: "btn b-blue sm", type: "button", onClick: rotate }, "Rotate (R)"), putBtn,
    h("button", { class: "btn b-gold sm", type: "button", onClick: () => setMode(false) }, "Done"));
  tray = h("div", { class: "movetray", hidden: true });
  root.append(btnEl, bar, tray);
  const svg = svgEl();
  svg.addEventListener("pointermove", e => { if (editing && hooks.ghost) { const [x, y] = pointerTile(e); setGhostAt(x, y); } });
  svg.addEventListener("click", e => { if (editing && hooks.ghost) { const [x, y] = pointerTile(e); setGhostAt(x, y); drop(); } });
  window.addEventListener("keydown", e => {
    if (!editing) return; const k = e.key.toLowerCase();
    if (k === "r") rotate(); if (k === "escape") { if (hooks.ghost) cancel(); else setMode(false); }
  });
  on("layout:place", ({ id }) => { if (!editing) setMode(true); if (S.furniture.includes(id)) startPlace(id); });
  on("furniture:changed", drawTray); on("layout:changed", drawTray);
  on("modal:open", () => { if (editing) setMode(false); });
  on("newgame", () => { S.layout = {}; if (editing) setMode(false); });
}
