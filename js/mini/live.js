/* FaceBazaar live minigame (D-66): juggle the room.
   Each product you brought is a lane. Comments "Mine <code>" fall down their lane; confirm them (CF) on the line
   with keys 1-4 or a click. Joy miners look slightly off (new account, no photo) and never pay if confirmed.
   Hype drains over time and when claims are missed; it sets how many viewers stay and how often they claim.
   The real Philippine routine: mine + item code, CF, joy miners, tally after the show (sourced in the paper). */
import { D, S, toast } from "../state.js";
import { makeOrder, syncStock } from "../sim/shop.js";

const R = Math.random;
const NAMES = ["Ana", "Mark", "Joy", "Kiko", "Bea", "Jen", "Paolo", "Mika", "Rico", "Lea", "Trish", "Jomar", "Cha", "Nico"];

export function playLive(opts = {}) {
  const items = (opts.items || []).filter(p => D.PR[p]).slice(0, 4);
  const L = D.T.live, DUR = L.duration, FALL = 2.4, WIN = 0.32;
  const res = { claims: 0, sold: 0, joy: 0, missedClaims: 0, peakViewers: 0 };
  if (!items.length) return Promise.resolve(res);
  const code = i => D.PR[items[i]].n.split(" ")[0].slice(0, 3).toUpperCase() + (i + 1);

  return new Promise(resolve => {
    const el = document.createElement("div");
    el.className = "mini live";
    el.innerHTML = `<div class="mini-card lv">
      <div class="mini-head"><span class="mini-pill fb">🔴 LIVE on FaceBazaar</span><span class="lv-view">👀 0</span><span class="lv-time">0:00</span></div>
      <div class="lv-hype"><span>Room interest</span><div class="lv-hbar"><i></i></div></div>
      <div class="lv-stage" style="grid-template-columns:repeat(${items.length},1fr)">${items.map((p, i) => `<div class="lv-lane" data-i="${i}"><div class="lv-notes"></div><div class="lv-line"></div><div class="lv-foot"><img src="img/${D.PR[p].icon}.png" alt=""><b>${code(i)}</b><span class="lv-stock"></span><kbd class="k">${i + 1}</kbd></div></div>`).join("")}</div>
      <div class="mini-foot">Confirm "Mine" claims when they reach the line. Some accounts look off. Your shop keeps running.</div>
    </div>`;
    (document.querySelector("#frame") || document.body).appendChild(el);
    const lanes = [...el.querySelectorAll(".lv-lane")], hbar = el.querySelector(".lv-hbar i"), viewEl = el.querySelector(".lv-view"), timeEl = el.querySelector(".lv-time");

    let t = 0, hype = 0.6, spawn = 0.8, last = performance.now(), raf = 0, over = false;
    const notes = [];
    const fol = S.followers.facebazaar || 0;
    const viewers = () => Math.round((L.viewersBase + fol * 0.2) * (0.4 + hype));

    function addNote() {
      const open = items.map((p, i) => i).filter(i => S.stock[items[i]] > 0);
      if (!open.length) return;
      const i = open[Math.floor(R() * open.length)], joy = R() < L.joyChance;
      const n = document.createElement("div"); n.className = "lv-note" + (joy ? " joy" : "");
      const name = NAMES[Math.floor(R() * NAMES.length)];
      n.innerHTML = joy ? `<span class="av q">?</span><span><b>${name}${Math.floor(R() * 900 + 100)}</b><small>new account</small>Mine ${code(i)}!!</span>` : `<span class="av" style="background:hsl(${Math.floor(R() * 360)},70%,72%)">${name[0]}</span><span><b>${name}</b>Mine ${code(i)}</span>`;
      lanes[i].querySelector(".lv-notes").appendChild(n);
      notes.push({ i, joy, t: 0, el: n, done: false });
    }
    function press(i) {
      if (over || i < 0 || i >= items.length) return;
      const cand = notes.filter(n => !n.done && n.i === i && Math.abs(n.t - FALL) < WIN).sort((a, b) => Math.abs(a.t - FALL) - Math.abs(b.t - FALL))[0];
      lanes[i].classList.add("tap"); setTimeout(() => lanes[i].classList.remove("tap"), 120);
      if (!cand) { hype = Math.max(0, hype - 0.03); return; }
      cand.done = true; res.claims++;
      if (cand.joy) { res.joy++; cand.el.classList.add("cfjoy"); const s = S.shelves.find(x => x.p === items[i] && x.n > 0); if (s) { s.n--; syncStock(); S.back[items[i]] = (S.back[items[i]] || 0) + 1; } }
      else { res.sold++; cand.el.classList.add("cf"); makeOrder(items[i]); hype = Math.min(1, hype + 0.08); }
      setTimeout(() => cand.el.remove(), 260);
    }
    function key(e) {
      const k = +e.key;
      if (k >= 1 && k <= 4) { e.preventDefault(); e.stopPropagation(); press(k - 1); }
      else if (e.key === "Escape" || e.code === "Space") { e.preventDefault(); e.stopPropagation(); }
    }
    el.querySelector(".lv-stage").addEventListener("pointerdown", e => { const l = e.target.closest(".lv-lane"); if (l) press(+l.dataset.i); });

    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
      hype = Math.max(0, hype - L.hypeDrain * dt);
      spawn -= dt * (0.6 + hype) * (1 + viewers() / 40);
      if (spawn <= 0 && t < DUR - FALL) { addNote(); spawn = L.claimEvery * (0.7 + R() * 0.6); }
      notes.forEach(n => {
        if (n.done) return;
        n.t += dt; n.el.style.top = `${(n.t / FALL) * 82}%`;
        if (n.t > FALL + WIN) { n.done = true; if (!n.joy) { res.missedClaims++; hype = Math.max(0, hype - 0.06); } n.el.classList.add("gone"); setTimeout(() => n.el.remove(), 300); }
      });
      const v = viewers(); res.peakViewers = Math.max(res.peakViewers, v);
      viewEl.textContent = `👀 ${v}`; timeEl.textContent = `${Math.floor((DUR - t) / 60)}:${String(Math.max(0, Math.floor(DUR - t) % 60)).padStart(2, "0")}`;
      hbar.style.width = Math.round(hype * 100) + "%"; hbar.style.background = hype < 0.3 ? "#ef3b4f" : hype < 0.6 ? "#ffd34e" : "#3ddc84";
      lanes.forEach((ln, i) => { ln.querySelector(".lv-stock").textContent = `${S.stock[items[i]]} left`; ln.classList.toggle("out", S.stock[items[i]] <= 0); });
      if (t >= DUR) return finish();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      over = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", key, true);
      const gain = res.sold * 3 + Math.round(res.peakViewers / 4);
      S.followers.facebazaar = fol + gain; res.followers = gain;
      (S.lives = S.lives || []).push({ ...res, items, at: S.clock });
      el.querySelector(".mini-foot").innerHTML = `<b>Show over.</b> ${res.claims} claims confirmed: ${res.sold} paid, ${res.joy} never paid (their items went back to storage). ${res.missedClaims} claims were missed. +${gain} followers.`;
      el.classList.add("done");
      toast(`Live ended: ${res.sold} orders to pack`);
      setTimeout(() => { el.remove(); S.edit = null; resolve(res); }, 3500);
    }
    S.edit = { site: "facebazaar" };
    document.addEventListener("keydown", key, true);
    raf = requestAnimationFrame(frame);
  });
}
