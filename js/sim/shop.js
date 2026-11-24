/* Shop loop: orders, packing, riders, deliveries, chats, and what the player can do where they stand. */
import { D, S, pl, toast, emit } from "../state.js";
import { world, inR } from "../world.js";
import { peso } from "../ui/format.js";
import { record } from "./ledger.js";
import { packSpeed } from "./gear.js";

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

/* ---------- shelves and storage ----------
   S.shelves: [{p, n}] one product per shelf, up to shop.shelfCap items. An empty shelf takes any product.
   S.back: backstock in the stockroom crates. Only shelf stock can be sold (FOUNDATION §5).
   S.stock[p] is the shelf total, kept in sync for the UI. */
export function syncStock() {
  for (const k in D.PR) S.stock[k] = 0;
  S.shelves.forEach(s => { if (s.n <= 0) { s.n = 0; s.p = null; } else S.stock[s.p] += s.n; });
}
export const shelfCap = () => D.T.shop.shelfCap;
export const incoming = p => S.deliveries.filter(d => d.p === p).reduce((a, d) => a + d.q, 0) + S.yard.filter(b => b.p === p).reduce((a, b) => a + b.q, 0) + (S.box && S.box.p === p ? S.box.q : 0);

/* Put items from the box on shelf k. Returns how many went on. */
export function stockShelf(k, box) {
  const s = S.shelves[k]; if (!s || (s.p && s.p !== box.p)) return 0;
  const n = Math.min(box.q, shelfCap() - s.n); if (n <= 0) return 0;
  s.p = box.p; s.n += n; box.q -= n; syncStock(); S.stocked = true; delete S.lows[box.p];
  return n;
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
    if (!force) { const s = S.shelves.filter(x => x.p === p).sort((a, b) => a.n - b.n)[0]; s.n--; syncStock(); }
    const o = { id: S.nextId++, p }; S.orders.push(o); if (post) post.orders++;
    toast(`New order #${o.id}: ${PR[p].n}`, AV(o.id));
    const T = D.T.shop;
    if (!force && S.stock[p] <= T.lowAt && !S.lows[p]) { S.lows[p] = true; toast(S.stock[p] ? `Low stock: ${S.stock[p]} ${PR[p].n} left on the shelf` : `${PR[p].n} shelf is empty${S.back[p] ? `. ${S.back[p]} in storage` : ""}`); }
  } else {
    S.missed++; if (post) post.missed++; S.flash[p] = 2;
    S.missedLog.push({ p, at: S.clock, site: post ? post.site : "inbox" }); if (S.missedLog.length > 200) S.missedLog.shift();
    toast(`Missed sale: no ${PR[p].n} on the shelf`);
  }
}

/* Missed sales in the last `secs` seconds, by product. */
export function recentMissed(secs = 120) {
  const out = {}; S.missedLog.filter(m => S.clock - m.at <= secs).forEach(m => { out[m.p] = (out[m.p] || 0) + 1; }); return out;
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
  const RS = D.T.restock, base = D.PR[p].cost * RS.qty;
  return mode === "w" ? base : Math.round(base * RS.expressMult);
}

export function buyStock(p, mode) {
  const RS = D.T.restock, cost = restockCost(p, mode);
  if (S.cash < cost) return false;
  S.cash -= cost; record("out", cost, { p, qty: RS.qty, mode }); S.deliveries.push({ p, q: RS.qty, t: mode === "w" ? RS.wholesaleTime : RS.expressTime });
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
  const near = S.riders.filter(r => r.state === "waiting" && Math.abs(pl.y - r.y) < T.handoverReach && pl.x > T.handoverMinX && pl.x < T.handoverMaxX);
  if (near.length) {
    const r = near.sort((a, b) => Math.abs(pl.y - a.y) - Math.abs(pl.y - b.y))[0];
    const i = S.carry.findIndex(o => o.id === r.id);
    if (i >= 0) return { label: `Hand over #${r.id}`, fn: () => { const o = S.carry.splice(i, 1)[0]; S.cash += PR[o.p].price; record("in", PR[o.p].price, { p: o.p, order: o.id }); S.shipped++; S.rating = Math.min(T.ratingMax, S.rating + T.ratingGainShip); r.state = "leaving"; toast(`Shipped #${o.id}. +${peso(PR[o.p].price)} cash on delivery`); } };
    if (carryN) return { label: `This rider is for #${r.id}` };
  }
  // yard boxes
  const yb = S.yard.find(b => Math.hypot(pl.x - b.x, pl.y - b.y) < T.pickupRadius);
  if (yb) { if (carryN || S.box) return { label: "Hands full" }; return { label: `Pick up ${yb.q} ${PR[yb.p].n}`, fn: () => { S.yard.splice(S.yard.indexOf(yb), 1); S.box = { p: yb.p, q: yb.q }; } }; }
  const z = (inR(world.shelfZone, pl.x, pl.y) ? { id: "shelves" } : null) || world.furn.find(f => f.zone && inR(f.zone, pl.x, pl.y));
  if (!z) return null;
  if (z.id === "desk") return { label: "Use the computer", fn: () => emit("openUI", "desktop") };
  if (z.id === "algo") return { label: "Talk to Mr. Algo", fn: () => emit("openUI", "algo") };
  if (z.id === "shelves") {
    const k = nearestShelf(), s = S.shelves[k], cap = shelfCap();
    const tag = s.p ? `${PR[s.p].n} ${s.n}/${cap}` : "empty";
    if (S.box) {
      if (s.p && s.p !== S.box.p) return { label: `Shelf ${k + 1} holds ${PR[s.p].n}. Walk to an empty shelf` };
      if (s.n >= cap) return { label: `Shelf ${k + 1} is full (${tag})` };
      return { label: `Stock shelf ${k + 1} (${tag}) with ${Math.min(S.box.q, cap - s.n)} ${PR[S.box.p].n}`, fn: () => { S.busy = { t: T.shelveTime || 0.8, d: T.shelveTime || 0.8, fn: () => { const n = stockShelf(k, S.box); toast(`Shelved ${n} ${PR[S.box.p].n} on shelf ${k + 1}${S.box.q ? `. ${S.box.q} left in the box` : ""}`); if (!S.box.q) S.box = null; } }; } };
    }
    return { label: `Shelf ${k + 1}: ${tag}${s.p && S.back[s.p] ? ` · ${S.back[s.p]} in storage` : ""}` };
  }
  if (z.id === "crates") {
    if (S.box) return { label: `Put ${S.box.q} ${PR[S.box.p].n} in storage`, fn: () => { S.back[S.box.p] = (S.back[S.box.p] || 0) + S.box.q; toast(`Stored ${S.box.q} ${PR[S.box.p].n}`); S.box = null; } };
    if (carryN) return { label: "Hands full" };
    const want = Object.keys(PR).filter(p => (S.back[p] || 0) > 0).sort((a, b) => S.stock[a] - S.stock[b])[0];
    if (!want) return { label: "Storage is empty. Order stock on the PC" };
    const q = Math.min(S.back[want], T.boxMax);
    return { label: `Take ${q} ${PR[want].n} from storage (shelf has ${S.stock[want]})`, fn: () => { S.back[want] -= q; S.box = { p: want, q }; } };
  }
  if (z.id === "table") {
    if (S.box) return { label: "Put the stock box on a shelf or in storage first" };
    if (S.orders.length) { const o = S.orders[0], pt = T.packTime * packSpeed(); return { label: `Pack #${o.id} (${PR[o.p].n})`, fn: () => { S.busy = { t: pt, d: pt }; } }; }
    if (S.table.length && carryN < T.carryMax) return { label: "Pick up a parcel", fn: () => S.carry.push(S.table.shift()) };
    if (S.table.length) return { label: "Hands full" };
    return { label: "No orders to pack" };
  }
  return null;
}
