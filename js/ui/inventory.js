/* INVENTORY (D-108, D-89). An always-on bar at the bottom centre: what you hold (picked orders with numbers), the stock box (units in boxes on the floor),
   and parcels (orders to pack, parcels ready for the courier). Click it or press I (or the Parcel button) to open the bag.
   Bag tabs: Orders, Stock (shelves, boxes, door, on the way), Furniture (unplaced pieces, Place), Gear (owned equipment).
   Events in: bag:toggle, bag:open {tab}, stock:changed, order:*, gear:changed, furniture:bought, newgame. Events out: layout:place {id}. */
import { D } from "../core/data.js";
import { S, fmtMoney } from "../core/state.js";
import { fmtDay } from "../core/clock.js";
import { on, emit } from "../core/bus.js";
import { h, btn, art, clear, modal, vimg } from "./ui.js";
import { unplaced, furnDef } from "./pc/helpers.js";

const TABS = [["orders", "Orders"], ["stock", "Stock"], ["furn", "Furniture"], ["gear", "Gear"]];
const OLAB = { toPack: ["Needs packing", "orange"], picked: ["Picked", "orange"], packed: ["Waiting for courier", "blue"], shipped: ["On the way", "teal"], paid: ["Paid", "green"], cancelled: ["Cancelled", "grey"], new: ["New", "blue"] };
let bar = null, win = null, body = null, tabsEl = null, tab = "orders";

export function initInventory() {
  bar = h("div", { class: "invbar", role: "button", title: "Open the bag (I)", onClick: () => toggle(true) });
  document.getElementById("hud").append(bar);
  const refresh = () => { drawBar(); if (win) drawBag(); };
  for (const ev of ["stock:changed", "order:new", "order:packed", "order:shipped", "order:paid", "order:cancelled", "gear:changed", "furniture:bought", "layout:changed", "newgame", "sample:taken"]) on(ev, refresh);
  on("bag:toggle", () => toggle());
  on("bag:open", ({ tab: t } = {}) => { if (t) tab = t; toggle(true); });
  window.addEventListener("keydown", e => {
    if (e.key !== "i" && e.key !== "I") return;
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || !S.started || document.getElementById("title").children.length) return;
    if (win) { toggle(false); return; }
    if (document.querySelectorAll("#modals .modal-back, #pc .modal-back").length) return;
    toggle(true);
  });
  drawBar();
}

function drawBar() {
  if (!bar) return;
  clear(bar);
  const picked = S.orders.filter(o => o.status === "picked"), toPack = S.orders.filter(o => o.status === "toPack").length, packed = S.orders.filter(o => o.status === "packed").length;
  const boxes = Object.values(S.boxes).reduce((a, b) => a + b, 0);
  const slot = (cls, ic, label, val, kids) => h("div", { class: "is " + cls }, vimg(ic[0], ic[1], "ii"), h("div", { class: "it" }, h("small", {}, label), kids || h("b", {}, val)));
  bar.append(
    slot("hand" + (picked.length ? " on" : ""), ["it_box", "✋"], "In hand", "Hands free", picked.length ? h("div", { class: "nos" }, ...picked.slice(0, 3).map(o => h("span", { class: "no" }, "#" + o.no)), picked.length > 3 ? h("span", { class: "no" }, "+" + (picked.length - 3)) : null) : null),
    slot("box" + (boxes ? " on" : ""), ["it_box", "📦"], "Stock box", boxes ? boxes + (boxes === 1 ? " unit" : " units") : "Empty"),
    slot("parcel" + (toPack + packed ? " on" : ""), ["it_parcel", "📮"], "Parcels", toPack + packed ? `${packed} ready` + (toPack ? `, ${toPack} to pack` : "") : "None"));
}

/* ---------- the bag ---------- */
function toggle(force) {
  const want = force === undefined ? !win : force;
  if (want && !win) {
    tabsEl = h("div", { class: "bagtabs" }); body = h("div", { class: "bagbody" });
    win = modal({ title: "🎒 Bag", cls: "bagwin", body: [tabsEl, body], onClose: () => { win = null; } });
    drawBag();
  } else if (!want && win) win.close();
}
function drawBag() {
  clear(tabsEl); clear(body);
  const fu = unplaced().length;
  for (const [id, label] of TABS) tabsEl.append(h("button", { class: "chip" + (tab === id ? " sel" : ""), type: "button", onClick: () => { tab = id; drawBag(); } }, label, id === "furn" && fu ? h("span", { class: "tag", style: { marginLeft: ".3em" } }, fu) : null));
  ({ orders, stock, furn, gear })[tab]();
}
const row = (...kids) => h("div", { class: "ordrow" }, ...kids);

function orders() {
  const os = S.orders.slice().reverse().slice(0, 40);
  if (!os.length) { body.append(h("div", { class: "panel" }, "No orders yet.")); return; }
  for (const o of os) {
    const [lab, col] = OLAB[o.status] || [o.status, "grey"];
    body.append(row(art(D.P[o.pid].icon), h("div", { class: "grow" }, h("b", { class: "lil" }, `Order #${o.no}`), h("div", { class: "small mute" }, D.P[o.pid].name + " · " + (o.mode === "affiliate" ? "Commission " + fmtMoney(o.comm) : fmtMoney(o.price)))), h("span", { class: "tag " + col }, lab)));
  }
}
function stock() {
  const rows = D.products.map(p => {
    const shelf = S.shelves.reduce((a, sh) => a + sh.filter(x => x === p.id).length, 0), box = S.boxes[p.id] || 0;
    const door = S.doorBoxes.reduce((a, b) => a + (b.items[p.id] || 0), 0) + S.doorSamples.filter(x => x === p.id).length;
    const ds = S.deliveries.filter(d => d.items[p.id]);
    return { p, shelf, box, door, way: ds.reduce((a, d) => a + d.items[p.id], 0), eta: ds.length ? Math.min(...ds.map(d => d.at)) : null, sample: !!S.samples[p.id] };
  }).filter(r => r.shelf + r.box + r.door + r.way + (r.sample ? 1 : 0) > 0);
  if (!rows.length) { body.append(h("div", { class: "panel" }, "You have no stock and no samples yet.")); return; }
  const cell = (n, txt) => h("div", { class: "sc" + (n ? "" : " zero") }, txt ?? String(n));
  body.append(h("div", { class: "stockgrid" },
    ...["Product", "On shelves", "In boxes", "At the door", "On the way"].map(t => h("div", { class: "sh" }, t)),
    ...rows.flatMap(r => [h("div", { class: "sp" }, art(r.p.icon), h("b", {}, r.p.name), r.sample ? h("span", { class: "tag teal" }, "sample") : null), cell(r.shelf), cell(r.box), cell(r.door), cell(r.way, r.way ? `${r.way}, ${fmtDay(r.eta)}` : "0")])));
}
function furn() {
  const list = unplaced();
  if (!list.length) { body.append(h("div", { class: "panel" }, "No furniture waiting. Buy pieces in the Tool Shop on the desk PC.")); return; }
  for (const f of list) {
    const d = furnDef(f.id);
    body.append(row(vimg([d.sprite, "fn_" + f.id, f.id], d.emoji || "🪑", "ii"), h("div", { class: "grow" }, h("b", { class: "lil" }, d.name || f.id), h("div", { class: "small mute" }, f.n > 1 ? `${f.n} waiting` : "Waiting to be placed")),
      btn("Place", "b-gold sm", () => { win.close(); emit("layout:place", { id: f.id }); })));
  }
}
function gear() {
  body.append(h("div", { class: "grid g3" }, D.gear.map(g => {
    const own = !!S.gear[g.id];
    return h("div", { class: "tile" + (own ? "" : " locked") }, art(g.art), h("b", {}, g.name), h("div", { class: "sub" }, g.does), own ? h("span", { class: "tag green" }, "Owned") : h("span", { class: "tag grey" }, "Not owned"));
  })));
}
