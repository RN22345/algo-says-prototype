/* PHONE feed apps: TikTik (short video, vertical cards) and YouView (long video, thumbnail rows), each in its own site colours.
   Both have two tabs: Feed (other creators with signals) and Mine (your posts, with a Results button).
   Also exports feedCard(f), the light card the PC site pages use. Events out: open:results. */
import { D } from "../../core/data.js";
import { S, fmtMoney } from "../../core/state.js";
import { fmt } from "../../core/clock.js";
import { feedFor } from "../../sim/rivals.js";
import { emit } from "../../core/bus.js";
import { h, btn, art } from "../ui.js";

export function ago(t) {
  const m = Math.max(0, Math.round(S.t - t));
  if (m < 2) return "just now"; if (m < 60) return m + " min ago";
  const hr = Math.round(m / 60); if (hr < 36) return hr + " h ago";
  return Math.round(hr / 24) + " days ago";
}
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : "");
const num = n => (n >= 10000 ? (n / 1000).toFixed(0) + "k" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));

/* The light card used on the PC site pages (and anywhere a plain feed row is needed). */
export function feedCard(f) {
  const p = f.p ? D.P[f.p] : null;
  return h("div", { class: "feed-card" }, p ? art(p.icon, "ic") : h("div", { class: "ic", style: { fontSize: "2em", textAlign: "center" } }, "📰"),
    h("div", { class: "grow" }, h("b", {}, f.news && !p ? f.text : (p ? p.short : "News")), " ", h("span", { class: "style-tag" }, f.style),
      h("div", { class: "meta" }, h("span", {}, "by " + f.by), f.views ? h("span", {}, f.views.toLocaleString() + " views") : null, f.likes ? h("span", {}, f.likes.toLocaleString() + " likes") : null, h("span", {}, fmt(f.at))),
      f.news && p ? h("div", { class: "top-c" }, f.text) : null, f.top ? h("div", { class: "top-c" }, `"${f.top}"`) : null));
}

function ttCard(f) {
  const p = f.p ? D.P[f.p] : null, news = f.news;
  return h("div", { class: "p-tt" },
    h("div", { class: "vid" }, p ? art(p.icon) : h("div", { class: "big" }, "📰"),
      f.style ? h("span", { class: "chipx" }, cap(f.style)) : null,
      f.views ? h("span", { class: "views" }, "▶ " + num(f.views)) : null),
    h("div", { class: "cap" }, h("b", {}, news && !p ? f.text : (p ? p.short : "News")), h("span", { class: "by" }, "@" + String(f.by).replace(/\s+/g, "_").toLowerCase())),
    news && p ? h("div", { class: "txt" }, f.text) : null,
    h("div", { class: "stats" }, f.likes ? h("span", {}, "♥ " + num(f.likes)) : null, h("span", {}, ago(f.at))),
    f.top ? h("div", { class: "cm" }, "💬 " + f.top) : null);
}
function ytRow(f) {
  const p = f.p ? D.P[f.p] : null, news = f.news;
  const len = `${3 + Math.floor(f.at) % 11}:${String(Math.floor(f.at * 7) % 60).padStart(2, "0")}`;
  const title = news && !p ? f.text : (p ? `${p.short}: ${cap(f.style || "review")}` : "News");
  return h("div", { class: "p-yt" },
    h("div", { class: "thumb" }, p ? art(p.icon) : h("div", { class: "big" }, "📰"), h("span", { class: "len" }, len)),
    h("div", { class: "meta" }, h("span", { class: "av" }, String(f.by)[0]), h("div", { class: "grow" }, h("b", {}, title),
      h("div", { class: "sub" }, `${f.by}${f.views ? " · " + num(f.views) + " views" : ""} · ${ago(f.at)}`),
      f.top ? h("div", { class: "cm" }, "💬 " + f.top) : null)));
}
function mine(site) {
  const list = S.posts.filter(p => p.site === site).slice().reverse().slice(0, 12), box = h("div", { class: "p-col" });
  if (!list.length) box.append(h("div", { class: "p-empty" }, `No ${D.SITE[site].name} posts yet. Film a video at the filming corner.`));
  for (const p of list) {
    const pr = D.P[p.pid];
    box.append(h("div", { class: "p-card" }, art(pr.icon, "ic"),
      h("div", { class: "grow" }, h("b", {}, pr.short), " ", h("span", { class: "p-chip " + (p.done ? "green" : "teal") }, p.done ? "ended" : "live"),
        h("div", { class: "sub" }, `${p.views.toLocaleString()} views · ${p.orders} orders · ${fmtMoney(p.profit)}`)),
      btn("Results", "b-blue sm", () => emit("open:results", p.id))));
  }
  return box;
}

const sub = { tiktik: "feed", youview: "feed" };
function make(id, emoji) {
  return {
    id, label: D.SITE[id].name, emoji, vicon: null, grad: [D.SITE[id].accent, D.SITE[id].accent2], badge: () => null,
    draw(ctx) {
      const s = D.SITE[id];
      ctx.setHead(s.name, { bg: `linear-gradient(90deg,${s.accent},${s.accent2})`, solid: s.accent, brand: true, dark: id === "tiktik", sub: `${S.followers[id]} followers` });
      ctx.setTabs([{ id: "feed", label: "Feed" }, { id: "mine", label: "My posts" }], sub[id], k => { sub[id] = k; ctx.refresh(); });
      ctx.scroll.classList.add(id === "tiktik" ? "tt-bg" : "yt-bg");
      if (sub[id] === "mine") { ctx.scroll.append(mine(id)); return; }
      const list = feedFor(id, 14);
      if (!list.length) ctx.scroll.append(h("div", { class: "p-empty" }, "The feed is quiet right now."));
      for (const f of list) ctx.scroll.append(id === "tiktik" ? ttCard(f) : ytRow(f));
    }
  };
}
export const tiktikApp = () => make("tiktik", "♪");
export const youviewApp = () => make("youview", "▶");
