/* Blender-rendered furniture sprites (Stage 1). Made by 05_ART/blender/render_sprites.py.
   Each sprite is placed by the centre of its footprint, so a piece can move later (Stage 3). */
import { P, getG } from "./iso.js";

const spr = {};

export async function loadSprites(base = "data/") {
  const meta = await (await fetch(base + "sprites.json")).json();
  await Promise.all(Object.entries(meta).map(([id, m]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { spr[id] = { ...m, im }; res(); };
    im.onerror = () => { console.warn("sprite missing", id); res(); };
    im.src = m.src;
  })));
}

/* Draw sprite `id` on footprint b = [x0, y0, x1, y1]. Returns false when the sprite is not loaded. */
export function sprite(id, b) {
  const s = spr[id]; if (!s) return false;
  const [ax, ay] = P((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  getG().drawImage(s.im, ax + s.dx, ay + s.dy, s.w, s.h);
  return true;
}
