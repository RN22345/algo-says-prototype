/* MARKETPLAZA views (D-114). Shared blocks for the phone app (shopApp) and the PC site (sites/shop.js):
   the courier pickup card, the listings (list or unlist, price level), the shop orders, and the reviews.
   Labels say what a choice does, never whether it is good (FOUNDATION §2).
   Events out: shop:list {pid, on}, shop:price {pid, price}, pickup:book {ok}.
   Unity: one ShopView UI Toolkit template, used by the phone panel and the PC window. */
import { D } from "../core/data.js";
import { S, fmtMoney, tier2On, listing, isListed, priceOf, shelfCount } from "../core/state.js";
import { fmt, fmtDay } from "../core/clock.js";
import { emit } from "../core/bus.js";
import { h, btn, art } from "./ui.js";
import { nextWindow, openPickup, courierHere, rating } from "../sim/shop.js";

const packedN = () => S.orders.filter(o => o.status === "packed").length;
const toPackN = () => S.orders.filter(o => o.status === "toPack" || o.status === "picked").length;
const s_ = n => (n === 1 ? "" : "s");

/* Products the player could list: anything on a shelf, in boxes, on the way, or listed before. */
function products() {
  const on = new Set(Object.keys(S.shop.listings));
  for (const pid of Object.keys(D.P)) if (shelfCount(pid) > 0 || (S.boxes[pid] || 0) > 0) on.add(pid);
  for (const d of S.deliveries) for (const pid of Object.keys(d.items)) on.add(pid);
  for (const b of S.doorBoxes) for (const pid of Object.keys(b.items)) on.add(pid);
  return [...on].filter(pid => D.P[pid]);
}

export function pickupCard(refresh) {
  const P = D.shop.pickup, here = courierHere(), pk = openPickup(), n = packedN();
  if (here) return h("div", { class: "p-card mp-pk here" }, h("span", { class: "mp-em" }, "🛵"), h("div", { class: "grow" },
    h("b", {}, `The courier is at the door until ${fmt(here.leave)}`),
    h("div", { class: "sub" }, n ? `Go to the door and hand over ${n} parcel${s_(n)}.` : "Nothing is packed. Pack orders at the packing table.")));
  if (pk) {
    const today = Math.floor(pk.from / 1440) === Math.floor(S.t / 1440);
    return h("div", { class: "p-card mp-pk" }, h("span", { class: "mp-em" }, "📅"), h("div", { class: "grow" },
      h("b", {}, `Pickup booked: ${fmt(pk.from)} to ${fmt(pk.to)} ${today ? "today" : "tomorrow"}`),
      h("div", { class: "sub" }, `Be home. The courier waits about ${P.waitMin} minutes. ${n} parcel${s_(n)} packed, ${toPackN()} to pack.`)));
  }
  const w = nextWindow();
  return h("div", { class: "p-card mp-pk none" }, h("span", { class: "mp-em" }, "🛵"), h("div", { class: "grow" },
    h("b", {}, "No pickup booked"),
    h("div", { class: "sub" }, `Next window: ${fmt(w.from)} to ${fmt(w.to)} ${w.today ? "today" : "tomorrow"}. Book before ${fmt(P.cutoff)} for the same day. ${n} packed, ${toPackN()} to pack.`)),
    h("button", { class: "btn b-gold sm mp-book", type: "button", onClick: () => { const q = { ok: false }; emit("pickup:book", q); if (q.ok) refresh(); } }, "Book pickup"));
}

export function listingRows(refresh) {
  const out = [], ps = products();
  if (!ps.length) { out.push(h("div", { class: "p-empty" }, "No stock yet. Buy stock on the Supplier site at the desk PC.")); return out; }
  for (const pid of ps) {
    const p = D.P[pid], l = listing(pid), on = isListed(pid), cur = (l && l.price) || "usual", sh = shelfCount(pid), bx = S.boxes[pid] || 0;
    const chips = D.shop.prices.map(pr => h("button", { class: "mp-pr" + (pr.id === cur ? " on" : ""), type: "button", title: pr.does || "",
      onClick: () => { emit("shop:price", { pid, price: pr.id }); refresh(); } }, h("span", {}, pr.label), h("b", {}, fmtMoney(Math.round(p.price * pr.mult)))));
    out.push(h("div", { class: "p-card mp-row" + (on ? " on" : "") }, art(p.icon, "ic"),
      h("div", { class: "grow" }, h("b", {}, p.short || p.name),
        h("div", { class: "sub" }, `On shelf: ${sh} · In boxes: ${bx}${on ? ` · Sells at ${fmtMoney(priceOf(pid))}` : " · Not listed"}`),
        h("div", { class: "mp-prs" }, ...chips)),
      h("button", { class: "btn sm mp-list" + (on ? " on b-teal" : " b-gold"), type: "button", onClick: () => { emit("shop:list", { pid, on: !on }); refresh(); } }, on ? "Listed ✓" : "List")));
  }
  out.push(h("div", { class: "mp-note" }, D.shop.prices.map(pr => `${pr.label}: ${pr.does}`).join(" ")));
  return out;
}

const OLAB = { toPack: ["Needs packing", "orange"], picked: ["Picked", "orange"], packed: ["Waiting for courier", "blue"], shipped: ["On the way", "teal"], paid: ["Paid", "green"], cancelled: ["Cancelled", "grey"], new: ["New", "blue"] };
export function orderRows() {
  const os = S.orders.filter(o => o.mode !== "affiliate").slice().reverse().slice(0, 30), out = [];
  if (!os.length) out.push(h("div", { class: "p-empty" }, "No shop orders yet. They come from your listings and your posts."));
  for (const o of os) {
    const [lab, col] = OLAB[o.status] || [o.status, "grey"], open = o.status === "toPack" || o.status === "picked" || o.status === "packed";
    const late = open && o.shipBy && o.shipBy - S.t < 360;
    out.push(h("div", { class: "p-card" }, art(D.P[o.pid].icon, "ic"),
      h("div", { class: "grow" }, h("b", {}, `#${o.no} ${D.P[o.pid].short}`),
        h("div", { class: "sub" + (late ? " mp-late" : "") }, fmtMoney(o.price) + (o.site === "shop" ? " · from shop search" : o.site ? " · from a post" : "")
          + (open && o.shipBy ? ` · ship by ${fmtDay(o.shipBy)}` : "") + (o.status === "shipped" && o.payAt ? ` · pays about ${fmt(o.payAt)}` : ""))),
      h("span", { class: "p-chip " + col }, lab)));
  }
  return out;
}

const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
export function reviewRows() {
  const r = rating(), out = [h("div", { class: "p-card mp-rate" }, h("span", { class: "mp-em" }, "⭐"), h("div", { class: "grow" },
    h("b", {}, r == null ? "New shop, no reviews yet" : `Shop rating ${r.toFixed(1)} of 5`),
    h("div", { class: "sub" }, r == null ? "Buyers leave reviews after their parcel arrives." : `From the last ${Math.min(30, S.shop.reviews.length)} reviews. Buyers who search the shop see it.`)))];
  for (const v of S.shop.reviews.slice(0, 20)) out.push(h("div", { class: "p-card mp-rev" }, art(D.P[v.pid].icon, "ic"),
    h("div", { class: "grow" }, h("span", { class: "mp-st" }, stars(v.stars)), h("div", { class: "sub" }, `"${v.text}" · ${fmtDay(v.at)}`))));
  return out;
}

/* ---------- phone app ---------- */
let tab = "shop";
export const shopApp = {
  id: "shop", label: D.shop ? D.shop.name : "MarketPlaza", emoji: "🛍️", vicon: null, grad: ["#ff5fa2", "#e8344f"],
  badge: () => (courierHere() ? "!" : toPackN() || null),
  draw(ctx) {
    ctx.setHead(D.shop.name, { bg: "linear-gradient(90deg,#ff5fa2,#e8344f)", solid: "#ff5fa2", brand: true, sub: `${toPackN()} to pack · ${packedN()} packed` });
    ctx.setTabs([{ id: "shop", label: "My shop" }, { id: "orders", label: "Orders" }, { id: "reviews", label: "Reviews" }], tab, k => { tab = k; ctx.refresh(); });
    if (!tier2On()) { ctx.scroll.append(h("div", { class: "p-empty" }, "Your shop opens when you own Shelves and a packing table (Tool Shop).")); return; }
    if (tab === "orders") { ctx.scroll.append(...orderRows()); return; }
    if (tab === "reviews") { ctx.scroll.append(...reviewRows()); return; }
    ctx.scroll.append(h("div", { class: "p-sec" }, "Courier pickup"), pickupCard(ctx.refresh), h("div", { class: "p-sec" }, "Listings"), ...listingRows(ctx.refresh));
  }
};
