/* Achievements unlock cover stickers (D-86). Checked about once a second. */
import { D, S, toast, emit } from "../state.js";

export const ACHIEVEMENTS = {
  replies5: { n: "Good listener", how: "Answer 5 buyers", done: () => S.replies >= 5 },
  ship10:   { n: "Reliable shop", how: "Ship 10 orders with a rating of 4.5 or higher", done: () => S.shipped >= 10 && S.rating >= 4.5 },
  early:    { n: "Early bird", how: "Post an item while people are only starting to talk about it", done: () => !!(S.flags && S.flags.early) },
  sold25:   { n: "25 orders", how: "Get 25 orders", done: () => (S.sold || 0) >= 25 },
  nomiss5:  { n: "Never empty", how: "5 posts in a row with no missed sales", done: () => { const l = S.posts.slice(-5); return l.length === 5 && l.every(p => !p.missed); } },
  live1:    { n: "On air", how: "Finish a FaceBazaar live show", done: () => (S.lives || []).length >= 1 }
};

/* Stickers the player can use now. */
export const stickerOpen = id => { const s = D.STK[id]; return !!s && (!s.unlock || !!(S.achv && S.achv[s.unlock])); };
export const stickerFor = a => Object.entries(D.STK).find(([, s]) => s.unlock === a);

let t = 0;
export function updateAchievements(dt) {
  t += dt; if (t < 1) return; t = 0;
  S.achv = S.achv || {};
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) {
    if (S.achv[id] || !a.done()) continue;
    S.achv[id] = S.clock;
    const st = stickerFor(id);
    toast(`Achievement: ${a.n}!${st ? ` New sticker: ${st[1].label}` : ""}`, "img/algo_unit_happy.png");
    emit("sfx", "done");
  }
}
