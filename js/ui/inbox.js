/* Phone inbox: buyers write after they see posts. */
import { D, S } from "../state.js";
import { $, registerWindow, registerActions } from "./windows.js";
import { AV, replyToChat } from "../sim/shop.js";

const REPLIES = [["price", "Send price"], ["avail", "Yes, available"], ["cod", "COD is OK"], ["where", "Ships from Valenzuela"]];

export function renderInbox(force) {
  const box = $("#inbox"); if (!force && box.contains(document.activeElement)) return;
  const TO = D.T.chat.timeout, WARN = D.T.chat.warnAt;
  const list = S.chats.slice().reverse();
  box.innerHTML = list.length ? list.map(c => `<div style="display:flex;flex-direction:column;gap:.35em;padding-bottom:.6em;border-bottom:.12em dashed #e3dcc8;${c.done ? "opacity:.6" : ""}">
    <div style="display:flex;align-items:center;gap:.5em"><img src="${AV(c.av)}" alt="" style="width:2.3em;border-radius:50%"><div><b style="font-family:var(--display)">${c.name}</b><div style="font-size:.78em;font-weight:700;color:${!c.done && c.t > WARN ? "var(--red)" : "var(--mute)"}">${c.done ? (c.lost ? "Left the chat" : "Done") : `via TikTik · ${Math.max(0, Math.ceil(TO - c.t))}s`}</div></div></div>
    ${c.log.map(([w, t]) => `<div class="bub ${w}">${t}</div>`).join("")}
    ${c.done ? "" : `<div style="display:flex;gap:.3em;flex-wrap:wrap">${REPLIES.map(([k, t]) => `<button class="cap ${k === REPLIES[0][0] ? "t" : "y"} sm" type="button" data-act="reply" data-c="${S.chats.indexOf(c)}" data-v="${k}">${t}</button>`).join("")}</div>`}
  </div>`).join("") : `<div style="text-align:center;color:var(--mute);font-weight:700;margin-top:2em">No messages yet.<br>Buyers write after they see your posts.</div>`;
}

export function initInbox() {
  registerWindow("phone", { open: () => renderInbox(true) });
  registerActions({ reply: (t, v) => { if (replyToChat(+t.dataset.c, v)) renderInbox(true); } });
}
