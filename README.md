# Algo Says: HTML prototype (07_PROTOTYPE)

A modular, data-driven vertical slice. Design: `../03_DESIGN/GDD_Prototype.md`. Decisions D-95 to D-101.
Plain HTML, CSS and ES modules. No build step, no npm.

## Run it

```
cd 07_PROTOTYPE
python -m http.server 8769
```
Open http://localhost:8769/index.html. It must come from a static server (modules and `fetch` do not work from `file://`). It also runs on GitHub Pages.
The page is a 1920x1080 stage scaled to the window (landscape phones too). Touch and mouse both work.
While developing, use a server that sends `Cache-Control: no-store`, or hard reload. Browsers cache ES modules.
Missing art files show up as 404 lines in the console. That is expected: the game draws a placeholder for each (see Art).

Saves go to `localStorage` (key and version in `data/config.json`). A bad or old save resets cleanly.
Dev panel: press the backtick key, or the small purple "D" button at the bottom right.

## Play the core loop

1. Press PLAY. Mr. Algo talks. Click the Desk PC (spotlighted). Open the Affiliate tab. Press "Request sample" on a product.
2. Time runs (6:00 to 24:00 each day, about 12 real minutes). Samples arrive at the door in about 3 game hours. Nap at the bed to pass time, or use the dev panel (x20).
3. Click the Front door. "Take it in".
4. Click the Filming corner.
   - Plan: drag clip cards into the slots (or tap), or press "Fill with a basic plan". Next.
   - Shoot: pick action, angle and light for each slot. Press REC. Each clip costs game time and energy.
   - Edit: drag the gold handles to trim the hatched dead air. Drag title bars to reorder. Pick captions, sound, price, filter, sticker. Export.
   - Post: caption (TikTik) or search title (YouView), up to 3 tags. POST.
5. Wait about 30 game minutes. The phone Inbox says "First results are in". Open Results (also: Desk PC, TikTik, My posts).
6. Read the retention line, the comments, Mr. Algo's 3 Things. ALGO SAYS cards pop up the first time a lesson happens and are saved in the phone Playbook.
7. Earn cash. Tool Shop (Desk PC): Ring light (true colour at any hour), Camera (opens YouView), Shelves and packing table (opens reselling).
8. Reselling: Supplier tab (order before 18:00, arrives 9:00 next day at the door). Take the box in. Shelves: put stock on shelves. Post with "My stock". Packing table: tap Pack 3 times per order. Courier takes parcels at 11:00 and 17:00. Cash on delivery arrives about 12 hours later.

## Folder map

```
index.html            one page, six layers (room, hud, algo, phone, modals, fx)
css/style.css         the artist palette, Lilita One + Fredoka, buttons, cards
data/                 EVERYTHING tunable (JSON)
  config.json         feature flags, editor mode, start values, seed trends, save version
  time.json           day length, daylight, nap/sleep, supplier and courier hours, energy costs, rent
  products.json       products: traits, price, unit cost, commission, sample delay, art ids
  shots.json          actions, angles, lights: what each answers, how each fits each trait
  viewers.json        viewer types, mixes, model constants, comment words, the reason table for Mr. Algo
  sites.json          TikTik and YouView: patience, refill, reach waves, search trickle, slots, stickers, filters, sounds, platform updates
  lessons.json        ALGO SAYS cards: id, when, conditions, text
  gear.json           equipment and what it opens
  room.json           the room view (iso), station positions, hit areas, art ids, required gear
  market.json         trend lifecycles, fizzles, rivals, creators, feed comments
  events.json         calendar events and random events (see below)
  assets.json         every art id from the artist list, with size and kind
  intro.json          guided start steps and Mr. Algo hints
img/                  artist PNGs go here, named by art id (st_desk.png, product_tote.png ...)
img/ph/               stand-in art (old product icons, Mr. Algo, avatars)
js/core/              bus, data, state, clock, save, assets, fit, sound, actions
js/sim/               viewerModel (pure), market, rivals, events, posts, orders, stock, money, energy, inbox, lessons, algo3, updates
js/ui/                room, hud, algo, phone, browser (+ sites/), studio, scene, editor, results, cards, door, bed, shelves, packing, stations, dev, ui
PROGRESS.md           build log
```

## How the pieces talk

- One event bus (`js/core/bus.js`: `on`, `emit`) and one shared state object `S` (`js/core/state.js`). Sim modules do not import each other. They listen to events and read or write `S`.
- Each file has a header comment: what it does and which events it uses.
- Viewer model: `simulate(video, product, siteId, ctx, seed)` in `js/sim/viewerModel.js`. Pure and seeded. Returns viewers, retention curve, drop reasons, comments, orders, returns and a wave schedule.
- Editor: `editVideo(draft, ui)` in `js/ui/editor.js` returns a Promise of the edit. `config.editorMode` picks `"blocks"` or `"auto"` (no UI). Add a mode by adding a branch in `editVideo`.
- Posts play out over game time (`js/sim/posts.js`), so they keep earning while you sleep. Time skips run the same tick events.

## How to ...

**Add a product.** Add an object to `data/products.json` (id, name, short, traits from colour/function/transformation/mood/scale, price, cost, commission, sampleDelay, art, icon, color, emoji, searchWords, tags, pack). Add `product_<id>` and `icon_<id>` to `data/assets.json`. It then appears in the catalogue, supplier, Studio preview, trends and the sims. Add it to `evergreen` only if it should sell all the time.

**Add a shot option.** Add an entry to `actions`, `angles` or `lights` in `data/shots.json`. For an action give `answers` (what, why, works, trust, get), `fits` per trait, `dur`, `minutes`, `energy`, `ansAt` and `hands` (hold, pinch, open or none). The Studio chips and the model pick it up. A new action also needs a drawing case in `js/ui/scene.js` (the `switch`); without one it shows the product only.

**Add a lesson.** Add an object to `lessons` in `data/lessons.json`: `id`, `title`, `text`, `when` (analysis, done or return), `if` (all of [fact, op, value]) or `any` (a list of such lists). Facts are listed in `js/sim/lessons.js` (`facts()`): views, orders, conv, missed, returns, hookLeft, colourDoubt, misleading, siteFit, bothSites, afterUpdate, heat, crowd, finish. A new fact is one line in `facts()`.

**Add a station.** Add an object to `stations` in `data/room.json`: `id`, `label`, `art`, `tile: [gx, gy, fw, fd]` (iso) or `x, y` (anchor), `scale`, `z`, `opens`, optional `hit`, `flag`, `requiresGear`. Wall art uses `mount: {face, t, z}`. Add the art id to `data/assets.json`. `opens` is a key in `OPEN` in `js/ui/stations.js`; add one line there that imports your screen.

**Change the room view.** The room is placed only from `data/room.json`. `view` holds the iso grid. A hit area can be a rect or polygon in room pixels. Replace `view.type` handling in `js/ui/room.js` to try another projection.

**Turn a mechanic off.** `data/config.json` `features`, or tick it in the dev panel. Flags: `energy`, `rent`, `honestyTrap` (vivid filter and fake sticker), `tier2` (shelves, packing, supplier), `platformUpdates`, `playbook`, `algoSays` (the cards), `intro`, `sound`, `calendarEvents`, `randomEvents`. `editorMode: "auto"` skips the edit screen. Every flag off still gives a working affiliate game.

**Add a market event.** Add an entry to `list` (random) or `calendar` in `data/events.json`. Effect kinds: `heatAdd`, `push`, `reach`, `conv`, `dealSpend`, `crowd`, `cost`, `supplierDelay`, `returns`, `patience`, `courierDelay`. Targets: all, product, trait, site, randomProduct (optional pool). Give it `signals` (feed, inbox, comments), a `headline` for the Seller Hub and an `explain` line that Mr. Algo uses in the 3 Things.

**Add a platform update.** Add an object to `updates` in `data/sites.json`: day, hour, rumour text, news text, `set` (deltas such as `"tiktik.patience": -0.8`) and `outdates` (lesson ids to flag in the Playbook).

**Tune the feel.** Retention and sales: `data/viewers.json` `model`, per-site `patience`, `refill`, `reach` in `data/sites.json`. Pace: `data/time.json`.

## Art

`js/core/assets.js` loads `img/<id>.png`, then `img/ph/<id>.png`, then draws a labelled placeholder. The artist drops PNGs into `img/` with the same names as `../05_ART/Artist_Asset_List.md`. No code change. `img/st_*.png` are the old iso sprites; `st_filming.png` is a composite of the old light and table. The door and window are drawn on the room walls and skewed to fit. The shoot preview is a flat camera image.

## Market events (D-95 style, ON by default)

Calendar: Payday (every 7 days from day 3), 5.5 Mega Sale (day 5), 11.11 Mega Sale (day 11). Supplier prices rise 1 to 2 days before a sale. Announced a day ahead.
Random: about 3 to 5 a week, weighted. Creator sighting, defect report, supplier shortage, rival flood, before-and-after challenge, cosy haul challenge, rainy week, courier delay. Each one posts a signal first (Seller Hub headline, feed post, inbox message, buyer comments). The dev panel lists active events and can trigger any by id.
