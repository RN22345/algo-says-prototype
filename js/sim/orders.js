/* ORDERS. Affiliate orders pay commission at once. Own-stock orders (tier 2) reserve a unit from the shelves, wait to be packed,
   ride the courier (pickups at set hours) and pay cash on delivery. No stock = missed sale. Returns come later and reverse the money.
   Events in: order:new {postId,pid,mode,site}, order:pack {id,ok}, tick. Events out: order:missed, order:packed, order:shipped, order:paid, order:returned, order:cancelled,
   money:earn, shelf:take, shelf:giveback, inbox:add, summary:add. Reads S.mods.courierDelay. */
import { D } from "../core/data.js";
import { S, flag, tier2On, uid, rand, rr, clamp, fmtMoney } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { crosses } from "../core/clock.js";

const trust = d => { S.trust = clamp(S.trust + d, 0, 100); emit("trust:changed"); };
const postOf = id => S.posts.find(p => p.id === id);

export function init() {
  on("order:new", onNew);
  on("order:pack", p => { p.ok = pack(p.id); });
  on("tick", onTick);
}

function onNew({ postId, pid, mode }) {
  const p = D.P[pid], post = postOf(postId); S.stats.nextNo = (S.stats.nextNo || 1000) + 1;
  const o = { id: uid("o"), no: S.stats.nextNo, pid, postId, mode, price: p.price, comm: Math.round(p.price * p.commission), status: "new", at: S.t };
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
    o.status = "toPack"; emit("toast", `New order #${o.no}: pack ${p.short}.`); emit("sfx", "pop");
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
  o.status = "packed"; emit("order:packed", o); return true;
}

function onTick({ t0, t1 }) {
  const delay = S.mods.courierDelay || 0;
  for (const m of D.time.courierTimes) {
    if (crosses(t0 - delay, t1 - delay, m)) {
      const packed = S.orders.filter(o => o.status === "packed");
      if (packed.length) {
        packed.forEach(o => { o.status = "shipped"; o.payAt = t1 + D.time.codDelayMin; emit("order:shipped", o); });
        emit("inbox:add", { kind: "system", title: "Courier pickup", text: `${packed.length} parcel${packed.length > 1 ? "s" : ""} collected. Cash on delivery comes in about 12 hours.` });
        emit("summary:add", `Courier collected ${packed.length} parcel${packed.length > 1 ? "s" : ""}.`); emit("sfx", "whoosh");
      }
    }
  }
  for (const o of S.orders) {
    if (o.status === "shipped" && o.payAt <= t1) {
      o.status = "paid"; S.stats.sold++; const p = D.P[o.pid], post = postOf(o.postId);
      emit("money:earn", { amount: o.price, why: `Sold: ${p.short}` }); trust(0.3);
      if (post) { post.revenue += o.price; post.profit += o.price - p.cost; }
      emit("order:paid", o); emit("summary:add", `Sold ${p.short} for ${fmtMoney(o.price)} (cash on delivery).`);
    } else if ((o.status === "toPack" || o.status === "packed") && t1 - o.at > D.time.orderExpireMin) {
      o.status = "cancelled"; emit("shelf:giveback", { pid: o.pid }); trust(-2);
      emit("order:cancelled", o); emit("inbox:add", { kind: "system", title: "Order cancelled", text: `Order #${o.no} waited too long and the buyer cancelled.` });
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
