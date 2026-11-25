/* MARKET EVENTS. Calendar events (payday, mega sales) and seeded random events (celebrity sighting, defect report, supplier shortage,
   rival flood, viral challenge, rainy week, courier delay). Data: data/events.json. Flags: calendarEvents, randomEvents.
   Every event shows a signal first: a feed post, a Seller Hub headline, an inbox message, comments. Effects are written into S.mods
   each tick, and other systems read S.mods (market heat/crowd/cost, posts reach/conv/returns/patience, stock delay, courier delay).
   Events in: tick, day:new, newgame, events:trigger {id}. Events out: inbox:add, summary:add, event:signal, event:start, event:end. */
import { D } from "../core/data.js";
import { S, flag, rand, rr, pick, uid } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { absAt, dayOf } from "../core/clock.js";

const E = () => D.events;
const fill = (txt, v) => (txt || "").replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export function init() {
  on("newgame", () => { S.events = { list: [], hist: [], next: null, headlines: [], created: {} }; S.mods = {}; scheduleNext(S.t + E().random.firstAfterHours * 60); });
  on("tick", onTick);
  on("day:new", () => spawnCalendar());
  on("events:trigger", ({ id }) => { fireEvent(id); });
  if (!S.events.next) scheduleNext(S.t + E().random.firstAfterHours * 60);
  spawnCalendar();
}

function scheduleNext(from) {
  const r = E().random, perWeek = rr(r.perWeekMin, r.perWeekMax), gap = (7 * 1440) / perWeek;
  S.events.next = (from ?? S.t) + gap * rr(0.6, 1.4);
}

/* Resolve a target to products and sites. */
function resolve(target, vars) {
  const all = D.products.map(p => p.id);
  if (!target || target.kind === "all") return { products: all, sites: Object.keys(D.SITE) };
  if (target.kind === "product") return { products: [target.id], sites: [] };
  if (target.kind === "trait") return { products: D.products.filter(p => p.traits.includes(target.id)).map(p => p.id), sites: [], trait: target.id };
  if (target.kind === "site") return { products: [], sites: [target.id] };
  if (target.kind === "randomProduct") { const pool = target.pool || all; const p = vars.product || pick(pool); return { products: [p], sites: [], picked: p }; }
  return { products: all, sites: [] };
}

function makeInstance(def, windows, signalAt, extraVars = {}) {
  const vars = { ...extraVars };
  const base = resolve(def.target, vars);
  if (base.picked) { vars.product = base.picked; vars.productName = D.P[base.picked].short; }
  if (base.trait) vars.trait = base.trait;
  if (def.celebs || /\{celeb\}/.test(JSON.stringify(def))) vars.celeb = pick(E().celebs);
  const tv = { product: vars.productName || "", celeb: vars.celeb || "", trait: vars.trait || "", site: "" };
  const inst = {
    key: uid("ev"), id: def.id, name: def.name, signalAt, signaled: false, pushed: false, started: false,
    windows: windows.map(w => ({ start: w.start, end: w.end, eff: w.effects.map(e => { const r = e.target ? resolve(e.target, vars) : base; return { ...e, products: r.products, sites: r.sites }; }) })),
    explain: fill(def.explain, tv), headline: fill(def.headline, tv), tv, product: vars.product || null,
    signals: def.signals || {}, pushStage: null
  };
  const pe = def.effects && def.effects.find(e => e.kind === "push"); if (pe) inst.pushStage = pe.stage;
  inst.end = Math.max(...inst.windows.map(w => w.end));
  inst.start = Math.min(...inst.windows.map(w => w.start));
  inst.affects = { products: [...new Set(inst.windows.flatMap(w => w.eff.flatMap(e => e.products)))], sites: [...new Set(inst.windows.flatMap(w => w.eff.flatMap(e => e.sites)))] };
  if (base.picked) inst.affects.products = [base.picked, ...inst.affects.products.filter(p => p !== base.picked)];
  S.events.list.push(inst);
  return inst;
}

/* Calendar: create instances for event days coming in the next 3 days. */
function spawnCalendar() {
  if (!flag("calendarEvents")) return;
  const today = dayOf(S.t);
  for (const def of E().calendar) {
    const days = def.days ? def.days.slice() : [];
    if (def.every) for (let d = def.offset; d <= today + 3; d += def.every) if (d >= 1) days.push(d);
    for (const d of days) {
      if (d < today || d > today + 3) continue;
      const key = def.id + "@" + d; if (S.events.created[key]) continue;
      const day0 = absAt(d, 0);
      if (day0 + (def.windows[def.windows.length - 1].to) * 1440 < S.t) continue;
      S.events.created[key] = 1;
      const inst = makeInstance(def, def.windows.map(w => ({ start: day0 + w.from * 1440, end: day0 + w.to * 1440, effects: w.effects })), Math.max(S.t, day0 - (def.announceDays || 1) * 1440 + 360));
      inst.cal = true; inst.day = d;
    }
  }
}

function signal(inst) {
  inst.signaled = true;
  const s = inst.signals, tv = inst.tv, def = [...E().calendar, ...E().list].find(x => x.id === inst.id) || {};
  if (inst.headline) { S.events.headlines.unshift({ at: S.t, text: inst.headline, id: inst.id }); S.events.headlines.length = Math.min(8, S.events.headlines.length); }
  if (s.inbox) emit("inbox:add", { kind: "news", title: fill(s.inbox.title, tv), text: fill(s.inbox.text, tv), pid: inst.product });
  if (s.feed) {
    const n = s.feed.count || 1;
    for (let i = 0; i < n; i++) emit("feed:post", { by: fill(s.feed.by, tv), text: fill(s.feed.text, tv), p: inst.product, news: true, site: "tiktik", event: inst.id });
  }
  if (s.comments && inst.product) { S.events.comments = S.events.comments || {}; S.events.comments[inst.product] = { until: inst.end, list: s.comments.map(c => fill(c, tv)) }; }
  emit("summary:add", inst.headline || inst.name);
  emit("event:signal", inst);
}

function onTick({ t1 }) {
  // random spawn
  if (flag("randomEvents") && S.events.next != null && t1 >= S.events.next) {
    scheduleNext(t1);
    const active = new Set(S.events.list.map(e => e.id));
    const pool = E().list.filter(e => !active.has(e.id)); if (pool.length) {
      const tot = pool.reduce((a, b) => a + b.weight, 0); let r = rand() * tot, def = pool[0];
      for (const d of pool) { r -= d.weight; if (r <= 0) { def = d; break; } }
      spawnRandom(def, t1);
    }
  }
  for (const inst of S.events.list) {
    if (!inst.signaled && t1 >= inst.signalAt) signal(inst);
    if (!inst.started && t1 >= inst.start) { inst.started = true; emit("event:start", inst); }
    if (inst.pushStage && !inst.pushed && t1 >= inst.start) { inst.pushed = true; pushTrend(inst.product, inst.pushStage); }
  }
  // expire
  const keep = [];
  for (const inst of S.events.list) { if (t1 >= inst.end) { S.events.hist.unshift({ id: inst.id, name: inst.name, end: inst.end }); S.events.hist.length = Math.min(12, S.events.hist.length); emit("event:end", inst); } else keep.push(inst); }
  S.events.list = keep;
  computeMods(t1);
}

function spawnRandom(def, t) {
  const inst = makeInstance(def, [{ start: t + (def.leadMin || 0), end: t + (def.leadMin || 0) + def.durationH * 60, effects: def.effects }], t);
  return inst;
}

function pushTrend(pid, stage) {
  if (!pid || !S.trends[pid]) return;
  const tr = S.trends[pid]; if (tr.stage === "rising" || tr.stage === "peak") return;
  const st = D.market.trends.stages[stage];
  tr.stage = stage; tr.t = 0; tr.len = st[0] + rand() * (st[1] - st[0]); tr.fz = false;
}

/* Fire any event by id now (dev panel, tests). */
export function fireEvent(id) {
  const cal = E().calendar.find(e => e.id === id), rnd = E().list.find(e => e.id === id);
  if (rnd) return spawnRandom(rnd, S.t);
  if (cal) {
    const d = dayOf(S.t), day0 = absAt(d, 0);
    const inst = makeInstance(cal, cal.windows.map(w => ({ start: Math.max(S.t, day0 + w.from * 1440), end: Math.max(day0 + w.to * 1440, S.t + 600), effects: w.effects })), S.t);
    inst.cal = true; return inst;
  }
  return null;
}
export const activeEvents = () => S.events.list.filter(e => S.t >= e.start && S.t < e.end);
export const allEvents = () => S.events.list;
export const eventIds = () => [...E().calendar.map(e => e.id), ...E().list.map(e => e.id)];

/* Fold active effects into S.mods. */
function computeMods(t) {
  const m = { heatAdd: {}, reach: {}, reachSite: {}, conv: {}, cost: {}, returns: {}, crowd: {}, patience: {}, dealSpend: 1, supplierDelay: 0, courierDelay: 0, comment: {} };
  for (const inst of S.events.list) for (const w of inst.windows) {
    if (t < w.start || t >= w.end) continue;
    for (const e of w.eff) {
      const P = e.products || [], Sx = e.sites || [];
      switch (e.kind) {
        case "heatAdd": P.forEach(p => { m.heatAdd[p] = (m.heatAdd[p] || 0) + e.add; }); break;
        case "reach": if (Sx.length && !P.length) Sx.forEach(s => { m.reachSite[s] = (m.reachSite[s] || 1) * e.mult; }); else P.forEach(p => { m.reach[p] = (m.reach[p] || 1) * e.mult; }); break;
        case "conv": P.forEach(p => { m.conv[p] = (m.conv[p] || 1) * e.mult; }); break;
        case "cost": P.forEach(p => { m.cost[p] = (m.cost[p] || 1) * e.mult; }); break;
        case "returns": P.forEach(p => { m.returns[p] = (m.returns[p] || 0) + e.add; }); break;
        case "crowd": P.forEach(p => { m.crowd[p] = (m.crowd[p] || 0) + e.add; }); break;
        case "patience": Sx.forEach(s => { m.patience[s] = (m.patience[s] || 1) * e.mult; }); break;
        case "dealSpend": m.dealSpend *= e.mult; break;
        case "supplierDelay": m.supplierDelay = Math.max(m.supplierDelay, e.minutes); break;
        case "courierDelay": m.courierDelay = Math.max(m.courierDelay, e.minutes); break;
        default: break;
      }
    }
  }
  const cm = S.events.comments || {};
  for (const [p, c] of Object.entries(cm)) { if (t < c.until) m.comment[p] = c.list; else delete cm[p]; }
  S.mods = m;
}

/* Events that touch a product and site right now (for post context and Mr. Algo). */
export function eventsFor(pid, site) {
  return activeEvents().filter(e => e.affects.products.includes(pid) || (site && e.affects.sites.includes(site)))
    .map(e => ({ id: e.id, name: e.name, explain: e.explain }));
}
