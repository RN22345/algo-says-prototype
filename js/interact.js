/* What E does where the player stands. Adds world spots from the map (the sari-sari store) to the shop loop's context(). */
import { S, pl, emit } from "./state.js";
import { world, inR } from "./world.js";
import { context as shopContext } from "./sim/shop.js";

export function context() {
  if (S.busy) return null;
  const z = world.sarisariZone;
  if (z && inR(z, pl.x, pl.y)) return { label: "Shop at the sari-sari store", fn: () => emit("openUI", "sarisari") };
  return shopContext();
}
