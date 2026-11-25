/* Seller Hub: news headlines (events, rumours, updates), the trending list (a count of posts, not a forecast) and the offline leaderboard against virtual rivals. */
import { D } from "../../core/data.js";
import { S, flag } from "../../core/state.js";
import { fmtDay } from "../../core/clock.js";
import { trendingList, leaderboard } from "../../sim/rivals.js";
import { h, art } from "../ui.js";

export function render(root) {
  const tr = trendingList().slice(0, 6), max = Math.max(1, tr[0] ? tr[0].posts : 1), lb = leaderboard();
  const news = S.events.headlines.slice(0, 5);
  root.append(h("div", { class: "site" },
    h("div", { class: "site-h", style: { background: "linear-gradient(90deg,#1c2452,#b744c9)" } }, h("span", { class: "logo" }, "Seller Hub"), h("span", { class: "small" }, "News, trends and top sellers")),
    h("h3", {}, "News"),
    news.length ? h("div", { class: "col" }, news.map(n => h("div", { class: "banner" }, h("b", {}, fmtDay(n.at) + "  "), n.text))) : h("div", { class: "banner" }, "No news today."),
    h("div", { class: "grid g2", style: { marginTop: ".6em" } },
      h("div", {}, h("h3", {}, "Most posted, last 3 hours"), h("div", { class: "col" }, tr.map((r, i) => h("div", { class: "hub-row" }, h("span", { class: "no" }, i + 1), art(D.P[r.p].icon),
        h("div", {}, D.P[r.p].name, h("div", { class: "bar-bg" }, h("i", { style: { width: Math.round(r.posts / max * 100) + "%" } }))), h("span", { class: "small" }, r.posts + " posts"))))),
      h("div", {}, h("h3", {}, "Top sellers (offline)"), h("div", { class: "col" }, lb.map((r, i) => h("div", { class: "hub-row" + (r.me ? " me" : "") }, h("span", { class: "no" }, i + 1), h("span", {}, r.me ? "⭐" : "🏪"),
        h("div", {}, r.n, r.habit ? h("div", { class: "tiny mute" }, r.habit) : null), h("span", { class: "small" }, r.sales + " sales"))))))));
}
