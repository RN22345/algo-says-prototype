/* Shop loop: orders, packing, riders, deliveries, chats, and what the player can do where they stand. */
import { D, S, pl, toast, emit } from "../state.js";
import { world, inR } from "../world.js";
import { peso } from "../ui/format.js";
import { record } from "./ledger.js";
import { packSpeed } from "./gear.js";
import { costMult } from "./trends.js";

/* Which of the 4 shelves the player stands in front of. */
export function nearestShelf() {
  const z = world.shelfZone, n = S.shelves.length;
  return Math.max(0, Math.min(n - 1, Math.floor((pl.x - z[0]) / ((z[2] - z[0]) / n))));
}

const R = Math.random;

export const AV = n => `img/chat_avatar_0${(n % 6) + 1}.png`;

export function freeSlot() {
  const used = S.riders.filter(r => r.state !== "leaving").map(r => r.slot);
  return D.MAP.riderSlots.findIndex((_, i) => !used.includes(i));
}

export function bookRider(id, delay) {
  const st = D.MAP.street, pat = D.T.shop.riderPatience;
  S.riders.push({ id, state: "queued", delay, x: st.riderX, y: st.riderStartY, slot: -1, pat, max: pat, walk: 0 });
}

/* ---------- shelves, storage, hands ----------
   S.shelves: [{slots: [product id or null] x 6}]. Any product can go in any slot (mixed shelves).
   S.back: backstock in the stockroom crates (whole boxes). S.hand: items the player holds [{p, o}], where o is
   the order the item was picked for (or null for a loose item being moved). An order reserves stock when it
   comes in; the player must pick the item from a shelf and bring it to the packing table.
   S.stock[p] = items that can still be sold = on shelves + loose in hand - orders not yet picked. */
export const shelfCount = p => S.shelves.reduce((a, s) => a + s.slots.filter(x => x === p).length, 0);
export function syncStock() {
  S.hand = S.hand || [];
  for (const k in D.PR) S.stock[k] = shelfCount(k) + S.hand.filter(h => h.p === k && h.o == null).length - S.orders.filter(o => o.p === k && !o.picked).length;
  for (const k in D.PR) if (S.stock[k] < 0) S.stock[k] = 0;
}
export const shelfCap = () => D.T.shop.shelfCap;
export const handFree = () => (S.hand || []).length < D.T.shop.handMax;
export const handsEmpty = () => !S.box && !S.carry.length && !(S.hand || []).length;
export const incoming = p => S.deliveries.filter(d => d.p === p).reduce((a, d) => a + d.q, 0) + S.yard.filter(b => b.p === p).reduce((a, b) => a + b.q, 0) + (S.box && S.box.p === p ? S.box.q : 0);
const unpicked = p => S.orders.find(o => o.p === p && !o.picked);

/* Shelf panel actions. Each returns a short message or "" when nothing happened. */
export function slotClick(k, i) {
  const s = S.shelves[k], PR = D.PR; if (!s) return "";
  const item = s.slots[i];
  if (item) {
    if (!handFree()) return "Your hands are full. Pack or put items down first.";
    if (S.box) return "Put the box down first.";
    const o = unpicked(item);
    s.slots[i] = null;
    if (o) { o.picked = true; S.hand.push({ p: item, o: o.id }); emit("sfx", "pick"); syncStock(); return `Picked ${PR[item].n} for order #${o.id}`; }
    S.hand.push({ p: item, o: null }); emit("sfx", "pick"); syncStock(); return `Took a ${PR[item].n} to move it`;
  }
  const li = S.hand.findIndex(h => h.o == null);
  if (li >= 0) { s.slots[i] = S.hand.splice(li, 1)[0].p; emit("sfx", "shelve"); syncStock(); return ""; }
  if (S.box && S.box.q > 0) { s.slots[i] = S.box.p; S.box.q--; if (!S.box.q) S.box = null; S.stocked = true; delete S.lows[s.slots[i]]; emit("sfx", "shelve"); syncStock(); return ""; }
  return "Hold a box or an item to fill this slot.";
}
export function fillFromBox(k) {
  const s = S.shelves[k]; let n = 0;
  for (let i = 0; i < s.slots.length && S.box && S.box.q > 0; i++) if (!s.slots[i]) { s.slots[i] = S.box.p; S.box.q--; n++; }
  if (n) { S.stocked = true; delete S.lows[s.slots.find(Boolean)]; emit("sfx", "shelve"); }
  if (S.box && !S.box.q) S.box = null;
  syncStock(); return n;
}
export function pickAllHere(k) {
  const s = S.shelves[k]; let n = 0;
  for (let i = 0; i < s.slots.length; i++) { const it = s.slots[i]; if (it && unpicked(it) && handFree() && !S.box) { slotClick(k, i); n++; } }
  return n;
}
export function storeBox() {
  if (!S.box) return; S.back[S.box.p] = (S.back[S.box.p] || 0) + S.box.q; toast(`Stored ${S.box.q} ${D.PR[S.box.p].n}`); S.box = null; emit("sfx", "shelve"); syncStock();
}
export function takeFromStorage(p) {
  if (!handsEmpty() || !(S.back[p] > 0)) return false;
  const q = Math.min(S.back[p], D.T.shop.boxMax); S.back[p] -= q; S.box = { p, q }; emit("sfx", "pick"); return true;
}

/* A warning before posting or going live with a product the player cannot sell. Null when fine. Never blocks. */
export function stockWarning(p) {
  const n = S.stock[p], name = D.PR[p].n, back = S.back[p] || 0, inc = incoming(p);
  if (n > 0 && n > D.T.shop.lowAt) return null;
  if (n === 0 && back === 0 && inc === 0) return `You have no ${name} on your shelves and none on the way. Buyers who order it become missed sales.`;
  if (n === 0 && back > 0) return `Your shelves have no ${name}. You have ${back} in storage: put them on a shelf first, or orders become missed sales.`;
  if (n === 0) return `Your shelves have no ${name}. ${inc} are on the way, but orders before they are shelved become missed sales.`;
  return `Only ${n} ${name} left on your shelves${back ? ` (${back} in storage)` : ""}. A good post can sell out fast.`;
}

/* `force` (developer panel) skips the stock check and the stock change. */
export function makeOrder(p, force = false, post = null) {
  const PR = D.PR;
  if (force || S.stock[p] > 0) {
    const o = { id: S.nextId++, p, picked: false }; S.orders.push(o); if (post) post.orders++;
    S.sold = (S.sold || 0) + 1; syncStock();
    toast(`New order #${o.id}: ${PR[p].n}. Pick it from a shelf`, AV(o.id)); emit("sfx", "order");
    const T = D.T.shop;
    if (!force && S.stock[p] <= T.lowAt && !S.lows[p]) { S.lows[p] = true; toast(S.stock[p] ? `Low stock: ${S.stock[p]} ${PR[p].n} left on the shelf` : `${PR[p].n} shelf is empty${S.back[p] ? `. ${S.back[p]} in storage` : ""}`); }
  } else {
    S.missed++; if (post) post.missed++; S.flash[p] = 2;
    S.missedLog.push({ p, at: S.clock, site: post ? post.site : "inbox" }); if (S.missedLog.length > 200) S.missedLog.shift();
    toast(`Missed sale: no ${PR[p].n} on the shelf`); emit("sfx", "missed");
  }
}

/* Missed sales in the last `secs` seconds, by product. */
export function recentMissed(secs = 120) {
  const out = {}; S.missedLog.filter(m => S.clock - m.at <= secs).forEach(m => { out[m.p] = (out[m.p] || 0) + 1; }); return out;
}

/* The order and hand item the packing table can use now. */
function packable() {
  for (const h of S.hand || []) {
    const o = h.o != null ? S.orders.find(x => x.id === h.o) : S.orders.find(x => x.p === h.p && !x.picked);
    if (o) return { o, h };
  }
  return null;
}
function finishPack() {
  const T = D.T.shop, m = packable(); if (!m) return;
  S.hand.splice(S.hand.indexOf(m.h), 1); S.orders.splice(S.orders.indexOf(m.o), 1);
  const k = { id: m.o.id, p: m.o.p };
  if (S.carry.length < T.carryMax) S.carry.push(k); else S.table.push(k);
  bookRider(k.id, T.riderDelayMin + R() * T.riderDelayRange); syncStock(); emit("sfx", "pack");
}

/* Flash timers, chat timeouts, packing progress. */
export function updateShop(dt) {
  const C = D.T.chat;
  S.clock += dt;
  for (const k in S.flash) S.flash[k] = Math.max(0, S.flash[k] - dt);
  S.chats.forEach(c => { c.t += dt; if (!c.done) { if (c.t > C.timeout) { c.done = true; c.lost = true; c.log.push(["in", "Sige, sa iba na lang po."]); } } });
  S.chats = S.chats.filter(c => !c.done || c.t < C.keepAfterDone);
  if (S.busy) { S.busy.t -= dt; if (S.busy.t <= 0) { const b = S.busy; S.busy = null; if (b.fn) b.fn(); else finishPack(); } }
}

/* Restock orders become van runs when their timer ends. */
export function updateDeliveries(dt) {
  S.deliveries.forEach(d => d.t -= dt);
  S.deliveries.filter(d => d.t <= 0).forEach(d => S.vanQ.push(d));
  S.deliveries = S.deliveries.filter(d => d.t > 0);
}

export function checkMilestone() {
  const M = D.T.milestone;
  if (!S.milestoneDone && S.stocked && S.posted && S.shipped >= M.ship && S.replies >= M.replies) {
    S.milestoneDone = true; S.rank = M.rank; toast("Milestone done! Seller Rank 2. A phone tripod (Tool Shop or the mall) opens FaceBazaar live.", "img/algo_unit_happy.png");
  }
}

export function restockCost(p, mode) {
  const RS = D.T.restock, base = Math.round(D.PR[p].cost * RS.qty * costMult(p));
  return mode === "w" ? base : Math.round(base * RS.expressMult);
}

export function buyStock(p, mode) {
  const RS = D.T.restock, cost = restockCost(p, mode);
  if (S.cash < cost) return false;
  S.cash -= cost; record("out", cost, { p, qty: RS.qty, mode }); S.deliveries.push({ p, q: RS.qty, t: mode === "w" ? RS.wholesaleTime : RS.expressTime });
  toast(`Ordered ${RS.qty} ${D.PR[p].n} for ${peso(cost)}`); emit("sfx", "buy"); return true;
}

const REPLY_TEXT = { price: p => `₱${D.PR[p].price} po!`, avail: () => "Yes po, available!", cod: () => "COD is OK po.", where: () => "We ship from Valenzuela po." };

export function replyToChat(idx, v) {
  const c = S.chats[idx]; if (!c || c.done) return false;
  const C = D.T.chat;
  c.log.push(["me", REPLY_TEXT[v](c.p)]); c.done = true; S.replies++; const ok = R() < (v === c.type ? C.okMatch : C.okMismatch);
  c.log.push(["in", ok ? "Sige po, order ako 1!" : "Ok po, thanks."]); if (ok) makeOrder(c.p);
  return true;
}

/* What E does where the player stands. Returns {label, fn?} or null. */
export function context() {
  if (S.busy) return null;
  const T = D.T.shop, PR = D.PR;
  const carryN = S.carry.length;
  // riders
  const near = S.riders.filter(r => r.state === "waiting" && Math.abs(pl.y - r.y) < T.handoverReach && pl.x > T.handoverMinX && pl.x < T.handoverMaxX);
  if (near.length) {
    const r = near.sort((a, b) => Math.abs(pl.y - a.y) - Math.abs(pl.y - b.y))[0];
    const i = S.carry.findIndex(o => o.id === r.id);
    if (i >= 0) return { label: `Hand over #${r.id}`, fn: () => { const o = S.carry.splice(i, 1)[0]; S.cash += PR[o.p].price; record("in", PR[o.p].price, { p: o.p, order: o.id }); S.shipped++; S.rating = Math.min(T.ratingMax, S.rating + T.ratingGainShip); r.state = "leaving"; toast(`Shipped #${o.id}. +${peso(PR[o.p].price)} cash on delivery`); emit("sfx", "cash"); } };
    if (carryN) return { label: `This rider is for #${r.id}` };
  }
  // yard boxes
  const yb = S.yard.find(b => Math.hypot(pl.x - b.x, pl.y - b.y) < T.pickupRadius);
  if (yb) { if (!handsEmpty()) return { label: "Hands full" }; return { label: `Pick up ${yb.q} ${PR[yb.p].n}`, fn: () => { S.yard.splice(S.yard.indexOf(yb), 1); S.box = { p: yb.p, q: yb.q }; } }; }
  const z = (inR(world.shelfZone, pl.x, pl.y) ? { id: "shelves" } : null) || world.furn.find(f => f.zone && inR(f.zone, pl.x, pl.y));
  if (!z) return null;
  if (z.id === "desk") return { label: "Use the computer", fn: () => emit("openUI", "desktop") };
  if (z.id === "algo") return { label: "Talk to Mr. Algo", fn: () => emit("openUI", "algo") };
  if (z.id === "shelves") {
    const k = nearestShelf(), s = S.shelves[k], here = s.slots.filter(Boolean);
    const sum = here.length ? Object.entries(here.reduce((a, p) => (a[p] = (a[p] || 0) + 1, a), {})).map(([p, n]) => `${PR[p].n} ${n}`).join(", ") : "empty";
    const want = S.orders.filter(o => !o.picked && s.slots.includes(o.p)).length;
    return { label: `Open shelf ${k + 1} (${sum})${want ? ` · ${want} to pick here` : ""}`, fn: () => emit("openUI", "shelf", k) };
  }
  if (z.id === "crates") return { label: S.box ? `Put ${S.box.q} ${PR[S.box.p].n} in storage` : "Open storage", fn: () => { if (S.box) storeBox(); else emit("openUI", "storage"); } };
  if (z.id === "table") {
    if (S.box) return { label: "Put the stock box on a shelf or in storage first" };
    const m = packable(), pt = T.packTime * packSpeed();
    if (m) return { label: `Pack #${m.o.id} (${PR[m.o.p].n})`, fn: () => { S.busy = { t: pt, d: pt }; } };
    if (S.orders.length) { const o = S.orders.find(x => !x.picked) || S.orders[0]; return { label: `Pick #${o.id} (${PR[o.p].n}) from a shelf first` }; }
    if (S.table.length && carryN < T.carryMax) return { label: "Pick up a parcel", fn: () => S.carry.push(S.table.shift()) };
    if (S.table.length) return { label: "Hands full" };
    return { label: "No orders to pack" };
  }
  return null;
}
