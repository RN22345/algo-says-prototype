/* Parcel Catch: an original arcade game. Catch parcels, dodge tomatoes. Arrow keys or mouse move the basket. */
import { D, S } from "../../state.js";
import { prefs, setPref } from "../prefs.js";
import { sfx } from "../audio.js";

const W = 360, H = 480, BY = H - 70; // canvas size, basket top
const G = { state: "ready", x: W / 2, tx: W / 2, items: [], score: 0, lives: 3, t: 0, spawn: 0 };
let cv = null, g = null, raf = 0, last = 0, win = null;
const keys = {};
const C = () => D.PC.catch;

export function reset() { Object.assign(G, { state: "play", x: W / 2, tx: W / 2, items: [], score: 0, lives: C().lives, t: 0, spawn: 0.4 }); }

function hit() {
  G.lives--; sfx(150, 0.18, "sawtooth");
  if (G.lives <= 0) { G.state = "over"; if (G.score > prefs.catchHigh) setPref("catchHigh", G.score); }
}

/* One game step. Exposed for tests. */
export function update(dt) {
  if (G.state !== "play") return;
  const c = C(); G.t += dt;
  const dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (dir) { G.x += dir * c.basketSpeed * dt; G.tx = G.x; } else G.x += (G.tx - G.x) * Math.min(1, dt * 18);
  G.x = Math.max(c.basketW / 2, Math.min(W - c.basketW / 2, G.x));
  if ((G.spawn -= dt) <= 0) {
    G.spawn = Math.max(c.spawnMin, c.spawn0 - G.t * c.spawnDecay);
    G.items.push({ x: 20 + Math.random() * (W - 40), y: -20, r: Math.random() * 6, tomato: Math.random() < c.tomatoChance });
  }
  const vy = c.speed0 + G.t * c.speedGain;
  G.items.forEach(it => {
    it.y += vy * dt; it.r += dt * 3;
    if (it.y >= BY && it.y < BY + 26 && Math.abs(it.x - G.x) < c.basketW / 2 + 10) {
      it.done = true;
      if (it.tomato) hit(); else { G.score++; sfx(520 + Math.min(G.score, 24) * 25, 0.06, "triangle"); }
    } else if (it.y > H - 14) { it.done = true; if (!it.tomato) hit(); }
  });
  G.items = G.items.filter(i => !i.done);
}

function box(it) {
  g.save(); g.translate(it.x, it.y); g.rotate(Math.sin(it.r) * 0.25); g.lineWidth = 3; g.strokeStyle = "#1b2a66";
  g.fillStyle = "#d9a066"; g.beginPath(); g.roundRect(-16, -14, 32, 28, 4); g.fill(); g.stroke();
  g.fillStyle = "#fff8e8"; g.fillRect(-4, -14, 8, 28); g.restore();
}

function tomato(it) {
  g.save(); g.translate(it.x, it.y); g.lineWidth = 3; g.strokeStyle = "#1b2a66";
  g.fillStyle = "#ef3b4f"; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.stroke();
  g.fillStyle = "#3fbf6a"; g.beginPath(); g.moveTo(0, -14); g.lineTo(-9, -20); g.lineTo(-2, -10); g.lineTo(9, -20); g.closePath(); g.fill(); g.stroke(); g.restore();
}

export function draw() {
  if (!g) return;
  const bw = C().basketW, sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#dff1ff"); sky.addColorStop(1, "#fff4b8");
  g.fillStyle = sky; g.fillRect(0, 0, W, H); g.fillStyle = "#2cc8b6"; g.fillRect(0, H - 14, W, 14);
  G.items.forEach(it => it.tomato ? tomato(it) : box(it));
  g.lineWidth = 3; g.strokeStyle = "#1b2a66"; g.fillStyle = "#ff8a2a"; g.beginPath(); g.moveTo(G.x - bw / 2, BY); g.lineTo(G.x + bw / 2, BY); g.lineTo(G.x + bw / 2 - 10, BY + 36); g.lineTo(G.x - bw / 2 + 10, BY + 36); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#1b2a66"; g.font = "700 20px Fredoka, system-ui, sans-serif"; g.textAlign = "left"; g.fillText(`Score ${G.score}`, 10, 26);
  g.textAlign = "right"; g.fillText(`Best ${prefs.catchHigh}`, W - 10, 26); g.fillText("♥".repeat(Math.max(0, G.lives)), W - 10, 50);
  if (G.state !== "play") {
    g.fillStyle = "rgba(27,42,102,.72)"; g.fillRect(0, 150, W, 150); g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 30px Fredoka, system-ui, sans-serif";
    g.fillText(G.state === "over" ? "Game over" : "Parcel Catch", W / 2, 205);
    g.font = "700 16px Nunito, system-ui, sans-serif"; g.fillText(G.state === "over" ? `You caught ${G.score} parcels` : "Catch parcels. Dodge tomatoes.", W / 2, 232);
    g.fillText(G.state === "over" ? "Click or press Space to retry" : "Click or press Space to start", W / 2, 256);
    if (G.state === "ready") g.fillText("Arrow keys or mouse move the basket", W / 2, 280);
  }
}

function loop(now) {
  if (!cv) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.ui === "desktop" && win.isTop()) update(dt);
  draw(); raf = requestAnimationFrame(loop);
}

const onKey = (e, down) => {
  if (!cv || !win.isTop() || e.target.matches?.("input,textarea")) return;
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key)) { keys[e.key] = down; e.preventDefault(); }
  if (down && (e.key === " " || e.key === "Enter") && G.state !== "play") { reset(); e.preventDefault(); }
};
const kd = e => onKey(e, true), ku = e => onKey(e, false);

export default {
  id: "catch", title: "Parcel Catch", icon: "📦", color: "p", cat: "games", w: 36, h: 88,
  api: { G, update, draw, reset, keys },
  mount(el, w) {
    win = w; w.setTitle("Parcel Catch", "Break time"); el.className = "dw-body pc-game";
    el.innerHTML = `<canvas width="${W}" height="${H}" tabindex="0" aria-label="Parcel Catch game"></canvas>`;
    cv = el.firstChild; g = cv.getContext("2d"); G.state = "ready"; G.items = []; G.score = 0; G.lives = C().lives; G.x = G.tx = W / 2;
    cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); G.tx = (e.clientX - r.left) / r.width * W; });
    cv.addEventListener("click", () => { if (G.state !== "play") reset(); });
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
    last = performance.now(); raf = requestAnimationFrame(loop); draw();
  },
  unmount() { cancelAnimationFrame(raf); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); cv = g = null; Object.keys(keys).forEach(k => delete keys[k]); }
};
