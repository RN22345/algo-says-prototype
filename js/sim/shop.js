/* SHOP (MarketPlaza, D-114) and COURIER PICKUP (D-113).
   Listings: S.shop.listings {pid: {on, price}}. A listed product with stock on a shelf gets a small, steady trickle of orders from shop
   search, shaped by the trend heat, trust, the listing price and the shop rating, and thinned by how crowded the product is.
   Videos still bring most buyers; they reach the listing through posts.js (an unlisted product loses those buyers, see orders.js).
   Pickup: one window a day (data/shop.json pickup). Book before the cutoff for today, else tomorrow. The courier comes at a time inside
   the window that the player does not know, waits waitMin minutes at the door, and takes the packed parcels the player hands over.
   Reviews: some paid orders leave a review; returns leave a bad one. The rating feeds back into search.
   Events in: tick, shop:list {pid, on}, shop:price {pid, price}, pickup:book {ok}, pickup:handover {ok, n}, order:paid, order:returned.
   Events out: order:new {pid, mode:"own", site:"shop"}, pickup:booked, courier:arrived, courier:left, order:shipped, shop:changed, inbox:add, toast.
   Unity: a ShopSystem (plain C#) holding Listing and Pickup records; the same numbers from a ShopConfig ScriptableObject. */
import { D } from "../core/data.js";
import { S, rand, uid, clamp, isListed, priceConv, shelfCount, tier2On } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { tod, fmt } from "../core/clock.js";

const C = () => D.shop;
const dayBase = t => t - tod(t);

export function init() {
  on("tick", onTick);
  on("shop:list", ({ pid, on: v }) => { const l = S.shop.listings[pid] || (S.shop.listings[pid] = { on: false, price: "usual" }); l.on = !!v; emit("shop:changed"); });
  on("shop:price", ({ pid, price }) => { const l = S.shop.listings[pid] || (S.shop.listings[pid] = { on: false, price: "usual" }); l.price = price; emit("shop:changed"); });
  on("pickup:book", p => { p.ok = book(); });
  on("pickup:handover", p => { const r = handover(); p.ok = r > 0; p.n = r; });
  on("order:paid", o => { if (o.mode !== "affiliate") review(o, false); });
  on("order:returned", r => { if (r.order && r.order.mode !== "affiliate") review(r.order, true); });
}

/* ---------- pickups ---------- */
/* The window the player can still book: today's if before the cutoff, otherwise tomorrow's. */
export function nextWindow(t = S.t) {
  const P = C().pickup, base = dayBase(t), today = tod(t) < P.cutoff;
  const b = today ? base : base + 1440;
  return { from: b + P.from, to: b + P.to, cutoff: b + P.cutoff, today };
}
export const openPickup = () => S.shop.pickups.find(p => p.status === "booked" || p.status === "here");
export const courierHere = () => { const p = openPickup(); return p && p.status === "here" ? p : null; };
function book() {
  if (!tier2On()) { emit("toast", "Buy Shelves and a packing table first."); return false; }
  if (openPickup()) { emit("toast", "A pickup is already booked."); return false; }
  const w = nextWindow(), P = C().pickup, late = (S.mods && S.mods.courierDelay) || 0;   // a courier delay event pushes the visit later
  const arrive = w.from + late + Math.floor(rand() * Math.max(1, (w.to - w.from) - P.waitMin));
  S.shop.pickups.push({ id: uid("pk"), from: w.from, to: w.to, arrive, leave: arrive + P.waitMin, status: "booked", n: 0 });
  if (S.shop.pickups.length > 20) S.shop.pickups.shift();
  S.stats.booked = (S.stats.booked || 0) + 1;
  emit("pickup:booked"); emit("shop:changed"); emit("sfx", "coin");
  emit("toast", `Pickup booked: ${fmt(w.from)} to ${fmt(w.to)}${w.today ? " today" : " tomorrow"}.`);
  return true;
}
function handover() {
  const pk = courierHere(); if (!pk) return 0;
  const packed = S.orders.filter(o => o.status === "packed"); if (!packed.length) return 0;
  for (const o of packed) { o.status = "shipped"; o.payAt = S.t + C().codDelayMin; emit("order:shipped", o); }
  pk.n += packed.length; pk.leave = Math.min(pk.leave, S.t + 6); S.stats.shipped = (S.stats.shipped || 0) + packed.length;
  emit("inbox:add", { kind: "system", title: "Parcels handed over", text: `The courier took ${packed.length} parcel${packed.length > 1 ? "s" : ""}. Cash on delivery comes in about 12 hours.` });
  emit("summary:add", `Courier collected ${packed.length} parcel${packed.length > 1 ? "s" : ""}.`); emit("sfx", "whoosh"); emit("shop:changed");
  return packed.length;
}

/* ---------- reviews ---------- */
function review(o, bad) {
  const R = C().review;
  if (!bad && rand() > R.chance) return;
  const late = o.shippedLate, stars = bad ? 1 + Math.floor(rand() * 2) : clamp(Math.round(3 + (S.trust - 40) / 25 + rand() - (late ? 1 : 0)), 2, 5);
  const pool = stars >= 4 ? R.good : stars === 3 ? R.ok : R.bad;
  S.shop.reviews.unshift({ pid: o.pid, stars, text: pool[Math.floor(rand() * pool.length)], at: S.t });
  if (S.shop.reviews.length > 40) S.shop.reviews.pop();
  emit("shop:changed");
}
export function rating() { const r = S.shop.reviews.slice(0, 30); return r.length ? r.reduce((a, x) => a + x.stars, 0) / r.length : null; }

/* ---------- tick: search orders and the courier ---------- */
function onTick({ t0, t1, dt }) {
  const Sr = C().search, m = tod(t1);
  if (tier2On() && m >= Sr.openFrom && m <= Sr.openTo) {
    const rt = rating(), rf = rt == null ? Sr.newShop : 0.6 + 0.4 * rt / 5;
    for (const [pid, l] of Object.entries(S.shop.listings)) {
      if (!l.on || !D.P[pid] || shelfCount(pid) <= 0) continue;
      const heat = Math.max(Sr.heatMin, S.market.heat[pid] ?? 0.2), crowd = S.market.crowd[pid] || 0;
      const rate = Sr.perHour * (heat / 0.5) * (S.trust / Sr.trustRef) * priceConv(pid) * rf / (1 + crowd * Sr.crowdDamp);
      S.shop.acc[pid] = (S.shop.acc[pid] || 0) + rate * dt / 60;
      while (S.shop.acc[pid] >= 1) { S.shop.acc[pid] -= 1; emit("order:new", { postId: null, pid, mode: "own", site: "shop" }); }
    }
  }
  for (const pk of S.shop.pickups) {
    if (pk.status === "booked" && t1 >= pk.arrive) {
      pk.status = "here"; emit("courier:arrived", pk); emit("shop:changed"); emit("sfx", "ding");
      const n = S.orders.filter(o => o.status === "packed").length;
      emit("toast", n ? `The courier is at the door until ${fmt(pk.leave)}. Hand over ${n} parcel${n > 1 ? "s" : ""}.` : `The courier is at the door until ${fmt(pk.leave)}, but nothing is packed.`);
    }
    if (pk.status === "here" && t1 >= pk.leave) {
      const left = S.orders.filter(o => o.status === "packed").length;
      pk.status = pk.n ? "done" : left ? "missed" : "empty"; emit("courier:left", pk); emit("shop:changed");
      if (pk.status === "missed") emit("inbox:add", { kind: "system", title: "The courier left", text: `Nobody handed over the ${left} packed parcel${left > 1 ? "s" : ""}. Book another pickup and be at the door in the window.` });
      else if (pk.status === "empty") emit("inbox:add", { kind: "system", title: "Pickup with nothing to take", text: "The courier came, but no parcel was packed. Pack orders before the pickup window." });
    }
  }
}
