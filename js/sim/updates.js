/* PLATFORM UPDATES (flag platformUpdates). A rumour post shows up in the feed first, then the rule changes: values in D.SITE shift (data/sites.json "updates").
   Playbook entries named in "outdates" are marked "may be outdated". Events in: tick, update:force {id}. Events out: feed:post, inbox:add, update:applied.
   The viewer model reads D.SITE live, so the next post tests the change. Saved updates are replayed on load (save.js). */
import { D, bumpSite } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { absAt } from "../core/clock.js";

export function init() {
  on("tick", ({ t1 }) => {
    if (!flag("platformUpdates")) return;
    for (const u of D.sites.updates) {
      const at = absAt(u.day, u.hour);
      if (!S.updatesRumoured.includes(u.id) && t1 >= at - u.rumourBeforeMin) rumour(u);
      if (!S.updatesApplied.includes(u.id) && t1 >= at) apply(u);
    }
  });
  on("update:force", ({ id }) => { const u = D.sites.updates.find(x => x.id === id); if (u && !S.updatesApplied.includes(u.id)) { rumour(u); apply(u); } });
}

function rumour(u) {
  if (S.updatesRumoured.includes(u.id)) return;
  S.updatesRumoured.push(u.id);
  emit("feed:post", { by: "Rumour mill", text: u.rumour, news: true, style: "Rumour", site: "tiktik", top: "is it true?? heard the same" });
  S.events.headlines.unshift({ at: S.t, text: "Rumour: " + u.rumour, id: u.id }); S.events.headlines.length = Math.min(8, S.events.headlines.length);
  emit("inbox:add", { kind: "news", title: "Rumour about the sites", text: u.rumour });
  emit("summary:add", "A rumour about a site change is going around.");
}
function apply(u) {
  S.updatesApplied.push(u.id);
  for (const [path, d] of Object.entries(u.set || {})) bumpSite(path, d);
  for (const id of u.outdates || []) if (S.playbook[id]) S.playbook[id].outdated = true;
  emit("feed:post", { by: "Site news", text: u.news, news: true, style: "Update", site: "tiktik" });
  S.events.headlines.unshift({ at: S.t, text: u.news, id: u.id }); S.events.headlines.length = Math.min(8, S.events.headlines.length);
  emit("inbox:add", { kind: "news", title: "Platform update", text: u.news });
  emit("summary:add", u.news);
  emit("update:applied", u); emit("sfx", "ding");
}
