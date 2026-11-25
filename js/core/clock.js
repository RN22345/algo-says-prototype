/* The game clock. One continuous day, 6:00 to 24:00. S.t is absolute game minutes since day 1 00:00.
   frame(realDt) advances time when nothing has paused it. skipBy/skipTo fast-forward through the same tick events,
   so posts, orders and deliveries keep running. Events out: tick {t0,t1,dt}, sleep:start, sleep:end {kind,lines}, day:new. */
import { D } from "./data.js";
import { S } from "./state.js";
import { emit } from "./bus.js";

const rt = { pauses: new Set(), skipping: false };
export const pause = k => rt.pauses.add(k);
export const resume = k => rt.pauses.delete(k);
export const paused = () => rt.pauses.size > 0;
export const isSkipping = () => rt.skipping;

export const tod = (t = S.t) => ((t % 1440) + 1440) % 1440;
export const dayOf = t => Math.floor(t / 1440) + 1;
export const dayNo = (t = S.t) => dayOf(t);
export const fmt = (t = S.t) => { const m = Math.floor(tod(t)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
export const fmtDay = (t = S.t) => `Day ${dayOf(t)}, ${fmt(t)}`;
export const isDaylight = (t = S.t) => { const m = tod(t); return m >= D.time.daylight[0] && m < D.time.daylight[1]; };
/* Absolute time of the next clock value (minutes since midnight) after t. */
export const nextAt = (mod, t = S.t) => { let x = Math.floor(t / 1440) * 1440 + mod; if (x <= t) x += 1440; return x; };
/* Does the clock value mod fall in (t0, t1]? */
export function crosses(t0, t1, mod) { return Math.floor((t1 - mod) / 1440) > Math.floor((t0 - mod) / 1440); }
export const absAt = (day, hour) => (day - 1) * 1440 + hour * 60;

export function stepTo(tNew) {
  const step = D.time.simStep;
  while (S.t < tNew - 1e-9) {
    const t0 = S.t, dt = Math.min(step, tNew - S.t);
    S.t += dt;
    emit("tick", { t0, t1: S.t, dt });
    if (dayOf(S.t) !== dayOf(t0)) emit("day:new", dayOf(S.t));
    if (!rt.skipping && crosses(t0, S.t, 0)) { passOut(); return; }
  }
}

export function frame(realDt) {
  if (rt.skipping) return;
  if (tod() < D.time.dayStart) { passOut(); return; }   // time ran past midnight during a skip: fall asleep
  if (paused()) return;
  stepTo(S.t + Math.min(realDt, 0.25) * D.time.minPerRealSec * (S.speed || 1));
  emit("frame");
}

/* Fast-forward. kind: nap | sleep | skip | auto. Collects "while you slept" lines. */
export function skipTo(tNew, kind = "skip") {
  rt.skipping = true; S.summary = [];
  emit("sleep:start", { kind });
  stepTo(tNew);
  rt.skipping = false;
  emit("sleep:end", { kind, lines: S.summary.slice() });
  emit("frame");
}
export const skipBy = (minutes, kind = "skip") => skipTo(S.t + minutes, kind);
export const sleepToMorning = (kind = "sleep") => skipTo(nextAt(D.time.dayStart), kind);
function passOut() { skipTo(nextAt(D.time.dayStart), "auto"); }
