/* SHOFI views (D-123, D-128). Shared blocks for the phone app (shopApp) and the PC site (sites/shop.js):
   the courier pickup card, the orders (status, ship-by time), the sales (today's and total revenue, units per product), and the reviews (read-only).
   One screen, no tabs. There is no listing or price control: stock the player owns is on sale at its usual price.
   Events out: pickup:book {ok}.
   Unity: one ShopView UI Toolkit template, used by the phone panel and the PC window. */
import { D } from "../core/data.js";
import { S, fmtMoney, tier2On } from "../core/state.js";
import { fmt, fmtDay } from "../core/clock.js";
import { emit } from "../core/bus.js";
import { h, btn, art } from "./ui.js";
import { nextWindow, openPickup, courierHere, rating, salesToday } from "../sim/shop.js";

const packedN = () => S.orders.filter(o => o.status === "packed").length;
const toPackN = () => S.orders.filter(o => o.status === "toPack" || o.status === "picked").length;
const s_ = n => (n === 1 ? "" : "s");

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

export function salesRows() {
  const L = S.shop.sales, units = Object.entries(L.units).filter(([pid, n]) => n > 0 && D.P[pid]).sort((x, y) => y[1] - x[1]);
  const out = [h("div", { class: "p-card mp-sales" }, h("span", { class: "mp-em" }, "💰"), h("div", { class: "grow" },
    h("b", {}, `Today ${fmtMoney(salesToday())}`), h("div", { class: "sub" }, `All time ${fmtMoney(L.total)}. Revenue counts when cash on delivery arrives.`)))];
  if (!units.length) out.push(h("div", { class: "p-empty" }, "No sales yet. Post a video of a product you have in stock."));
  for (const [pid, n] of units) out.push(h("div", { class: "p-card" }, art(D.P[pid].icon, "ic"),
    h("div", { class: "grow" }, h("b", {}, D.P[pid].short), h("div", { class: "sub" }, `${n} sold · ${fmtMoney(n * D.P[pid].price)}`))));
  return out;
}

const OLAB = { toPack: ["New", "orange"], picked: ["New", "orange"], packed: ["Packed", "blue"], shipped: ["Shipped", "teal"], paid: ["Paid", "green"], cancelled: ["Cancelled", "grey"], new: ["New", "blue"] };
export function orderRows() {
  const os = S.orders.filter(o => o.mode !== "affiliate").slice().reverse().slice(0, 30), out = [];
  if (!os.length) out.push(h("div", { class: "p-empty" }, "No orders yet. Orders come from your videos."));
  for (const o of os) {
    const [lab, col] = OLAB[o.status] || [o.status, "grey"], open = o.status === "toPack" || o.status === "picked" || o.status === "packed";
    const late = open && o.shipBy && o.shipBy - S.t < 360;
    out.push(h("div", { class: "p-card" }, art(D.P[o.pid].icon, "ic"),
      h("div", { class: "grow" }, h("b", {}, `#${o.no} ${D.P[o.pid].short}`),
        h("div", { class: "sub" + (late ? " mp-late" : "") }, fmtMoney(o.price) + (o.site ? " · from a video" : "")
          + (open && o.shipBy ? ` · ship by ${fmtDay(o.shipBy)}` : "") + (o.status === "shipped" && o.payAt ? ` · pays about ${fmt(o.payAt)}` : ""))),
      h("span", { class: "p-chip " + col }, lab)));
  }
  return out;
}

const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
export function reviewRows() {
  const r = rating(), out = [h("div", { class: "p-card mp-rate" }, h("span", { class: "mp-em" }, "⭐"), h("div", { class: "grow" },
    h("b", {}, r == null ? "New shop, no reviews yet" : `Shop rating ${r.toFixed(1)} of 5`),
    h("div", { class: "sub" }, r == null ? "Buyers leave reviews after their parcel arrives." : `From the last ${Math.min(30, S.shop.reviews.length)} reviews.`)))];
  for (const v of S.shop.reviews.slice(0, 20)) out.push(h("div", { class: "p-card mp-rev" }, art(D.P[v.pid].icon, "ic"),
    h("div", { class: "grow" }, h("span", { class: "mp-st" }, stars(v.stars)), h("div", { class: "sub" }, `"${v.text}" · ${fmtDay(v.at)}`))));
  return out;
}

/* ---------- phone app ---------- */
export const shopApp = {
  id: "shop", label: D.shop ? D.shop.name : "Shofi", emoji: "🛍️", vicon: null, grad: ["#ff5fa2", "#e8344f"],
  badge: () => (courierHere() ? "!" : toPackN() || null),
  draw(ctx) {
    ctx.setHead(D.shop.name, { bg: "linear-gradient(90deg,#ff5fa2,#e8344f)", solid: "#ff5fa2", brand: true, sub: `${toPackN()} to pack · ${packedN()} packed` });
    if (!tier2On()) { ctx.scroll.append(h("div", { class: "p-empty" }, "Your shop opens when you own Shelves and a packing table (Tool Shop).")); return; }
    ctx.scroll.append(h("div", { class: "p-sec" }, "Courier pickup"), pickupCard(ctx.refresh),
      h("div", { class: "p-sec" }, "Orders"), ...orderRows(),
      h("div", { class: "p-sec" }, "Sales"), ...salesRows(),
      h("div", { class: "p-sec" }, "Reviews"), ...reviewRows());
  }
};
