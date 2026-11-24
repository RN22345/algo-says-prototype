/* HUD, toasts, milestone note, and the top-right menu (New game with in-page confirm). */
import { S, D, on } from "../state.js";
import { peso } from "./format.js";
import { $, registerActions, registerWindow, openUI, closeUI } from "./windows.js";
import { newGame } from "../save.js";

export function toast(msg, img) {
  const t = document.createElement("div"); t.className = "card toast";
  t.innerHTML = (img ? `<img src="${img}" alt="">` : "") + `<span>${msg}</span>`;
  const box = $("#toasts"); box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), 4200);
}

export function renderHud() {
  const M = D.T.milestone;
  $("#hud").innerHTML = `<span class="pill"><img src="img/icon_hud_cash.png" alt="">${peso(S.cash)}</span>
   <span class="pill"><img src="img/icon_hud_seller_rank.png" alt="">Rank ${S.rank}</span>
   <span class="pill"><img src="img/icon_hud_trust.png" alt="">${S.rating.toFixed(1)}</span>
   <span class="pill plain">📦 ${S.orders.length} to pack</span>
   ${S.missed ? `<span class="pill plain" style="color:var(--red)">Missed sales ${S.missed}</span>` : ""}`;
  $("#carry").innerHTML = S.box ? `<span class="pill plain">Carrying: ${S.box.q} ${D.PR[S.box.p].n}</span>` : S.carry.length ? `<span class="pill plain">Carrying: ${S.carry.map(o => "#" + o.id).join(", ")}</span>` : "";
  const ck = (b, t) => `<span>${b ? "✅" : "⬜"} ${t}</span>`;
  $("#note").innerHTML = `<h3>${S.milestoneDone ? "Milestone 1 done" : "Launch the shop"}</h3><div>${ck(S.stocked, "Restock a product")}${ck(S.posted, "Post on TikTik")}${ck(S.shipped >= M.ship, `Ship ${M.ship} orders (${Math.min(M.ship, S.shipped)}/${M.ship})`)}${ck(S.replies >= M.replies, `Answer ${M.replies} buyers (${Math.min(M.replies, S.replies)}/${M.replies})`)}</div>`;
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
