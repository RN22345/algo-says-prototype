/* PHONE. A drawer from the right edge: Inbox (with "while you slept"), Feeds, Orders and posts, Wallet (rent), Playbook (flag playbook).
   Events in: phone:toggle, phone:open {tab}, inbox:changed, order:*, lesson:new, cash:changed. Events out: open:results. */
import { D } from "../core/data.js";
import { S, flag, fmtMoney } from "../core/state.js";
import { fmtDay, fmt, dayOf } from "../core/clock.js";
import { feedFor } from "../sim/rivals.js";
import { on, emit } from "../core/bus.js";
import { h, btn, art, clear } from "./ui.js";

let ph, body, tabsEl, open = false, tab = "inbox", feedSite = "tiktik";

const TABS = () => [
  { id: "inbox", label: "Inbox" }, { id: "feeds", label: "Feeds" }, { id: "orders", label: "Orders" }, { id: "wallet", label: "Wallet" },
  ...(flag("playbook") ? [{ id: "playbook", label: "Playbook" }] : [])
];

export function initPhone() {
  const root = document.getElementById("phone");
  ph = h("div", { class: "ph" });
  tabsEl = h("div", { class: "ph-tabs" }); body = h("div", { class: "ph-body" });
  ph.append(h("div", { class: "ph-top" }, "📱 My phone", h("button", { class: "x", style: { width: "44px", height: "44px", borderRadius: "50%", border: "3px solid #fff", background: "var(--red)", color: "#fff", font: "400 26px var(--lil)", cursor: "pointer" }, type: "button", onClick: () => toggle(false) }, "×")), tabsEl, body);
  root.append(ph, h("div", { class: "peek", onClick: () => toggle() }, "📱"));
  on("modal:open", () => { if (open) toggle(false); });
  on("phone:toggle", () => toggle()); on("phone:open", ({ tab: t }) => { if (t) tab = t; toggle(true); });
  for (const ev of ["inbox:changed", "order:paid", "order:packed", "order:shipped", "order:new", "order:returned", "lesson:new", "cash:changed", "post:created", "newgame"]) on(ev, () => { if (open) render(); });
}
function toggle(force) {
  open = force === undefined ? !open : force; ph.classList.toggle("open", open);
  if (open) render();
}
export const isOpen = () => open;

function render() {
  clear(tabsEl); clear(body);
  if (!TABS().some(t => t.id === tab)) tab = "inbox";
  for (const t of TABS()) {
    const n = t.id === "inbox" ? S.inbox.filter(m => !m.read).length : 0;
    tabsEl.append(h("button", { class: "chip" + (tab === t.id ? " sel" : ""), type: "button", onClick: () => { tab = t.id; render(); } }, t.label, n ? h("span", { class: "tag" }, n) : null));
  }
  ({ inbox, feeds, orders, wallet, playbook })[tab]();
  if (tab === "inbox") { S.inbox.forEach(m => { if (m.read) return; setTimeout(() => { m.read = true; emit("inbox:changed"); }, 1800); }); }
}

function inbox() {
  if (!S.inbox.length) { body.append(h("div", { class: "panel" }, "No messages yet.")); return; }
  for (const m of S.inbox.slice(0, 40)) {
    const el = h("div", { class: `msg ${m.kind}${m.read ? "" : " unread"}`, style: m.link ? { cursor: "pointer" } : {}, onClick: m.link ? () => emit("open:results", m.link) : null },
      h("b", {}, m.title), h("span", {}, m.text), h("div", { class: "when" }, fmtDay(m.at)));
    body.append(el);
  }
}
function feeds() {
  body.append(h("div", { class: "row" }, ...["tiktik", "youview"].map(s => h("button", { class: "chip" + (feedSite === s ? " sel" : ""), type: "button", onClick: () => { feedSite = s; render(); } }, D.SITE[s].name))));
  const list = feedFor(feedSite, 14);
  if (!list.length) body.append(h("div", { class: "panel" }, "The feed is quiet right now."));
  for (const f of list) body.append(feedCard(f));
}
export function feedCard(f) {
  const p = f.p ? D.P[f.p] : null;
  return h("div", { class: "feed-card" }, p ? art(p.icon, "ic") : h("div", { class: "ic", style: { fontSize: "2em", textAlign: "center" } }, "📰"),
    h("div", { class: "grow" }, h("b", {}, f.news && !p ? f.text : (p ? p.short : "News")), " ", h("span", { class: "style-tag" }, f.style),
      h("div", { class: "meta" }, h("span", {}, "by " + f.by), f.views ? h("span", {}, f.views.toLocaleString() + " views") : null, f.likes ? h("span", {}, f.likes.toLocaleString() + " likes") : null, h("span", {}, fmt(f.at))),
      f.news && p ? h("div", { class: "top-c" }, f.text) : null, f.top ? h("div", { class: "top-c" }, `"${f.top}"`) : null));
}
function orders() {
  body.append(h("h3", { style: { color: "var(--gold)" } }, "My posts"));
  const ps = S.posts.slice().reverse().slice(0, 8);
  if (!ps.length) body.append(h("div", { class: "panel" }, "No posts yet. Film a video at the filming corner."));
  for (const p of ps) body.append(h("div", { class: "feed-card", style: { cursor: "pointer" }, onClick: () => emit("open:results", p.id) }, art(D.P[p.pid].icon, "ic"),
    h("div", { class: "grow" }, h("b", {}, D.P[p.pid].short), " ", h("span", { class: "style-tag" }, D.SITE[p.site].name), p.done ? h("span", { class: "tag green", style: { marginLeft: ".4em" } }, "ended") : h("span", { class: "tag teal", style: { marginLeft: ".4em" } }, "live"),
      h("div", { class: "meta" }, h("span", {}, p.views + " views"), h("span", {}, p.orders + " orders"), h("span", {}, fmtMoney(p.profit))))));
  body.append(h("h3", { style: { color: "var(--gold)" } }, "Orders"));
  const os = S.orders.slice().reverse().slice(0, 12);
  if (!os.length) body.append(h("div", { class: "panel" }, "No orders yet."));
  const lab = { toPack: "Pack it", packed: "Waiting for courier", shipped: "On the way", paid: "Paid", cancelled: "Cancelled", new: "New" };
  for (const o of os) body.append(h("div", { class: "feed-card" }, art(D.P[o.pid].icon, "ic"), h("div", { class: "grow" }, h("b", {}, `#${o.no} ${D.P[o.pid].short}`), h("div", { class: "meta" }, h("span", {}, o.mode === "affiliate" ? "Commission " + fmtMoney(o.comm) : fmtMoney(o.price)), h("span", {}, lab[o.status] || o.status)))));
}
function wallet() {
  body.append(h("div", { class: "msg", style: { borderLeftColor: "var(--gold)" } }, h("b", {}, "Cash: " + fmtMoney(S.cash)), `Earned in total: ${fmtMoney(S.stats.earned)}`));
  if (flag("rent")) {
    body.append(h("div", { class: "msg", style: { borderLeftColor: S.rent.due > 0 ? "var(--red)" : "var(--green)" } },
      h("b", {}, S.rent.due > 0 ? `Rent due: ${fmtMoney(S.rent.due)}` : "Rent is paid"), `Next rent: day ${S.rent.nextDay}, ${fmtMoney(D.time.rent.amount)}.`));
    if (S.rent.due > 0) body.append(btn("Pay rent " + fmtMoney(S.rent.due), "b-gold", () => { const p = { ok: false }; emit("rent:pay", p); if (p.ok) render(); }));
  }
  body.append(h("h3", { style: { color: "var(--gold)" } }, "Recent"));
  for (const l of S.ledger.slice(0, 14)) body.append(h("div", { class: "msg", style: { borderLeftColor: l.amount >= 0 ? "var(--green)" : "var(--red)", padding: ".15em .6em" } }, h("span", {}, `${l.amount >= 0 ? "+" : "-"}${fmtMoney(Math.abs(l.amount))}  ${l.why}`), h("div", { class: "when" }, fmtDay(l.t))));
}
function playbook() {
  const ids = Object.keys(S.playbook);
  if (!ids.length) { body.append(h("div", { class: "panel" }, "Nothing here yet. Post videos and Mr. Algo will add what you learn.")); return; }
  for (const id of ids.sort((a, b) => S.playbook[b].at - S.playbook[a].at)) {
    const e = S.playbook[id], l = D.lessons.find(x => x.id === id); if (!l) continue;
    body.append(h("div", { class: "pb" + (e.outdated ? " old" : ""), style: { cursor: "pointer" }, onClick: () => emit("open:results", e.postId) },
      h("b", {}, l.title), e.outdated ? h("span", { class: "tag", style: { background: "var(--orange)", marginLeft: ".5em" } }, "may be outdated") : null,
      h("div", {}, l.text), h("div", { class: "ev" }, "Evidence: " + e.evidence + " · " + fmtDay(e.at))));
  }
}
