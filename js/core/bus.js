/* Event bus. The only way systems talk to each other (besides the shared state object S).
   on(event, fn) returns an off function. emit(event, ...args) calls handlers in order; errors are logged and do not stop others. */
const map = new Map();
export const on = (ev, fn) => { if (!map.has(ev)) map.set(ev, []); map.get(ev).push(fn); return () => off(ev, fn); };
export const off = (ev, fn) => { const a = map.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } };
export const once = (ev, fn) => { const o = on(ev, (...a) => { o(); fn(...a); }); return o; };
export const emit = (ev, ...args) => { const a = map.get(ev); if (!a) return; for (const f of a.slice()) { try { f(...args); } catch (e) { console.error("[bus]", ev, e); } } };
