/* RIG. Characters and small vehicles built from boxes, drawn in the iso view with soft voxel shading (no outlines).
   A look (data/rig.json) sets colours, hair style and size. A pose sets position, facing angle, walk phase, sit, carry, blink.
   Each box is in local units: lx to the character's right, ly forward, lz up (1 unit = 1 tile). The rig turns smoothly to any angle,
   so walking in 8 directions needs no extra art. Faces are depth sorted per box; only faces toward the camera are drawn.
   Unity: a rig is a prefab of cubes (one per box) with an Animator: walk swings legs and arms, idle breathes, blink scales the eyes.
   Exports: drawRig(g, look, pose), drawBoxes(g, x, y, ang, boxes, o), lookOf(id), randomLook(rand), scooterBoxes(col), turnToward. */
import { D } from "../core/data.js";
import { P } from "./proj.js";

/* ---------- colour helpers (cached) ---------- */
const rgbC = {}, shC = {};
const rgb = hex => rgbC[hex] || (rgbC[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
function shadeOf(hex, k) {
  const q = Math.round(k * 40) / 40, key = hex + q; if (shC[key]) return shC[key];
  const [r, g, b] = rgb(hex), f = v => Math.max(0, Math.min(255, Math.round(q >= 1 ? v + (255 - v) * (q - 1) * 1.6 : v * q)));
  return (shC[key] = `rgb(${f(r)},${f(g)},${f(b)})`);
}
const LX = -0.35, LY = 0.94;   // light from the upper left of the screen

/* ---------- box renderer ---------- */
/* boxes: [{x,y,z (centre, local), w,d,h, c (hex), a? (alpha)}]. o: {alpha, scale} */
export function drawBoxes(g, px, py, ang, boxes, o = {}) {
  const fx = Math.cos(ang), fy = Math.sin(ang), rx = -fy, ry = fx, k = o.scale || 1, z0 = o.z || 0;
  const W = (lx, ly) => [px + (rx * lx + fx * ly) * k, py + (ry * lx + fy * ly) * k];
  const list = boxes.map(b => { const [wx, wy] = W(b.x, b.y); return { b, key: wx + wy + b.z * 0.25 + (b.pri || 0) }; }).sort((a, b) => a.key - b.key);
  const prev = g.globalAlpha; if (o.alpha != null) g.globalAlpha = prev * o.alpha;
  g.lineJoin = "round"; g.lineWidth = 1;
  for (const { b } of list) {
    const hw = b.w / 2, hd = b.d / 2, zb = z0 + (b.z - b.h / 2) * k, zt = z0 + (b.z + b.h / 2) * k;
    const c4 = [W(b.x - hw, b.y - hd), W(b.x + hw, b.y - hd), W(b.x + hw, b.y + hd), W(b.x - hw, b.y + hd)];   // corners: back-left, back-right, front-right, front-left
    // side faces: edge i -> i+1 with outward normals -ly, +lx, +ly, -lx
    const nrm = [[-fx, -fy], [rx, ry], [fx, fy], [-rx, -ry]];
    const ba = b.a != null ? b.a : 1; if (ba !== 1) g.globalAlpha = prev * (o.alpha ?? 1) * ba;
    for (let i = 0; i < 4; i++) {
      const [nx, ny] = nrm[i]; if (nx + ny <= 0.001) continue;
      const a = c4[i], c = c4[(i + 1) % 4], p0 = P(a[0], a[1], zb), p1 = P(c[0], c[1], zb), p2 = P(c[0], c[1], zt), p3 = P(a[0], a[1], zt);
      const col = shadeOf(b.c, 0.8 + 0.14 * (nx * LX + ny * LY) / Math.SQRT2 * 1.2);
      g.fillStyle = col; g.strokeStyle = col; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.closePath(); g.fill(); g.stroke();
    }
    if (!b.noTop) {
      const col = shadeOf(b.c, 1.07); g.fillStyle = col; g.strokeStyle = col; g.beginPath();
      c4.forEach((q, i) => { const p = P(q[0], q[1], zt); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); g.fill(); g.stroke();
    }
    if (ba !== 1) g.globalAlpha = prev * (o.alpha ?? 1);
  }
  g.globalAlpha = prev;
}

/* ---------- looks ---------- */
const DEF = { skin: "#f2c9a0", hair: "#5a3a26", top: "#f7f3e8", bottom: "#4f9d5b", shoes: "#3b3f5c", style: "long", size: 1 };
export const lookOf = id => ({ ...DEF, ...((D.rig && D.rig.looks && D.rig.looks[id]) || {}) });
export function randomLook(rand) {
  const R = (D.rig && D.rig.palette) || {}, pk = a => a[Math.floor(rand() * a.length)];
  const kid = rand() < 0.14;
  return { skin: pk(R.skin || [DEF.skin]), hair: pk(R.hair || [DEF.hair]), top: pk(R.top || [DEF.top]), bottom: pk(R.bottom || [DEF.bottom]), shoes: pk(R.shoes || [DEF.shoes]),
    style: pk(R.styles || ["short", "long", "bun", "cap"]), cap: pk(R.top || ["#e8344f"]), size: kid ? 0.74 : 0.92 + rand() * 0.12, bag: rand() < 0.25 ? pk(R.top || ["#3a7bf0"]) : null };
}

/* ---------- the character ---------- */
const B = (x, y, z, w, d, h, c, extra) => ({ x, y, z, w, d, h, c, ...extra });
/* pose: {x, y, ang, phase, move (0..1), sit, carry, blink (0..1 closed), talk, alpha, lift, wave} */
export function rigBoxes(L, p) {
  const s = Math.sin(p.phase || 0), m = p.move || 0, out = [];
  const swing = s * 0.12 * m, lift = Math.max(0, Math.cos(p.phase || 0)) * 0.035 * m, bob = Math.abs(s) * 0.03 * m + (1 - m) * Math.sin((p.breath || 0)) * 0.006;
  const hipZ = p.sit ? 0.36 : 0.4 + bob;
  // legs and shoes
  for (const side of [-1, 1]) {
    const lx = side * 0.075;
    if (p.sit) {
      out.push(B(lx, 0.12, hipZ - 0.02, 0.11, 0.3, 0.1, L.bottom), B(lx, 0.27, hipZ / 2 - 0.03, 0.1, 0.1, hipZ - 0.1, L.bottom), B(lx, 0.31, 0.03, 0.11, 0.17, 0.06, L.shoes));
    } else {
      const fwd = swing * side, up = side > 0 ? lift : Math.max(0, -Math.cos(p.phase || 0)) * 0.035 * m;
      out.push(B(lx, fwd, (hipZ + 0.04 + up) / 2 + 0.02, 0.1, 0.11, hipZ - 0.04 - up, L.bottom), B(lx, fwd + 0.025, 0.03 + up, 0.11, 0.17, 0.06, L.shoes));
    }
  }
  // hips, torso
  out.push(B(0, 0, hipZ + 0.06, 0.3, 0.18, 0.12, L.bottom), B(0, 0, hipZ + 0.27, 0.3, 0.17, 0.3, L.top));
  if (L.bag) out.push(B(0, -0.13, hipZ + 0.28, 0.24, 0.1, 0.24, L.bag));
  // arms
  const shZ = hipZ + 0.41;
  for (const side of [-1, 1]) {
    const lx = side * 0.195;
    if (p.carry) out.push(B(lx, 0.13, shZ - 0.12, 0.08, 0.26, 0.08, L.top), B(lx * 0.95, 0.28, shZ - 0.12, 0.08, 0.07, 0.07, L.skin));
    else if (p.wave && side > 0) out.push(B(lx + 0.03, 0, shZ + 0.12, 0.08, 0.09, 0.26, L.top), B(lx + 0.03, 0, shZ + 0.3, 0.08, 0.08, 0.07, L.skin));
    else { const a = p.sit ? 0.06 : -swing * side * 0.8; out.push(B(lx, a, shZ - 0.14, 0.08, 0.09, 0.27, L.top), B(lx, a * 1.3, shZ - 0.31, 0.075, 0.08, 0.07, L.skin)); }
  }
  if (p.carry) out.push(B(0, 0.3, shZ - 0.12, 0.32, 0.26, 0.24, "#d9a066", { pri: 0.02 }), B(0, 0.3, shZ - 0.0, 0.33, 0.06, 0.01, "#b9833f", { pri: 0.03, noTop: false }));
  // head
  const hz = shZ + 0.22, hh = 0.36, hf = 0.18;
  out.push(B(0, 0, hz, 0.4, 0.36, hh, L.skin));
  // face: eyes (blink), highlights, cheeks, mouth
  const eh = 0.075 * (1 - (p.blink || 0)) + 0.01;
  for (const side of [-1, 1]) {
    out.push(B(side * 0.085, hf + 0.008, hz + 0.01, 0.055, 0.014, eh, "#2a2340", { noTop: true, pri: 0.01 }));
    if ((p.blink || 0) < 0.5) out.push(B(side * 0.085 - 0.012, hf + 0.016, hz + 0.03, 0.02, 0.01, 0.022, "#ffffff", { noTop: true, pri: 0.02 }));
    out.push(B(side * 0.14, hf + 0.006, hz - 0.055, 0.05, 0.01, 0.03, "#f39a9a", { noTop: true, pri: 0.01, a: 0.75 }));
  }
  out.push(B(0, hf + 0.006, hz - 0.075, p.talk ? 0.05 : 0.06, 0.01, p.talk ? 0.03 : 0.014, "#a8484a", { noTop: true, pri: 0.01 }));
  // hair
  const top = hz + hh / 2;
  if (L.style === "cap") {
    out.push(B(0, -0.01, top + 0.03, 0.43, 0.39, 0.09, L.cap || "#e8344f"), B(0, 0.24, top - 0.01, 0.3, 0.14, 0.025, L.cap || "#e8344f"), B(0, -0.19, hz + 0.04, 0.42, 0.04, 0.22, L.hair));
  } else {
    out.push(B(0, -0.01, top + 0.03, 0.44, 0.4, 0.08, L.hair), B(0, 0.17, top - 0.03, 0.42, 0.05, 0.07, L.hair, { pri: 0.02 }));
    const backH = L.style === "long" ? 0.56 : L.style === "bun" ? 0.3 : 0.22;
    out.push(B(0, -0.195, top - backH / 2, 0.44, 0.06, backH, L.hair));
    for (const side of [-1, 1]) out.push(B(side * 0.21, -0.03, top - (L.style === "long" ? 0.2 : 0.1), 0.04, 0.3, L.style === "long" ? 0.4 : 0.2, L.hair));
    if (L.style === "bun") out.push(B(0, -0.12, top + 0.11, 0.17, 0.17, 0.14, L.hair));
  }
  return out;
}
export function drawRig(g, L, p) {
  const k = (L.size || 1) * 1.18, a = p.alpha ?? 1;
  const [sx, sy] = P(p.x, p.y);
  if (!p.noShadow) { g.fillStyle = `rgba(28,36,82,${0.16 * a})`; g.beginPath(); g.ellipse(sx, sy, 22 * k, 11 * k, 0, 0, Math.PI * 2); g.fill(); }
  drawBoxes(g, p.x, p.y, p.ang || 0, rigBoxes(L, p), { scale: k, alpha: a, z: (p.lift || 0) + (p.z || 0) });
}
/* Screen box of a character, for culling and fade tests. */
export function rigBox(L, x, y) { const [sx, sy] = P(x, y), k = (L.size || 1); return [sx - 40 * k, sy - 160 * k, 80 * k, 172 * k]; }

/* ---------- a delivery scooter ---------- */
export function scooterBoxes(col = "#ff7a1a") {
  const dk = "#2a2d44";
  return [B(0, 0.42, 0.1, 0.07, 0.2, 0.2, dk), B(0, -0.4, 0.1, 0.07, 0.2, 0.2, dk),
    B(0, 0.02, 0.2, 0.26, 0.7, 0.12, col), B(0, 0.36, 0.42, 0.22, 0.12, 0.4, col), B(0, 0.4, 0.66, 0.42, 0.05, 0.05, dk),
    B(0, -0.18, 0.36, 0.28, 0.34, 0.1, "#3b3f5c"), B(0, -0.42, 0.52, 0.38, 0.32, 0.32, col, { pri: -0.01 }), B(0, -0.42, 0.69, 0.39, 0.33, 0.02, "#ffffff", { a: 0.35 })];
}

/* Turn angle a toward b by at most step (radians), the short way round. */
export function turnToward(a, b, step) { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + Math.max(-step, Math.min(step, d)); }
