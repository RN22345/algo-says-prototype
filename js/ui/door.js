/* DOOR. Samples and supplier boxes wait here until you take them in. When the booked courier is here, hand over the packed parcels (D-113). */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { fmt } from "../core/clock.js";
import { courierHere, openPickup } from "../sim/shop.js";
import { on, emit } from "../core/bus.js";
import { h, btn, art, clear, modal } from "./ui.js";

let win = null, offs = [];
export function openDoor() {
  if (win && win.back.isConnected) return;
  const box = h("div", { class: "col" });
  win = modal({ title: "🚪 Front door", cls: "dlg", body: box, onClose: () => { offs.forEach(f => f()); offs = []; win = null; } });
  const draw = () => {
    clear(box);
    const items = [];
    for (const pid of S.doorSamples) items.push(row(art(D.P[pid].icon), `Sample: ${D.P[pid].name}`, "Free sample from the seller", btn("Take it in", "b-gold sm", () => emit("door:take", { kind: "sample", id: pid }))));
    for (const b of S.doorBoxes) items.push(row(art("stock_box"), "Supplier box", Object.entries(b.items).map(([k, v]) => `${v} x ${D.P[k].short}`).join(", "), btn("Take it in", "b-gold sm", () => emit("door:take", { kind: "box", id: b.id }))));
    box.append(h("h3", {}, "Waiting at the door"));
    if (items.length) box.append(...items); else box.append(h("div", { class: "panel" }, "Nothing at the door right now."));
    if (S.doorSamples.length + S.doorBoxes.length > 1) box.append(btn("Take everything in", "b-teal", () => { [...S.doorSamples].forEach(id => emit("door:take", { kind: "sample", id })); [...S.doorBoxes].forEach(b => emit("door:take", { kind: "box", id: b.id })); }));
    if (flag("tier2")) {
      const packed = S.orders.filter(o => o.status === "packed");
      const here = courierHere(), pk = openPickup(), n = packed.length, pl = n === 1 ? "" : "s";
      box.append(h("h3", {}, "Parcels for the courier"));
      if (here) box.append(h("div", { class: "panel" }, `The courier is here until ${fmt(here.leave)}. ${n ? n + " packed parcel" + pl + " ready." : "Nothing is packed."}`),
        n ? btn(`Hand over ${n} parcel${pl}`, "b-gold", () => { const q = { ok: false }; emit("pickup:handover", q); if (q.ok) emit("sfx", "coin"); draw(); }) : null);
      else box.append(h("div", { class: "panel" }, `${n ? n + " packed parcel" + pl + " waiting. " : "No packed parcels. "}` + (pk ? `Courier booked: ${fmt(pk.from)} to ${fmt(pk.to)}. Be here when they come.` : "No courier booked. Book a pickup on MarketPlaza (phone or PC).")));
    }
  };
  draw(); offs = ["stock:changed", "order:packed", "order:shipped", "courier:arrived", "courier:left", "tick"].map(ev => on(ev, () => { if (ev !== "tick") draw(); }));
}
const row = (icon, title, sub, action) => h("div", { class: "ordrow" }, icon, h("div", { class: "grow" }, h("b", { class: "lil" }, title), h("div", { class: "small mute" }, sub)), action);
