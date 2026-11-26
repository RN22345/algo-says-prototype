/* ART. Loads data/sprites.json (guarded: a missing file means no sprites) and the images in img/v/<id>.png, then draws them by the
   art contract: (ax, ay) is the image pixel of the footprint centre at floor level, images are px times game pixels.
   Anything without a sprite keeps its code-drawn or old-PNG fallback, so the game works with partial art.
   drawSpr(g, id, cx, cy, opts): (cx, cy) = footprint centre in tiles. A sprite may carry "scale" in sprites.json to match the others' size. opts: z, lift (px), flip, alpha, hue, scale.
   Exports: loadSprites, spr, hasSpr, drawSpr, drawSprAt, sprBox, sprBoxAt, tinted. */
import { D } from "../core/data.js";
import { P } from "./proj.js";

const store = {}, tints = {};
let px = 2;
export async function loadSprites() {
  let j = null;
  try { const r = await fetch("data/sprites.json", { cache: "no-cache" }); if (r.ok) j = await r.json(); } catch (e) { /* no sprites */ }
  const list = (j && j.sprites) || {}; px = (j && j.px) || 2; D.sprites = { px, sprites: list };
  const ids = Object.keys(list).concat(((D.world && D.world.clouds) || []).map(c => c.art));
  await Promise.all(ids.map(id => new Promise(res => {
    const i = new Image();
    i.onload = () => { store[id] = { img: i, w: i.naturalWidth, h: i.naturalHeight, ax: 0, ay: 0, fw: 1, fd: 1, ...(list[id] || {}) }; res(); };
    i.onerror = res; i.src = `img/v/${id}.png`;
  })));
}
export const spr = id => store[id] || null;
export const hasSpr = id => !!store[id];

export function tinted(id, hue) {
  const k = id + "|" + hue; if (tints[k]) return tints[k];
  const s = store[id], c = document.createElement("canvas"); c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
  const x = c.getContext("2d"); x.filter = `hue-rotate(${hue}deg)`; x.drawImage(s.img, 0, 0); return (tints[k] = c);
}
/* World-pixel box [x, y, w, h] of a sprite whose anchor sits at world pixel (sx, sy). */
export function sprBoxAt(id, sx, sy, o = {}) {
  const s = store[id]; if (!s) return null;
  const k = (o.scale || 1) * (s.scale || 1) / px, w = s.w * k, h = s.h * k, ax = s.ax * k, ay = s.ay * k;
  return [o.flip ? sx - (w - ax) : sx - ax, sy - ay, w, h];
}
export function sprBox(id, cx, cy, o = {}) { const [sx, sy] = P(cx, cy, o.z || 0); return sprBoxAt(id, sx, sy - (o.lift || 0), o); }
export function drawSprAt(g, id, sx, sy, o = {}) {
  const s = store[id]; if (!s) return false;
  const k = (o.scale || 1) * (s.scale || 1) / px, w = s.w * k, h = s.h * k, ax = s.ax * k, ay = s.ay * k, img = o.hue ? tinted(id, o.hue) : s.img, prev = g.globalAlpha;
  if (o.alpha != null) g.globalAlpha = prev * o.alpha;
  if (o.flip) { g.save(); g.translate(sx, 0); g.scale(-1, 1); g.drawImage(img, -ax, sy - ay, w, h); g.restore(); }
  else g.drawImage(img, sx - ax, sy - ay, w, h);
  g.globalAlpha = prev; return true;
}
export function drawSpr(g, id, cx, cy, o = {}) { const [sx, sy] = P(cx, cy, o.z || 0); return drawSprAt(g, id, sx, sy - (o.lift || 0), o); }
