/* DOOR. Samples and supplier boxes wait here until you take them in. Packed parcels wait here for the courier (pickups at set hours). */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { nextAt, fmtDay, fmt } from "../core/clock.js";
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
      const times = D.time.courierTimes.map(m => fmt(nextAt(m) )).join(" and ");
      box.append(h("h3", {}, "Parcels for the courier"), h("div", { class: "panel" }, packed.length ? `${packed.length} packed parcel${packed.length > 1 ? "s" : ""} waiting. ` : "No packed parcels. ", `The courier comes at ${D.time.courierTimes.map(m => Math.floor(m / 60) + ":00").join(" and ")}.` + (S.mods.courierDelay ? " Running late today." : "")));
    }
  };
  draw(); offs = ["stock:changed", "order:packed", "order:shipped", "tick"].map(ev => on(ev, () => { if (ev !== "tick") draw(); }));
}
const row = (icon, title, sub, action) => h("div", { class: "ordrow" }, icon, h("div", { class: "grow" }, h("b", { class: "lil" }, title), h("div", { class: "small mute" }, sub)), action);
