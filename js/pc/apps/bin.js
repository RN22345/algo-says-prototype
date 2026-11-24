/* Recycle Bin: a joke. One item, one funny text. */
const TEXT = `BUY NOW!!! best earbuds ever (not sponsored)

version 2: please buy
version 3: ok but actually buy
version 4: my cat says buy
version FINAL: the wrong one got posted

(This file will not come back. It knows what it did.)`;

export default {
  id: "bin", title: "Recycle Bin", icon: "🗑️", color: "r", w: 40, h: 54,
  mount(el, win) {
    win.setTitle("Recycle Bin", "1 item");
    el.className = "dw-body";
    let open = false;
    const draw = () => {
      el.innerHTML = `<div class="bn"><button type="button" class="bn-item" aria-expanded="${open}">📄<span>old_caption_final_FINAL2.txt</span></button>${open ? `<pre class="bn-txt">${TEXT}</pre>` : `<small>Click the file to open it.</small>`}</div>`;
      el.querySelector(".bn-item").onclick = () => { open = !open; draw(); };
    };
    draw();
  }
};
