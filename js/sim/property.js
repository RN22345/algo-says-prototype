/* PROPERTY and FURNITURE. Buying house extensions (data/world.json "properties") and furniture (data/gear.json "furniture").
   S.property {id: true} marks owned rooms. S.furniture is the list of bought, unplaced piece ids (the tray); layout.js places them.
   A shelf unit (a station with "shelves": n) gets n new shelves of 6 places in S.shelves; S.shelfOwn {stationId: [first, count]}
   tells the shelves screen which ones belong to which unit. Rent rises by each owned room's rentAdd (money.js reads it).
   Events in: property:buy {id, ok}, furniture:buy {id, ok}, furniture:placed {uid, id}.
   Events out: property:bought {id}, furniture:bought {id}, furniture:changed {id}, stock:changed, inbox:add, toast, sfx.
   Exports: where (the station the player is using: shootMult), rentExtra(). */
import { D } from "../core/data.js";
import { S, fmtMoney } from "../core/state.js";
import { on, emit } from "../core/bus.js";

/* Set by the station router when a studio opens: the shoot-time multiplier of the room the player is in. */
export const where = { shootMult: 1 };
export const rentExtra = () => (D.world.properties || []).reduce((a, p) => a + (S.property && S.property[p.id] ? p.rentAdd || 0 : 0), 0);

function ensureShelves(stId, n) {
  if (!n || S.shelfOwn[stId]) return;
  S.shelfOwn[stId] = [S.shelves.length, n];
  for (let i = 0; i < n; i++) S.shelves.push(Array(6).fill(null));
  emit("stock:changed");
}
function buyProperty(id) {
  const p = (D.world.properties || []).find(x => x.id === id); if (!p) return false;
  if (S.property[id]) { emit("toast", "You already own this room."); return false; }
  if (p.requires && !S.property[p.requires]) { const r = D.world.properties.find(x => x.id === p.requires); emit("toast", `Buy the ${r ? r.name : p.requires} first.`, "bad"); return false; }
  const pay = { amount: p.price, why: `Property: ${p.name}`, ok: false }; emit("money:spend", pay); if (!pay.ok) return false;
  S.property[id] = true;
  for (const st of p.stations) ensureShelves(st.id, st.shelves);
  emit("inbox:add", { kind: "system", title: `${p.name} is yours`, text: `Rent goes up by ${fmtMoney(p.rentAdd)} each rent day. New rent: ${fmtMoney(D.time.rent.amount + rentExtra())}.` });
  emit("property:bought", { id }); emit("toast", `${p.name} bought. Rent is now ${fmtMoney(D.time.rent.amount + rentExtra())}.`); emit("sfx", "coin");
  return true;
}
function buyFurniture(id) {
  const d = D.F && D.F[id]; if (!d) return false;
  const pay = { amount: d.price, why: `Furniture: ${d.name}`, ok: false }; emit("money:spend", pay); if (!pay.ok) return false;
  S.furniture.push(id); emit("furniture:bought", { id }); emit("furniture:changed", { id }); emit("toast", `${d.name} bought. Press "Move furniture" to place it.`); emit("sfx", "pop");
  return true;
}
export function init() {
  on("property:buy", p => { p.ok = buyProperty(p.id); });
  on("furniture:buy", p => { p.ok = buyFurniture(p.id); });
  on("furniture:placed", ({ uid, id }) => { const d = D.F[id]; if (d) ensureShelves(uid, d.shelves); });
}
