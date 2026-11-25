/* ENERGY. Shooting, editing and packing cost energy. At zero energy the player can only rest (new tasks are blocked).
   Nap gives back some energy, sleep gives full energy. Flag: energy (off = no costs, no blocks).
   Events in: energy:check {ok}, energy:spend {cost}, sleep:end {kind}. Events out: energy:changed, toast. */
import { D } from "../core/data.js";
import { S, flag, clamp } from "../core/state.js";
import { on, emit } from "../core/bus.js";

export function init() {
  on("energy:check", p => {
    if (!flag("energy")) return;
    if (S.energy <= 0) { p.ok = false; emit("toast", "Too tired. Nap or sleep first.", "bad"); emit("sfx", "error"); }
  });
  on("energy:spend", ({ cost }) => { if (!flag("energy")) return; S.energy = clamp(S.energy - cost, 0, D.time.energy.max); emit("energy:changed"); });
  on("sleep:end", ({ kind }) => {
    const max = D.time.energy.max;
    if (kind === "nap") S.energy = clamp(S.energy + D.time.napEnergy, 0, max);
    else if (kind === "sleep") S.energy = max;
    else if (kind === "auto") { S.energy = Math.max(S.energy, D.time.passoutEnergy); emit("toast", "You fell asleep at your desk."); }
    emit("energy:changed");
  });
}
