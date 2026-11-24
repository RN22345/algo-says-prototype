/* Paint app: doodle, then save up to 3 stickers. TikTik Studio offers them on the cover. */
import { D, S } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { saveGame } from "../../save.js";

const COLORS = ["#1b2a66", "#9446e0", "#2cc8b6", "#ffc928", "#ff8a2a", "#ef3b4f", "#3fbf6a", "#ffffff"];
const SIZES = [["S", 4], ["M", 10], ["L", 20]];
let root = null, cv = null, g = null, color = COLORS[0], size = 1, erase = false, draft = null, msg = "";

function sync() {
  if (!root) return;
  root.querySelectorAll("[data-pc]").forEach(b => {
    const k = b.dataset.pc, v = b.dataset.v;
    b.setAttribute("aria-pressed", String(k === "color" ? !erase && color === v : k === "size" ? +v === size : erase));
  });
  root.querySelector(".pt-stk").innerHTML = S.stickers.length ? S.stickers.map((u, i) => `<span class="pt-thumb"><img src="${u}" alt="Sticker ${i + 1}"><button type="button" class="x" data-act="pt-del" data-v="${i}" aria-label="Delete sticker ${i + 1}">✕</button></span>`).join("") : `<small>No stickers yet.</small>`;
  root.querySelector(".pt-msg").textContent = msg;
  root.querySelector("[data-act=pt-save]").disabled = S.stickers.length >= D.PC.stickerMax;
}

const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };

function stroke(a, b) {
  g.globalCompositeOperation = erase ? "destination-out" : "source-over";
  g.strokeStyle = erase ? "#000" : color; g.fillStyle = g.strokeStyle; g.lineWidth = SIZES[size][1]; g.lineCap = g.lineJoin = "round";
  g.beginPath(); g.moveTo(...a); g.lineTo(b[0] + 0.01, b[1]); g.stroke();
}

function empty() { const d = g.getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; }

registerActions({
  "pt-color": (t, v) => { color = v; erase = false; sync(); },
  "pt-size": (t, v) => { size = +v; sync(); },
  "pt-erase": () => { erase = !erase; sync(); },
  "pt-clear": () => { g.clearRect(0, 0, cv.width, cv.height); msg = ""; sync(); },
  "pt-del": (t, v) => { S.stickers.splice(+v, 1); msg = "Sticker deleted."; saveGame(); sync(); },
  "pt-save": () => {
    if (S.stickers.length >= D.PC.stickerMax) { msg = "All 3 sticker slots are full. Delete one first."; return sync(); }
    if (empty()) { msg = "Draw something first."; return sync(); }
    const t = document.createElement("canvas"); t.width = t.height = 96; t.getContext("2d").drawImage(cv, 0, 0, 96, 96);
    S.stickers.push(t.toDataURL("image/png")); msg = `Saved as sticker ${S.stickers.length}. Find it in TikTik Studio under Sticker.`; saveGame(); sync();
  }
});

export default {
  id: "paint", title: "Paint", icon: "🎨", color: "r", w: 56, h: 82,
  mount(el, win) {
    root = el; win.setTitle("Paint", "Draw a sticker"); el.className = "dw-body pt";
    el.innerHTML = `<div class="pt-tools">
      <div class="pt-row">${COLORS.map(c => `<button type="button" class="pt-sw" data-act="pt-color" data-pc="color" data-v="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")}</div>
      <div class="pt-row">${SIZES.map(([n, px], i) => `<button type="button" class="chip" data-act="pt-size" data-pc="size" data-v="${i}">${n}</button>`).join("")}
        <button type="button" class="chip" data-act="pt-erase" data-pc="erase">Eraser</button>
        <button type="button" class="cap r sm" data-act="pt-clear">Clear</button></div></div>
      <div class="pt-canvas"><canvas width="300" height="300" aria-label="Drawing area"></canvas></div>
      <div class="pt-foot"><button type="button" class="cap p sm" data-act="pt-save">Save as sticker</button><div class="pt-stk"></div><div class="pt-msg" aria-live="polite"></div></div>`;
    cv = el.querySelector("canvas"); g = cv.getContext("2d");
    if (draft) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0); im.src = draft; }
    let last = null;
    cv.addEventListener("pointerdown", e => { last = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } stroke(last, last); });
    cv.addEventListener("pointermove", e => { if (!last) return; const p = pos(e); stroke(last, p); last = p; });
    ["pointerup", "pointercancel"].forEach(n => cv.addEventListener(n, () => { last = null; }));
    msg = ""; sync();
  },
  unmount() { if (cv) draft = cv.toDataURL(); root = cv = g = null; }
};
