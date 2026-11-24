/* HUD, toasts, milestone note, and the top-right menu (New game with in-page confirm). */
import { S, D, on } from "../state.js";
import { peso } from "./format.js";
import { $, registerActions, registerWindow, openUI, closeUI } from "./windows.js";
import { newGame } from "../save.js";
import { recentMissed } from "../sim/shop.js";

export function toast(msg, img) {
  const t = document.createElement("div"); t.className = "card toast";
  t.innerHTML = (img ? `<img src="${img}" alt="">` : "") + `<span>${msg}</span>`;
  const box = $("#toasts"); box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), 4200);
}

/* Missed sales: the total, plus what was missed in the last 2 minutes by product. */
function missedPill() {
  if (!S.missed) return "";
  const r = Object.entries(recentMissed(120)), PR = D.PR;
  const recent = r.length ? ` · last 2 min: ${r.map(([p, n]) => `${PR[p].n} ${n}`).join(", ")}` : "";
  return `<span class="pill plain miss${r.length ? " hot" : ""}" title="Buyers wanted these, but the shelf was empty">⚠ Missed sales ${S.missed}${recent}</span>`;
}

export function renderHud() {
  const M = D.T.milestone;
  $("#hud").innerHTML = `<span class="pill"><img src="img/icon_hud_cash.png" alt="">${peso(S.cash)}</span>
   <span class="pill"><img src="img/icon_hud_seller_rank.png" alt="">Rank ${S.rank}</span>
   <span class="pill"><img src="img/icon_hud_trust.png" alt="">${S.rating.toFixed(1)}</span>
   <span class="pill plain">📦 ${S.orders.filter(o => !o.picked).length} to pick · ${S.orders.length} to pack</span>
   ${S.running.length ? `<span class="pill plain">● ${S.running.length} post${S.running.length > 1 ? "s" : ""} running</span>` : ""}
   ${missedPill()}`;
  const ck = (b, t) => `<span>${b ? "✅" : "⬜"} ${t}</span>`;
  $("#note").innerHTML = `<h3>${S.milestoneDone ? "Milestone 1 done" : "Launch the shop"}</h3><div>${ck(S.stocked, "Restock a product")}${ck(S.posted, "Post a video")}${ck(S.shipped >= M.ship, `Ship ${M.ship} orders (${Math.min(M.ship, S.shipped)}/${M.ship})`)}${ck(S.replies >= M.replies, `Answer ${M.replies} buyers (${Math.min(M.replies, S.replies)}/${M.replies})`)}</div>`;
  const open = S.chats.filter(c => !c.done).length; $("#pbadge").hidden = !open; $("#pbadge").textContent = open;
}

export function initHud() {
  on("toast", toast);
  registerWindow("confirm", { open: () => { const b = $("#w-confirm [data-act=new-cancel]"); if (b) b.focus(); } });
  registerActions({
    "menu-new": () => openUI("confirm"),
    "new-cancel": () => closeUI(),
    "new-confirm": () => { closeUI(); newGame(); }
  });
}
