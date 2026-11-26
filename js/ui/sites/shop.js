/* MarketPlaza seller page on the PC (marketplaza.ph/seller). The same blocks as the phone app (shopview.js), laid out in two columns. */
import { D } from "../../core/data.js";
import { tier2On } from "../../core/state.js";
import { h } from "../ui.js";
import { pickupCard, listingRows, orderRows, reviewRows } from "../shopview.js";

export function render(root, def, api) {
  const head = h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#ff5fa2,#e8344f)", color: "#fff" } }, h("span", { class: "logo" }, D.shop.name), h("span", { class: "small" }, "Seller center"));
  if (!tier2On()) { root.append(h("div", { class: "site mp-site" }, head, h("div", { class: "banner" }, "Your shop opens when you own Shelves and a packing table. Buy them in the Tool Shop."))); return; }
  root.append(h("div", { class: "site mp-site" }, head,
    h("div", { class: "mp-cols" },
      h("div", { class: "mp-col" }, h("h3", {}, "Courier pickup"), pickupCard(api.rerender), h("h3", {}, "Listings"), ...listingRows(api.rerender)),
      h("div", { class: "mp-col" }, h("h3", {}, "Orders"), ...orderRows(), h("h3", {}, "Reviews"), ...reviewRows()))));
}
