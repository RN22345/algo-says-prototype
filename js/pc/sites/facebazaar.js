/* FaceBazaar: live-selling site. Live now (feed) and Go live (pick 1 to 4 shelf products, then play the live minigame). */
import { D, S } from "../../state.js";
import { registerActions } from "../../ui/windows.js";
import { siteAccess, has } from "../../sim/gear.js";
import { playLive } from "../../mini/live.js";
import { esc } from "../util.js";
import { nav } from "./nav.js";
import { feedHTML } from "./feeds.js";
import { productRow, shell, closedCard } from "./common.js";

const MAX = 4;
const fb = { pick: [], busy: false, last: null };
const LABEL = { claims: "Claims", sold: "Sold", joy: "Joy miners", missedClaims: "Missed claims", peakViewers: "Peak viewers", orders: "Orders", viewers: "Viewers", interest: "Room interest", cash: "Cash" };
const label = k => LABEL[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

function resultCard() {
  if (!fb.last) return "";
  const { items, result } = fb.last;
  const rows = Object.entries(result || {}).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => `<div class="card stat"><span class="lbl">${esc(label(k))}</span><b>${esc(typeof v === "number" ? Math.round(v * 100) / 100 : v)}</b></div>`).join("");
  return `<div class="br-lastlive"><div class="lbl">Your last live · ${items.map(k => D.PR[k].n).join(", ")}</div><div class="br-statrow">${rows || `<span class="br-sub">No numbers came back.</span>`}</div></div>`;
}

function livePage() {
  const acc = siteAccess("facebazaar");
  if (!acc.open) return closedCard(acc.reason, !has("tripod")) + resultCard();
  fb.pick = fb.pick.filter(k => D.PR[k] && S.stock[k] > 0);
  const prods = Object.keys(D.PR).map(k => {
    const on = fb.pick.includes(k), none = !(S.stock[k] > 0);
    return productRow(k, "br-fb-pick", on, none ? `<span class="br-sub">Not on your shelves</span>` : "", none || (!on && fb.pick.length >= MAX));
  }).join("");
  const n = fb.pick.length;
  return `<div class="br-livepage"><div class="lbl">Pick 1 to ${MAX} products from your shelves</div><div class="br-prodgrid">${prods}</div>
    <div class="br-actions"><span class="br-sub">${n} picked. Your claims and orders are up to you once you are live.</span>
      <button class="cap ac" type="button" data-act="br-fb-go" ${n < 1 || fb.busy ? "disabled" : ""}>${fb.busy ? "You are live…" : "Go live"}</button></div>
    ${resultCard()}</div>`;
}

registerActions({
  "br-fb-pick": (t, v) => { fb.pick = fb.pick.includes(v) ? fb.pick.filter(k => k !== v) : fb.pick.length < MAX ? [...fb.pick, v] : fb.pick; nav.redraw(); },
  "br-fb-go": async () => {
    if (fb.busy || !fb.pick.length || !siteAccess("facebazaar").open) return;
    const items = [...fb.pick]; fb.busy = true; nav.redraw();
    let result = null;
    try { result = await playLive({ items }); } catch (e) { console.warn("live minigame failed", e); }
    fb.busy = false; fb.last = { items, result: result || {} };
    nav.go("facebazaar", "live");
  }
});

export default {
  id: "facebazaar", name: "FaceBazaar", host: "facebazaar.example", icon: "📡", cat: "social", ac: "#2cc8b6", ac2: "#139180", c1: "#5fe3d3", c2: "#2cc8b6",
  pages: [{ id: "feed", label: "Live now", path: "live" }, { id: "live", label: "Go live", path: "go-live" }],
  path(tab) { return (this.pages.find(x => x.id === tab.page) || this.pages[0]).path; },
  render(tab) {
    const body = tab.page === "live" ? livePage() : feedHTML("facebazaar");
    return shell(this, tab, body, tab.page === "feed" ? `<button type="button" class="chip" data-act="br-reload" title="Show new lives">⟳ Refresh</button>` : "");
  }
};
