/* Shop Books app: a ledger of every cash in and cash out, with totals and cash profit per product. */
import { D, S } from "../../state.js";
import { peso } from "../../ui/format.js";
import { SITE_NAME } from "../../sim/post.js";
import { clockText, setHTML } from "../util.js";

let root = null;

export function totals() {
  const per = {}; Object.keys(D.PR).forEach(k => { per[k] = { sold: 0, inn: 0, out: 0 }; });
  const other = { inn: 0, out: 0 }; let inn = 0, out = 0;
  S.ledger.forEach(e => {
    const row = e.p && per[e.p] ? per[e.p] : other;
    if (e.kind === "in") { inn += e.amount; row.inn += e.amount; if (row.sold !== undefined) row.sold++; }
    else { out += e.amount; row.out += e.amount; }
  });
  return { per, other, inn, out };
}

const SITE_COLS = [["tiktik", "TikTik"], ["youview", "YouView"], ["facebazaar", "FaceBazaar"], ["inbox", "Chat"]];
const siteName = k => SITE_NAME[k] || (k === "inbox" ? "Chat" : k);

/* Missed sales: counts per product and site, then the last 10 with game time. */
function missedHTML() {
  const log = S.missedLog || [], PR = D.PR;
  if (!log.length) return `<span class="lbl">Missed sales</span><span class="bk-note">None so far. A missed sale is an order that came in when the shelf had none of that product.</span>`;
  const rows = Object.keys(PR).map(k => {
    const mine = log.filter(m => m.p === k); if (!mine.length) return "";
    const by = SITE_COLS.map(([s]) => mine.filter(m => (m.site || "inbox") === s).length);
    return `<div class="bk-miss"><span>${PR[k].n}</span>${by.map(n => `<span>${n || "·"}</span>`).join("")}<b>${mine.length}</b></div>`;
  }).join("");
  const last = log.slice(-10).reverse().map(m => `<div class="bk-miss last"><span>${clockText(m.at)}</span><span>${PR[m.p] ? PR[m.p].n : m.p}</span><span>${siteName(m.site || "inbox")}</span></div>`).join("");
  return `<span class="lbl">Missed sales · by product and site</span>
    <div class="bk-miss bk-head"><span>Product</span>${SITE_COLS.map(([, n]) => `<span>${n}</span>`).join("")}<span>All</span></div>${rows}
    <span class="lbl" style="margin-top:.5em">Last 10</span>${last}
    <span class="bk-note">The shop remembers up to 200 missed sales. Now holding ${log.length}.</span>`;
}

const sign = n => `<b style="color:${n < 0 ? "var(--red)" : "var(--tealD)"}">${n < 0 ? "-" : ""}${peso(Math.abs(n))}</b>`;

function render() {
  if (!root) return;
  const { per, other, inn, out } = totals(), PR = D.PR;
  const rows = S.ledger.slice().reverse().map(e => {
    const gear = e.gear && D.GEAR[e.gear] ? `Gear · ${D.GEAR[e.gear].n}` : null;
    const what = gear ? gear : e.kind === "in" ? (e.order ? `Sale · order #${e.order} · ${PR[e.p].n}` : e.note || "Cash in") : (e.qty ? `Stock · ${e.qty} × ${PR[e.p].n}${e.mode === "e" ? " (express)" : ""}` : e.note || "Cash out");
    return `<div class="bk-row"><span>${clockText(e.t)}</span><span>${what}</span><b style="color:var(--tealD)">${e.kind === "in" ? "+" + peso(e.amount) : ""}</b><b style="color:var(--red)">${e.kind === "out" ? "-" + peso(e.amount) : ""}</b></div>`;
  }).join("") || `<div style="color:var(--mute);font-weight:700;padding:1em">No money moved yet. Sales and stock orders appear here.</div>`;
  const prod = Object.entries(per).map(([k, v]) => `<div class="bk-prod"><span><img src="img/${PR[k].icon}.png" alt="" style="width:1.8em;vertical-align:middle"> ${PR[k].n}</span><span>${v.sold} sold</span><span>${peso(v.inn)}</span><span>-${peso(v.out)}</span>${sign(v.inn - v.out)}</div>`).join("");
  const oth = other.inn || other.out ? `<div class="bk-prod"><span>Other</span><span></span><span>${peso(other.inn)}</span><span>-${peso(other.out)}</span>${sign(other.inn - other.out)}</div>` : "";
  setHTML(root, `
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.7em">
     <div class="card stat"><span class="lbl">Cash in</span><b style="color:var(--tealD)">${peso(inn)}</b></div>
     <div class="card stat"><span class="lbl">Cash out</span><b style="color:var(--red)">${peso(out)}</b></div>
     <div class="card stat"><span class="lbl">Cash profit</span><b>${inn - out < 0 ? "-" : ""}${peso(Math.abs(inn - out))}</b></div>
     <div class="card stat"><span class="lbl">Cash now</span><b>${peso(S.cash)}</b></div>
   </div>
   <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:1em;min-height:0">
     <div class="card" style="display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;overflow:hidden"><div class="bk-row bk-head"><span>Time</span><span>What</span><span>In</span><span>Out</span></div><div data-sk="led" style="overflow:auto">${rows}</div></div>
     <div class="bk-side" data-sk="bks"><div class="card" style="padding:.6em .8em;align-content:start;display:grid;gap:.3em"><span class="lbl">By product</span><div class="bk-prod bk-head"><span>Product</span><span>Sales</span><span>In</span><span>Out</span><span>Profit</span></div>${prod}${oth}
       <span style="font-size:.8em;font-weight:700;color:var(--mute);margin-top:.5em">Profit counts cash only. Stock still on the shelves is not counted.</span></div>
     <div class="card bk-missed">${missedHTML()}</div></div>
   </div>`);
}

export default {
  id: "books", title: "Shop Books", icon: "📒", color: "y", cat: "business", w: 82, h: 82,
  mount(el, win) { root = el; el.className = "dw-body wbody"; el.style.gridTemplateRows = "auto minmax(0,1fr)"; win.setTitle("Shop Books", "Every peso in and out"); render(); },
  refresh: render,
  unmount() { root = null; }
};
