/* PEOPLE. Pedestrians who make the street feel alive. They enter at an island edge on a sidewalk (fading in), then either stroll to
   the other end, or visit the park or the garden, maybe sit on a bench for a while, and leave by a sidewalk end (fading out).
   They use the people layer of the walk grid (they never enter the house), wait at the curb while a car is at the crosswalk,
   and pause when the player stands in their way. Fewer at night. Settings: data/world.json people; looks: data/rig.json palette.
   Visual only: people do not buy or affect the sims (walk-in customers stay out of scope, FOUNDATION section 9).
   Unity: a spawner with pooled rig prefabs on NavMeshAgents; benches are seat points.
   Exports: stepPeople(dt, player), peopleItems(), peopleOnCross() -> set of crosswalk indices, peopleState. */
import { D } from "../core/data.js";
import { tod } from "../core/clock.js";
import { P } from "./proj.js";
import { findPath, crossAt, walkAreas, blockedAt } from "./world.js";
import { drawRig, randomLook, turnToward } from "./rig.js";
import { carNear, edgeAlpha } from "./traffic.js";

const ppl = [];
let wait = 1, uid = 0;
const C = () => D.world.people || {}, B = () => D.world.bounds;
const rr = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const night = () => { const m = tod(); return m < 360 || m >= 1260; };
export const peopleState = () => ppl;
/* Sidewalk entry and exit points at both island ends. */
const ends = () => { const b = B(), xs = [11.55, 16.45]; return xs.flatMap(x => [[x, b.y0 + 0.2], [x, b.y1 - 0.2]]); };
function randomSpot(area) {
  for (let i = 0; i < 20; i++) { const x = area[0] + Math.random() * area[2], y = area[1] + Math.random() * area[3]; if (!blockedAt(x, y, null, "npc")) return [x, y]; }
  return null;
}
function plan(p, goal, near = 0.3) {
  const path = findPath(p.x, p.y, (x, y) => Math.hypot(x - goal[0], y - goal[1]) < near, "npc");
  p.path = path || []; return !!path;
}
function spawn() {
  const e = ends(), start = pick(e), look = randomLook(Math.random), cfg = C();
  const p = { n: ++uid, look, x: start[0] + rr(-0.15, 0.15), y: start[1], ang: start[1] < 0 ? Math.PI / 4 : -Math.PI * 0.75, phase: Math.random() * 6, move: 0,
    speed: rr(...(cfg.speed || [1, 1.5])) * (look.size < 0.8 ? 1.15 : 1), path: [], todo: [], blink: 0, blinkAt: Math.random() * 3, breath: Math.random() * 6, waitT: 0, sit: null, leaving: false };
  // what this person does: a list of goals
  const areas = walkAreas().slice(2), benches = D.world.benches || [];
  if (Math.random() < (cfg.parkChance ?? 0.45) && areas.length) {
    const a = pick(areas), spot = randomSpot(a); if (spot) p.todo.push({ go: spot });
  }
  if (Math.random() < (cfg.sitChance ?? 0.35) && benches.length) {
    const bn = benches.slice().sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(b[0] - p.x, b[1] - p.y)).slice(0, 4);
    const free = bn.filter(s => !ppl.some(o => o.sit && o.sit[0] === s[0] && o.sit[1] === s[1]));
    if (free.length) p.todo.push({ sit: pick(free) });
  }
  const exits = e.filter(q => Math.hypot(q[0] - start[0], q[1] - start[1]) > 6);
  p.todo.push({ go: pick(exits), exit: true });
  ppl.push(p); next(p);
}
function next(p) {
  const t = p.todo.shift(); if (!t) { p.gone = true; return; }
  p.cur = t;
  if (t.sit) { if (!plan(p, t.sit, 0.85)) next(p); return; }
  if (!plan(p, t.go, t.exit ? 0.35 : 0.3)) { if (t.exit) p.gone = true; else next(p); }
}
export function stepPeople(dt, player) {
  const c = C(), max = night() ? c.maxNight ?? 3 : c.maxDay ?? 9;
  wait -= dt;
  if (wait <= 0) { if (ppl.length < max) spawn(); wait = rr(...(night() ? c.gapNight || [12, 26] : c.gapDay || [3, 8])); }
  for (const p of ppl) {
    p.breath += dt * 2; p.blinkAt -= dt; if (p.blinkAt < 0) { p.blink = 1; p.blinkAt = 2 + Math.random() * 4; } p.blink = Math.max(0, p.blink - dt * 7);
    if (p.sit) {   // sitting on a bench
      p.sitT -= dt; p.move = 0;
      if (p.sitT <= 0) { p.x = p.sit[0]; p.y = p.sit[1] + 0.55; p.sit = null; next(p); }
      continue;
    }
    let moving = false;
    if (p.path.length) {
      const [tx, ty] = p.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), sp = p.speed * dt;
      const nx = p.x + dx / Math.max(d, 1e-6) * Math.min(sp, d), ny = p.y + dy / Math.max(d, 1e-6) * Math.min(sp, d);
      // wait at the curb while a car is at the crosswalk; pause when the player is in the way
      const k = crossAt(nx, ny, 0.05), onNow = crossAt(p.x, p.y, 0.05);
      const blockedByCar = k >= 0 && onNow < 0 && carNear(k);
      const pd = Math.hypot(player.x - nx, player.y - ny), inWay = pd < 0.42 && (player.x - p.x) * dx + (player.y - p.y) * dy > 0;
      if (blockedByCar || inWay) { p.waitT += dt; if (inWay && p.waitT > 1.6) { p.x = nx; p.y = ny; moving = true; } }
      else { p.waitT = 0; p.x = nx; p.y = ny; moving = true; if (d <= sp) p.path.shift(); }
      if (d > 0.02) p.ang = turnToward(p.ang, Math.atan2(dy, dx), dt * 9);
    } else if (p.cur && p.cur.sit) {
      p.sit = p.cur.sit; p.sitT = rr(...(c.sitSecs || [8, 20])); p.ang = turnToward(p.ang, Math.PI / 2, 9); next0(p);
    } else if (p.cur && p.cur.exit) p.gone = true;
    else next(p);
    p.move += ((moving ? 1 : 0) - p.move) * Math.min(1, dt * 10);
    if (moving) p.phase += dt * 10 * p.speed / 1.3;
  }
  for (let i = ppl.length - 1; i >= 0; i--) if (ppl[i].gone) ppl.splice(i, 1);
}
const next0 = p => { p.cur = null; };
export function peopleItems() {
  return ppl.map(p => {
    const x = p.sit ? p.sit[0] : p.x, y = p.sit ? p.sit[1] + 0.02 : p.y, [sx, sy] = P(x, y), a = edgeAlpha(y);
    return { d: x + y + (p.sit ? 0.45 : 0.3), bb: [sx - 40, sy - 170, 80, 180], f: g => drawRig(g, p.look, { x, y, ang: p.sit ? Math.PI / 2 : p.ang, phase: p.phase, move: p.move, sit: !!p.sit, blink: p.blink > 0.4 ? 1 : 0, breath: p.breath, alpha: a, z: p.sit ? 0.02 : 0, noShadow: !!p.sit }) };
  });
}
export function peopleOnCross() { const s = new Set(); for (const p of ppl) { if (p.sit) continue; const k = crossAt(p.x, p.y, 0.1); if (k >= 0) s.add(k); } return s; }
