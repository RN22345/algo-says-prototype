/* Boot. Load data, preload art, load or start a save, start the systems (each registers on the event bus), build the UI, run the loop.
   Systems (js/sim) talk through events and the shared state S. UI modules (js/ui) read S and emit events. */
import { loadData, D } from "./core/data.js";
import { preload } from "./core/assets.js";
import { S, flag, resetState } from "./core/state.js";
import { load, newGame, initSave, save, wipe } from "./core/save.js";
import { initFit } from "./core/fit.js";
import { initSound } from "./core/sound.js";
import { frame } from "./core/clock.js";
import { on, emit } from "./core/bus.js";

import * as events from "./sim/events.js";
import * as market from "./sim/market.js";
import * as rivals from "./sim/rivals.js";
import * as inbox from "./sim/inbox.js";
import * as money from "./sim/money.js";
import * as energy from "./sim/energy.js";
import * as stock from "./sim/stock.js";
import * as orders from "./sim/orders.js";
import * as posts from "./sim/posts.js";
import * as lessons from "./sim/lessons.js";
import * as updates from "./sim/updates.js";
import * as property from "./sim/property.js";
import * as shop from "./sim/shop.js";

import { initUI, h, btn, clear } from "./ui/ui.js";
import { initRoom } from "./ui/room.js";
import { initHud } from "./ui/hud.js";
import { initAlgo, setPostCount } from "./ui/algo.js";
import { initGuide, skipGuide } from "./ui/guide.js";
import { initStations } from "./ui/stations.js";
import { initLayout } from "./ui/layout.js";
import { initPhone } from "./ui/phone.js";
import { initInventory } from "./ui/inventory.js";
import { initCards } from "./ui/cards.js";
import { initDev } from "./ui/dev.js";

async function boot() {
  try {
    await loadData();
    await preload();
  } catch (e) { document.body.innerHTML = `<pre style="color:#fff;padding:20px">Could not load data: ${e.message}\nRun this folder from a static server (python -m http.server).</pre>`; throw e; }
  resetState(); initFit(); initUI(); initSound();
  // systems: events first (it writes S.mods), then market, rivals and the rest
  for (const m of [events, market, rivals, inbox, money, energy, stock, orders, posts, lessons, updates, property, shop]) m.init();
  let had = false;
  try { had = load(); } catch (e) { console.warn("save reset", e); wipe(); }
  initRoom(); initLayout(); initHud(); initInventory(); initAlgo(); setPostCount(() => S.posts.length); initGuide(); initStations(); initPhone(); initCards(); initDev(had);
  initSave();
  showTitle(had);
  let last = performance.now(), run = false;
  on("game:start", () => { run = true; });
  const loop = now => { const dt = (now - last) / 1000; last = now; if (run) frame(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__algo = { S, D, emit, on, skipGuide };
}

function showTitle(had) {
  const root = document.getElementById("title"); clear(root);
  const begin = (fresh, mode) => {
    if (fresh) { newGame(mode); }
    clear(root); emit("game:start"); emit("frame"); emit("cash:changed");
  };
  const logo = small => h("h1", { class: "tlogo" + (small ? " small" : ""), "data-text": "ALGO SAYS" }, "ALGO SAYS");
  const scene = (...kids) => h("div", { class: "tscreen" }, h("div", { class: "tsun" }), h("div", { class: "tcloud c1" }), h("div", { class: "tcloud c2" }), h("div", { class: "tcloud c3" }),
    h("div", { class: "thill h1" }), h("div", { class: "thill h2" }), h("div", { class: "tcontent" }, ...kids));
  const choose = () => {       // new game: start as an affiliate, or skip straight to reselling (feature: start choice)
    clear(root);
    const card = (title, sub, cls, mode, em) => h("div", { class: "startcard" }, h("div", { class: "em" }, em), h("h3", {}, title), h("p", {}, sub), btn("Start", cls, () => begin(true, mode)));
    root.append(scene(logo(true), h("p", { class: "sub" }, "How do you want to start?"),
      h("div", { class: "startrow" },
        card("Affiliate", "Promote other sellers' products for a commission. Free samples, no stock. Learn the sites first.", "b-gold", "affiliate", "🤝"),
        card("Reseller", "Skip ahead. You own shelves and a packing table. Buy stock, post, pack orders, ship.", "b-orange", "reseller", "📦")),
      btn("Back", "b-grey sm", () => showTitle(had))));
  };
  const play = btn(had ? "CONTINUE" : "PLAY", "b-gold big", () => had ? begin(false) : choose());
  const items = [logo(false), h("p", { class: "tag-line" }, "An educational tycoon game"), h("p", { class: "sub" }, "Learn how two video sites treat products. Sell as an affiliate, then as a reseller."), play];
  if (had) items.push(btn("New game", "b-red sm", choose));
  items.push(h("p", { class: "tiny" }, "TikTik and YouView are made-up sites. Not affiliated with any real platform."));
  root.append(scene(...items));
}

boot();
