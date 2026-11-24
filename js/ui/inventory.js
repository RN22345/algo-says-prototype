/* Inventory: a hotbar that is always on screen (hands, box, parcels) and a bag window (key I) with the full picture:
   what you hold, parcels, orders, and where every item of stock is. Nothing here changes results. It only shows state. */
import { D, S, emit } from "../state.js";
import { $, registerWindow, registerActions, openUI } from "./windows.js";
import { putBack, inShelfZone, shelfCount } from "../sim/shop.js";

let msg = "";
const PR = () => D.PR;
const icon = p => `<img src="img/${D.PR[p].icon}.png" alt="">`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Plain-words description of one held thing. Used for hover titles and the bag window. */
function handNote(h) {
  const n = PR()[h.p].n;
  return h.o != null ? `${n} for order #${h.o}. Take it to the packing table.` : `${n}, loose. Put it on a shelf.`;
}
const boxNote = b => `Box of ${b.q} ${PR()[b.p].n}. Put it on a shelf or in storage.`;
function riderNote(id) {
  const r = S.riders.find(x => x.id === id && x.state !== "leaving");
  return !r ? "Its rider is not here yet." : r.state === "waiting" ? "Its rider is waiting at the street." : "Its rider is on the way.";
}
const parcelNote = k => `Parcel for order #${k.id} (${PR()[k.p].n}). Hand it to its rider at the street. ${riderNote(k.id)}`;

/* ---------- hotbar ---------- */
const slot = (cls, inner, title) => `<span class="ib-slot ${cls}" title="${esc(title)}">${inner}</span>`;

function hotbarHTML() {
  const T = D.T.shop, hand = S.hand || [];
  const hands = Array.from({ length: T.handMax }, (_, i) => {
    const h = hand[i];
    return h ? slot("full", `${icon(h.p)}<i class="ib-tag">${h.o != null ? "#" + h.o : "move"}</i>`, handNote(h)) : slot("", "", "Empty hand slot");
  }).join("");
  const box = S.box ? slot("full box", `${icon(S.box.p)}<i class="ib-tag">×${S.box.q}</i>`, boxNote(S.box)) : slot("", "", "No box. Pick up a delivery, or take one from storage.");
  const parcels = Array.from({ length: T.carryMax }, (_, i) => {
    const k = S.carry[i];
    return k ? slot("full parcel", `<b class="ib-pk">📦</b><i class="ib-tag">#${k.id}</i>`, parcelNote(k)) : slot("", "", "No parcel. Pack an order to make one.");
  }).join("");
  return `<span class="ib-grp"><span class="ib-lbl">Hands</span><span class="ib-row">${hands}</span></span>` +
    `<span class="ib-grp"><span class="ib-lbl">Box</span><span class="ib-row">${box}</span></span>` +
    `<span class="ib-grp"><span class="ib-lbl">Parcels</span><span class="ib-row">${parcels}</span></span>` +
    `<span class="ib-key" aria-hidden="true"><kbd class="k">I</kbd></span>`;
}

let hbSig = "";
export function refreshHotbar() {
  const el = $("#hotbar"); if (!el) return;
  const sig = JSON.stringify([S.hand, S.box, S.carry, S.riders.map(r => [r.id, r.state === "waiting"])]);
  if (sig === hbSig) return; hbSig = sig;
  el.innerHTML = hotbarHTML();
}

/* ---------- bag window ---------- */
const bigItem = (inner, note, extra = "") => `<div class="iv-it"><div class="iv-ic">${inner}</div><div class="iv-tx">${note}</div>${extra}</div>`;

function handsSection() {
  const hand = S.hand || [], here = inShelfZone();
  const rows = hand.map((h, i) => {
    const btn = `<button type="button" class="cap o sm" data-act="inv-put" data-v="${i}" ${here ? "" : "disabled"}>Put back</button>`;
    return bigItem(`${icon(h.p)}<i class="ib-tag">${h.o != null ? "#" + h.o : "move"}</i>`, `<b>${esc(PR()[h.p].n)}</b><small>${h.o != null ? `Picked for order #${h.o}. Take it to the packing table.` : "Loose. Put it on a shelf."}</small>`, btn);
  }).join("");
  return `<section><h3>In your hands <span class="iv-n">${hand.length}/${D.T.shop.handMax}</span></h3>${rows || `<div class="iv-none">Nothing in your hands.</div>`}
    ${hand.length && !here ? `<div class="iv-note">Stand at a shelf to put items back.</div>` : ""}${msg ? `<div class="iv-msg">${esc(msg)}</div>` : ""}</section>`;
}

function boxSection() {
  const b = S.box;
  return `<section><h3>Box</h3>${b ? bigItem(`${icon(b.p)}<i class="ib-tag">×${b.q}</i>`, `<b>${b.q} ${esc(PR()[b.p].n)}</b><small>Put it on a shelf or in storage.</small>`) : `<div class="iv-none">No box.</div>`}</section>`;
}

function parcelSection() {
  const T = D.T.shop;
  const rows = S.carry.map(k => bigItem(`<b class="ib-pk">📦</b><i class="ib-tag">#${k.id}</i>`, `<b>Order #${k.id}: ${esc(PR()[k.p].n)}</b><small>${riderNote(k.id)}</small>`)).join("");
  const tab = S.table.map(k => bigItem(`<b class="ib-pk dim">📦</b><i class="ib-tag">#${k.id}</i>`, `<b>Order #${k.id}: ${esc(PR()[k.p].n)}</b><small>On the packing table. Press E there to pick it up. ${riderNote(k.id)}</small>`)).join("");
  return `<section><h3>Parcels <span class="iv-n">${S.carry.length}/${T.carryMax}</span></h3>${rows || `<div class="iv-none">No parcels in your hands.</div>`}${tab ? `<div class="iv-sub">On the packing table</div>${tab}` : ""}</section>`;
}

function ordersSection() {
  const pick = S.orders.filter(o => !o.picked), done = S.orders.filter(o => o.picked);
  const line = (o, ok) => `<span class="iv-ord ${ok ? "ok" : ""}">${icon(o.p)}<span>#${o.id} ${esc(PR()[o.p].n)}${ok ? " ✓" : ""}</span></span>`;
  return `<section><h3>Orders <span class="iv-n">${S.orders.length}</span></h3>
    <div class="iv-sub">To pick from a shelf (${pick.length})</div><div class="iv-ords">${pick.map(o => line(o, false)).join("") || `<span class="iv-none">None.</span>`}</div>
    <div class="iv-sub">Picked, to pack at the table (${done.length})</div><div class="iv-ords">${done.map(o => line(o, true)).join("") || `<span class="iv-none">None.</span>`}</div></section>`;
}

function stockSection() {
  const rows = Object.keys(PR()).map(p => {
    const reserved = S.orders.filter(o => o.p === p && !o.picked).length;
    const way = S.deliveries.filter(d => d.p === p).reduce((a, d) => a + d.q, 0) + S.yard.filter(b => b.p === p).reduce((a, b) => a + b.q, 0);
    const hands = (S.hand || []).filter(h => h.p === p).length + (S.box && S.box.p === p ? S.box.q : 0);
    return { p, shelf: shelfCount(p), back: S.back[p] || 0, way, hands, reserved, sell: S.stock[p] || 0 };
  }).filter(r => r.shelf || r.back || r.way || r.hands || r.reserved || r.sell);
  const body = rows.map(r => `<tr><td class="l">${icon(r.p)}${esc(PR()[r.p].n)}</td><td>${r.shelf}</td><td>${r.back}</td><td>${r.hands}</td><td>${r.way}</td><td>${r.reserved}</td><td class="sell">${r.sell}</td></tr>`).join("");
  return `<section class="wide"><h3>Stock overview</h3>${rows.length ? `<table class="iv-tbl"><thead><tr><th class="l">Product</th><th>Shelves</th><th>Storage</th><th>In hands</th><th>On the way</th><th>Reserved</th><th>Can sell</th></tr></thead><tbody>${body}</tbody></table>` : `<div class="iv-none">You have no stock. Order some on the PC.</div>`}
    <div class="iv-note">Only shelf stock sells. Can sell = on shelves + loose items in hand - reserved by orders.</div></section>`;
}

export function renderInv() {
  const b = $("#invBody"); if (!b) return;
  const sc = b.scrollTop;
  b.innerHTML = `<div class="iv-grid">${handsSection()}${parcelSection()}${boxSection()}${ordersSection()}${stockSection()}</div>`;
  b.scrollTop = sc;
}

let invSig = "";
export function refreshInv() {
  if (S.ui !== "inv") return;
  const sig = JSON.stringify([S.orders, S.hand, S.box, S.carry, S.table, S.back, S.shelves, S.deliveries.map(d => [d.p, d.q]), S.yard.map(y => [y.p, y.q]), S.riders.map(r => [r.id, r.state]), inShelfZone(), msg]);
  if (sig === invSig) return; invSig = sig;
  renderInv();
}

export function initInventory() {
  const el = document.createElement("div"); el.className = "ov"; el.id = "w-inv"; el.hidden = true;
  el.innerHTML = `<div class="win inv"><div class="wbar t"><span class="wt">🎒 Your bag</span><small>Press I or Esc to close</small><span class="sp"></span><button class="x" data-act="close" type="button" aria-label="Close">✕</button></div><div class="wbody iv-body" id="invBody"></div></div>`;
  $("#frame").appendChild(el);
  registerWindow("inv", { open: () => { msg = ""; invSig = ""; renderInv(); }, close: () => { msg = ""; } });
  registerActions({
    "inv-open": () => { if (!S.ui) openUI("inv"); },
    "inv-put": (t, v) => { msg = putBack(+v); invSig = ""; renderInv(); emit("refresh"); }
  });
  hbSig = ""; refreshHotbar();
}
