/* Notes app: one text box, saved in the save file. */
import { S } from "../../state.js";
import { saveGame } from "../../save.js";

export default {
  id: "notes", title: "Notes", icon: "📝", color: "y", cat: "misc", w: 34, h: 56,
  mount(el, win) {
    win.setTitle("Notes", "Saved with your game");
    el.className = "dw-body nt-body";
    el.innerHTML = `<textarea class="nt-in" aria-label="Notes" placeholder="Write down what you notice about your posts and orders."></textarea>`;
    const ta = el.firstChild; ta.value = S.notes || "";
    ta.addEventListener("input", () => { S.notes = ta.value; });
    ta.addEventListener("blur", saveGame);
  }
};
