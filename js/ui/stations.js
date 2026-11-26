/* STATIONS router. Maps a clicked station (data/room.json "opens") to its screen. Screens load lazily, so a missing module never stops the boot.
   Events in: station:click {id, locked}. Events out: studio:open. */
import { D } from "../core/data.js";
import { S, hasGear } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { toast, sfx } from "../core/actions.js";

const firstTime = () => !S.posts.length && !Object.keys(S.samples).length && !S.samplePending.length && !S.doorSamples.length;
const OPEN = {
  pc: () => import("./browser.js").then(m => m.openBrowser(firstTime() ? (S.mode === "reseller" ? (S.posts.length || Object.keys(S.boxes).length || S.deliveries.length ? undefined : "supplier") : "affiliate") : undefined)),
  studio: () => import("./studio.js").then(m => m.openStudio()),
  door: () => import("./door.js").then(m => m.openDoor()),
  bed: () => import("./bed.js").then(m => m.openBed()),
  shelves: () => import("./shelves.js").then(m => m.openShelves()),
  packing: () => import("./packing.js").then(m => m.openPacking()),
  algo: () => {}
};
export function initStations() {
  on("station:click", ({ id, locked }) => {
    const st = D.room.stations.find(s => s.id === id); if (!st) return;
    if (locked) { toast(`Locked. Buy "${D.G[st.requiresGear].name}" in the Tool Shop on the desk PC.`); sfx("error"); return; }
    const f = OPEN[st.opens]; if (f) f().catch(e => console.error("[open " + st.opens + "]", e));
  });
  on("open:browser", tab => import("./browser.js").then(m => m.openBrowser(tab)));
  on("open:studio", site => import("./studio.js").then(m => m.openStudio(typeof site === "string" ? site : undefined)));
  on("open:results", id => import("./results.js").then(m => m.openResults(id)));
}
