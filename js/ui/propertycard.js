/* PROPERTY CARD. Opens when the player clicks a for-sale sign: the room's price, the new rent and what it does, with a Buy button.
   Buying goes through the property:buy event (js/sim/property.js). The Property page on the desk PC uses the same event. */
import { D } from "../core/data.js";
import { S, fmtMoney } from "../core/state.js";
import { emit } from "../core/bus.js";
import { h, btn, modal } from "./ui.js";
import { rentExtra } from "../sim/property.js";

export function openProperty(id) {
  const p = (D.world.properties || []).find(x => x.id === id); if (!p) return;
  const req = p.requires && !S.property[p.requires] ? D.world.properties.find(x => x.id === p.requires) : null;
  const now = D.time.rent.amount + rentExtra(), body = h("div", { class: "col" });
  const win = modal({ title: "🏷️ For sale: " + p.name, cls: "dlg", body, pause: true });
  body.append(h("p", {}, p.does),
    h("div", { class: "panel" }, h("div", {}, h("b", { class: "lil" }, "Price: "), fmtMoney(p.price)),
      h("div", {}, h("b", { class: "lil" }, "Rent: "), `${fmtMoney(now)} now, ${fmtMoney(now + p.rentAdd)} after (${fmtMoney(p.rentAdd)} more each rent day)`)));
  if (S.property[id]) body.append(h("div", { class: "panel" }, "You own this room."));
  else if (req) body.append(h("div", { class: "panel" }, `Buy the ${req.name} first.`));
  else body.append(btn(`Buy for ${fmtMoney(p.price)}`, "b-gold", () => { const q = { id, ok: false }; emit("property:buy", q); if (q.ok) win.close(); }));
}
