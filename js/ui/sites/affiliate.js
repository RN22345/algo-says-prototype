/* Affiliate catalogue (tier 1). Pick a product, request a free sample. It arrives at the door after a delay. No stock needed; you earn a commission per sale.
   Shows price and commission only. No demand numbers (fail first). */
import { D } from "../../core/data.js";
import { S, fmtMoney } from "../../core/state.js";
import { fmtDay } from "../../core/clock.js";
import { emit } from "../../core/bus.js";
import { h, btn, art } from "../ui.js";

export function render(root, def, api) {
  const tiles = D.products.map(p => {
    const pend = S.samplePending.find(s => s.pid === p.id), atDoor = S.doorSamples.includes(p.id), have = !!S.samples[p.id];
    let action;
    if (have) action = h("span", { class: "tag green" }, "You have a sample");
    else if (atDoor) action = h("span", { class: "tag gold" }, "At your door");
    else if (pend) action = h("span", { class: "tag teal" }, "Arrives " + fmtDay(pend.at));
    else action = btn("Request sample", "b-orange sm aff-req", () => { const q = { pid: p.id, ok: false }; emit("sample:request", q); if (q.ok) api.rerender(); });
    return h("div", { class: "tile" }, art(p.icon), h("b", {}, p.name), h("div", { class: "sub" }, `Sells for ${fmtMoney(p.price)}`),
      h("div", { class: "sub" }, `You earn ${Math.round(p.commission * 100)}% = ${fmtMoney(p.price * p.commission)} per sale`), action);
  });
  root.append(h("div", { class: "site" },
    h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#3a7bf0,#2fd9cf)" } }, h("span", { class: "logo" }, "Affiliate catalogue"), h("span", { class: "small" }, "Free samples. No stock. Earn a commission.")),
    h("div", { class: "banner", style: { marginBottom: ".6em" } }, "Request a sample. It arrives at your door in a few hours. Then film it and post it with your affiliate link."),
    h("div", { class: "grid g4" }, tiles)));
}
