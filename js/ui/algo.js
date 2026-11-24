/* Mr. Algo: reports facts about the last post. Never says if a choice was good. */
import { D, S } from "../state.js";
import { $, registerWindow, closeUI } from "./windows.js";

let lines = [], idx = 0;

function startAlgo() {
  const PR = D.PR, CLIPS = D.CLIPS;
  const L = [];
  if (!S.algoMet) { S.algoMet = true; L.push("Hi! I'm Mr. Algo.", "I can't tell you what works. Nobody outside the sites knows that for sure.", "I can tell you what happened. Post a video, then come back and ask me."); }
  const p = S.last;
  if (p) {
    S.algoUnread = false;
    const top = Object.entries(p.counts).sort((a, b) => b[1] - a[1])[0];
    L.push(`Your last TikTik video showed the ${PR[p.p].n.toLowerCase()}. It got ${Math.round(p.views).toLocaleString()} views and ${p.orders} orders.`);
    L.push(`Most viewers swiped away at 0:0${p.leftAt}. Your first clip was "${CLIPS[p.clips[0]][0]}". About ${Math.round(p.endPct)}% watched to the end.`);
    if (top) L.push(`The comment people wrote most: "${top[0]}" (${top[1]} times).`);
    if (p.missed) L.push(`${p.missed} people wanted to buy, but the shelf was empty.`);
    const prev = S.posts[S.posts.length - 2]; if (prev) L.push(`The video before it got ${Math.round(prev.views).toLocaleString()} views. That one started with "${CLIPS[prev.clips[0]][0]}".`);
    if (p.first) L.push("That was your first video. First videos reach few people. Keep posting.");
  } else if (S.post) L.push(`Your video is still running. ${Math.round(S.post.views).toLocaleString()} views so far. Come back when it ends.`);
  else if (L.length === 0) L.push("Make a video on the computer. Then come back.");
  lines = L; idx = 0; showAlgo();
}

function showAlgo() {
  $("#algoText").textContent = lines[idx];
  $("#algoNext").textContent = idx < lines.length - 1 ? "Next" : "OK";
  $("#algoImg").src = idx % 2 ? "img/algo_unit_neutral.png" : "img/algo_unit_talk_1.png";
}

export function initAlgo() {
  registerWindow("algo", { open: startAlgo });
  $("#algoNext").onclick = () => { if (idx < lines.length - 1) { idx++; showAlgo(); } else closeUI(); };
}
