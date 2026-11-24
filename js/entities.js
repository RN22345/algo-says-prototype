/* Player, riders, supplier van, jeepney: drawing and update. */
import { D, S, pl, keys, toast } from "./state.js";
import { P, poly, box, circ, bar, getG, overlay, NAVY, FONT } from "./iso.js";
import { blocked } from "./world.js";
import { bookRider, freeSlot } from "./sim/shop.js";

const PLC = { legs: "#3a4a8c", body: "#9446e0", stripe: "#ffc928", hair: NAVY };
const RDC = { legs: "#3a4a8c", body: "#2cc8b6", stripe: "#ffffff", hair: "#ff8a2a", helmet: 1 };

function drawPerson(sx, sy, face, walk, moving, c) {
  const g = getG();
  const b = moving ? Math.sin(walk * 12) * 3 : 0, l = moving ? Math.sin(walk * 12) * 6 : 0;
  g.beginPath(); g.ellipse(sx, sy, 22, 10, 0, 0, 7); g.fillStyle = "rgba(27,42,102,.3)"; g.fill();
  g.save(); g.translate(sx, sy); g.scale(face, 1); g.lineWidth = 3; g.strokeStyle = NAVY;
  g.fillStyle = c.legs; g.beginPath(); g.roundRect(-12 + l, -32, 9, 32, 4); g.fill(); g.stroke(); g.beginPath(); g.roundRect(3 - l, -32, 9, 32, 4); g.fill(); g.stroke();
  g.fillStyle = c.body; g.beginPath(); g.roundRect(-18, -76 + b, 36, 47, 12); g.fill(); g.stroke();
  g.fillStyle = c.stripe; g.fillRect(-16, -57 + b, 32, 7);
  g.fillStyle = "#f2c19b"; g.beginPath(); g.arc(0, -95 + b, 20, 0, 7); g.fill(); g.stroke();
  g.fillStyle = c.hair;
  if (c.helmet) { g.beginPath(); g.arc(0, -99 + b, 22, Math.PI, 0); g.fill(); g.stroke(); g.fillRect(-22, -101 + b, 44, 6); }
  else { g.beginPath(); g.arc(0, -101 + b, 21, Math.PI * 1.02, Math.PI * 1.98); g.fill(); g.beginPath(); g.moveTo(-20, -103 + b); g.quadraticCurveTo(10, -118 + b, 24, -99 + b); g.lineTo(20, -105 + b); g.fill(); }
  g.fillStyle = NAVY; g.beginPath(); g.arc(8, -93 + b, 3, 0, 7); g.fill();
  g.restore();
  return b;
}

export function drawPlayer() {
  const g = getG();
  const [sx, sy] = P(pl.x, pl.y); const b = drawPerson(sx, sy, pl.face, pl.walk, pl.moving, PLC);
  if (S.box) { g.save(); g.translate(sx, sy - 128 + b); g.fillStyle = "#d9a066"; g.lineWidth = 3; g.strokeStyle = NAVY; g.beginPath(); g.roundRect(-30, -26, 60, 40, 6); g.fill(); g.stroke(); g.fillStyle = "#fff8e8"; g.fillRect(-14, -18, 28, 14); g.fillStyle = NAVY; g.font = `700 13px ${FONT}`; g.textAlign = "center"; g.fillText(S.box.q, 0, -7); g.restore(); }
  S.carry.forEach((o, i) => { const y = sy - 124 + b - i * 30; g.fillStyle = "#e2ae74"; g.lineWidth = 3; g.strokeStyle = NAVY; g.beginPath(); g.roundRect(sx - 24, y - 24, 48, 28, 5); g.fill(); g.stroke(); g.fillStyle = NAVY; g.font = `700 14px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("#" + o.id, sx, y - 10); });
  if (S.busy) { bar(sx, sy - 150, 70, 1 - S.busy.t / S.busy.d, "#9446e0"); }
}

function drawBike(x, y) { // bike along y axis
  const g = getG();
  box(x - .18, y - .55, x + .18, y + .55, 16, 18, "#ff8a2a", "#e06d12", "#c25a08", 2.5);
  [y - .55, y + .55].forEach(wy => { const w = P(x, wy, 12); g.beginPath(); g.ellipse(w[0], w[1], 14, 12, 0, 0, 7); g.fillStyle = "#2b3466"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = NAVY; g.stroke(); });
  box(x - .22, y + .15, x + .22, y + .55, 34, 26, "#e2ae74", "#c08445", "#a26c33", 2);
}

export function drawRider(r) {
  drawBike(r.x, r.y);
  const [sx, sy] = P(r.x, r.y - .1, 30); drawPerson(sx, sy, r.state === "leaving" ? -1 : 1, r.walk || 0, r.state !== "waiting", RDC);
  if (r.state === "waiting") { const p = r.pat / r.max; overlay.bubbles.push([r.x, r.y, 150, `#${r.id}`, p < .3 ? "#ff9aa8" : "#fff"]); overlay.bars.push([r.x, r.y, 138, p, p < .3 ? "#ef3b4f" : "#2cc8b6"]); }
}

export function drawVan(v) {
  box(v.x - .5, v.y - 1.3, v.x + .5, v.y + .6, 0, 80, "#ffffff", "#e6e9f5", "#cfd5ea");
  box(v.x - .5, v.y + .6, v.x + .5, v.y + 1.3, 0, 52, "#9446e0", "#7c36c4", "#6224a8");
  poly([P(v.x - .5, v.y - 1.3, 30), P(v.x - .5, v.y + .6, 30), P(v.x - .5, v.y + .6, 46), P(v.x - .5, v.y - 1.3, 46)], "#2cc8b6", 0);
}

export function drawJeep(j) {
  box(j.x - .45, j.y - 1.6, j.x + .45, j.y + 1.6, 10, 62, "#ffc928", "#ef3b4f", "#d42a3e");
  box(j.x - .47, j.y - 1.62, j.x + .47, j.y + 1.62, 72, 8, "#c9cde6", "#aab0d6", "#8f96c4", 2);
  for (let k = 0; k < 4; k++) { const yy = j.y - 1.3 + k * .7; poly([P(j.x + .45, yy, 40), P(j.x + .45, yy + .5, 40), P(j.x + .45, yy + .5, 64), P(j.x + .45, yy, 64)], "#cfeeff", 2); }
  [j.y - 1.2, j.y + 1.2].forEach(wy => { const w = P(j.x + .45, wy, 10); circ(w[0], w[1], 11, "#2b3466"); });
}

export function drawYardBox(b) { box(b.x - .3, b.y - .3, b.x + .3, b.y + .3, 0, 38, "#d9a066", "#c08445", "#a26c33"); }

/* ---------- update ---------- */
export function updateRiders(dt) {
  const T = D.T.shop, slots = D.MAP.riderSlots, st = D.MAP.street;
  S.riders.forEach(r => {
    if (r.state === "queued") { r.delay -= dt; if (r.delay <= 0) { const s = freeSlot(); if (s >= 0) { r.slot = s; r.ty = slots[s]; r.state = "coming"; } } }
    else if (r.state === "coming") { r.y += T.riderSpeed * dt; r.walk += dt; if (r.y >= r.ty) { r.y = r.ty; r.state = "waiting"; } }
    else if (r.state === "waiting") { r.pat -= dt; if (r.pat <= 0) { r.state = "leaving"; S.rating = Math.max(T.ratingMin, S.rating - T.ratingLossLeave); toast(`Rider for #${r.id} left. A new rider is coming.`); bookRider(r.id, T.riderReplaceDelay); } }
    else if (r.state === "leaving") { r.y += T.riderSpeed * dt; r.walk += dt; }
  });
  S.riders = S.riders.filter(r => r.y < st.riderExitY);
}

export function updateVan(dt) {
  const V = D.T.van, st = D.MAP.street;
  if (!S.van && S.vanQ.length) S.van = { x: st.vanX, y: st.vanStartY, state: "in", d: S.vanQ.shift(), w: 0 };
  if (!S.van) return;
  const v = S.van;
  if (v.state === "in") { v.y += V.speed * dt; if (v.y >= st.vanDropY) { v.y = st.vanDropY; v.state = "drop"; v.w = V.dropWait; } }
  else if (v.state === "drop") {
    v.w -= dt;
    if (v.w <= 0) {
      const spots = D.MAP.yardDrops; const s = spots.find(([x, y]) => !S.yard.some(b => b.x === x && b.y === y)) || spots[0];
      S.yard.push({ x: s[0], y: s[1], p: v.d.p, q: v.d.q }); toast(`Delivery at the gate: ${v.d.q} ${D.PR[v.d.p].n}`); v.state = "out";
    }
  }
  else { v.y += V.speed * dt; if (v.y > st.vanExitY) S.van = null; }
}

export function updateJeep(dt) {
  const J = D.T.jeep, j = S.jeep;
  j.t -= dt;
  if (j.t <= 0) { j.y += J.speed * dt; if (j.y > J.endY) { j.y = J.startY; j.t = J.respawnMin + Math.random() * J.respawnRange; } }
}

export function updatePlayer(dt) {
  const T = D.T.shop;
  if (!S.ui && S.active && !S.busy) {
    let sx = 0, sy = 0; if (keys.has("w")) sy--; if (keys.has("s")) sy++; if (keys.has("a")) sx--; if (keys.has("d")) sx++;
    pl.moving = !!(sx || sy);
    if (pl.moving) {
      const dx = sx * .5 + sy, dy = -sx * .5 + sy, n = Math.hypot(dx, dy) || 1, v = T.playerSpeed * dt;
      const nx = pl.x + dx / n * v, ny = pl.y + dy / n * v; if (!blocked(nx, pl.y)) pl.x = nx; if (!blocked(pl.x, ny)) pl.y = ny;
      if (sx) pl.face = sx > 0 ? 1 : -1; else pl.face = sy > 0 ? -1 : 1; pl.walk += dt;
    }
  } else pl.moving = false;
}
