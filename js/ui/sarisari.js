/* Sari-sari store window: buy a small amount of a product right now, at a higher price than the supplier. */
import { D, S, toast, emit } from "../state.js";
import { peso } from "./format.js";
import { $, registerWindow, registerActions } from "./windows.js";

export const sariCost = p => Math.round(D.PR[p].cost * D.T.sarisari.mult * D.T.sarisari.qty);

/* Stock goes straight onto the shelves. */
export function buySariSari(p) {
  const cost = sariCost(p), q = D.T.sarisari.qty;
  if (S.cash < cost) return false;
  S.cash -= cost; S.stock[p] += q; S.stocked = true;
  toast(`Bought ${q} ${D.PR[p].n} at the store for ${peso(cost)}`);
  return true;
}

export function renderSariSari() {
  const PR = D.PR, q = D.T.sarisari.qty;
  $("#sarisari").innerHTML = `<div class="lbl">Buy ${q} of a product now. It goes on your shelves at once. The price is higher than the supplier.</div>` + Object.entries(PR).map(([k, v]) => {
    const c = sariCost(k);
    return `<div class="card" style="display:grid;grid-template-columns:3em 1fr auto;gap:.8em;align-items:center;padding:.5em .8em">
      <img src="img/${v.icon}.png" alt="" style="width:3em"><div><b style="font-family:var(--display)">${v.n}</b><div style="font-size:.85em;font-weight:700;color:var(--mute)">On shelf: ${S.stock[k]} · you sell at ${peso(v.price)}</div></div>
      <button class="cap o sm" type="button" data-act="ss-buy" data-v="${k}" ${S.cash < c ? "disabled" : ""}>Buy ${q} · ${peso(c)}</button></div>`;
  }).join("");
}

export function initSariSari() {
  registerWindow("sarisari", { open: renderSariSari });
  registerActions({ "ss-buy": (t, v) => { if (buySariSari(v)) { renderSariSari(); emit("refresh"); } } });
}
