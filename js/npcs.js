/* Neighbour NPCs. They walk fixed paths on the sidewalks and stop sometimes. No interaction.
   `held` is a colour for a held item. It is not drawn yet (later stages may use it for trending items). */
import { D } from "./state.js";
import { P } from "./iso.js";
import { drawPerson } from "./entities.js";

export const npcs = [];
const R = Math.random;

export function initNpcs() {
  npcs.length = 0;
  (D.MAP.npcs || []).forEach(d => {
    const [x, y] = d.path[0];
    npcs.push({ id: d.id, x, y, face: 1, walk: R() * 6, moving: false, wp: 1, dir: 1, mode: d.mode, path: d.path, speed: d.speed, colors: d.colors, held: d.held || null, pause: R() * 2 });
  });
}

function nextWaypoint(n) {
  const last = n.path.length - 1;
  if (n.mode === "loop") { n.wp = (n.wp + 1) % n.path.length; return; }
  if (n.wp + n.dir > last || n.wp + n.dir < 0) n.dir = -n.dir;
  n.wp += n.dir;
}

export function updateNpcs(dt) {
  const C = D.T.npc;
  npcs.forEach(n => {
    if (n.pause > 0) { n.pause -= dt; n.moving = false; return; }
    const [tx, ty] = n.path[n.wp], dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy), v = n.speed * dt;
    n.moving = true; n.walk += dt;
    if (d <= v) {
      n.x = tx; n.y = ty; nextWaypoint(n);
      n.pause = C.pauseMin + R() * (C.pauseMax - C.pauseMin);
    } else {
      n.x += dx / d * v; n.y += dy / d * v;
      n.face = dx - dy >= 0 ? 1 : -1;
      if (R() < C.stopChance * dt) n.pause = C.stopMin + R() * (C.stopMax - C.stopMin);
    }
  });
}

export function drawNpc(n) {
  const [sx, sy] = P(n.x, n.y);
  drawPerson(sx, sy, n.face, n.walk, n.moving, n.colors);
}
