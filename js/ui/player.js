/* PLAYER. Walking (WASD, arrows, the touch joystick, or click to move by BFS on the world grid), using a station in reach,
   and drawing the character: the sprite ch_player_<front|back>_<frame> if it exists (falls back to front_0, mirrored by facing,
   bobbing while it walks), otherwise the old code figure. A carried order shows it_box above the head.
   Events out: station:click {id, locked}. Exports: pl, PS, walkTo, walkToStation, nearestStation, stepPlayer, drawPlayer, playerPos, typing. */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { emit } from "../core/bus.js";
import { P } from "./proj.js";
import { blockedAt, cellBlocked, CELL, gridDims, rectDist, tileOf, stations, locked } from "./world.js";
import { hasSpr, spr, drawSprAt } from "./art.js";
import { shadow } from "./drawkit.js";
import { joy } from "./joystick.js";

export const pl = { path: [], then: null, moving: false, face: 1, back: false, step: 0, keys: {} };
export const PS = () => { if (!S.player) S.player = { x: D.room.player.start[0], y: D.room.player.start[1] }; return S.player; };
export const playerPos = () => { const p = PS(); return [p.x, p.y]; };
export const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable); };

function bfs(sx, sy, goal) {
  const { W, H, y0 } = gridDims(), clampI = (v, m) => Math.min(m - 1, Math.max(0, v));
  const start = [clampI(Math.floor(sx / CELL), W), clampI(Math.floor((sy - y0) / CELL), H)];
  const seen = new Int32Array(W * H).fill(-1), q = [start[0] + start[1] * W]; seen[q[0]] = q[0];
  const cx = x => (x + 0.5) * CELL, cy = y => y0 + (y + 0.5) * CELL;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], x = c % W, y = (c / W) | 0;
    if (qi > 0 && goal(cx(x), cy(y))) { const path = []; let k = c; while (k !== seen[k]) { path.push([cx(k % W), cy((k / W) | 0)]); k = seen[k]; } return path.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = nx + ny * W; if (seen[n] >= 0 || cellBlocked(nx, ny) || (dx && dy && (cellBlocked(x, ny) || cellBlocked(nx, y)))) continue;
      seen[n] = c; q.push(n);
    }
  }
  return null;
}
export function walkTo(tx, ty, then) {
  const p = PS();
  const path = bfs(p.x, p.y, (x, y) => Math.hypot(x - tx, y - ty) < 0.2) || bfs(p.x, p.y, (x, y) => Math.hypot(x - tx, y - ty) < 0.6);
  pl.path = path || []; pl.then = then || null;
  if (!pl.path.length && then) { pl.then = null; then(); }
}
export function walkToStation(st) {
  const p = PS(), t = tileOf(st), near = D.room.player.useDist;
  const open = () => emit("station:click", { id: st.id, locked: locked(st) });
  if (rectDist(p.x, p.y, t) <= near + 0.1) { pl.path = []; return open(); }
  const path = bfs(p.x, p.y, (x, y) => rectDist(x, y, t) <= near);
  if (!path) return open();       // unreachable: open anyway so nothing is ever stuck
  pl.path = path; pl.then = open;
}
export function nearestStation() {
  const p = PS(); let best = null, bd = 9;
  for (const st of stations()) { if (st.deco) continue; const d = rectDist(p.x, p.y, tileOf(st)); if (d < bd) { bd = d; best = st; } }
  return bd <= D.room.player.useDist + 0.15 ? best : null;
}
/* Move one step. can = false while a window is open or furniture is being moved. */
export function stepPlayer(dt, can) {
  const p = PS(), sp = D.room.player.speed * dt; let mx = 0, my = 0, mag = 1;
  if (can) {
    const k = pl.keys, up = k.w || k.arrowup, dn = k.s || k.arrowdown, lf = k.a || k.arrowleft, rt = k.d || k.arrowright;
    if (up) { mx -= 1; my -= 1; } if (dn) { mx += 1; my += 1; } if (lf) { mx -= 1; my += 1; } if (rt) { mx += 1; my -= 1; }
    if (!mx && !my && (joy.x || joy.y)) { mx = joy.x + joy.y; my = joy.y - joy.x; mag = Math.min(1, Math.hypot(joy.x, joy.y)); }
  }
  if (mx || my) {
    pl.path = []; pl.then = null;
    const l = Math.hypot(mx, my); mx = mx / l * sp * mag; my = my / l * sp * mag;
    if (!blockedAt(p.x + mx, p.y + my)) { p.x += mx; p.y += my; } else if (!blockedAt(p.x + mx, p.y)) p.x += mx; else if (!blockedAt(p.x, p.y + my)) p.y += my;
    pl.moving = true; pl.face = (mx - my) >= 0 ? 1 : -1; pl.back = (mx + my) < 0;
  } else if (pl.path.length) {
    const [tx, ty] = pl.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d <= sp) { p.x = tx; p.y = ty; pl.path.shift(); } else { p.x += dx / d * sp; p.y += dy / d * sp; }
    if (Math.abs(dx - dy) > 0.01) pl.face = (dx - dy) >= 0 ? 1 : -1;
    if (Math.abs(dx + dy) > 0.01) pl.back = (dx + dy) < 0;
    pl.moving = true;
    if (!pl.path.length && pl.then) { const f = pl.then; pl.then = null; f(); }
  } else pl.moving = false;
  if (pl.moving) pl.step += dt * 9;
}

/* ---------- drawing ---------- */
const carrying = () => !!(S.orders && S.orders.some(o => o.status === "picked"));
function frameId() {
  const base = (D.world.player && D.world.player.sprite) || "ch_player_front", walk = pl.moving ? 1 + (Math.floor(pl.step / 1.8) % 2) : 0;
  const dir = pl.back ? base.replace("front", "back") : base;
  for (const id of [`${dir}_${walk}`, `${base}_${walk}`, `${base}_0`]) if (hasSpr(id)) return [id, id.endsWith("_" + walk) && walk > 0];
  return [null, false];
}
export function drawPlayer(g) {
  const p = PS(), [sx, sy] = P(p.x, p.y), [id, framed] = frameId();
  if (id) {
    const bob = pl.moving && !framed ? Math.abs(Math.sin(pl.step)) * 5 : 0, faces = (D.world.player && D.world.player.faces) || "right";
    shadow(g, p.x, p.y, 0.3, 0.18);
    drawSprAt(g, id, sx, sy, { flip: faces === "right" ? pl.face < 0 : pl.face > 0, lift: bob });
    if (carrying() && hasSpr("it_box")) { const s = spr(id), top = sy - bob - (s.ay / 2); drawSprAt(g, "it_box", sx, top + 4 - (spr("it_box").h - spr("it_box").ay) / 2 + 2, {}); }
    return;
  }
  const x = sx, y = sy, bob = pl.moving ? Math.abs(Math.sin(pl.step)) * 4 : 0, leg = pl.moving ? Math.sin(pl.step) * 5 : 0;
  g.save(); g.translate(x, y);
  g.fillStyle = "rgba(28,36,82,.22)"; g.beginPath(); g.ellipse(0, 0, 20, 9, 0, 0, Math.PI * 2); g.fill();
  g.lineCap = "round"; g.strokeStyle = "#1c2452"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(-6, -22); g.lineTo(-6 + leg, -2); g.moveTo(6, -22); g.lineTo(6 - leg, -2); g.stroke();
  g.translate(0, -bob);
  g.fillStyle = "#2fd9cf"; g.strokeStyle = "#1c2452"; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(-15, -58, 30, 38, 12) : g.rect(-15, -58, 30, 38); g.fill(); g.stroke();
  if (carrying()) { g.fillStyle = "#d9a066"; g.fillRect(-12, -46, 24, 16); g.strokeRect(-12, -46, 24, 16); }
  g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(0, -72, 15, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#1c2452"; g.beginPath(); g.arc(0, -76, 15, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  g.beginPath(); g.arc(4 * pl.face, -71, 2.2, 0, Math.PI * 2); g.fill();
  g.restore();
}
