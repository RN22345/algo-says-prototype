/* Home: placeholder for build mode. */
export default {
  id: "home", title: "Home", icon: "🏠", color: "o", cat: "business", w: 38, h: 46,
  mount(el, win) {
    win.setTitle("Home", "Decorate your shop");
    el.className = "dw-body";
    el.innerHTML = `<div class="lk-screen"><div class="lk-ic">🏠</div><h2>Home</h2><p>Build mode arrives in a later build.</p></div>`;
  }
};
