/* Shop loop: orders, packing, riders, deliveries, chats, and what the player can do where they stand. */
import { D, S, pl, toast, emit } from "../state.js";
import { world, inR } from "../world.js";
import { peso } from "../ui/format.js";

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

/* `force` (developer panel) skips the stock check and the stock change. */
export function makeOrder(p, force = false) {
  const PR = D.PR;
  if (force || S.stock[p] > 0) {
    if (!force) S.stock[p]--;
    const o = { id: S.nextId++, p }; S.orders.push(o); if (S.post) S.post.orders++;
    toast(`New order #${o.id}: ${PR[p].n}`, AV(o.id));
  } else { S.missed++; if (S.post) S.post.missed++; S.flash[p] = 2; toast(`Missed sale: ${PR[p].n} is out of stock`); }
}

function finishPack() {
  const T = D.T.shop;
  const k = S.orders.shift(); if (!k) return;
  if (S.carry.length < T.carryMax) S.carry.push(k); else S.table.push(k);
  bookRider(k.id, T.riderDelayMin + R() * T.riderDelayRange);
}

/* Flash timers, chat timeouts, packing progress. */
export function updateShop(dt) {
  const C = D.T.chat;
  for (const k in S.flash) S.flash[k] = Math.max(0, S.flash[k] - dt);
  S.chats.forEach(c => { c.t += dt; if (!c.done) { if (c.t > C.timeout) { c.done = true; c.lost = true; c.log.push(["in", "Sige, sa iba na lang po."]); } } });
  S.chats = S.chats.filter(c => !c.done || c.t < C.keepAfterDone);
  if (S.busy) { S.busy.t -= dt; if (S.busy.t <= 0) { S.busy = null; finishPack(); } }
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
    S.milestoneDone = true; S.rank = M.rank; toast("Milestone done! Seller Rank 2. FaceBazaar unlocks in a later build.", "img/algo_unit_happy.png");
  }
}

export function restockCost(p, mode) {
  const RS = D.T.restock, base = D.PR[p].cost * RS.qty;
  return mode === "w" ? base : Math.round(base * RS.expressMult);
}

export function buyStock(p, mode) {
  const RS = D.T.restock, cost = restockCost(p, mode);
  if (S.cash < cost) return false;
  S.cash -= cost; S.deliveries.push({ p, q: RS.qty, t: mode === "w" ? RS.wholesaleTime : RS.expressTime });
  toast(`Ordered ${RS.qty} ${D.PR[p].n} for ${peso(cost)}`); return true;
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
  const near = S.riders.filter(r => r.state === "waiting" && Math.abs(pl.y - r.y) < T.handoverReach && pl.x > T.handoverMinX);
  if (near.length) {
    const r = near.sort((a, b) => Math.abs(pl.y - a.y) - Math.abs(pl.y - b.y))[0];
    const i = S.carry.findIndex(o => o.id === r.id);
    if (i >= 0) return { label: `Hand over #${r.id}`, fn: () => { const o = S.carry.splice(i, 1)[0]; S.cash += PR[o.p].price; S.shipped++; S.rating = Math.min(T.ratingMax, S.rating + T.ratingGainShip); r.state = "leaving"; toast(`Shipped #${o.id}. +${peso(PR[o.p].price)} cash on delivery`); } };
    if (carryN) return { label: `This rider is for #${r.id}` };
  }
  // yard boxes
  const yb = S.yard.find(b => Math.hypot(pl.x - b.x, pl.y - b.y) < T.pickupRadius);
  if (yb) { if (carryN || S.box) return { label: "Hands full" }; return { label: `Pick up ${yb.q} ${PR[yb.p].n}`, fn: () => { S.yard.splice(S.yard.indexOf(yb), 1); S.box = { p: yb.p, q: yb.q }; } }; }
  const z = world.furn.find(f => f.zone && inR(f.zone, pl.x, pl.y)) || (inR(world.shelfZone, pl.x, pl.y) ? { id: "shelves" } : null);
  if (!z) return null;
  if (z.id === "desk") return { label: S.post ? "Check your TikTik post" : "Make a TikTik video", fn: () => emit("openUI", S.post ? "running" : "studio") };
  if (z.id === "algo") return { label: "Talk to Mr. Algo", fn: () => emit("openUI", "algo") };
  if (z.id === "shelves") { if (S.box) return { label: `Shelve ${S.box.q} ${PR[S.box.p].n}`, fn: () => { S.stock[S.box.p] += S.box.q; S.stocked = true; toast(`Shelved ${S.box.q} ${PR[S.box.p].n}`); S.box = null; } }; return { label: "Order stock", fn: () => emit("openUI", "restock") }; }
  if (z.id === "table") {
    if (S.box) return { label: "Put the stock box on the shelves first" };
    if (S.orders.length) { const o = S.orders[0]; return { label: `Pack #${o.id} (${PR[o.p].n})`, fn: () => { S.busy = { t: T.packTime, d: T.packTime }; } }; }
    if (S.table.length && carryN < T.carryMax) return { label: "Pick up a parcel", fn: () => S.carry.push(S.table.shift()) };
    if (S.table.length) return { label: "Hands full" };
    return { label: "No orders to pack" };
  }
  return null;
}
