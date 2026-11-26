/* Small readers for data and state that Builder A owns (properties, furniture). They guard against missing data, so the screens
   work before that data exists. Shapes accepted: S.property as an array of ids or an object {id: true} (or {owned: ...});
   S.furniture as an array of ids or {id, ...} objects, or an object {id: count}. */
import { D } from "../../core/data.js";
import { S } from "../../core/state.js";

export const propList = () => (D.world && Array.isArray(D.world.properties) ? D.world.properties : []);
export const furnList = () => (D.gear && Array.isArray(D.gear.furniture) ? D.gear.furniture : (Array.isArray(D.furniture) ? D.furniture : []));
export const furnDef = id => furnList().find(f => f.id === id) || { id, name: id };

export function ownedProps() {
  let p = S.property; if (!p) return [];
  if (!Array.isArray(p) && (p.owned !== undefined || p.bought !== undefined)) p = p.owned !== undefined ? p.owned : p.bought;
  if (Array.isArray(p)) return p.map(x => (typeof x === "string" ? x : x && x.id)).filter(Boolean);
  return Object.keys(p || {}).filter(k => p[k] && k !== "owned" && k !== "bought");
}
export const hasProp = id => ownedProps().includes(id);
/* Weekly rent: the base rent plus the rentAdd of every property the player owns. */
export const weeklyRent = () => D.time.rent.amount + propList().filter(p => hasProp(p.id)).reduce((a, p) => a + (p.rentAdd || 0), 0);

/* Furniture bought but not placed: [{id, n}]. */
export function unplaced() {
  const f = S.furniture; if (!f) return [];
  const m = {};
  if (Array.isArray(f)) for (const x of f) { const id = typeof x === "string" ? x : x && x.id; if (id) m[id] = (m[id] || 0) + ((x && x.n) || 1); }
  else for (const [k, v] of Object.entries(f)) { const n = typeof v === "number" ? v : (v ? 1 : 0); if (n > 0) m[k] = n; }
  return Object.entries(m).map(([id, n]) => ({ id, n }));
}
export const productLine = items => Object.entries(items).map(([k, v]) => `${v} x ${D.P[k] ? D.P[k].short : k}`).join(", ");
