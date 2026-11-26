/* SHOFI (D-123, D-128) and COURIER PICKUP (D-113). Shofi is the in-game sales app. It has no listing step, no price setting and no shop search:
   any product the player has in stock counts as listed, it sells at its usual price, and every order comes from a video (posts.js, orders.js).
   Shofi shows orders, sales (S.shop.sales: total revenue, units per product, revenue per day number) and the courier pickup. Rating is read-only info.
   Pickup: one window a day (data/shop.json pickup). Book before the cutoff for today, else tomorrow. The courier comes at a time inside
   the window that the player does not know, waits waitMin minutes at the door, and takes the packed parcels the player hands over.
   Reviews: some paid orders leave a review; returns leave a bad one. They are shown in Shofi and change nothing else.
   Events in: tick, pickup:book {ok}, pickup:handover {ok, n}, order:paid, order:returned.
   Events out: pickup:booked, courier:arrived, courier:left, order:shipped, shop:changed, inbox:add, toast.
   Unity: a ShopSystem (plain C#) holding Pickup, Review and SalesLedger records; the same numbers from a ShopConfig ScriptableObject. */
import { D } from "../core/data.js";
import { S, rand, uid, clamp, tier2On } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { tod, fmt, dayNo } from "../core/clock.js";

const C = () => D.shop;
const dayBase = t => t - tod(t);

export function init() {
  on("tick", onTick);
  on("pickup:book", p => { p.ok = book(); });
  on("pickup:handover", p => { const r = handover(); p.ok = r > 0; p.n = r; });
  on("order:paid", o => { if (o.mode !== "affiliate") { review(o, false); sale(o, 1); } });
  on("order:returned", r => { if (r.order && r.order.mode !== "affiliate") { review(r.order, true); sale(r.order, -1); } });
}

/* Sales ledger: net of returns. Revenue counts on the day the cash on delivery arrives. */
function sale(o, sign) {
  const L = S.shop.sales, d = dayNo();
  L.total += sign * o.price; L.units[o.pid] = (L.units[o.pid] || 0) + sign; L.daily[d] = (L.daily[d] || 0) + sign * o.price;
  emit("shop:changed");
}
export const salesToday = () => S.shop.sales.daily[dayNo()] || 0;

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

/* ---------- tick: the courier ---------- */
function onTick({ t0, t1, dt }) {
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
