/* BED. Nap skips 2 hours and gives back some energy. Sleep skips to 6:00 and gives full energy. The simulation keeps running during the skip
   (posts, orders, deliveries), then a "while you slept" summary opens on the phone. */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { tod, skipBy, sleepToMorning, fmt } from "../core/clock.js";
import { emit } from "../core/bus.js";
import { h, btn, modal } from "./ui.js";
import { blackout } from "./cards.js";

export function openBed() {
  const canNap = tod() + D.time.napMinutes < 1440;
  const m = modal({
    title: "🛏️ Bed", cls: "dlg sm",
    body: h("div", { class: "col" },
      h("div", { class: "panel" }, `It is ${fmt()}. Energy ${Math.round(S.energy)} of ${D.time.energy.max}.`),
      h("div", { class: "row" }, btn(`Nap (${D.time.napMinutes / 60} h, +${D.time.napEnergy} energy)`, canNap ? "b-teal" : "b-grey", () => { if (!canNap) return emit("toast", "Too late for a nap. Sleep instead."); m.close(); blackout("Zzz...", () => skipBy(D.time.napMinutes, "nap")).then(() => emit("phone:open", { tab: "inbox" })); }),
        btn("Sleep until 6:00", "b-blue", () => { m.close(); blackout("Sleeping...", () => sleepToMorning("sleep"), 1100).then(() => emit("phone:open", { tab: "inbox" })); })),
      h("div", { class: "small", style: { opacity: ".85" } }, "Posts, orders and deliveries keep going while you rest.")),
  });
}
