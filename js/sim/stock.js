/* STOCK: affiliate samples, supplier deliveries, boxes at the door, shelves.
   Samples: requested at the Affiliate site, arrive at the door after a delay. Supplier (tier 2): order before 18:00, arrives 9:00 next day.
   Deliveries wait at the door until taken. Shelves hold 6 units each. Orders reserve stock from shelves (see orders.js).
   Events in: tick, shelf:take {pid, ok}, shelf:giveback {pid}, sample:request {pid, ok}, stock:order {pid, qty, ok}, door:take {kind,id}, shelf:put {pid, ok}, shelf:pull {si, slot}.
   Events out: sample:requested, sample:arrived, sample:taken, delivery:arrived, delivery:taken, stock:changed, inbox:add, summary:add. */
import { D } from "../core/data.js";
import { S, flag, uid } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { tod, fmtDay } from "../core/clock.js";

export const shelfCount = pid => S.shelves.reduce((a, sh) => a + sh.filter(x => x === pid).length, 0);
export const boxCount = pid => S.boxes[pid] || 0;
export const freeSlots = () => S.shelves.reduce((a, sh) => a + sh.filter(x => !x).length, 0);
export const doorCount = () => S.doorSamples.length + S.doorBoxes.length;

export function init() {
  on("tick", onTick);
  on("sample:request", p => { p.ok = requestSample(p.pid); });
  on("stock:order", p => { p.ok = orderStock(p.pid, p.qty); });
  on("door:take", ({ kind, id }) => { if (kind === "sample") takeSample(id); else takeBox(id); });
  on("shelf:put", p => { p.ok = putOnShelf(p.pid); });
  on("shelf:pull", ({ si, slot }) => pullFromShelf(si, slot));
  on("shelf:take", p => { p.ok = takeUnit(p.pid); });
  on("shelf:giveback", ({ pid }) => giveBackUnit(pid));
}

function requestSample(pid) {
  const p = D.P[pid];
  if (S.samplePending.some(s => s.pid === pid) || S.doorSamples.includes(pid)) { emit("toast", "A sample is already on the way."); return false; }
  if (S.samplePending.length >= 3) { emit("toast", "Three samples are already on the way."); return false; }
  const delay = p.sampleDelay + (S.mods.supplierDelay ? 0 : 0);
  S.samplePending.push({ pid, at: S.t + delay, asked: S.t });
  emit("inbox:add", { kind: "system", title: "Sample requested", text: `${p.name}: the seller will send a sample. It should reach your door in about ${Math.round(delay / 60)} hours.`, pid });
  emit("sample:requested", pid); emit("sfx", "ding");
  return true;
}

export function orderStock(pid, qty) {
  const p = D.P[pid]; if (!flag("tier2")) return false;
  const unit = Math.round(p.cost * (S.market.costMult[pid] || 1)), total = unit * qty;
  const pay = { amount: total, why: `Stock: ${qty} x ${p.short}`, ok: false }; emit("money:spend", pay); if (!pay.ok) return false;
  const T = D.time, m = tod();
  const day0 = Math.floor(S.t / 1440) * 1440;
  let at = day0 + (m < T.supplierCutoff ? 1 : 2) * 1440 + T.supplierArrive; // before 18:00: 9:00 next morning, else the morning after
  at += S.mods.supplierDelay || 0;
  S.deliveries.push({ id: uid("d"), items: { [pid]: qty }, at, paid: total });
  emit("inbox:add", { kind: "system", title: "Stock ordered", text: `${qty} x ${p.name} for ₱${total}. Arrives ${fmtDay(at)}.`, pid });
  emit("stock:changed"); emit("sfx", "pop");
  return true;
}

function onTick({ t1 }) {
  const arrivedS = S.samplePending.filter(s => s.at <= t1);
  if (arrivedS.length) {
    S.samplePending = S.samplePending.filter(s => s.at > t1);
    for (const s of arrivedS) {
      S.doorSamples.push(s.pid);
      emit("inbox:add", { kind: "system", title: "Sample arrived", text: `${D.P[s.pid].name} is at your door.`, pid: s.pid });
      emit("summary:add", `A sample of ${D.P[s.pid].short} arrived at the door.`);
      emit("sample:arrived", s.pid); emit("sfx", "ding");
    }
    emit("stock:changed");
  }
  const arrivedD = S.deliveries.filter(d => d.at <= t1);
  if (arrivedD.length) {
    S.deliveries = S.deliveries.filter(d => d.at > t1);
    for (const d of arrivedD) {
      S.doorBoxes.push({ id: d.id, items: d.items });
      const txt = Object.entries(d.items).map(([k, v]) => `${v} x ${D.P[k].short}`).join(", ");
      emit("inbox:add", { kind: "system", title: "Delivery arrived", text: `${txt} is at your door.` });
      emit("summary:add", `Supplier delivery arrived: ${txt}.`);
      emit("delivery:arrived", d); emit("sfx", "ding");
    }
    emit("stock:changed");
  }
}

function takeSample(pid) {
  const i = S.doorSamples.indexOf(pid); if (i < 0) return;
  S.doorSamples.splice(i, 1); S.samples[pid] = true;
  emit("sample:taken", pid); emit("stock:changed"); emit("toast", `${D.P[pid].name} sample added. You can film it now.`); emit("sfx", "pop");
}
function takeBox(id) {
  const i = S.doorBoxes.findIndex(b => b.id === id); if (i < 0) return;
  const b = S.doorBoxes.splice(i, 1)[0];
  for (const [pid, q] of Object.entries(b.items)) S.boxes[pid] = (S.boxes[pid] || 0) + q;
  emit("delivery:taken", b); emit("stock:changed"); emit("toast", "Stock brought inside. Put it on the shelves."); emit("sfx", "pop");
}
export function putOnShelf(pid) {
  if (!(S.boxes[pid] > 0)) return false;
  for (const sh of S.shelves) { const i = sh.indexOf(null); if (i >= 0) { sh[i] = pid; S.boxes[pid]--; emit("stock:changed"); return true; } }
  emit("toast", "The shelves are full.", "bad"); return false;
}
export function pullFromShelf(si, slot) {
  const pid = S.shelves[si] && S.shelves[si][slot]; if (!pid) return;
  S.shelves[si][slot] = null; S.boxes[pid] = (S.boxes[pid] || 0) + 1; emit("stock:changed");
}
/* Take one unit off the shelves for an order. Returns true if it worked. */
export function takeUnit(pid) {
  for (const sh of S.shelves) { const i = sh.indexOf(pid); if (i >= 0) { sh[i] = null; emit("stock:changed"); return true; } }
  return false;
}
export function giveBackUnit(pid) {
  for (const sh of S.shelves) { const i = sh.indexOf(null); if (i >= 0) { sh[i] = pid; emit("stock:changed"); return true; } }
  S.boxes[pid] = (S.boxes[pid] || 0) + 1; emit("stock:changed"); return false;
}
