/* Supplier window: order stock, van brings it to the gate. */
import { D, S } from "../state.js";
import { peso } from "./format.js";
import { $, registerWindow, registerActions } from "./windows.js";
import { buyStock, restockCost } from "../sim/shop.js";

export function renderRestock() {
  const PR = D.PR, RS = D.T.restock;
  $("#restock").innerHTML = `<div class="lbl">Order ${RS.qty} of a product. The van brings it to your gate.</div>` + Object.entries(PR).map(([k, v]) => {
    const w = restockCost(k, "w"), e = restockCost(k, "e");
    return `<div class="card" style="display:grid;grid-template-columns:3em 1fr auto auto;gap:.8em;align-items:center;padding:.5em .8em">
      <img src="img/${v.icon}.png" alt="" style="width:3em"><div><b style="font-family:var(--display)">${v.n}</b><div style="font-size:.85em;font-weight:700;color:var(--mute)">On shelf: ${S.stock[k]} · you sell at ${peso(v.price)}</div></div>
      <button class="cap t sm" type="button" data-act="buy" data-v="${k}" data-m="w" ${S.cash < w ? "disabled" : ""}>Wholesale ${peso(w)} · ${RS.wholesaleTime}s</button>
      <button class="cap o sm" type="button" data-act="buy" data-v="${k}" data-m="e" ${S.cash < e ? "disabled" : ""}>Express ${peso(e)} · ${RS.expressTime}s</button></div>`;
  }).join("") +
    (S.deliveries.length ? `<div style="font-weight:700;color:var(--mute)">On the way: ${S.deliveries.map(d => `${d.q} ${PR[d.p].n} (${Math.ceil(d.t)}s)`).join(", ")}</div>` : "");
}

export function initRestock() {
  registerWindow("restock", { open: renderRestock });
  registerActions({ buy: (t, v) => { if (buyStock(v, t.dataset.m)) renderRestock(); } });
}
