/* SCENE: what the camera sees for one shot (also used for thumbnails). Layers: background art, product art scaled by angle, hand or player overlay,
   then CSS light effects (warm lamp tint, grain and dimness, window only by day, ring light highlight, glare). Flat 2D camera image, no iso.
   flawNotes() lists plain facts about the shot ("Yellow tint", "Grainy"). It never grades. */
import { D } from "../core/data.js";
import { artUrl } from "../core/assets.js";
import { h } from "./ui.js";

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 1.4 -.2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
const act = id => D.shots.actions.find(a => a.id === id), ang = id => D.shots.angles.find(a => a.id === id), lig = id => D.shots.lights.find(l => l.id === id);
const isNight = hour => !(hour >= D.time.daylight[0] && hour < D.time.daylight[1]);
const img = (id, style) => { const e = h("img", { src: artUrl(id), alt: "", draggable: false }); Object.assign(e.style, style); return e; };

/* Build the scene element. opts: filter (none|bright|vivid), pct sizes only, so it scales. */
export function sceneEl(clip, product, opts = {}) {
  const A = act(clip.action), G = ang(clip.angle), L = lig(clip.light), night = isNight(clip.hour);
  const sc = h("div", { class: "scene" });
  sc.append(img(G.bg, { left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover" }));
  const base = 52 * G.scale * (A.id === "closeup" ? 1.15 : A.id === "talk" ? 0.45 : A.id === "price" ? 0.5 : 1);   // percent of width
  const prodArt = product.art;
  const pos = (cx, cy, wPct, id, extra = {}) => img(id, { left: cx - wPct / 2 + "%", top: cy - wPct / 2 + "%", width: wPct + "%", height: "auto", aspectRatio: "1", objectFit: "contain", ...extra });
  switch (A.id) {
    case "holdup": sc.append(img("hand_hold", { left: "22%", top: "48%", width: "56%", height: "auto", aspectRatio: "1" }), pos(50, 46, base, prodArt)); break;
    case "closeup": sc.append(pos(50, 50, Math.min(96, base), prodArt)); break;
    case "demo": sc.append(pos(50, 44, base, prodArt, { animation: "wiggle 1.4s ease-in-out infinite" }), img("hand_pinch", { left: "8%", top: "52%", width: "48%", height: "auto", aspectRatio: "1" })); break;
    case "beforeafter": {
      const b = product.artBefore || product.art, a = product.artAfter || product.art;
      sc.append(h("div", { style: { position: "absolute", left: 0, top: 0, width: "50%", height: "100%", overflow: "hidden", filter: product.artBefore ? "none" : "grayscale(.85) brightness(.85)" } }, pos(100, 50, base * 1.6, b)),
        h("div", { style: { position: "absolute", left: "50%", top: 0, width: "50%", height: "100%", overflow: "hidden" } }, pos(0, 50, base * 1.6, a)),
        h("div", { style: { position: "absolute", left: "49.5%", top: 0, width: "1%", height: "100%", background: "#fff" } }),
        h("div", { class: "tag", style: { position: "absolute", left: "6%", top: "6%", fontSize: "60%" } }, "Before"), h("div", { class: "tag gold", style: { position: "absolute", right: "6%", top: "6%", fontSize: "60%" } }, "After")); break; }
    case "inuse": sc.append(pos(44, 52, base, prodArt), img("hand_open", { left: "50%", top: "44%", width: "46%", height: "auto", aspectRatio: "1" })); break;
    case "unbox": sc.append(img("parcel", { left: "26%", top: "40%", width: "50%", height: "auto", aspectRatio: "1", objectFit: "contain" }), pos(50, 40, base * 0.85, prodArt, { animation: "wiggle 2s ease-in-out infinite" }), img("hand_open", { left: "30%", top: "56%", width: "44%", height: "auto", aspectRatio: "1" })); break;
    case "talk": sc.append(img("player_bust", { left: "16%", top: "30%", width: "68%", height: "auto", aspectRatio: "1", objectFit: "contain" }), pos(78, 78, base, prodArt)); break;
    case "price": sc.append(
      h("div", { style: { position: "absolute", left: "8%", top: "7%", width: "84%", height: "36%", background: "#ffc61a", border: "0.25em solid #1c2452", borderRadius: "0.8em", display: "grid", placeItems: "center", transform: "rotate(-2deg)", boxShadow: "0 0.2em 0 rgba(0,0,0,.3)" } },
        h("span", { style: { font: "400 3.6em/1 'Lilita One',var(--lil)", color: "#1c2452" } }, "₱" + product.price)),
      pos(27, 72, 38, prodArt),
      h("div", { style: { position: "absolute", left: "50%", top: "54%", width: "44%", height: "36%", background: "#1c2452", color: "#fff", borderRadius: "0.8em", border: "0.15em solid #fff", display: "grid", placeItems: "center", textAlign: "center", font: "400 2em/1.15 'Lilita One',var(--lil)", padding: "0.2em" } },
        h("span", {}, "🛒 Tap the cart", h("br"), h("span", { style: { fontSize: ".75em", color: "#ffc61a" } }, "Link in bio")))); break;
    default: sc.append(pos(50, 50, base, prodArt));
  }
  // light
  const fx = h("div", { class: "lightfx" }), f = [];
  if (L.id === "lamp") { f.push("sepia(.4)", "saturate(1.25)", "hue-rotate(-10deg)"); fx.style.background = "radial-gradient(circle at 80% 15%,rgba(255,170,60,.45),rgba(255,140,40,.3) 60%)"; fx.style.mixBlendMode = "multiply"; }
  else if (L.id === "ceiling") { f.push(night ? "brightness(.7) contrast(.9)" : "contrast(.9) brightness(.97)"); if (night) { fx.style.backgroundImage = GRAIN; fx.style.opacity = ".55"; fx.style.mixBlendMode = "overlay"; } }
  else if (L.id === "window") { f.push("brightness(1.07)"); fx.style.background = "linear-gradient(90deg,rgba(255,255,255,.28),rgba(255,255,255,0) 60%)"; }
  else if (L.id === "ring") { f.push("brightness(1.1) contrast(1.05)"); fx.style.background = "radial-gradient(circle at 50% 42%,rgba(255,255,255,.3),rgba(255,255,255,0) 55%)"; }
  if (opts.filter === "bright") f.push("brightness(1.12)"); if (opts.filter === "vivid") f.push("saturate(1.7) hue-rotate(-14deg) contrast(1.08)");
  sc.style.filter = f.join(" ");
  sc.append(fx);
  if (product.shiny && G.id === "close" && (L.id === "ring" || L.id === "window")) sc.append(h("div", { class: "lightfx", style: { background: "linear-gradient(115deg,transparent 40%,rgba(255,255,255,.7) 46%,transparent 52%)", mixBlendMode: "screen" } }));
  return sc;
}

/* Plain facts about the shot. Never a grade. */
export function flawNotes(clip, product) {
  const A = act(clip.action), G = ang(clip.angle), L = lig(clip.light), n = [];
  if (L.shift >= 0.5) n.push("Yellow tint");
  if (L.id === "ceiling" && isNight(clip.hour)) n.push("Grainy and dim");
  else if (L.clarity < 0.9) n.push("Flat light");
  if (G.scale < 0.6) n.push("Product looks small");
  if (G.id === "close" && product.traits.includes("scale")) n.push("No sense of size");
  if (product.shiny && G.id === "close" && (L.id === "ring" || L.id === "window")) n.push("Glare on the product");
  if (A.hands === "none" && !A.player && !A.priceCard) n.push("No hands in frame");
  return n;
}
export { act as actionOf, ang as angleOf, lig as lightOf, isNight };
