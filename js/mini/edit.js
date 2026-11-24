/* Editing minigame (D-65): "Trim the footage".
   Footage tiles scroll down toward a line. BAD tiles (blurry, shaky, dead air, bloopers) must be cut.
   GOOD tiles (the hook, the proof, the price) must be left alone. Swipe across tiles like fruit ninja, tap one,
   or press 1 to 4 (J K L ;) to cut the lowest tile in a lane.
   Skill changes only how fast the edit finishes. The video turns out the same either way.
   The player stays at the desk while it runs; the shop keeps going. */
import { D, S, sel, emit } from "../state.js";
import { editSpeed } from "../sim/gear.js";

/* name, colour, and the short word used in "You cut the ...!" */
const SEGS = {
  tiktik: [["Hook", "#ffd34e", "hook"], ["Show", "#c79bf5", "product shot"], ["Proof", "#6fe3d3", "proof"], ["Price + how to order", "#ffab66", "price"]],
  youview: [["Intro", "#ffd34e", "intro"], ["Demo", "#ffab66", "demo"], ["Compare", "#6fe3d3", "comparison"], ["Review", "#c79bf5", "review"], ["Price", "#ff8a9a", "price"]]
};
const BAD = [["Blurry", "🌫️"], ["Shaky", "📳"], ["Dead air ...", "🔇"], ["Blooper", "🤦"], ["Umm...", "💬"], ["Phone buzz", "📵"]];
const LANES = { tiktik: 3, youview: 4 };
const KEYS = { "1": 0, "2": 1, "3": 2, "4": 3, j: 0, k: 1, l: 2, ";": 3 };
const KEYCAP = [["1", "J"], ["2", "K"], ["3", "L"], ["4", ";"]];

const W = { good: 0.5, badCut: 1, badMiss: -0.5, goodCut: -1, combo: 0.1, comboMax: 5 }; // progress weights, in units of u
const CUT_T = 0.28;       // seconds a cut tile takes to fly off
const SLACK = 5;          // px added around a tile when testing a swipe

export function playEdit(opts = {}) {
  const site = opts.site === "youview" ? "youview" : "tiktik";
  const nLanes = LANES[site], segs = SEGS[site];
  const base = (D.T.edit[site] || 22) * editSpeed();       // seconds with good play
  const passive = 100 / (2.2 * base);                       // floor: doing nothing still finishes in about 2.2 x base
  const clipNames = site === "tiktik" && sel.clips && sel.clips.length ? sel.clips.map(c => (D.CLIPS[c] || [c])[0]) : null;
  const icon = D.PR[sel.p] ? `img/${D.PR[sel.p].icon}.png` : "";

  return new Promise(resolve => {
    const el = document.createElement("div");
    el.className = "mini edit";
    el.innerHTML = `<div class="mini-card">
      <div class="mini-head"><span class="mini-pill">✂️ Editing your ${site === "youview" ? "YouView video" : "TikTik video"}</span><span class="mini-sub">Swipe to cut bad footage. Don't cut the good parts.</span></div>
      <div class="ed-stage" style="--n:${nLanes}"><div class="ed-lanes">${Array.from({ length: nLanes }, (_, i) => `<i class="ed-lane"><b class="ed-key">${KEYCAP[i][0]} · ${KEYCAP[i][1]}</b></i>`).join("")}</div><div class="ed-tiles"></div><canvas class="ed-trail"></canvas><div class="ed-line"></div><div class="ed-note"></div></div>
      <div class="ed-info"><div class="ed-bar"><i></i></div><b class="ed-pct">0%</b><span class="ed-combo"></span></div>
      <div class="mini-foot">Cutting bad footage and keeping good footage finishes the edit sooner. The video turns out the same either way. Your shop keeps running while you edit.</div>
    </div>`;
    (document.querySelector("#frame") || document.body).appendChild(el);
    const stage = el.querySelector(".ed-stage"), tilesEl = el.querySelector(".ed-tiles"), cv = el.querySelector(".ed-trail"), g = cv.getContext("2d");
    const bar = el.querySelector(".ed-bar i"), pct = el.querySelector(".ed-pct"), combo = el.querySelector(".ed-combo"), note = el.querySelector(".ed-note");
    const SW = stage.clientWidth || 720, SH = stage.clientHeight || 440;   // layout pixels (not scaled by the frame)
    cv.width = SW; cv.height = SH;
    const laneW = SW / nLanes, TH = Math.round(SH * 0.2), LINE = SH - Math.round(SH * 0.13), TW = laneW - 10;
    const speed = t => SH * (0.42 + 0.2 * Math.min(1, t / base));          // px per second, ramps gently
    const gap = t => (site === "youview" ? 0.74 : 0.8) - 0.3 * Math.min(1, t / base); // seconds between rows
    const pBad = t => 0.42 + 0.13 * Math.min(1, t / base);

    // ---- the whole tile schedule is made up front, so progress per tile can be balanced ----
    let goodN = 0, badN = 0;
    const mk = (lane, bad, t) => bad ? { lane, bad: true, kind: BAD[badN++ % BAD.length], t } : { lane, bad: false, seg: goodN++, t };
    const rows = [];
    for (let t = 0.6; t < base * 2.6; t += gap(t)) {
      const r = Math.random(), lane = Math.floor(Math.random() * nLanes), bad = Math.random() < pBad(t);
      if (r < 0.2) {                                         // a tight pair: one good, one bad, side by side
        const l2 = lane + 1 < nLanes ? lane + 1 : lane - 1, flip = Math.random() < 0.5;
        rows.push([mk(lane, flip, t), mk(l2, !flip, t)]);
      } else if (r < 0.5) {                                  // two tiles, not side by side when there is room
        let l2 = (lane + 2) % nLanes; if (l2 === lane) l2 = (lane + 1) % nLanes;
        rows.push([mk(lane, bad, t), mk(l2, Math.random() < pBad(t), t)]);
      } else rows.push([mk(lane, bad, t)]);
    }
    const fall = t => (LINE + TH / 2) / speed(t);
    let wsum = 0; rows.forEach(r => r.forEach(k => { if (k.t + fall(k.t) <= base) wsum += k.bad ? W.badCut + W.combo * 3 : W.good; }));
    const u = Math.max(0.2, (100 - passive * base) / Math.max(1, wsum));   // percent per weight unit
    let next = 0;

    // ---- state ----
    const tiles = [];                                       // live tiles on screen
    let prog = 0, T = 0, streak = 0, hits = 0, raf = 0, over = false, last = performance.now();
    const trail = [];
    let noteT = 0;

    const say = (txt, bad) => { note.textContent = txt; note.classList.toggle("bad", !!bad); note.classList.add("on"); noteT = 1.3; };
    const comboTxt = () => { combo.textContent = streak > 2 ? `Clean cuts ×${streak}` : ""; };
    const flash = () => { el.classList.add("shake"); stage.classList.add("flash"); setTimeout(() => { el.classList.remove("shake"); stage.classList.remove("flash"); }, 200); };
    const add = d => { prog = Math.max(0, prog + d * u); };

    function spawn(k) {
      const t = document.createElement("div");
      t.className = "ed-tile " + (k.bad ? "bad" : "good");
      t.style.cssText = `left:${k.lane * laneW + 5}px;width:${TW}px;height:${TH}px;`;
      if (k.bad) t.innerHTML = `<b class="ed-ti">${k.kind[1]}</b><span class="ed-tl">${k.kind[0]}</span>`;
      else {
        const si = k.seg % segs.length, [name, col, word] = segs[si];
        k.word = word; t.style.setProperty("--tc", col);
        const label = clipNames && si < clipNames.length ? clipNames[si] : name;
        t.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ""}<span class="ed-tl">${label}</span>`;
      }
      tilesEl.appendChild(t);
      const o = { ...k, el: t, y: -TH, cut: false, cutT: 0, gone: false };
      tiles.push(o); return o;
    }

    function cutTile(o) {
      if (o.cut || over) return;
      o.cut = true; o.cutT = CUT_T; o.el.classList.add("cut");
      if (o.bad) {
        add(W.badCut + W.combo * Math.min(streak, W.comboMax)); streak++; hits++; emit("sfx", "hit"); comboTxt();
        say(streak > 2 ? `Clean cuts ×${streak}` : "Cut!", false);
      } else {
        add(W.goodCut); streak = 0; emit("sfx", "miss"); comboTxt(); flash(); o.el.classList.add("wrong");
        say(`You cut the ${o.word}!`, true);
      }
    }

    function hitPoint(x, y) {
      for (const o of tiles) {
        if (o.cut || o.gone) continue;
        const l = o.lane * laneW + 5 - SLACK, r = l + TW + 2 * SLACK;
        if (x >= l && x <= r && y >= o.y - SLACK && y <= o.y + TH + SLACK) cutTile(o);
      }
    }
    function sweep(x0, y0, x1, y1) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
      for (let i = 0; i <= n; i++) hitPoint(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n);
    }
    const pos = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) * (SW / (r.width || SW)), (e.clientY - r.top) * (SH / (r.height || SH))]; };

    // ---- input: pointer (mouse and touch), keys ----
    let pid = null, px = 0, py = 0;
    const down = e => {
      if (over || pid !== null) return;
      e.preventDefault(); pid = e.pointerId;
      try { stage.setPointerCapture(pid); } catch (err) { /* synthetic pointer */ }
      [px, py] = pos(e); trail.length = 0; trail.push({ x: px, y: py, t: T }); hitPoint(px, py);
    };
    const move = e => {
      if (e.pointerId !== pid || over) return;
      const [x, y] = pos(e); trail.push({ x, y, t: T }); sweep(px, py, x, y); px = x; py = y;
    };
    const up = e => { if (e.pointerId === pid) pid = null; };
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(n => stage.addEventListener(n, up));
    function key(e) {
      const k = (e.key || "").toLowerCase();
      if (k === "escape") { e.preventDefault(); e.stopPropagation(); return; }
      if (!(k in KEYS)) return;
      e.preventDefault(); e.stopPropagation();
      const lane = KEYS[k]; if (lane >= nLanes || over) return;
      let low = null;
      for (const o of tiles) if (o.lane === lane && !o.cut && !o.gone && o.y + TH > 0 && (!low || o.y > low.y)) low = o;
      if (low) cutTile(low);
      else { const lx = lane * laneW + laneW / 2; trail.length = 0; trail.push({ x: lx, y: LINE - TH, t: T }, { x: lx, y: LINE, t: T }); }
    }

    // ---- main loop ----
    function drawTrail() {
      g.clearRect(0, 0, SW, SH);
      while (trail.length && T - trail[0].t > 0.3) trail.shift();
      if (trail.length < 2) return;
      g.lineCap = "round"; g.lineJoin = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i], f = Math.max(0, 1 - (T - b.t) / 0.3);
        g.strokeStyle = `rgba(255,255,255,${0.9 * f})`; g.lineWidth = 2 + 9 * f;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      T += dt; prog += passive * dt;
      while (next < rows.length && rows[next][0].t <= T) rows[next++].forEach(spawn);
      const v = speed(T);
      for (const o of tiles) {
        if (o.cut) {
          o.cutT -= dt; const f = Math.max(0, o.cutT / CUT_T); o.y += v * dt * 0.6;
          o.el.style.opacity = f.toFixed(2);
          o.el.style.transform = `translateY(${o.y}px) rotate(${(1 - f) * (o.lane % 2 ? 14 : -14)}deg) scale(${0.85 + 0.15 * f})`;
          if (o.cutT <= 0) o.gone = true;
          continue;
        }
        o.y += v * dt;
        o.el.style.transform = `translateY(${o.y}px)`;
        if (o.y + TH / 2 >= LINE) {                            // reached the line uncut
          o.gone = true;
          if (o.bad) { add(W.badMiss); streak = 0; comboTxt(); emit("sfx", "miss"); say("Dead air stayed in", true); }
          else { add(W.good); }
        }
      }
      for (let i = tiles.length - 1; i >= 0; i--) if (tiles[i].gone) { tiles[i].el.remove(); tiles.splice(i, 1); }
      if (noteT > 0) { noteT -= dt; if (noteT <= 0) note.classList.remove("on"); }
      drawTrail();
      const p = Math.min(100, prog); bar.style.width = p + "%"; pct.textContent = Math.floor(p) + "%";
      if (p >= 100) return finish();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      over = true; cancelAnimationFrame(raf);
      document.removeEventListener("keydown", key, true);
      note.classList.remove("on"); g.clearRect(0, 0, SW, SH);
      el.querySelector(".mini-foot").textContent = `Edit done. ${hits} bad clips cut.`;
      el.classList.add("done"); emit("sfx", "done");
      setTimeout(() => { el.remove(); S.edit = null; resolve({ secs: (performance.now() - t0) / 1000, hits }); }, 700);
    }
    const t0 = performance.now();
    S.edit = { site };
    document.addEventListener("keydown", key, true);
    raf = requestAnimationFrame(frame);
  });
}
