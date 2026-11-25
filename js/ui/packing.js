/* PACKING TABLE (tier 2). Each order reserved a unit from the shelf. Tap Pack three times to tape the box (costs energy). Packed parcels wait at the door for the courier. */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { fmt, nextAt } from "../core/clock.js";
import { energyCheck } from "../core/actions.js";
import { h, btn, art, clear, modal } from "./ui.js";

let win = null, offs = [], prog = {};
export function openPacking() {
  if (win && win.back.isConnected) return;
  const box = h("div", { class: "col" });
  win = modal({ title: "📦 Packing table", cls: "dlg", body: box, onClose: () => { offs.forEach(f => f()); offs = []; win = null; } });
  const draw = () => {
    clear(box);
    const todo = S.orders.filter(o => o.status === "toPack"), packed = S.orders.filter(o => o.status === "packed");
    box.append(h("div", { class: "panel" }, `Pack costs ${D.time.energy.pack} energy each. Courier pickups at ${D.time.courierTimes.map(m => Math.floor(m / 60) + ":00").join(" and ")}. ${packed.length} parcel${packed.length === 1 ? "" : "s"} waiting.`));
    if (!todo.length) box.append(h("div", { class: "panel" }, "No orders to pack. Orders come when your posts get buyers and the shelf has stock."));
    for (const o of todo) {
      const n = prog[o.id] || 0;
      box.append(h("div", { class: "ordrow" }, art(D.P[o.pid].icon), h("div", { class: "grow" }, h("b", { class: "lil" }, `Order #${o.no}`), h("div", { class: "small mute" }, D.P[o.pid].name)),
        h("div", { class: "bar-bg", style: { width: "120px" } }, h("i", { style: { width: n / 3 * 100 + "%", background: "var(--green)" } })),
        btn(n ? "Tape! " + n + "/3" : "Pack", "b-orange sm", () => {
          if (!n && !energyCheck()) return; prog[o.id] = n + 1; emit("sfx", "tap");
          if (prog[o.id] >= 3) { const p = { id: o.id, ok: false }; emit("order:pack", p); delete prog[o.id]; if (p.ok) emit("sfx", "coin"); }
          draw();
        })));
    }
  };
  draw(); offs = ["order:new", "order:packed", "order:shipped", "stock:changed"].map(ev => on(ev, draw));
}
