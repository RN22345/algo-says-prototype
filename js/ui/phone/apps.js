/* PHONE apps: Messages (the inbox), Orders (orders and posts), Bank (cash, rent, ledger), Calendar (timed things), Playbook (what you learned).
   Each app is { id, label, emoji, vicon, grad, badge(), enter?(), draw(ctx) }. ctx comes from phone.js:
   scroll (the page), setHead(title, opts), setBack(fn), setTabs(list, cur, onPick), refresh(), go(appId).
   Events out: open:results, rent:pay, inbox:changed. */
import { D } from "../../core/data.js";
import { S, flag, fmtMoney } from "../../core/state.js";
import { fmt, fmtDay, dayOf, absAt } from "../../core/clock.js";
import { emit } from "../../core/bus.js";
import { h, btn, art } from "../ui.js";
import { ago } from "./feedapp.js";
import { weeklyRent, productLine } from "../pc/helpers.js";

const KIND = {
  ask: { who: "Buyer", em: "🛍️", c: "#2fd9cf" }, news: { who: "Seller Hub", em: "📰", c: "#ff7a1a" }, system: { who: "Shop alerts", em: "🔔", c: "#3a7bf0" },
  result: { who: "Mr. Algo", em: "🤖", c: "#ffc61a" }, sleep: { who: "Daily summary", em: "🌙", c: "#b744c9" }
};
const kind = m => KIND[m.kind] || KIND.system;

/* ---------------- Messages ---------------- */
let sel = null;
export const messagesApp = {
  id: "messages", label: "Messages", emoji: "💬", vicon: null, grad: ["#3ec45a", "#1d8c82"],
  badge: () => S.inbox.filter(m => !m.read).length || null,
  enter() { sel = null; },
  draw(ctx) {
    const m = sel && S.inbox.find(x => x.id === sel);
    if (m) {
      const k = kind(m);
      ctx.setHead(k.who, { bg: "#f7f8ff", solid: "#f7f8ff", fg: "#1c2452", sub: ago(m.at) }); ctx.setBack(() => { sel = null; ctx.refresh(); });
      ctx.scroll.append(h("div", { class: "p-time" }, fmtDay(m.at)),
        h("div", { class: "p-bub" }, h("b", {}, m.title), h("div", { class: "txt" }, m.text),
          m.link ? btn("See results", "b-gold sm", () => emit("open:results", m.link)) : null));
      return;
    }
    const unread = S.inbox.filter(x => !x.read).length;
    ctx.setHead("Messages", { bg: "#f7f8ff", solid: "#f7f8ff", fg: "#1c2452", sub: unread ? unread + " new" : "All read", action: unread ? { label: "Mark read", fn: () => { S.inbox.forEach(x => { x.read = true; }); emit("inbox:changed"); } } : null });
    if (!S.inbox.length) { ctx.scroll.append(h("div", { class: "p-empty" }, "No messages yet.")); return; }
    for (const x of S.inbox.slice(0, 40)) {
      const k = kind(x);
      ctx.scroll.append(h("div", { class: "p-msg" + (x.read ? "" : " unread"), onClick: () => { sel = x.id; if (!x.read) { x.read = true; emit("inbox:changed"); } else ctx.refresh(); } },
        h("span", { class: "av", style: { background: k.c } }, k.em),
        h("div", { class: "grow" }, h("div", { class: "top" }, h("b", {}, k.who), h("span", { class: "when" }, ago(x.at))),
          h("div", { class: "ttl" }, x.title), h("div", { class: "pre" }, String(x.text).split("\n")[0]))));
    }
  }
};

/* ---------------- Orders ---------------- */
let ordTab = "orders";
const OLAB = { toPack: ["Needs packing", "orange"], picked: ["Picked", "orange"], packed: ["Waiting for courier", "blue"], shipped: ["On the way", "teal"], paid: ["Paid", "green"], cancelled: ["Cancelled", "grey"], new: ["New", "blue"] };
export const ordersApp = {
  id: "orders", label: "Orders", emoji: "📦", vicon: "ic_parcel", grad: ["#ff9a3a", "#e8344f"],
  badge: () => S.orders.filter(o => o.status === "toPack" || o.status === "picked").length || null,
  draw(ctx) {
    ctx.setHead("Orders", { bg: "linear-gradient(90deg,#ff9a3a,#e8344f)", solid: "#ff9a3a", sub: `${S.orders.filter(o => o.status === "toPack").length} to pack` });
    ctx.setTabs([{ id: "orders", label: "Orders" }, { id: "posts", label: "My posts" }], ordTab, k => { ordTab = k; ctx.refresh(); });
    if (ordTab === "posts") {
      const ps = S.posts.slice().reverse().slice(0, 14);
      if (!ps.length) ctx.scroll.append(h("div", { class: "p-empty" }, "No posts yet. Film a video at the filming corner."));
      for (const p of ps) ctx.scroll.append(h("div", { class: "p-card click", onClick: () => emit("open:results", p.id) }, art(D.P[p.pid].icon, "ic"),
        h("div", { class: "grow" }, h("b", {}, D.P[p.pid].short), " ", h("span", { class: "p-chip " + (p.done ? "green" : "teal") }, p.done ? "ended" : "live"), " ", h("span", { class: "p-chip grey" }, D.SITE[p.site].name),
          h("div", { class: "sub" }, `${p.views} views · ${p.orders} orders · ${fmtMoney(p.profit)}`))));
      return;
    }
    const os = S.orders.slice().reverse().slice(0, 24);
    if (!os.length) ctx.scroll.append(h("div", { class: "p-empty" }, "No orders yet. Orders come after your posts reach buyers."));
    for (const o of os) {
      const [lab, col] = OLAB[o.status] || [o.status, "grey"];
      ctx.scroll.append(h("div", { class: "p-card" }, art(D.P[o.pid].icon, "ic"),
        h("div", { class: "grow" }, h("b", {}, `#${o.no} ${D.P[o.pid].short}`),
          h("div", { class: "sub" }, o.mode === "affiliate" ? "Commission " + fmtMoney(o.comm) : fmtMoney(o.price) + (o.status === "shipped" && o.payAt ? ", pays about " + fmt(o.payAt) : ""))),
        h("span", { class: "p-chip " + col }, lab)));
    }
  }
};

/* ---------------- Bank ---------------- */
export const bankApp = {
  id: "bank", label: "Bank", emoji: "💰", vicon: "ic_cash", grad: ["#7a4ae0", "#3a7bf0"],
  badge: () => (flag("rent") && S.rent.due > 0 ? "!" : null),
  draw(ctx) {
    ctx.setHead("Bank", { bg: "linear-gradient(90deg,#7a4ae0,#3a7bf0)", solid: "#7a4ae0", sub: "Wallet" });
    ctx.scroll.append(h("div", { class: "p-wallet" }, h("div", { class: "lab" }, "Cash"), h("div", { class: "amt" }, fmtMoney(S.cash)), h("div", { class: "sub" }, `Earned in total: ${fmtMoney(S.stats.earned)}`)));
    if (flag("rent")) {
      const due = S.rent.due > 0;
      ctx.scroll.append(h("div", { class: "p-card rent" + (due ? " due" : "") }, h("div", { class: "grow" },
        h("b", {}, due ? `Rent due: ${fmtMoney(S.rent.due)}` : "Rent is paid"),
        h("div", { class: "sub" }, `Next rent: day ${S.rent.nextDay}, ${fmtMoney(weeklyRent())} a week.`)),
        due ? btn("Pay", "b-gold sm", () => { const p = { ok: false }; emit("rent:pay", p); if (p.ok) ctx.refresh(); }) : null));
    }
    ctx.scroll.append(h("div", { class: "p-sec" }, "Recent"));
    if (!S.ledger.length) ctx.scroll.append(h("div", { class: "p-empty" }, "Nothing yet."));
    for (const l of S.ledger.slice(0, 16)) ctx.scroll.append(h("div", { class: "p-led " + (l.amount >= 0 ? "in" : "out") }, h("span", { class: "grow" }, l.why, h("small", {}, ago(l.t))), h("b", {}, (l.amount >= 0 ? "+" : "-") + fmtMoney(Math.abs(l.amount)))));
  }
};

/* ---------------- Calendar ---------------- */
function calendarItems() {
  const T = D.time, now = S.t, day = dayOf(now), out = [], d0 = absAt(day, 0);
  const add = (at, em, title, sub) => out.push({ at, em, title, sub });
  for (let k = 0; k < 2; k++) {
    const base = d0 + k * 1440;
    if (flag("tier2")) { add(base + T.supplierArrive, "🚚", "Supplier trucks arrive", "Boxes ordered the day before come to the door"); add(base + T.supplierCutoff, "⏰", "Supplier order cut-off", "Order before this time to get stock tomorrow"); }
  }
  for (const d of S.deliveries) add(d.at, "📦", "Your stock arrives", productLine(d.items));
  for (const pk of (S.shop && S.shop.pickups) || []) if (pk.status === "booked" || pk.status === "here") { const n = S.orders.filter(o => o.status === "packed").length; add(pk.from, "🛵", `Courier pickup, ${fmt(pk.from)} to ${fmt(pk.to)}`, `Be at the door. ${n} parcel${n === 1 ? "" : "s"} packed`); }
  for (const s of S.samplePending) add(s.at, "🎁", "Sample arrives", D.P[s.pid].name);
  if (flag("rent")) { if (S.rent.due > 0) add(now, "🏠", "Rent is due now", fmtMoney(S.rent.due)); else if (S.rent.nextDay - day <= 3) add(absAt(S.rent.nextDay, 0), "🏠", "Rent day", `${fmtMoney(weeklyRent())} comes due`); }
  for (const e of S.events.list) if (e.signaled) add(Math.min(e.start, Math.max(now, e.signalAt || now)), "📣", e.headline || e.name, now >= e.start ? "Happening now" : "Coming soon");
  return out.filter(x => x.at < d0 + 1440 * 3).sort((a, b) => a.at - b.at);
}
export const calendarApp = {
  id: "calendar", label: "Calendar", emoji: "📅", vicon: "ic_market", grad: ["#ffc61a", "#ff7a1a"],
  badge: () => null,
  draw(ctx) {
    const day = dayOf(S.t);
    ctx.setHead("Calendar", { bg: "linear-gradient(90deg,#ffc61a,#ff7a1a)", solid: "#ffc61a", fg: "#1c2452", sub: `Day ${day}, ${fmt()}` });
    const items = calendarItems(); let lastDay = 0;
    if (!items.length) ctx.scroll.append(h("div", { class: "p-empty" }, "Nothing planned."));
    for (const it of items) {
      const dd = dayOf(it.at);
      if (dd !== lastDay) { lastDay = dd; ctx.scroll.append(h("div", { class: "p-sec" }, dd === day ? "Today" : dd === day + 1 ? "Tomorrow" : "Day " + dd)); }
      const past = it.at < S.t - 1;
      ctx.scroll.append(h("div", { class: "p-cal" + (past ? " past" : "") }, h("span", { class: "tm" }, fmt(it.at)), h("span", { class: "em" }, it.em), h("div", { class: "grow" }, h("b", {}, it.title), h("div", { class: "sub" }, it.sub)), past ? h("span", { class: "ok" }, "✓") : null));
    }
  }
};

/* ---------------- Playbook ---------------- */
export const playbookApp = {
  id: "playbook", label: "Playbook", emoji: "📖", vicon: "ic_knowledge", grad: ["#2fd9cf", "#3a7bf0"],
  badge: () => { const n = Object.keys(S.playbook).filter(id => !(S.ui && S.ui.pbSeen && S.ui.pbSeen[id])).length; return n || null; },
  draw(ctx) {
    ctx.setHead("Playbook", { bg: "linear-gradient(90deg,#2fd9cf,#3a7bf0)", solid: "#2fd9cf", fg: "#1c2452", sub: "What you learned" });
    const ids = Object.keys(S.playbook);
    if (!ids.length) { ctx.scroll.append(h("div", { class: "p-empty" }, "Nothing here yet. Post videos and Mr. Algo will add what you learn.")); return; }
    S.ui = S.ui || { pbSeen: {} }; S.ui.pbSeen = S.ui.pbSeen || {};
    for (const id of ids.sort((a, b) => S.playbook[b].at - S.playbook[a].at)) {
      const e = S.playbook[id], l = D.lessons.find(x => x.id === id); if (!l) continue;
      S.ui.pbSeen[id] = true;
      ctx.scroll.append(h("div", { class: "p-pb" + (e.outdated ? " old" : ""), onClick: () => emit("open:results", e.postId) },
        h("b", {}, l.title), e.outdated ? h("span", { class: "p-chip orange" }, "may be outdated") : null,
        h("div", { class: "txt" }, l.text), h("div", { class: "ev" }, "Evidence: " + e.evidence + " · " + fmtDay(e.at))));
    }
  }
};
