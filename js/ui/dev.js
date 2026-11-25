/* DEV PANEL (backtick key or the purple button). Time speed, cash, energy, skip to a time, push a trend stage, toggle feature flags,
   list and trigger events, force a platform update, reset the save. Uses the same events as the game. */
import { D } from "../core/data.js";
import { S, flag, setFlag } from "../core/state.js";
import { skipTo, nextAt, absAt, dayOf } from "../core/clock.js";
import { wipe } from "../core/save.js";
import { on, emit } from "../core/bus.js";
import { h, btn, clear } from "./ui.js";
import { eventIds, activeEvents, allEvents } from "../sim/events.js";

let root, panel, shown = false;
export function initDev() {
  root = document.getElementById("dev"); root.hidden = false;
  document.getElementById("frame").append(h("button", { id: "devbtn", type: "button", "aria-label": "Dev panel", onClick: toggle }, "D"));
  document.addEventListener("keydown", e => { if (e.key === "`" || e.key === "~") { e.preventDefault(); toggle(); } });
  on("flag:changed", () => { if (shown) render(); });
}
function toggle() { shown = !shown; if (!panel) { panel = h("div", { class: "dp" }); root.append(panel); } panel.style.display = shown ? "block" : "none"; if (shown) render(); }
function render() {
  clear(panel);
  const add = (...n) => panel.append(...n);
  add(h("h4", {}, "Time speed (now x" + (S.speed || 1) + ")"), h("div", {}, ...[1, 5, 20].map(x => btn("x" + x, S.speed === x ? "b-gold sm" : "b-blue sm", () => { S.speed = x; render(); }))));
  add(h("h4", {}, "Resources"), h("div", {}, btn("+₱1000", "b-green sm", () => { emit("money:earn", { amount: 1000, why: "Dev" }); render(); }), btn("+₱10000", "b-green sm", () => { emit("money:earn", { amount: 10000, why: "Dev" }); }),
    btn("Energy full", "b-teal sm", () => { S.energy = D.time.energy.max; emit("energy:changed"); }), btn("Energy 0", "b-red sm", () => { S.energy = 0; emit("energy:changed"); }),
    btn("+100 followers", "b-teal sm", () => { S.followers.tiktik += 100; S.followers.youview += 100; emit("followers:changed"); }),
    btn("Trust +10", "b-orange sm", () => { S.trust = Math.min(100, S.trust + 10); emit("trust:changed"); })));
  add(h("h4", {}, "Gear"), h("div", {}, ...D.gear.map(g => btn((S.gear[g.id] ? "✓ " : "") + g.name, S.gear[g.id] ? "b-gold sm" : "b-grey sm", () => { S.gear[g.id] = !S.gear[g.id]; emit("gear:changed"); render(); }))));
  const hr = h("select", {}, ...[6, 7, 9, 11, 12, 14, 17, 18, 20, 23].map(x => h("option", { value: x }, x + ":00")));
  add(h("h4", {}, "Skip to (next day if past)"), h("div", { class: "row" }, hr, btn("Go", "b-blue sm", () => { skipTo(nextAt(+hr.value * 60), "skip"); }), btn("+1 day", "b-blue sm", () => skipTo(S.t + 1440, "skip")), btn("+3 h", "b-blue sm", () => skipTo(S.t + 180, "skip"))));
  const ps = h("select", {}, ...D.products.map(p => h("option", { value: p.id }, p.short + " (" + S.trends[p.id].stage + ")"))), st = h("select", {}, ...["calm", "whisper", "rising", "peak", "crowded", "afterglow"].map(x => h("option", { value: x }, x)));
  add(h("h4", {}, "Push a trend stage"), h("div", { class: "row" }, ps, st, btn("Push", "b-orange sm", () => { emit("market:push", { p: ps.value, stage: st.value }); render(); })));
  add(h("h4", {}, "Feature flags"), ...Object.keys(D.config.features).map(k => h("label", {}, h("input", { type: "checkbox", checked: flag(k), onChange: e => setFlag(k, e.target.checked) }), k)));
  add(h("label", {}, "editor mode ", (() => { const s = h("select", { onChange: e => { D.config.editorMode = e.target.value; } }, ...D.config.editorModes.map(m => h("option", { value: m, selected: D.config.editorMode === m }, m))); return s; })()));
  const act = activeEvents(), all = allEvents();
  add(h("h4", {}, `Events (${act.length} active, ${all.length} queued)`), ...all.map(e => h("div", {}, `${act.includes(e) ? "● " : "○ "}${e.name}${e.product ? " (" + e.product + ")" : ""} ends ${Math.round((e.end - S.t) / 60)}h`)));
  const es = h("select", {}, ...eventIds().map(x => h("option", { value: x }, x)));
  add(h("div", { class: "row" }, es, btn("Trigger", "b-orange sm", () => { emit("events:trigger", { id: es.value }); render(); })));
  const us = h("select", {}, ...D.sites.updates.map(u => h("option", { value: u.id }, u.id + (S.updatesApplied.includes(u.id) ? " (done)" : ""))));
  add(h("h4", {}, "Platform update"), h("div", { class: "row" }, us, btn("Force", "b-orange sm", () => { emit("update:force", { id: us.value }); render(); })));
  add(h("h4", {}, "Save"), h("div", {}, btn("Reset save", "b-red sm", () => { wipe(); location.reload(); })));
}
