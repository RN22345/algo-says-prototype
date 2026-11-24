/* What E does where the player stands. Adds world spots from the map (the sari-sari store) to the shop loop's context(). */
import { S, pl, emit } from "./state.js";
import { world, inR } from "./world.js";
import { context as shopContext } from "./sim/shop.js";
import { courierDrop } from "./ui/places.js";

export function context() {
  if (S.busy) return null;
  const pz = (world.places || []).find(o => inR(o.zone, pl.x, pl.y));
  if (pz) {
    if (pz.kind === "mall") return { label: "Enter Plaza Mall", fn: () => emit("openUI", "mall") };
    if (pz.kind === "warehouse") return { label: "Enter Bodega Supply (walk-in wholesale)", fn: () => emit("openUI", "warehouse") };
    if (pz.kind === "booth") return S.carry.length ? { label: `Drop ${S.carry.length} parcel${S.carry.length > 1 ? "s" : ""} at the courier`, fn: courierDrop } : { label: "Courier drop-off: bring packed parcels here" };
  }
  return shopContext();
}
