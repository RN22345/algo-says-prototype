/* Money ledger: every cash change is written here (sale with order id, stock purchase). Shop Books reads it. */
import { S } from "../state.js";

/* kind: "in" or "out". extra: { p, order, qty, mode, note }. */
export function record(kind, amount, extra = {}) {
  S.ledger.push({ t: Math.round(S.clock), kind, amount, ...extra });
}
