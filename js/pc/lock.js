/* Lock screen for apps that arrive in a later build. Shows which Seller Rank unlocks the app. */
import { D, S } from "../state.js";
import { setHTML } from "./util.js";

export function lockedApp(id, title, icon, color) {
  let root = null;
  const render = () => {
    if (!root) return;
    const L = D.PC.locks[id], have = S.rank >= L.rank;
    setHTML(root, `<div class="lk-screen"><div class="lk-ic">${have ? "⏳" : "🔒"}</div><h2>${title}</h2><p>${L.blurb}</p>
      ${have ? `<div class="card lk-pill">You have Seller Rank ${S.rank}, but this app arrives in a later build.</div>`
             : `<div class="card lk-pill">Unlocks at <b>Seller Rank ${L.rank}</b>. You are Rank ${S.rank}.</div><small>Finish missions and ship orders to rank up.</small>`}</div>`);
  };
  return {
    id, title, icon, color, w: 38, h: 56,
    get rank() { return D.PC.locks[id].rank; },
    mount(el, win) { root = el; el.className = "dw-body"; win.setTitle(title, "Locked"); render(); },
    refresh: render,
    unmount() { root = null; }
  };
}
