/* Asset manifest loader. data/assets.json lists every art id. For each id the game tries img/<id>.png (the artist's file),
   then img/ph/<id>.png (a stand-in), then draws a labelled placeholder. A new PNG with the same name replaces the placeholder with no code change. */
import { D } from "./data.js";

const urls = {}, imgs = {}, isPh = {};
const PAL = { navy: "#1c2452", card: "#26307a", gold: "#ffc61a", teal: "#2fd9cf", orange: "#ff7a1a", red: "#e8344f", blue: "#3a7bf0" };

const tryImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

async function load(id) {
  let i = await tryImg(`img/${id}.png`);
  if (i) { urls[id] = i.src; imgs[id] = i; isPh[id] = false; return; }
  i = await tryImg(`img/ph/${id}.png`);
  if (i) { urls[id] = i.src; imgs[id] = i; isPh[id] = true; return; }
  urls[id] = paint(id); isPh[id] = true; imgs[id] = await tryImg(urls[id]);
}

export async function preload() { await Promise.all(Object.keys(D.assets).map(load)); }
export const artUrl = id => urls[id] || (urls[id] = paint(id));
export const artImg = id => imgs[id] || null;
export const isPlaceholder = id => isPh[id] !== false;
export const artSize = id => (D.assets[id] ? [D.assets[id].w, D.assets[id].h] : [256, 256]);

/* An <img> for an art id. */
export function artEl(id, cls = "") { const e = new Image(); e.src = artUrl(id); e.alt = ""; e.draggable = false; if (cls) e.className = cls; return e; }

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

/* Draw a placeholder for id and return a data URL. */
function paint(id) {
  const a = D.assets[id] || { w: 256, h: 256, kind: "x", label: id };
  const sc = Math.min(1, 640 / Math.max(a.w, a.h));
  const w = Math.max(32, Math.round(a.w * sc)), h = Math.max(32, Math.round(a.h * sc));
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  const kind = a.kind;
  if (id === "room_window_day" || id === "room_window_night") {
    const day = id.endsWith("day"), gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, day ? "#6db8ff" : "#10163f"); gr.addColorStop(1, day ? "#dff1ff" : "#2a3380");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (day) { g.fillStyle = "#fff"; [[.25, .3, .12], [.65, .22, .09], [.55, .6, .1]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(w * x, h * y, w * r * 1.6, w * r * .7, 0, 0, 7); g.fill(); }); g.fillStyle = "#ffe066"; g.beginPath(); g.arc(w * .82, h * .2, w * .07, 0, 7); g.fill(); }
    else { g.fillStyle = "#fff"; for (let i = 0; i < 18; i++) { g.globalAlpha = .5 + (i % 3) * .2; g.fillRect((i * 97) % w, (i * 53) % (h * .8), 3, 3); } g.globalAlpha = 1; g.fillStyle = "#fff4c2"; g.beginPath(); g.arc(w * .75, h * .25, w * .07, 0, 7); g.fill(); }
    g.strokeStyle = "#fff"; g.lineWidth = Math.max(6, w * .03); g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    return c.toDataURL();
  }
  if (id === "st_door") {
    g.fillStyle = "#c88a4a"; rr(g, w * .08, h * .02, w * .84, h * .96, 14); g.fill(); g.lineWidth = 6; g.strokeStyle = PAL.navy; g.stroke();
    g.fillStyle = "#a8692f"; rr(g, w * .2, h * .12, w * .6, h * .36, 8); g.fill(); rr(g, w * .2, h * .54, w * .6, h * .36, 8); g.fill();
    g.fillStyle = PAL.gold; g.beginPath(); g.arc(w * .78, h * .52, w * .045, 0, 7); g.fill(); g.stroke();
    return c.toDataURL();
  }
  if (kind === "bg") {
    const gr = g.createLinearGradient(0, 0, 0, h);
    const pal = id === "bg_desk_top" ? ["#d9b27a", "#c49a5e"] : id === "bg_bedroom" ? ["#cfe0ff", "#f4d9e8"] : ["#e9eefc", "#cdd8f2"];
    gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (id === "bg_bedroom") { g.fillStyle = "#ffffff55"; g.fillRect(0, h * .72, w, h * .28); }
    return c.toDataURL();
  }
  if (kind === "hand") {
    g.fillStyle = "#f2c19b"; g.strokeStyle = PAL.navy; g.lineWidth = Math.max(3, w * .014);
    rr(g, w * .25, h * .45, w * .5, h * .55, w * .12); g.fill(); g.stroke();
    const fingers = id.endsWith("point") ? [0] : id.endsWith("pinch") ? [1, 2] : [0, 1, 2, 3];
    fingers.forEach(i => { const x = w * (.27 + i * .115); rr(g, x, h * .1 + (i % 2) * h * .06, w * .1, h * .42, w * .05); g.fill(); g.stroke(); });
    g.fillStyle = PAL.navy; g.font = `600 ${Math.round(w * .07)}px sans-serif`; g.textAlign = "center"; g.fillText(id.replace("hand_", ""), w / 2, h * .92);
    return c.toDataURL();
  }
  if (kind === "bust") {
    g.fillStyle = PAL.blue; rr(g, w * .12, h * .62, w * .76, h * .5, w * .2); g.fill(); g.lineWidth = 5; g.strokeStyle = PAL.navy; g.stroke();
    g.fillStyle = "#f2c19b"; g.beginPath(); g.arc(w / 2, h * .38, w * .22, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#3b2a1c"; g.beginPath(); g.arc(w / 2, h * .3, w * .23, Math.PI, 0); g.fill();
    g.fillStyle = PAL.navy; g.beginPath(); g.arc(w * .43, h * .4, 5, 0, 7); g.arc(w * .57, h * .4, 5, 0, 7); g.fill();
    g.beginPath(); g.arc(w / 2, h * .46, w * .06, 0.2, Math.PI - 0.2); g.stroke();
    return c.toDataURL();
  }
  if (id === "logo") {
    g.fillStyle = "transparent"; g.font = `${Math.round(h * .5)}px "Lilita One", Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = h * .1; g.lineJoin = "round"; g.strokeStyle = PAL.navy; g.strokeText("ALGO SAYS", w / 2, h / 2); g.fillStyle = PAL.gold; g.fillText("ALGO SAYS", w / 2, h / 2);
    return c.toDataURL();
  }
  // generic: rounded rect in the palette with the id text
  const col = { product: "#ffc61a", icon: "#ffc61a", algo: "#2fd9cf", station: "#3a7bf0", gear: "#ff7a1a", item: "#ff7a1a", site: "#b744c9", avatar: "#e8344f", room: "#bcd4f5" }[kind] || "#3a7bf0";
  const prod = id.startsWith("product_") || id.startsWith("icon_") ? D.P[id.replace(/^(product_|icon_)/, "").replace(/_(before|after)$/, "")] : null;
  g.fillStyle = prod ? prod.color : col; rr(g, 3, 3, w - 6, h - 6, Math.min(w, h) * .14); g.fill(); g.lineWidth = Math.max(3, w * .02); g.strokeStyle = PAL.navy; g.stroke();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  if (prod) { g.font = `${Math.round(h * .45)}px sans-serif`; g.fillText(prod.emoji, w / 2, h * .42); }
  g.fillStyle = PAL.navy; g.font = `700 ${Math.max(11, Math.round(Math.min(w / (id.length * .55), h * .12)))}px sans-serif`; g.fillText(id, w / 2, h * (prod ? .82 : .5));
  return c.toDataURL();
}
