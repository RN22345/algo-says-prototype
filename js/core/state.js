/* The shared state object S (saved to localStorage) plus small helpers: flags, seeded random, ids, gear checks.
   S keeps its identity: resetState() replaces its contents so imports stay valid. */
import { D } from "./data.js";
import { emit } from "./bus.js";

export const S = {};

export function makeState() {
  const c = D.config.start;
  return {
    v: D.config.saveVersion, t: D.time.dayStart, speed: 1, nid: 1, rs: 1234567 >>> 0,
    flags: {}, cash: c.cash, energy: c.energy, trust: c.trust, followers: { ...c.followers },
    gear: {}, samples: {}, samplePending: [], doorSamples: [], deliveries: [], doorBoxes: [], boxes: {},
    shelves: Array.from({ length: 4 }, () => Array(6).fill(null)),
    orders: [], returns: [], posts: [], feed: [], trends: {}, rivals: [],
    market: { heat: {}, stage: {}, crowd: {}, costMult: {}, inDemand: {}, siteFit: {} },
    playbook: {}, lessonsSeen: {}, inbox: [], summary: [], ledger: [],
    rent: { due: 0, nextDay: D.time.rent.days + 1, fee: 0, warned: false },
    intro: { step: 0, done: false }, updatesApplied: [], updatesRumoured: [],
    events: { list: [], hist: [], next: null, headlines: [], created: {} }, mods: {},
    stats: { sold: 0, missed: 0, returned: 0, earned: 0 }, started: false, mode: "affiliate", player: null, layout: {},
    ui: { pbSeen: {} },   // Builder B: Playbook entries the player has opened (phone badge)
    property: {}, furniture: [], placed: [], shelfOwn: {}   // property: owned room ids. furniture: unplaced piece ids. placed: [{uid,id}] (position in layout[uid]). shelfOwn: station id -> [first shelf, count]
  };
}
export function resetState() { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, makeState()); }

export const flag = n => (S.flags && n in S.flags) ? !!S.flags[n] : !!D.config.features[n];
export function setFlag(n, v) { S.flags[n] = !!v; emit("flag:changed", n, !!v); }

/* Seeded random for the world (state saved in S.rs). */
export function rand() {
  let t = (S.rs += 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a, b) => a + rand() * (b - a);
export const pick = a => a[Math.floor(rand() * a.length)];
export const uid = p => p + (S.nid++);
export const hasGear = id => !!(S.gear && S.gear[id]);
export const siteOpen = id => { const g = D.SITE[id].needsGear; return !g || hasGear(g); };
export const tier2On = () => flag("tier2") && hasGear("shelves");
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmtMoney = n => "₱" + Math.round(n).toLocaleString("en-US");

/* Small seeded PRNG for pure functions (viewer model). */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
