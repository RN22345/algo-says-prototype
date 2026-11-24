/* Boot and main loop. Fixed timestep driven by requestAnimationFrame. */
import { S, rt, on, loadData, D, resetState, pl } from "./state.js";
import { initWorld } from "./world.js";
import { initRender, render } from "./render.js";
import { updateCamera, snapCamera, cam, setZoom, screenToTile, tileToScreen } from "./camera.js";
import { initNpcs, updateNpcs, npcs } from "./npcs.js";
import { updatePost } from "./sim/post.js";
import { updateShop, updateDeliveries, checkMilestone, syncStock } from "./sim/shop.js";
import { updateRiders, updateVan, updateJeep, updatePlayer } from "./entities.js";
import { initWindows, $ } from "./ui/windows.js";
import { renderHud, initHud } from "./ui/hud.js";
import { initInbox, renderInbox } from "./ui/inbox.js";
import { initAlgo } from "./ui/algo.js";
import { initPlaces, refreshPlaces } from "./ui/places.js";
import { initInput } from "./input.js";
import { initSave, loadGame, saveGame, newGame } from "./save.js";
import { initDev, devTick } from "./dev.js";
import { initDesktop, refreshDesktop, pcApi } from "./pc/desktop.js";
import { loadSprites } from "./sprites.js";

const DT = 1 / 60;       // fixed simulation step (seconds)
const MAX_STEPS = 15;    // catch-up limit per frame
let acc = 0, uiT = 0;

/* One simulation step. Same order as the original loop. */
function update(dt) {
  rt.perf += dt;
  updatePost(dt);
  updateShop(dt);
  updateRiders(dt);
  updateDeliveries(dt);
  updateVan(dt);
  updateJeep(dt);
  updatePlayer(dt);
  updateNpcs(dt);
  updateCamera(dt);
  checkMilestone();
}

function refreshUI() {
  renderHud();
  refreshDesktop();
  if (S.ui === "phone") renderInbox(false);
  refreshPlaces();
  devTick();
}

/* Advance game time without rAF. Used by the developer panel and by tests. */
export function step(seconds) {
  let n = Math.floor(seconds / DT + 1e-9);
  const rest = seconds - n * DT;
  while (n-- > 0) update(DT);
  if (rest > 1e-9) update(rest);
  refreshUI();
}

function frame(now) {
  const real = Math.min(0.25, (now - last) / 1000); last = now;
  rt.fps = rt.fps ? rt.fps * 0.9 + (1 / Math.max(real, 1e-3)) * 0.1 : 60;
  acc += real;
  let n = 0;
  while (acc >= DT && n < MAX_STEPS) { update(DT); acc -= DT; n++; }
  if (n === MAX_STEPS) acc = 0;
  render();
  uiT -= real; if (uiT <= 0) { uiT = 0.2; refreshUI(); }
  requestAnimationFrame(frame);
}
let last = performance.now();

async function boot() {
  try { await loadData(); }
  catch (e) {
    $("#start").hidden = true;
    const m = document.createElement("p"); m.className = "loaderr";
    m.textContent = "Could not load game data. Run this folder from a web server (see README).";
    $("#frame").appendChild(m); console.error(e); return;
  }
  try { await loadSprites(); } catch (e) { console.warn("sprites not loaded, using drawn shapes", e); }
  initWorld(D.MAP);
  resetState();
  loadGame();
  syncStock();
  initNpcs();
  snapCamera();
  initRender($("#iso"));
  initWindows(); initHud(); initInbox(); initAlgo(); initPlaces();
  try { await initDesktop(); } catch (e) { console.error(e); }
  initDev({ step });
  initInput();
  initSave();
  on("refresh", refreshUI);
  window.__game = { state: S, player: pl, step, render, refresh: refreshUI, save: saveGame, newGame, data: D, cam, npcs, setZoom, screenToTile: (x, y) => screenToTile(x, y, $("#iso").getBoundingClientRect()), tileToScreen: (i, j, z) => tileToScreen(i, j, $("#iso").getBoundingClientRect(), z), pc: pcApi };
  refreshUI();
  last = performance.now();
  requestAnimationFrame(frame);
}

boot();
