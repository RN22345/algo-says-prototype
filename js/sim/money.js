/* MONEY: cash, ledger, rent. Events in: money:earn {amount,why,silent}, money:spend {amount,why,ok}, rent:pay {ok}, day:new.
   Events out: cash:changed, fx:float, sfx. Rent (flag rent): due every N days; missing it adds a late fee once, never game over. Paid in the phone Wallet. */
import { D } from "../core/data.js";
import { S, flag, fmtMoney } from "../core/state.js";
import { on, emit } from "../core/bus.js";

/* Base rent plus the rentAdd of each bought room (data/world.json properties). */
const rentAmount = () => D.time.rent.amount + (D.world.properties || []).reduce((a, p) => a + (S.property && S.property[p.id] ? p.rentAdd || 0 : 0), 0);

function ledger(amount, why) { S.ledger.unshift({ t: S.t, amount, why }); if (S.ledger.length > 60) S.ledger.length = 60; }

export function init() {
  on("money:earn", ({ amount, why, silent }) => {
    S.cash += amount; if (amount > 0) S.stats.earned += amount; ledger(amount, why); emit("cash:changed");
    if (!silent && amount > 0) { emit("fx:float", { text: "+" + fmtMoney(amount), kind: "gold" }); emit("sfx", "coin"); }
    if (!silent && amount < 0) emit("fx:float", { text: fmtMoney(amount).replace("₱-", "-₱"), kind: "red" });
  });
  on("money:spend", p => {
    if (S.cash >= p.amount) { S.cash -= p.amount; ledger(-p.amount, p.why); p.ok = true; emit("cash:changed"); }
    else { p.ok = false; emit("toast", "Not enough cash.", "bad"); emit("sfx", "error"); }
  });
  on("rent:pay", p => {
    if (S.rent.due <= 0) { p.ok = true; return; }
    if (S.cash >= S.rent.due) { S.cash -= S.rent.due; ledger(-S.rent.due, "Rent"); S.rent.due = 0; S.rent.feeApplied = false; p.ok = true; emit("cash:changed"); emit("sfx", "coin"); emit("toast", "Rent paid."); }
    else { p.ok = false; emit("toast", "Not enough cash for rent.", "bad"); emit("sfx", "error"); }
  });
  on("day:new", day => {
    if (!flag("rent")) return;
    const R = D.time.rent;
    if (S.rent.due > 0 && !S.rent.feeApplied) {
      S.rent.due += R.lateFee; S.rent.feeApplied = true;
      emit("inbox:add", { kind: "system", title: "Late fee", text: `Rent was late. A late fee of ${fmtMoney(R.lateFee)} was added. Pay it in the Wallet.` });
      emit("summary:add", "Rent is late. A late fee was added.");
    }
    if (day >= S.rent.nextDay) {
      S.rent.due += rentAmount(); S.rent.nextDay += R.days; S.rent.feeApplied = false;
      emit("inbox:add", { kind: "system", title: "Rent is due", text: `Rent of ${fmtMoney(rentAmount())} is due. Pay it in the Wallet tab. A late fee applies if you wait a day.` });
      emit("summary:add", "Rent is due.");
    } else if (day === S.rent.nextDay - R.remindDaysBefore && S.rent.due <= 0) {
      emit("inbox:add", { kind: "system", title: "Rent tomorrow", text: `Rent of ${fmtMoney(rentAmount())} is due tomorrow. Keep the cash ready.` });
    }
  });
}
