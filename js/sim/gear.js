/* Equipment (D-70): the only thing that opens features. Bought at the Tool Shop site or the mall. */
import { D, S, toast } from "../state.js";
import { peso } from "../ui/format.js";
import { record } from "./ledger.js";

export const has = id => !!(S.gear && S.gear[id]) || !!(D.GEAR[id] && D.GEAR[id].owned);

export function buyGear(id) {
  const g = D.GEAR[id]; if (!g || has(id) || S.cash < g.price) return false;
  S.cash -= g.price; S.gear[id] = true; record("out", g.price, { gear: id });
  toast(`Bought: ${g.n} (${peso(g.price)})`); return true;
}

/* Items on all shelves together. */
export const shelfTotal = () => Object.values(S.stock).reduce((a, b) => a + b, 0);

/* Can the player use a site? { open, reason } where reason says what is missing (no hints about quality). */
export function siteAccess(site) {
  if (site === "tiktik") return { open: true, reason: "" };
  if (site === "youview") return has("camera") ? { open: true, reason: "" } : { open: false, reason: "Needs a camera (Tool Shop or the mall)." };
  return { open: false, reason: "" };
}

/* Speed multipliers from gear: smaller is faster. */
export const editSpeed = () => (has("editpc") ? 0.65 : 1) * (has("ringlight") ? 0.85 : 1);
export const packSpeed = () => (has("packstation") ? 0.6 : 1);
