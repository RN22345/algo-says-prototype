/* Supplier (tier 2). Unit prices rise while a trend is hot or an event pushes costs. Orders placed before 18:00 arrive at 9:00 next day at the door.
   Before the shelves are bought the page is read only: you can still see "in demand" tags and prices (signals). */
import { D } from "../../core/data.js";
import { S, fmtMoney, tier2On, flag } from "../../core/state.js";
import { fmtDay, tod } from "../../core/clock.js";
import { emit } from "../../core/bus.js";
import { h, btn, art } from "../ui.js";

export function render(root, def, api) {
  const on_ = tier2On(), cut = D.time.supplierCutoff;
  const rows = D.products.map(p => {
    const unit = Math.round(p.cost * (S.market.costMult[p.id] || 1)), up = unit > p.cost * 1.04;
    const q = p.pack;
    return h("div", { class: "hub-row", style: { gridTemplateColumns: "3em 1fr auto auto" } }, art(p.icon),
      h("div", {}, h("b", {}, p.name), " ", S.market.inDemand[p.id] ? h("span", { class: "tag teal" }, "In demand") : null, up ? h("span", { class: "tag", style: { marginLeft: ".3em" } }, "Price up") : null,
        h("div", { class: "tiny mute" }, `Sells for ${fmtMoney(p.price)} · you have ${shelf(p.id)} on shelves, ${S.boxes[p.id] || 0} in boxes`)),
      h("span", { class: "lil" }, `${fmtMoney(unit)} each`),
      btn(on_ ? `Order ${q} (${fmtMoney(unit * q)})` : "Locked", on_ ? "b-gold sm" : "b-grey sm", () => { if (!on_) return emit("toast", "Buy Shelves and packing table in the Tool Shop first."); const o = { pid: p.id, qty: q, ok: false }; emit("stock:order", o); if (o.ok) api.rerender(); }));
  });
  const arr = S.deliveries.map(d => h("div", { class: "banner" }, `On the way: ${Object.entries(d.items).map(([k, v]) => `${v} x ${D.P[k].short}`).join(", ")}. Arrives ${fmtDay(d.at)}.`));
  root.append(h("div", { class: "site" },
    h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#2c3a82,#3ec45a)" } }, h("span", { class: "logo" }, "Supplier"), h("span", { class: "small" }, "Wholesale stock")),
    h("div", { class: "banner", style: { marginBottom: ".5em" } }, on_ ? `Order before ${cut / 60}:00 and it arrives at ${D.time.supplierArrive / 60}:00 tomorrow. You pay now. Cash on delivery comes from buyers.` : "Read only. Buy Shelves and packing table in the Tool Shop to open reselling."),
    ...arr, h("div", { class: "col", style: { marginTop: ".5em" } }, rows)));
}
const shelf = id => S.shelves.reduce((a, sh) => a + sh.filter(x => x === id).length, 0);
