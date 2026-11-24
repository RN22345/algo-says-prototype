/* Editing minigame (D-65): "Cut on the beat".
   The clip strip scrolls past the cut line. Press Space (or click) when a cut marker crosses it.
   Hits finish the edit sooner. Misses only slow it down. The video turns out the same either way
   (skill changes speed, never results). The player stays at the desk while it runs; the shop keeps going. */
import { D, S, sel } from "../state.js";
import { editSpeed } from "../sim/gear.js";

const SEGS = {
  tiktik: [["Hook", "#ffd34e"], ["Show", "#9446e0"], ["Proof", "#2cc8b6"], ["Price + how to order", "#ff8a2a"]],
  youview: [["Intro", "#ffd34e"], ["Demo", "#ff8a2a"], ["Compare", "#2cc8b6"], ["Review", "#9446e0"], ["Price", "#ef3b4f"]]
};

export function playEdit(opts = {}) {
  const site = opts.site === "youview" ? "youview" : "tiktik";
  const base = (D.T.edit[site] || 22) * editSpeed();       // seconds with good play
  const GAP = 0.9, SPEED = 220;                              // seconds between markers, strip px per second
  const passive = 100 / (2.2 * base), perHit = (100 - passive * base) * GAP / base;
  const segs = SEGS[site];
  const clipNames = site === "tiktik" && sel.clips && sel.clips.length ? sel.clips.map(c => (D.CLIPS[c] || [c])[0]) : null;

  return new Promise(resolve => {
    const el = document.createElement("div");
    el.className = "mini edit";
    el.innerHTML = `<div class="mini-card">
      <div class="mini-head"><span class="mini-pill">✂️ Editing your ${site === "youview" ? "YouView video" : "TikTik video"}</span><span class="mini-sub">Press <kbd class="k">Space</kbd> or click when a ◆ marker reaches the yellow line</span></div>
      <div class="ed-track"><div class="ed-strip"></div><div class="ed-line"></div></div>
      <div class="ed-info"><div class="ed-bar"><i></i></div><b class="ed-pct">0%</b><span class="ed-combo"></span></div>
      <div class="mini-foot">Hits make the edit finish sooner. The video turns out the same either way. Your shop keeps running while you edit.</div>
    </div>`;
    (document.querySelector("#frame") || document.body).appendChild(el);
    const strip = el.querySelector(".ed-strip"), track = el.querySelector(".ed-track"), bar = el.querySelector(".ed-bar i"), pct = el.querySelector(".ed-pct"), combo = el.querySelector(".ed-combo");

    // build the strip: segment blocks with markers at the cuts
    let x = 0; const marks = [];
    const total = Math.ceil(base * 2.4 / GAP) + 10;
    for (let i = 0; i < total; i++) {
      const [name, col] = segs[i % segs.length];
      const label = clipNames && i % segs.length < clipNames.length ? clipNames[i % segs.length] : name;
      const b = document.createElement("div"); b.className = "ed-seg"; b.style.cssText = `left:${x}px;width:${GAP * SPEED - 6}px;background:${col}`;
      b.textContent = label; strip.appendChild(b);
      const m = document.createElement("div"); m.className = "ed-mark"; m.style.left = (x + GAP * SPEED - 3) + "px"; strip.appendChild(m);
      marks.push({ x: x + GAP * SPEED - 3, el: m, done: false });
      x += GAP * SPEED;
    }

    let prog = 0, off = 0, last = performance.now(), streak = 0, hits = 0, raf = 0, over = false;
    function hit() {
      if (over) return;
      const lx = off, near = marks.find(m => !m.done && Math.abs(m.x - lx) < 26);
      if (near) { near.done = true; near.el.classList.add("hit"); prog += perHit; streak++; hits++; combo.textContent = streak > 2 ? `Clean cuts ×${streak}` : "Cut!"; }
      else { streak = 0; combo.textContent = "Missed the cut"; el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 180); }
    }
    function key(e) {
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); e.stopPropagation(); hit(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
    }
    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      off += SPEED * dt; prog += passive * dt;
      marks.forEach(m => { if (!m.done && m.x < off - 30) { m.done = true; m.el.classList.add("miss"); streak = 0; } });
      strip.style.transform = `translateX(${-off}px)`;
      const p = Math.min(100, prog); bar.style.width = p + "%"; pct.textContent = Math.floor(p) + "%";
      if (p >= 100) return finish();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      over = true; cancelAnimationFrame(raf);
      document.removeEventListener("keydown", key, true);
      el.querySelector(".mini-foot").textContent = `Edit done. ${hits} clean cuts.`;
      el.classList.add("done");
      setTimeout(() => { el.remove(); S.edit = null; resolve({ secs: (performance.now() - t0) / 1000, hits }); }, 700);
    }
    const t0 = performance.now();
    S.edit = { site };
    track.addEventListener("pointerdown", hit);
    document.addEventListener("keydown", key, true);
    raf = requestAnimationFrame(frame);
  });
}
