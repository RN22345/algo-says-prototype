/* Save and load S in localStorage. A missing, broken or old-version save resets cleanly. */
import { D, resetSites, bumpSite } from "./data.js";
import { S, makeState, resetState } from "./state.js";
import { emit } from "./bus.js";

const key = () => D.config.storageKey;

let blocked = false;
export function save() {
  if (blocked || !S.started) return;
  try { localStorage.setItem(key(), JSON.stringify({ v: D.config.saveVersion, S })); } catch (e) { /* storage blocked */ }
}

function replayUpdates() {
  resetSites();
  for (const id of S.updatesApplied) {
    const u = D.sites.updates.find(x => x.id === id);
    if (u) for (const [p, d] of Object.entries(u.set || {})) bumpSite(p, d);
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(key()); if (!raw) return false;
    const o = JSON.parse(raw);
    if (!o || o.v !== D.config.saveVersion || !o.S || o.S.v !== D.config.saveVersion) { localStorage.removeItem(key()); return false; }
    const base = makeState();
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, base, o.S);
    replayUpdates();
    return true;
  } catch (e) { try { localStorage.removeItem(key()); } catch (e2) { /* ignore */ } return false; }
}

export function wipe() { blocked = true; try { localStorage.removeItem(key()); } catch (e) { /* ignore */ } resetState(); resetSites(); }
export function newGame(mode = "affiliate") {
  blocked = false; resetState(); resetSites(); S.started = true; S.mode = mode;
  if (mode === "reseller") {           // skip the affiliate tier: shelves owned, more cash, affiliate site off
    const r = D.config.start.reseller || {}; S.gear.shelves = true; S.flags.affiliate = false; S.cash = r.cash ?? S.cash;
  }
  emit("newgame"); if (mode === "reseller") emit("gear:changed"); save();
}
export function initSave() {
  setInterval(save, 10000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
}
