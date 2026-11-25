/* INBOX: the phone inbox and the "while you slept" summary. Events in: inbox:add {kind,title,text,pid,link}, summary:add text, sleep:end.
   Events out: inbox:changed. kinds: ask, news, system, result, sleep. */
import { S, uid } from "../core/state.js";
import { on, emit } from "../core/bus.js";
import { isSkipping } from "../core/clock.js";

export function init() {
  on("inbox:add", m => {
    S.inbox.unshift({ id: uid("m"), at: S.t, read: false, kind: "system", ...m });
    if (S.inbox.length > 80) S.inbox.length = 80;
    emit("inbox:changed");
    if (m.kind === "ask" || m.kind === "news") emit("sfx", "pop");
  });
  on("summary:add", t => { if (isSkipping()) S.summary.push(t); });
  on("sleep:end", ({ kind, lines }) => {
    if (kind === "nap" || kind === "sleep" || kind === "auto") {
      const title = kind === "nap" ? "While you napped" : "While you slept";
      emit("inbox:add", { kind: "sleep", title, text: lines.length ? lines.join("\n") : "Nothing happened.", pinned: true });
    }
  });
}
export const unread = () => S.inbox.filter(m => !m.read).length;
