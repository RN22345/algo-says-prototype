/* Places on the street: Plaza Mall (gadgets and retail stock), Bodega Supply (walk-in wholesale), courier drop-off.
   Stock bought in person is a box the player carries home (in the world, FOUNDATION §2). */
import { D, S, toast, emit } from "../state.js";
import { peso } from "./format.js";
import { $, registerWindow, registerActions } from "./windows.js";
import { record } from "../sim/ledger.js";
import { has, buyGear } from "../sim/gear.js";
import { costMult } from "../sim/trends.js";

const handsFree = () => !S.box && !S.carry.length && !(S.hand || []).length;
const cost = (p, place) => Math.round(D.PR[p].cost * D.T[place].mult * D.T[place].qty * costMult(p));
let mallTab = "gadgets";

function shell(id, title, sub, cls) {
  const el = document.createElement("div");
  el.className = "ov"; el.id = "w-" + id; el.hidden = true;
  el.innerHTML = `<div class="win place ${cls}"><div class="wbar"><span class="wt">${title}</span><small>${sub}</small><span class="sp"></span><button class="x" data-act="close" type="button" aria-label="Close">✕</button></div><div class="wbody" id="${id}Body"></div></div>`;
  $("#frame").appendChild(el);
}

function stockRows(place) {
  const q = D.T[place].qty;
  const note = handsFree() ? `You carry a box of ${q} home. Put it on a shelf or in storage.` : "Your hands are full. Put down what you carry first.";
  return `<div class="lbl">${note}</div>` + Object.entries(D.PR).map(([k, v]) => {
    const c = cost(k, place);
    return `<div class="card prow"><img src="img/${v.icon}.png" alt=""><div><b>${v.n}</b><div class="sub">Shelf ${S.stock[k]} · storage ${S.back[k] || 0} · you sell at ${peso(v.price)}</div></div>
      <button class="cap o sm" type="button" data-act="pl-buy" data-v="${k}" data-place="${place}" ${S.cash < c || !handsFree() ? "disabled" : ""}>Buy ${q} · ${peso(c)}</button></div>`;
  }).join("");
}

function gearRows() {
  return `<div class="lbl">Equipment opens new things to do. It never makes a post better by itself.</div>` + Object.entries(D.GEAR).filter(([, g]) => !g.owned).map(([k, g]) => `<div class="card prow"><span class="gi">${g.icon}</span><div><b>${g.n}</b><div class="sub">${g.does}</div></div>
    ${has(k) ? `<span class="owned">Owned</span>` : `<button class="cap p sm" type="button" data-act="pl-gear" data-v="${k}" ${S.cash < g.price ? "disabled" : ""}>Buy · ${peso(g.price)}</button>`}</div>`).join("");
}

function renderMall() {
  const b = $("#mallBody"); if (!b) return;
  b.innerHTML = `<div class="tabs"><button class="chip ${mallTab === "gadgets" ? "on" : ""}" type="button" data-act="pl-tab" data-v="gadgets">Gadget store</button><button class="chip ${mallTab === "dept" ? "on" : ""}" type="button" data-act="pl-tab" data-v="dept">Department store</button></div>` +
    (mallTab === "gadgets" ? gearRows() : stockRows("mall"));
}
function renderWarehouse() { const b = $("#warehouseBody"); if (b) b.innerHTML = stockRows("warehouse"); }

function buy(p, place) {
  const c = cost(p, place), q = D.T[place].qty;
  if (S.cash < c || !handsFree()) return;
  S.cash -= c; record("out", c, { p, qty: q, place }); S.box = { p, q }; emit("sfx", "buy");
  toast(`Bought ${q} ${D.PR[p].n} for ${peso(c)}. Carry the box home.`);
  emit("refresh");
}

/* Hand every carried parcel to the courier. Their riders are cancelled. */
export function courierDrop() {
  const PR = D.PR, T = D.T.shop, n = S.carry.length;
  S.carry.forEach(o => {
    S.cash += PR[o.p].price; record("in", PR[o.p].price, { p: o.p, order: o.id, via: "courier" }); S.shipped++;
    S.rating = Math.min(T.ratingMax, S.rating + T.ratingGainShip);
    S.riders.forEach(r => { if (r.id === o.id) r.state = "leaving"; });
  });
  S.carry = []; emit("sfx", "cash");
  toast(`Dropped ${n} parcel${n > 1 ? "s" : ""} at the courier. Paid on delivery.`);
  emit("refresh");
}

export function initPlaces() {
  shell("mall", "🛍️ Plaza Mall", "Gadgets, and stock at retail price", "t-mall");
  shell("warehouse", "🏭 Bodega Supply", "Walk-in wholesale. No waiting, but you carry it", "t-ware");
  registerWindow("mall", { open: renderMall });
  registerWindow("warehouse", { open: renderWarehouse });
  registerActions({
    "pl-tab": (t, v) => { mallTab = v; renderMall(); },
    "pl-buy": (t, v) => { buy(v, t.dataset.place); renderMall(); renderWarehouse(); },
    "pl-gear": (t, v) => { if (buyGear(v)) { renderMall(); emit("refresh"); } }
  });
}

let lastSig = "";
export function refreshPlaces() {
  if (S.ui !== "mall" && S.ui !== "warehouse") return;
  const sig = S.cash + "|" + !!S.box + "|" + S.carry.length + "|" + JSON.stringify(S.gear);
  if (sig === lastSig) return; lastSig = sig;
  if (S.ui === "mall") renderMall(); else renderWarehouse();
}
