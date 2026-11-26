/* Tool Shop. Equipment is the gate (D-70): ring light (light option at any hour), camera (opens YouView), shelves and packing table (opens reselling).
   Items come from data/gear.json. Buying emits gear:changed. */
import { D } from "../../core/data.js";
import { S, fmtMoney, flag } from "../../core/state.js";
import { emit } from "../../core/bus.js";
import { spend, toast, sfx } from "../../core/actions.js";
import { h, btn, art, vimg } from "../ui.js";
import { furnList } from "../pc/helpers.js";

export function render(root, def, api) {
  const tiles = D.gear.filter(g => g.id !== "shelves" || flag("tier2")).map(g => {
    const own = !!S.gear[g.id];
    return h("div", { class: "tile" }, art(g.art), h("b", {}, g.name), h("div", { class: "sub" }, g.does),
      own ? h("span", { class: "tag green" }, "Owned") : btn(`Buy ${fmtMoney(g.price)}`, (S.cash >= g.price ? "b-gold sm" : "b-grey sm") + " ts-" + g.id, () => {
        if (!spend(g.price, "Gear: " + g.name)) return;
        S.gear[g.id] = true; emit("gear:changed"); toast(`${g.name} installed.`); sfx("coin"); api.rerender();
      }));
  });
  const fl = furnList();
  const furn = fl.map(f => h("div", { class: "tile" }, vimg([f.sprite, "fn_" + f.id, f.id], f.emoji || "🪑", "big"), h("b", {}, f.name || f.id), h("div", { class: "sub" }, f.does || f.desc || "Furniture for your house."),
    btn(`Buy ${fmtMoney(f.price || 0)}`, S.cash >= (f.price || 0) ? "b-gold sm" : "b-grey sm", () => {
      const q = { id: f.id, ok: false }; emit("furniture:buy", q);
      if (q.ok) api.rerender(); else if (S.cash >= (f.price || 0)) emit("toast", "That could not be bought right now.", "bad");
    })));
  root.append(h("div", { class: "site" },
    h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#ee7a30,#ffc61a)", color: "#1c2452" } }, h("span", { class: "logo" }, "Tool Shop"), h("span", { class: "small" }, "Equipment opens features")),
    h("div", { class: "grid g3" }, tiles),
    fl.length ? [h("h3", { style: { marginTop: ".8em" } }, "Furniture"), h("div", { class: "banner", style: { marginBottom: ".6em" } }, "Bought pieces wait in your bag (key I). Place them with Move furniture."), h("div", { class: "grid g4" }, furn)] : null));
}
