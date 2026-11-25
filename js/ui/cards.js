/* CARDS and overlays: the ALGO SAYS card (first time a lesson happens), the blackout used by nap and sleep.
   Events in: lesson:new {lesson, post, show}. Exports: blackout(text, midFn) for the bed. */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { h, btn, art, modal } from "./ui.js";
import { artUrl } from "../core/assets.js";
import { sfx } from "../core/actions.js";

const queue = []; let showing = false;

export function initCards() {
  on("lesson:new", ({ lesson, post, show }) => { if (!show) return; queue.push({ lesson, post }); next(); });
  on("sleep:end", ({ kind }) => { if (kind === "auto") emit("phone:open", { tab: "inbox" }); });
  const fx = h("div", { id: "sleepfx" }); document.getElementById("frame").append(fx);
}
function next() {
  if (showing || !queue.length) return;
  showing = true; const { lesson, post } = queue.shift();
  sfx("lesson");
  const m = modal({
    title: "ALGO SAYS", cls: "says sticky", pause: true, noClose: true, onClose: () => { showing = false; setTimeout(next, 250); },
    body: [h("div", { style: { display: "flex", gap: ".8em", alignItems: "center" } },
      h("img", { src: artUrl("algo_" + (lesson.mood || "talk")), alt: "", style: { width: "200px", height: "200px", objectFit: "contain" } }),
      h("div", {}, h("div", { class: "tag gold" }, lesson.title), h("div", { class: "txt", style: { font: "400 1.7em/1.2 var(--lil)", marginTop: ".2em" } }, lesson.text),
        h("div", { style: { font: "600 .6em var(--body)", opacity: ".85", marginTop: ".6em" } }, flag("playbook") ? `Saved to your Playbook. Evidence: your ${D.P[post.pid].short} post on ${D.SITE[post.site].name}.` : "")))],
    headerExtra: null
  });
  m.body.append(h("div", { class: "row", style: { justifyContent: "flex-end", marginTop: ".4em" } }, btn("Got it", "b-gold", () => m.close())));
}

/* Fade to black with text, run midFn, fade back. */
export function blackout(text, midFn, hold = 900) {
  return new Promise(res => {
    const fx = document.getElementById("sleepfx"); fx.textContent = text; fx.classList.add("on");
    setTimeout(() => { try { midFn && midFn(); } catch (e) { console.error(e); } setTimeout(() => { fx.classList.remove("on"); res(); }, hold); }, 750);
  });
}
