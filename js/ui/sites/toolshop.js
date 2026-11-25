/* Tool Shop. Equipment is the gate (D-70): ring light (light option at any hour), camera (opens YouView), shelves and packing table (opens reselling).
   Items come from data/gear.json. Buying emits gear:changed. */
import { D } from "../../core/data.js";
import { S, fmtMoney, flag } from "../../core/state.js";
import { emit } from "../../core/bus.js";
import { spend, toast, sfx } from "../../core/actions.js";
import { h, btn, art } from "../ui.js";

export function render(root, def, api) {
  const tiles = D.gear.filter(g => g.id !== "shelves" || flag("tier2")).map(g => {
    const own = !!S.gear[g.id];
    return h("div", { class: "tile" }, art(g.art), h("b", {}, g.name), h("div", { class: "sub" }, g.does),
      own ? h("span", { class: "tag green" }, "Owned") : btn(`Buy ${fmtMoney(g.price)}`, S.cash >= g.price ? "b-gold sm" : "b-grey sm", () => {
        if (!spend(g.price, "Gear: " + g.name)) return;
        S.gear[g.id] = true; emit("gear:changed"); toast(`${g.name} installed.`); sfx("coin"); api.rerender();
      }));
  });
  root.append(h("div", { class: "site" },
    h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#ee7a30,#ffc61a)", color: "#1c2452" } }, h("span", { class: "logo" }, "Tool Shop"), h("span", { class: "small" }, "Equipment opens features")),
    h("div", { class: "grid g3" }, tiles)));
}
