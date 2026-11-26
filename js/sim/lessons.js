/* LESSONS. The first time a lesson in data/lessons.json holds, it fires an ALGO SAYS card and is saved to the Playbook with the post as evidence.
   Conditions are data: [fact, op, value]; "==" and "!=" also compare strings (site). Facts are built here from a post. when = analysis | done | return.
   Events in: post:analysed, post:done, order:returned. Events out: lesson:new {lesson, post}. Flags: algoSays (cards), playbook (saving). */
import { D } from "../core/data.js";
import { S, flag } from "../core/state.js";
import { on, emit } from "../core/bus.js";

const OPS = { "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b, "==": (a, b) => a === b, "!=": (a, b) => a !== b };

export function facts(post) {
  const r = post.res, f = r.facts;
  return {
    views: post.views, orders: post.orders, conv: post.views ? post.orders / post.views : 0, missed: post.missed, returns: post.returns,
    hookLeft: f.hookLeft, colourDoubt: f.colourDoubt, misleading: f.misleading, siteFit: post.ctx.siteFit ?? 1,
    bothSites: S.posts.some(o => o.pid === post.pid && o.site !== post.site), afterUpdate: !!post.afterUpdate,
    heat: post.ctx.heat, crowd: post.ctx.crowd, finish: f.finish,
    site: post.site, doneCount: S.posts.filter(o => o.done).length,                          // the post's site id; finished posts so far (this one included at "done")
    viewsPerFollower: post.views / Math.max(1, post.ctx.followers ?? 0), strangerViews: r.viewers.strangers   // views against followers at posting time; planned stranger views (the model has no shares stat)
  };
}
const check = (c, fa) => OPS[c[1]](fa[c[0]], c[2]);
const holds = (lesson, fa) => (lesson.if ? lesson.if.every(c => check(c, fa)) : true) && (lesson.any ? lesson.any.some(g => g.every(c => check(c, fa))) : true);

function evaluate(when, post) {
  if (!flag("algoSays") && !flag("playbook")) return;
  const fa = facts(post);
  for (const lesson of D.lessons) {
    if (lesson.when !== when || S.lessonsSeen[lesson.id]) continue;
    if (!holds(lesson, fa)) continue;
    S.lessonsSeen[lesson.id] = { at: S.t, postId: post.id };
    if (flag("playbook")) S.playbook[lesson.id] = { at: S.t, postId: post.id, evidence: `${prodName(post)} on ${D.SITE[post.site].name}: ${post.views} views, ${post.orders} orders`, outdated: false };
    emit("lesson:new", { lesson, post, show: flag("algoSays") });
  }
}
const prodName = post => D.P[post.pid].short;

export function init() {
  on("post:analysed", p => evaluate("analysis", p));
  on("post:done", p => evaluate("done", p));
  on("order:returned", ({ postId }) => { const p = S.posts.find(x => x.id === postId); if (p) evaluate("return", p); });
}
