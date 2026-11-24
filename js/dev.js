/* Developer panel (testing only). Toggle with F1 or the Dev menu item. */
import { D, S, rt, emit } from "./state.js";
import { $, registerActions } from "./ui/windows.js";
import { makeOrder } from "./sim/shop.js";
import { finishPostNow } from "./sim/post.js";
import { record } from "./sim/ledger.js";

let stepFn = null;

export function toggleDev(force) {
  const p = $("#dev"); if (!p) return;
  p.hidden = force === undefined ? !p.hidden : !force;
  const b = $("#devBtn"); if (b) b.setAttribute("aria-expanded", String(!p.hidden));
  devTick();
}

/* Called from the UI refresh: updates the checkboxes text and FPS read-out. */
export function devTick() {
  const f = $("#devFps"); if (f) f.textContent = rt.showFps ? `${Math.round(rt.fps)} FPS` : "";
}

export function initDev({ step }) {
  stepFn = step;
  registerActions({
    "dev-toggle": () => toggleDev(),
    "dev-cash": () => { S.cash += D.T.dev.cash; record("in", D.T.dev.cash, { note: "Developer cash" }); emit("refresh"); },
    "dev-orders": () => { Object.keys(D.PR).forEach(p => makeOrder(p, true)); emit("refresh"); },
    "dev-stock": () => { Object.keys(D.PR).forEach(p => { S.stock[p] = D.T.dev.stock; }); emit("refresh"); },
    "dev-skip": () => { stepFn(D.T.dev.skip); },
    "dev-finish": () => { finishPostNow(); emit("refresh"); },
    "dev-zones": (t) => { rt.showZones = !rt.showZones; t.setAttribute("aria-pressed", String(rt.showZones)); },
    "dev-fps": (t) => { rt.showFps = !rt.showFps; t.setAttribute("aria-pressed", String(rt.showFps)); devTick(); }
  });
}
