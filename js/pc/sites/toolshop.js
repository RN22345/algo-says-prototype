/* Tool Shop: equipment opens features (D-70). Lists D.GEAR, buys with buyGear. */
import { D, S } from "../../state.js";
import { peso } from "../../ui/format.js";
import { registerActions } from "../../ui/windows.js";
import { has, buyGear } from "../../sim/gear.js";
import { esc } from "../util.js";
import { nav } from "./nav.js";
import { shell } from "./common.js";

function page() {
  const cards = Object.entries(D.GEAR).map(([id, g]) => {
    const own = has(id), short = g.price - S.cash;
    return `<div class="card br-gear ${own ? "own" : ""}"><div class="gi">${g.icon}</div><div><b>${esc(g.n)}</b><p>${esc(g.does)}</p></div>
      ${own ? `<span class="br-owned">✓ Owned</span>` : `<button type="button" class="cap sm" data-act="br-gear" data-v="${id}" ${short > 0 ? "disabled" : ""}>Buy ${peso(g.price)}</button>${short > 0 ? `<small class="br-sub">Need ${peso(short)} more</small>` : ""}`}</div>`;
  }).join("");
  return `<div class="lbl">Equipment opens new things to do. Cash now: ${peso(S.cash)}</div><div class="br-geargrid">${cards}</div>`;
}

registerActions({ "br-gear": (t, v) => { if (buyGear(v)) nav.redraw(); } });

export default {
  id: "toolshop", name: "Tool Shop", host: "toolshop.example", icon: "🧰", cat: "business", ac: "#5a6f8f", ac2: "#394a66", c1: "#9db3d3", c2: "#6f88ad",
  pages: [{ id: "shop", label: "Equipment", path: "equipment" }],
  path() { return "equipment"; },
  render(tab) { return shell(this, tab, page()); }
};
