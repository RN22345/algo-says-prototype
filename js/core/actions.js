/* Thin helpers so systems and UI can use money, energy, toasts and effects through events without importing each other. */
import { emit } from "./bus.js";

export const earn = (amount, why, opt = {}) => emit("money:earn", { amount, why, ...opt });
export function spend(amount, why) { const p = { amount, why, ok: false }; emit("money:spend", p); return p.ok; }
export const toast = (msg, kind = "") => emit("toast", msg, kind);
export const sfx = n => emit("sfx", n);
export const float = (text, kind = "gold", x, y) => emit("fx:float", { text, kind, x, y });
export const summary = text => emit("summary:add", text);
export const inbox = m => emit("inbox:add", m);
/* Can the player start a task that costs energy? At zero energy only rest is allowed. */
export function energyCheck() { const p = { ok: true }; emit("energy:check", p); return p.ok; }
export const energySpend = cost => emit("energy:spend", { cost });
