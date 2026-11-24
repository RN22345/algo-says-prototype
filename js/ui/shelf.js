/* Shelf and storage panels: place items in any slot (mixed shelves), pick items for orders by hand,
   take boxes out of storage. The packing table needs the picked item (D-79, refined 2026-11-24). */
import { D, S, emit } from "../state.js";
import { $, registerWindow, registerActions } from "./windows.js";
import { slotClick, fillFromBox, pickAllHere, takeFromStorage, storeBox, handsEmpty } from "../sim/shop.js";

let cur = 0, msg = "";
const icon = p => `<img src="img/${D.PR[p].icon}.png" alt="${D.PR[p].n}">`;

function shell(id, title) {
  const el = document.createElement("div"); el.className = "ov"; el.id = "w-" + id; el.hidden = true;
  el.innerHTML = `<div class="win place t-shelf"><div class="wbar"><span class="wt">${title}</span><small id="${id}Sub"></small><span class="sp"></span><button class="x" data-act="close" type="button" aria-label="Close">✕</button></div><div class="wbody" id="${id}Body"></div></div>`;
  $("#frame").appendChild(el);
}

function handHTML() {
  const PR = D.PR, h = S.hand || [];
  const box = S.box ? `<span class="hd-box">${icon(S.box.p)} Box: ${S.box.q} ${PR[S.box.p].n}</span>` : "";
  const items = h.map(x => `<span class="hd-it">${icon(x.p)}${x.o != null ? `#${x.o}` : "loose"}</span>`).join("");
  return `<div class="hd"><span class="lbl">In your hands (${h.length}/${D.T.shop.handMax})</span>${box}${items || (box ? "" : `<span class="sub">Nothing</span>`)}</div>`;
}

function ordersHTML() {
  const PR = D.PR, list = S.orders;
  if (!list.length) return `<div class="sub">No orders waiting.</div>`;
  return `<div class="ords">${list.map(o => `<span class="ord ${o.picked ? "ok" : ""}">${icon(o.p)}#${o.id} ${PR[o.p].n}${o.picked ? " ✓" : ""}</span>`).join("")}</div>`;
}

export function renderShelf() {
  const b = $("#shelfBody"); if (!b) return;
  const s = S.shelves[cur], PR = D.PR;
  $("#shelfSub").textContent = `Shelf ${cur + 1} of ${S.shelves.length}`;
  const left = {}; S.orders.forEach(o => { if (!o.picked) left[o.p] = (left[o.p] || 0) + 1; });
  const slots = s.slots.map((p, i) => {
    const need = p && left[p] > 0; if (need) left[p]--;
    return `<button type="button" class="slotb ${p ? "full" : ""} ${need ? "need" : ""}" data-act="sh-slot" data-v="${i}" title="${p ? PR[p].n : "Empty slot"}">${p ? icon(p) + `<small>${PR[p].n}</small>` : `<small>Empty</small>`}${need ? `<i>pick</i>` : ""}</button>`;
  }).join("");
  b.innerHTML = `<div class="shelf-grid">${slots}</div>
   <div class="row">${S.box ? `<button class="cap t sm" type="button" data-act="sh-fill">Fill empty slots from the box</button>` : ""}
     ${S.orders.some(o => !o.picked && s.slots.includes(o.p)) ? `<button class="cap o sm" type="button" data-act="sh-pickall">Pick every order item here</button>` : ""}
     <button class="cap y sm" type="button" data-act="sh-prev">◀ Shelf</button><button class="cap y sm" type="button" data-act="sh-next">Shelf ▶</button></div>
   ${handHTML()}
   <div><span class="lbl">Orders</span>${ordersHTML()}</div>
   <div class="sub">${msg || "Click an item to pick it. Click an empty slot to put down what you hold. Take picked items to the packing table."}</div>`;
}

export function renderStorage() {
  const b = $("#storageBody"); if (!b) return;
  const PR = D.PR, rows = Object.keys(PR).filter(p => (S.back[p] || 0) > 0);
  b.innerHTML = (S.box ? `<div class="row"><button class="cap t sm" type="button" data-act="st-store">Put the box (${S.box.q} ${PR[S.box.p].n}) in storage</button></div>` : "") +
    (rows.length ? rows.map(p => `<div class="card prow">${icon(p)}<div><b>${PR[p].n}</b><div class="sub">${S.back[p]} in storage · ${S.stock[p]} can sell from shelves</div></div><button class="cap o sm" type="button" data-act="st-take" data-v="${p}" ${handsEmpty() ? "" : "disabled"}>Take a box (${Math.min(S.back[p], D.T.shop.boxMax)})</button></div>`).join("")
      : `<div class="sub">Storage is empty. Order stock on the PC, or buy at the warehouse or the mall.</div>`) +
    (handsEmpty() || S.box ? "" : `<div class="sub">Your hands are full.</div>`);
}

export function initShelf() {
  shell("shelf", "🗄️ Shelf"); shell("storage", "📦 Storage");
  registerWindow("shelf", { open: k => { cur = +k || 0; msg = ""; renderShelf(); } });
  registerWindow("storage", { open: renderStorage });
  registerActions({
    "sh-slot": (t, v) => { msg = slotClick(cur, +v); renderShelf(); emit("refresh"); },
    "sh-fill": () => { const n = fillFromBox(cur); msg = n ? `Put ${n} items on the shelf` : "No empty slots here"; renderShelf(); emit("refresh"); },
    "sh-pickall": () => { const n = pickAllHere(cur); msg = n ? `Picked ${n} items` : "Your hands are full"; renderShelf(); emit("refresh"); },
    "sh-prev": () => { cur = (cur + S.shelves.length - 1) % S.shelves.length; msg = ""; renderShelf(); },
    "sh-next": () => { cur = (cur + 1) % S.shelves.length; msg = ""; renderShelf(); },
    "st-store": () => { storeBox(); renderStorage(); emit("refresh"); },
    "st-take": (t, v) => { takeFromStorage(v); renderStorage(); emit("refresh"); }
  });
}
let sig = "";
export function refreshShelf() {
  if (S.ui !== "shelf" && S.ui !== "storage") return;
  const k = JSON.stringify([S.orders, S.hand, S.box, S.back, S.shelves]); if (k === sig) return; sig = k;
  if (S.ui === "shelf") renderShelf(); else renderStorage();
}
