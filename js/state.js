/* Shared game state, loaded data, tiny event bus. One module so every system sees the same objects. */

/* Loaded data. Filled by loadData() at boot. */
export const D = { PR: {}, CLIPS: {}, MAP: null, T: null, PC: null, GEAR: {}, STK: {} };

export async function loadData(base = "data/") {
  const get = async f => {
    const r = await fetch(base + f, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Could not load ${f} (${r.status})`);
    return r.json();
  };
  const [PR, CLIPS, MAP, T, GEAR, STK] = await Promise.all([get("products.json"), get("clips.json"), get("map.json"), get("tuning.json"), get("gear.json"), get("stickers.json")]);
  delete GEAR._note; delete STK._note; D.STK = STK;
  D.PR = PR; D.CLIPS = CLIPS; D.MAP = MAP; D.T = T; D.GEAR = GEAR;
}

/* Event bus: systems emit, UI listens. Keeps sim code free of DOM calls. */
const handlers = {};
export const on = (name, fn) => { (handlers[name] ||= []).push(fn); };
export const emit = (name, ...args) => { (handlers[name] || []).forEach(fn => fn(...args)); };
export const toast = (msg, img) => emit("toast", msg, img);

/* Game state (saved). */
export const S = {};
/* Player (saved) and studio selection (not saved). */
export const pl = {};
export const sel = {};
/* Held keys, and runtime values that are never saved. */
export const keys = new Set();
export const rt = { perf: 0, fps: 0, showFps: false, showZones: false };

export function newState() {
  const T = D.T;
  return {
    cash: T.start.cash, rating: T.start.rating, shipped: 0, replies: 0, stocked: false, posted: false,
    stock: { ...T.start.stock },
    orders: [], table: [], carry: [], box: null, riders: [], deliveries: [], yard: [], posts: [], running: [], last: null,
    gear: {}, followers: { tiktik: 0, youview: 0 }, shelves: T.start.shelves.map(s => ({ slots: Array.isArray(s.slots) ? [...s.slots] : Array(6).fill(null) })), hand: [], achv: {}, flags: {}, trends: null, rivals: null, rposts: [], trendNext: null, sold: 0, back: { ...T.start.back }, missedLog: [], lows: {},
    chats: [], missed: 0, edit: null, nextId: T.start.nextOrderId, busy: null,
    clock: 0, ledger: [], notes: "", stickers: [],
    algoUnread: false, rank: 1, van: null, vanQ: [], jeep: { y: T.jeep.startY, t: T.jeep.firstDelay },
    ui: null, active: false, flash: {}, milestoneDone: false, algoMet: false
  };
}

const replace = (obj, src) => { for (const k in obj) delete obj[k]; Object.assign(obj, src); };

/* Reset everything to a fresh game, or to a saved game when `saved` is given. */
export function resetState(saved = null, keepActive = false) {
  const active = keepActive && S.active;
  replace(S, { ...newState(), ...(saved && saved.S ? saved.S : {}) });
  S.ui = null; S.busy = null; S.active = active;
  const [px, py] = D.MAP.playerStart;
  replace(pl, { x: px, y: py, face: 1, walk: 0, moving: false, ...(saved && saved.pl ? saved.pl : {}) });
  pl.moving = false;
  replace(sel, { p: Object.keys(D.PR)[0], clips: [], shot: "product", text: "none", sticker: "none", caption: "" });
  keys.clear();
  emit("newgame");
}
