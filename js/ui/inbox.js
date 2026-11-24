/* Phone inbox: buyers write after they see posts. */
import { D, S } from "../state.js";
import { $, registerWindow, registerActions } from "./windows.js";
import { AV, replyToChat } from "../sim/shop.js";
import { feedCards, sigHTML } from "../pc/sites/feeds.js";
import { shortNum, esc } from "../pc/util.js";

/* Phone tabs: Inbox (buyers), Feeds (what other sellers post, all three sites), Orders (pick, pack, hand over). */
let tab = "inbox", site = "all", sig = "";
const SITES = [["all", "All"], ["tiktik", "TikTik"], ["youview", "YouView"], ["facebazaar", "FaceBazaar"]];
function tabsHTML() {
  const open = S.chats.filter(c => !c.done).length;
  return [["inbox", `Inbox${open ? ` (${open})` : ""}`], ["feeds", "Feeds"], ["orders", `Orders${S.orders.length ? ` (${S.orders.length})` : ""}`]]
    .map(([k, t]) => `<button type="button" class="chip ${tab === k ? "on" : ""}" data-act="ph-tab" data-v="${k}" aria-pressed="${tab === k}">${t}</button>`).join("");
}
function feedsHTML() {
  const PR = D.PR, list = site === "all" ? ["tiktik", "youview", "facebazaar"].flatMap(s => feedCards(s).slice(0, 5).map(c => ({ ...c, site: s }))) : feedCards(site).map(c => ({ ...c, site }));
  const name = { tiktik: "TikTik", youview: "YouView", facebazaar: "FaceBazaar" };
  return `<div class="ph-sites">${SITES.map(([k, t]) => `<button type="button" class="chip ${site === k ? "on" : ""}" data-act="ph-site" data-v="${k}">${t}</button>`).join("")}</div>` +
    list.map(c => `<div class="ph-card ph-${c.site}"><div class="ph-top"><img src="img/${PR[c.p].icon}.png" alt=""><div><b>${esc(c.site === "youview" ? c.title : c.site === "facebazaar" ? c.live : c.caption)}</b><div class="ph-by"><img src="${AV(c.av)}" alt="">${esc(c.seller)} · ${name[c.site]} · ${c.site === "facebazaar" ? `👁 ${c.watching} live` : `${shortNum(c.views)} views`}</div></div></div>${sigHTML(c)}</div>`).join("");
}
function ordersHTML() {
  const PR = D.PR, waiting = S.riders.filter(r => r.state === "waiting").map(r => r.id);
  const rows = [
    ...S.orders.map(o => [o.p, `#${o.id}`, o.picked ? "Picked. Pack it at the table" : "Pick it from a shelf"]),
    ...S.table.map(o => [o.p, `#${o.id}`, "Packed, on the table"]),
    ...S.carry.map(o => [o.p, `#${o.id}`, waiting.includes(o.id) ? "In your hands. Its rider is waiting outside" : "In your hands. Rider on the way"])
  ];
  return rows.length ? rows.map(([p, id, st]) => `<div class="ph-ord"><img src="img/${PR[p].icon}.png" alt=""><div><b>${id} ${PR[p].n}</b><div>${st}</div></div></div>`).join("")
    : `<div style="text-align:center;color:var(--mute);font-weight:700;margin-top:2em">No orders right now.</div>`;
}

const REPLIES = [["price", "Send price"], ["avail", "Yes, available"], ["cod", "COD is OK"], ["where", "Ships from Valenzuela"]];

export function renderInbox(force) {
  const box = $("#inbox"); if (!force && box.contains(document.activeElement)) return;
  const tabs = $("#phTabs"); if (tabs) tabs.innerHTML = tabsHTML();
  if (tab !== "inbox") {
    const k = tab + site + (tab === "feeds" ? Math.floor(S.clock / 45) : JSON.stringify([S.orders, S.table, S.carry, S.riders.map(r => r.state)]));
    if (!force && k === sig) return; sig = k;
    box.innerHTML = tab === "feeds" ? feedsHTML() : ordersHTML(); return;
  }
  sig = "";
  const TO = D.T.chat.timeout, WARN = D.T.chat.warnAt;
  const list = S.chats.slice().reverse();
  box.innerHTML = list.length ? list.map(c => `<div style="display:flex;flex-direction:column;gap:.35em;padding-bottom:.6em;border-bottom:.12em dashed #e3dcc8;${c.done ? "opacity:.6" : ""}">
    <div style="display:flex;align-items:center;gap:.5em"><img src="${AV(c.av)}" alt="" style="width:2.3em;border-radius:50%"><div><b style="font-family:var(--display)">${c.name}</b><div style="font-size:.78em;font-weight:700;color:${!c.done && c.t > WARN ? "var(--red)" : "var(--mute)"}">${c.done ? (c.lost ? "Left the chat" : "Done") : `via ${c.site || "TikTik"} · ${Math.max(0, Math.ceil(TO - c.t))}s`}</div></div></div>
    ${c.log.map(([w, t]) => `<div class="bub ${w}">${t}</div>`).join("")}
    ${c.done ? "" : `<div style="display:flex;gap:.3em;flex-wrap:wrap">${REPLIES.map(([k, t]) => `<button class="cap ${k === REPLIES[0][0] ? "t" : "y"} sm" type="button" data-act="reply" data-c="${S.chats.indexOf(c)}" data-v="${k}">${t}</button>`).join("")}</div>`}
  </div>`).join("") : `<div style="text-align:center;color:var(--mute);font-weight:700;margin-top:2em">No messages yet.<br>Buyers write after they see your posts.</div>`;
}

export function initInbox() {
  registerWindow("phone", { open: () => renderInbox(true) });
  registerActions({
    reply: (t, v) => { if (replyToChat(+t.dataset.c, v)) renderInbox(true); },
    "ph-tab": (t, v) => { tab = v; renderInbox(true); $("#inbox").scrollTop = 0; },
    "ph-site": (t, v) => { site = v; renderInbox(true); }
  });
}
