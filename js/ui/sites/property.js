/* Property site (homes.ph). Lists the house extensions from D.world.properties (data/world.json, Builder A). Buy emits property:buy {id, ok}.
   Builder A's handler spends the cash and builds the room. If ok stays false and the player had the cash, a toast says it did not work. */
import { D } from "../../core/data.js";
import { S, fmtMoney } from "../../core/state.js";
import { emit } from "../../core/bus.js";
import { h, btn, vimg } from "../ui.js";
import { propList, hasProp, weeklyRent } from "../pc/helpers.js";

export function render(root, def, api) {
  const list = propList();
  const tiles = list.map(p => {
    const own = hasProp(p.id), can = S.cash >= p.price, need = p.requires && !hasProp(p.requires) ? (list.find(x => x.id === p.requires) || { name: p.requires }).name : null;
    return h("div", { class: "tile prop" + (own ? " owned" : "") }, vimg(["pr_" + p.id, p.art], p.emoji || "🏠", "big"), h("b", {}, p.name || p.id),
      h("div", { class: "sub" }, p.desc || p.does || p.text || "A new room for your house."),
      need && !own ? h("div", { class: "sub" }, `Needs: ${need}.`) : null,
      h("div", { class: "sub" }, `Rent goes up by ${fmtMoney(p.rentAdd || 0)} a week.`),
      own ? h("span", { class: "tag green" }, "Yours") : btn(`Buy ${fmtMoney(p.price)}`, can && !need ? "b-gold sm" : "b-grey sm", () => {
        if (need) return emit("toast", `Buy the ${need} first.`);
        const q = { id: p.id, ok: false }; emit("property:buy", q);
        if (q.ok) api.rerender(); else if (can) emit("toast", "This property could not be bought right now.", "bad");
      }));
  });
  root.append(h("div", { class: "site" },
    h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#3ec45a,#ffc61a)", color: "#1c2452" } }, h("span", { class: "logo" }, "Homes"), h("span", { class: "small" }, "Add rooms to your house")),
    h("div", { class: "banner", style: { marginBottom: ".6em" } }, `Your rent is ${fmtMoney(weeklyRent())} a week now. A new room adds to it. The room appears next to your house.`),
    list.length ? h("div", { class: "grid g3" }, tiles) : h("div", { class: "banner" }, "No properties are for sale right now.")));
}
