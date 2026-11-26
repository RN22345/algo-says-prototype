/* TikTik and YouView pages: Feed (other creators, with signals: post style, views, likes, top comment) and My posts (live stats, results). */
import { D } from "../../core/data.js";
import { S, hasGear, siteOpen, fmtMoney } from "../../core/state.js";
import { emit } from "../../core/bus.js";
import { feedFor } from "../../sim/rivals.js";
import { feedCard } from "../phone.js";
import { h, btn, art } from "../ui.js";

const sub = {};
export function render(root, def) {
  const id = def.site, site = D.SITE[id], open = siteOpen(id);
  sub[id] = sub[id] || "feed";
  const head = h("div", { class: "site-h", style: { background: `linear-gradient(90deg,${site.accent},${site.accent2})` } },
    h("span", { class: "logo" }, site.name), h("span", { class: "small" }, site.format),
    h("span", { class: "grow" }), h("span", { class: "small" }, `${S.followers[id]} followers`),
    btn(open ? "Make a video" : "Needs gear", open ? "b-gold sm" : "b-grey sm", () => { if (open) emit("open:studio", id); else emit("toast", `${site.name} needs a ${D.G[site.needsGear].name}. Buy it in the Tool Shop.`); }));
  const tabs = h("div", { class: "site-tabs" }, ...[["feed", "Feed"], ["mine", "My posts"]].map(([k, l]) => h("button", { class: "chip" + (sub[id] === k ? " sel" : ""), type: "button", onClick: () => { sub[id] = k; emit("stock:changed"); } }, l)));
  const body = h("div", { class: "grid g2" });
  if (sub[id] === "feed") {
    const list = feedFor(id, 16);
    if (!list.length) body.append(h("div", { class: "banner" }, "Quiet right now. Check back later."));
    for (const f of list) { const c = feedCard(f); body.append(c); }
  } else {
    const mine = S.posts.filter(p => p.site === id).slice().reverse();
    if (!mine.length) body.append(h("div", { class: "banner" }, `No ${site.name} posts yet. Film a video at the filming corner.`));
    for (const p of mine) body.append(postCard(p));
  }
  root.append(h("div", { class: "site" }, head, tabs, body));
}
export function postCard(p) {
  const pr = D.P[p.pid];
  return h("div", { class: "post-card" }, art(pr.icon),
    h("div", { class: "grow" }, h("b", { class: "lil" }, pr.name), " ", h("span", { class: "tag " + (p.done ? "green" : "teal") }, p.done ? "ended" : "live"),
      h("div", { class: "small" }, `${p.views.toLocaleString()} views · ${p.orders} orders · ${fmtMoney(p.profit)} earned${p.missed ? " · " + p.missed + " missed" : ""}`)),
    btn("Results", "b-blue sm", () => emit("open:results", p.id)));
}
