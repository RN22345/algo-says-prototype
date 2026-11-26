/* ORDERS. Affiliate orders pay commission at once. Own-stock orders (tier 2) need a MarketPlaza listing: a buyer from a video who finds
   no listing is a missed sale. A listed order reserves a unit from the shelves at the listing price, waits to be packed, is handed to the
   courier at a booked pickup (shop.js) and pays cash on delivery. Orders not shipped by their ship-by time are cancelled.
   No stock = missed sale. Returns come later and reverse the money.
   Events in: order:new {postId,pid,mode,site}, order:pack {id,ok}, tick. Events out: order:missed, order:packed, order:paid, order:returned, order:cancelled,
   money:earn, shelf:take, shelf:giveback, inbox:add, summary:add. Shipping (packed to shipped) happens in shop.js at the courier handover. */
import { D } from "../core/data.js";
import { S, flag, tier2On, uid, rand, rr, clamp, fmtMoney, isListed, priceOf } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { fmtDay } from "../core/clock.js";

const trust = d => { S.trust = clamp(S.trust + d, 0, 100); emit("trust:changed"); };
const postOf = id => S.posts.find(p => p.id === id);

export function init() {
  on("order:new", onNew);
  on("order:pack", p => { p.ok = pack(p.id); });
  on("tick", onTick);
}

function onNew({ postId, pid, mode, site }) {
  const p = D.P[pid], post = postOf(postId);
  if (mode !== "affiliate" && site !== "shop" && !isListed(pid)) {      // a buyer came from the video but found no listing
    S.stats.missed++; if (post) post.missed++; emit("order:missed", { postId, pid, why: "unlisted" });
    if (post && post.missed === 1) emit("inbox:add", { kind: "system", title: "Buyers could not find it", text: `People asked where to buy ${p.name}, but it is not listed on ${D.shop.name}. List it on the phone.`, pid });
    return;
  }
  S.stats.nextNo = (S.stats.nextNo || 1000) + 1;
  const o = { id: uid("o"), no: S.stats.nextNo, pid, postId, mode, site: site || "", price: mode === "affiliate" ? p.price : priceOf(pid), comm: Math.round(p.price * p.commission), status: "new", at: S.t };
  if (post) post.orders++;
  if (mode === "affiliate") {
    o.status = "paid"; S.stats.sold++;
    emit("money:earn", { amount: o.comm, why: `Commission: ${p.short}`, silent: false });
    if (post) { post.revenue += o.comm; post.profit += o.comm; }
    emit("order:paid", o); emit("summary:add", `Earned ${fmtMoney(o.comm)} commission on ${p.short}.`);
  } else {
    const t = { pid, ok: false };
    if (tier2On()) emit("shelf:take", t);
    if (!t.ok) {
      S.stats.missed++; if (post) { post.missed++; post.orders--; }
      trust(-0.5); emit("order:missed", { postId, pid }); emit("sfx", "error");
      if (post && post.missed === 1) emit("inbox:add", { kind: "system", title: "Missed sale", text: `A buyer wanted ${p.name} but you had none on the shelf. Check your stock.`, pid });
      return;
    }
    o.status = "toPack"; o.shipBy = S.t + D.shop.shipByMin; S.stats.ownOrders = (S.stats.ownOrders || 0) + 1;
    emit("toast", `New order #${o.no}${site === "shop" ? " from shop search" : ""}: pack ${p.short}. Ship by ${fmtDay(o.shipBy)}.`); emit("sfx", "pop");
  }
  S.orders.push(o);
  if (S.orders.length > 200) S.orders = S.orders.filter(x => x.status !== "paid" || S.t - x.at < 4000).slice(-200);
  // schedule a return?
  if (post && post.res && rand() < post.res.returns.rate) S.returns.push({ orderId: o.id, at: S.t + rr(D.time.returnDelayMin[0], D.time.returnDelayMin[1]), why: post.res.returns.why[0] || "plain", postId });
}

function pack(id) {
  const o = S.orders.find(x => x.id === id && x.status === "toPack"); if (!o) return false;
  const chk = { ok: true }; emit("energy:check", chk); if (!chk.ok) return false;
  emit("energy:spend", { cost: D.time.energy.pack });
  o.status = "packed"; S.stats.packed = (S.stats.packed || 0) + 1; emit("order:packed", o); return true;
}

function onTick({ t0, t1 }) {
  for (const o of S.orders) {
    if (o.status === "shipped" && o.payAt <= t1) {
      o.status = "paid"; S.stats.sold++; const p = D.P[o.pid], post = postOf(o.postId);
      emit("money:earn", { amount: o.price, why: `Sold: ${p.short}` }); trust(0.3);
      if (post) { post.revenue += o.price; post.profit += o.price - p.cost; }
      emit("order:paid", o); emit("summary:add", `Sold ${p.short} for ${fmtMoney(o.price)} (cash on delivery).`);
    } else if ((o.status === "toPack" || o.status === "packed") && t1 > (o.shipBy || o.at + D.shop.shipByMin)) {
      o.status = "cancelled"; emit("shelf:giveback", { pid: o.pid }); trust(-2);
      emit("order:cancelled", o); emit("inbox:add", { kind: "system", title: "Order cancelled", text: `Order #${o.no} was not shipped in time, so the buyer cancelled. Trust went down.` });
    }
  }
  // returns
  const due = S.returns.filter(r => r.at <= t1), keep = S.returns.filter(r => r.at > t1);
  for (const r of due) {
    const o = S.orders.find(x => x.id === r.orderId);
    if (!o || o.status === "cancelled") continue;
    if (o.status !== "paid") { r.at = t1 + 360; keep.push(r); continue; }
    const p = D.P[o.pid], post = postOf(r.postId), amt = o.mode === "affiliate" ? o.comm : o.price;
    emit("money:earn", { amount: -amt, why: `Return: ${p.short}` });
    S.stats.returned++; if (post) post.returns++;
    trust(r.why === "plain" ? -1.5 : -3);
    emit("inbox:add", { kind: "system", title: `Return: ${p.short}`, text: `"${D.viewers.reviewText[r.why] || D.viewers.reviewText.plain}" ${fmtMoney(amt)} was taken back. Trust went down.`, pid: o.pid });
    emit("summary:add", `A ${p.short} order was returned.`);
    emit("order:returned", { postId: r.postId, why: r.why, order: o }); emit("sfx", "error");
  }
  S.returns = keep;
}
