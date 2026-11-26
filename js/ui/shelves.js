/* SHELVES (tier 2). Boxes you took in wait on the floor. Put them on the shelves (4 shelves, 6 places each). Only shelf stock sells. Click a full place to take it back. */
import { D } from "../core/data.js";
import { S } from "../core/state.js";
import { shelfRange, stationById } from "./world.js";
import { on, emit } from "../core/bus.js";
import { h, btn, art, clear, modal } from "./ui.js";

let win = null, off = null, openId = null;
/* stId = the station clicked: the house shelves or a shelf unit. Each owns a range of S.shelves (world.js shelfRange). */
export function openShelves(stId = "shelves") {
  if (win && win.back.isConnected) { if (openId === stId) return; win.close(); }
  openId = stId; const [from, count] = shelfRange(stId), unit = stationById(stId);
  const box = h("div", { class: "grid", style: { gridTemplateColumns: "1fr 1fr", gap: "1em" } });
  win = modal({ title: "📚 " + (unit && stId !== "shelves" ? unit.label : "Shelves"), cls: "dlg", body: box, onClose: () => { off && off(); win = null; } });
  const draw = () => {
    clear(box);
    const left = h("div", { class: "col" }, h("h3", {}, "Boxes on the floor"));
    const ids = Object.keys(S.boxes).filter(k => S.boxes[k] > 0);
    if (!ids.length) left.append(h("div", { class: "panel" }, "No boxes. Order stock on the Supplier site."));
    for (const id of ids) left.append(h("div", { class: "ordrow" }, art(D.P[id].icon), h("div", { class: "grow" }, h("b", { class: "lil" }, D.P[id].name), h("div", { class: "small mute" }, `${S.boxes[id]} in boxes`)),
      btn("Shelve 1", "b-gold sm", () => emit("shelf:put", { pid: id })), btn("All", "b-teal sm", () => { for (let i = 0; i < S.boxes[id] + 99 && S.boxes[id] > 0; i++) { const p = { pid: id, ok: false }; emit("shelf:put", p); if (!p.ok) break; } })));
    const right = h("div", { class: "shelf-box" }, S.shelves.slice(from, from + count).map((sh, k) => { const si = from + k; return h("div", { class: "shelf-row" }, sh.map((pid, slot) => h("div", { class: "cell" + (pid ? " full" : ""), title: pid ? D.P[pid].name + " (tap to take back)" : "Empty", onClick: () => { if (pid) emit("shelf:pull", { si, slot }); } }, pid ? art(D.P[pid].icon) : null))); }));
    box.append(left, h("div", {}, h("h3", {}, "Shelves"), right, h("div", { class: "small", style: { marginTop: ".3em", opacity: ".85" } }, "Orders take stock from the shelves. Empty shelves mean missed sales.")));
  };
  draw(); off = on("stock:changed", draw);
}
