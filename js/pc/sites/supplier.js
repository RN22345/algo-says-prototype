/* Bodega Supply: order stock (wholesale or express). The van brings it to the gate. */
import { D, S } from "../../state.js";
import { peso } from "../../ui/format.js";
import { registerActions } from "../../ui/windows.js";
import { buyStock, restockCost } from "../../sim/shop.js";
import { nav } from "./nav.js";
import { shell, stockLine } from "./common.js";

function page() {
  const PR = D.PR, RS = D.T.restock;
  const rows = Object.entries(PR).map(([k, v]) => {
    const w = restockCost(k, "w"), e = restockCost(k, "e");
    return `<div class="card br-sup"><img src="img/${v.icon}.png" alt=""><div><b>${v.n}</b><div class="br-sub">You sell at ${peso(v.price)} · cost ${peso(v.cost)} each</div>${stockLine(k)}</div>
      <button class="cap sm" type="button" data-act="br-buy" data-v="${k}" data-m="w" ${S.cash < w ? "disabled" : ""}>Wholesale ${peso(w)} · ${RS.wholesaleTime}s</button>
      <button class="cap sm o" type="button" data-act="br-buy" data-v="${k}" data-m="e" ${S.cash < e ? "disabled" : ""}>Express ${peso(e)} · ${RS.expressTime}s</button></div>`;
  }).join("");
  const way = S.deliveries.length ? `<div class="card br-note2"><span class="lbl">Orders on the way</span>${S.deliveries.map(d => `<div>${d.q} × ${PR[d.p].n} · ${Math.ceil(d.t)}s</div>`).join("")}</div>` : "";
  return `<div class="lbl">Order ${RS.qty} of a product. The van brings it to your gate. Boxes in storage or on a shelf are counted below.</div>${rows}${way}`;
}

registerActions({ "br-buy": (t, v) => { if (buyStock(v, t.dataset.m)) nav.redraw(); } });

export default {
  id: "supplier", name: "Bodega Supply", host: "bodega-supply.example", icon: "🚚", cat: "business", ac: "#7a6a4f", ac2: "#4f4432", c1: "#c9b88f", c2: "#a89468",
  pages: [{ id: "order", label: "Order stock", path: "order" }],
  path() { return "order"; },
  render(tab) { return shell(this, tab, page()); }
};
