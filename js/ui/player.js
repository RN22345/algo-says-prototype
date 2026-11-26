/* PLAYER. Walking (WASD, arrows, the touch joystick, or click to move on a smoothed grid path), using a station in reach,
   and drawing the character with the box rig (js/ui/rig.js): it turns smoothly toward where it walks, swings its arms and legs,
   breathes and blinks when idle, and holds a box in both arms while carrying a picked order.
   Keyboard walking slides along walls and furniture instead of stopping dead.
   Unity: a CharacterController on the NavMesh; the rig prefab gets Speed and Carry parameters on its Animator.
   Events out: station:click {id, locked}. Exports: pl, PS, walkTo, walkToStation, nearestStation, stepPlayer, drawPlayer, playerPos, typing. */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { emit } from "../core/bus.js";
import { blockedAt, findPath, rectDist, tileOf, stations, locked } from "./world.js";
import { drawRig, lookOf, turnToward } from "./rig.js";
import { joy } from "./joystick.js";

export const pl = { path: [], then: null, moving: false, move: 0, ang: Math.PI * 0.75, phase: 0, keys: {}, blinkAt: 2, blink: 0, breath: 0, target: null };
export const PS = () => { if (!S.player) S.player = { x: D.room.player.start[0], y: D.room.player.start[1] }; return S.player; };
export const playerPos = () => { const p = PS(); return [p.x, p.y]; };
export const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable); };

export function walkTo(tx, ty, then) {
  const p = PS();
  const path = findPath(p.x, p.y, (x, y) => Math.hypot(x - tx, y - ty) < 0.2) || findPath(p.x, p.y, (x, y) => Math.hypot(x - tx, y - ty) < 0.7);
  pl.path = path || []; pl.then = then || null; pl.target = path ? [tx, ty] : null;
  if (!pl.path.length && then) { pl.then = null; then(); }
  return !!path;
}
export function walkToStation(st) {
  const p = PS(), t = tileOf(st), near = D.room.player.useDist;
  const open = () => { faceTo(t[0] + t[2] / 2, t[1] + t[3] / 2); emit("station:click", { id: st.id, locked: locked(st) }); };
  if (rectDist(p.x, p.y, t) <= near + 0.1) { pl.path = []; return open(); }
  const path = findPath(p.x, p.y, (x, y) => rectDist(x, y, t) <= near);
  if (!path) return open();       // unreachable: open anyway so nothing is ever stuck
  pl.path = path; pl.then = open; pl.target = null;
}
function faceTo(x, y) { const p = PS(); if (Math.hypot(x - p.x, y - p.y) > 0.05) pl.angT = Math.atan2(y - p.y, x - p.x); }
export function nearestStation() {
  const p = PS(); let best = null, bd = 9;
  for (const st of stations()) { if (st.deco) continue; const d = rectDist(p.x, p.y, tileOf(st)); if (d < bd) { bd = d; best = st; } }
  return bd <= D.room.player.useDist + 0.15 ? best : null;
}
/* Try a move; if blocked, slide along the free axis, then try turning up to 60 degrees either way. */
function tryMove(p, mx, my) {
  if (!blockedAt(p.x + mx, p.y + my)) { p.x += mx; p.y += my; return true; }
  if (Math.abs(mx) > 1e-4 && !blockedAt(p.x + mx, p.y)) { p.x += mx * 0.9; return true; }
  if (Math.abs(my) > 1e-4 && !blockedAt(p.x, p.y + my)) { p.y += my * 0.9; return true; }
  const l = Math.hypot(mx, my), a = Math.atan2(my, mx);
  for (const da of [0.5, -0.5, 1.05, -1.05]) { const nx = Math.cos(a + da) * l * 0.8, ny = Math.sin(a + da) * l * 0.8; if (!blockedAt(p.x + nx, p.y + ny)) { p.x += nx; p.y += ny; return true; } }
  return false;
}
/* Move one step. can = false while a window is open or furniture is being moved. */
export function stepPlayer(dt, can) {
  const p = PS(), sp = D.room.player.speed * dt; let mx = 0, my = 0, mag = 1, moved = false;
  if (can) {
    const k = pl.keys, up = k.w || k.arrowup, dn = k.s || k.arrowdown, lf = k.a || k.arrowleft, rt = k.d || k.arrowright;
    if (up) { mx -= 1; my -= 1; } if (dn) { mx += 1; my += 1; } if (lf) { mx -= 1; my += 1; } if (rt) { mx += 1; my -= 1; }
    if (!mx && !my && (joy.x || joy.y)) { mx = joy.x + joy.y; my = joy.y - joy.x; mag = Math.min(1, Math.hypot(joy.x, joy.y)); }
  }
  if (mx || my) {
    pl.path = []; pl.then = null; pl.target = null;
    const l = Math.hypot(mx, my); mx = mx / l * sp * mag; my = my / l * sp * mag;
    pl.angT = Math.atan2(my, mx); moved = tryMove(p, mx, my);
  } else if (pl.path.length) {
    const [tx, ty] = pl.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d <= sp) { p.x = tx; p.y = ty; pl.path.shift(); } else { p.x += dx / d * sp; p.y += dy / d * sp; }
    if (d > 0.02) pl.angT = Math.atan2(dy, dx);
    moved = true;
    if (!pl.path.length) { pl.target = null; if (pl.then) { const f = pl.then; pl.then = null; f(); } }
  }
  pl.moving = moved;
  pl.move += ((moved ? 1 : 0) - pl.move) * Math.min(1, dt * 12);
  if (pl.angT != null) pl.ang = turnToward(pl.ang, pl.angT, dt * 11);
  if (moved) pl.phase += dt * 11 * (D.room.player.speed / 3.4);
  else pl.phase += (Math.round(pl.phase / Math.PI) * Math.PI - pl.phase) * Math.min(1, dt * 10);   // settle the stride
  pl.breath += dt * 2.2;
  pl.blinkAt -= dt; if (pl.blinkAt < 0) { pl.blink = 1; pl.blinkAt = 2.2 + Math.random() * 3; }
  pl.blink = Math.max(0, pl.blink - dt * 7);
}

/* ---------- drawing ---------- */
const carrying = () => !!(S.orders && S.orders.some(o => o.status === "picked"));
let look = null;
export function drawPlayer(g) {
  const p = PS(); look = look || lookOf("player");
  drawRig(g, look, { x: p.x, y: p.y, ang: pl.ang, phase: pl.phase, move: pl.move, carry: carrying(), blink: pl.blink > 0.4 ? 1 : 0, breath: pl.breath });
}
/* Small marker where a click-walk is heading. */
export function walkTarget() { return pl.target; }
