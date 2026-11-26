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
The game reads `img/_have.json` (a list of the PNGs that exist) so it does not probe for missing art. After adding or removing art, run `python tools/make_have.py`. Open the page with `?probe=1` to probe every file instead (no list needed, but missing files show as 404 lines).

Saves go to `localStorage` (key and version in `data/config.json`). A bad or old save resets cleanly.
Dev panel: press the backtick key, or the small purple "D" button at the bottom right.

## Play the core loop

1. Press PLAY. Mr. Algo talks. Click the Desk PC (spotlighted). Open the Affiliate tab. Press "Request sample" on a product.
2. Time runs (6:00 to 24:00 each day, about 6 real minutes; `minPerRealSec` in `data/time.json`). Samples arrive at the door in about 3 game hours. Nap at the bed to pass time, or use the dev panel (x20).
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
tools/make_have.py    writes img/_have.json
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

`js/core/assets.js` loads `img/<id>.png` (if `_have.json` lists it), then `img/ph/<id>.png`, then draws a labelled placeholder. The artist drops PNGs into `img/` with the same names as `../05_ART/Artist_Asset_List.md`, then runs `python tools/make_have.py`. No code change. `img/st_*.png` are the old iso sprites; `st_filming.png` is a composite of the old light and table. The door and window are drawn on the room walls and skewed to fit. The shoot preview is a flat camera image.

## Market events (D-95 style, ON by default)

Calendar: Payday (every 7 days from day 3), 5.5 Mega Sale (day 5), 11.11 Mega Sale (day 11). Supplier prices rise 1 to 2 days before a sale. Announced a day ahead.
Random: about 3 to 5 a week, weighted. Creator sighting, defect report, supplier shortage, rival flood, before-and-after challenge, cosy haul challenge, rainy week, courier delay. Each one posts a signal first (Seller Hub headline, feed post, inbox message, buyer comments). The dev panel lists active events and can trigger any by id.

## Walking, furniture, outside, start choice
- Walk with WASD or arrows, or click the floor. Click a station to walk there and use it; E or Space uses the station in reach.
- Move (dock button or M): click a piece to pick it up, R rotates, click to drop on a green spot. Saved in `S.layout`. `"fixed": true` in room.json stops a piece moving.
- House size and door gap are in `data/room.json` (`view.Nx/Ny`, `front`); the yard, street and extra rooms are in `data/world.json` (see World below). Riders, the supplier van, and traffic are drawn by `js/ui/outside.js` from the clock and events (visual only).
- New game asks: Affiliate or Reseller. Reseller sets the `affiliate` flag off, gives shelves and `start.reseller.cash` (config.json), and uses `stepsReseller` in intro.json.
- Dev server without caching: `python tools/serve.py 8771`.

## Screens (Builder B, round 3: D-107 to D-109)

- **Phone** (`js/ui/phone.js`, `js/ui/phone/*`): a phone with bezel, notch, status bar (game clock), home screen of app icons with badges, and a home bar. Apps: Messages, TikTik, YouView, Orders, Bank, Calendar, Playbook. `emit("phone:open", {tab})` still works (inbox, feeds, orders, wallet, playbook) and also takes an app id (`{app: "calendar"}`). A modal opening closes the phone unless it was opened with `keepPhone: true`. To add an app: write `{id, label, emoji, vicon, grad, badge(), draw(ctx)}` and add it to `appList()` in `phone.js`.
- **Desk PC** (`js/ui/browser.js`, `js/ui/pc/*`): `desktop.js` is the monitor, wallpaper, icons, taskbar, start menu and window manager (`openWindow`, drag, resize, minimise, maximise, close). Windows survive closing the PC. `browser.js` registers the icons and builds the Browser window (tabs, address bar with `addr` from `data/sites.json` "browser", bookmark bar). Site pages in `js/ui/sites/*` render unchanged inside it. To add a desktop app: `registerApp({id, label, emoji, grad, show?, open})`. To add a site: add an entry to `data/sites.json` "browser" (with `addr`) and a page module in `js/ui/sites/`.
- **Stock Sheet** (`js/ui/pc/stocksheet.js`): a spreadsheet window of stock per product. **Property** site (`sites/property.js`) reads `D.world.properties`; Tool Shop shows `D.gear.furniture`. `js/ui/pc/helpers.js` reads property and furniture state with guards.
- **HUD** (`js/ui/hud.js`, round 4): soft glass panels, no artist HUD art. Top left: one stat strip (cash, followers on each site, trust, energy) and the goal line (click to fold). Top right: clock (sun or moon, time, day, day progress) with round bell and settings buttons. Bottom right: dock with Bag (I), Phone (P), Move (M). Calm mode fades the panels while the player walks; any change wakes them. H hides the HUD down to the clock (also in Settings). Icons are one line-icon set in `js/ui/icons.js` (`ic(name)`).
- **Inventory** (`js/ui/inventory.js`): bottom bar (in hand, stock box, parcels) and the bag (key I, Parcel button, `bag:open {tab}`): Orders, Stock, Furniture (Place emits `layout:place {id}`), Gear.
- **Title** (`showTitle` in `js/main.js`, styles in `css/ui2.css`).
- Styles for all of this are in `css/ui2.css`. The intro spotlight uses `.sp-order` and `.aff-req` (classes on the supplier and affiliate buttons) inside the focused window.

## World (Builder A, round 3: D-105 to D-106)

- **Camera.** The world is bigger than the stage. `js/ui/camera.js` follows the player (dead zone, clamped to the ground box), mouse wheel or two-finger pinch zooms 0.7 to 1.3. The hit layer and name tags use the same matrix. `window.__algo` plus `import('/js/ui/room.js')` gives `perf.ms` (draw time).
- **Files.** `proj.js` (P, toTile), `world.js` (what exists: rooms, walls, stations, props, `blockedAt`, the walk grid and `findPath`), `rig.js` (box characters), `traffic.js` (cars), `people.js` (passers-by), `fx.js` (pop-in and dust), `terrain.js` (the ground diorama drawn once to an offscreen shell, front walls, props, clouds), `player.js` (walking, BFS, drawing), `outside.js` (courier on foot, sample rider, van, boxes, traffic), `art.js` (sprite loader and drawing), `drawkit.js` (code-drawn fallbacks), `camera.js`, `joystick.js`, `room.js` (draw loop, hit layer), `layout.js` (Move furniture and the tray), `propertycard.js` (for-sale card), `js/sim/property.js` (buying).
- **Art contract.** `data/sprites.json` plus `img/v/<id>.png`. A station, prop, vehicle, item or character uses its sprite when the id is listed, otherwise the old PNG or a code-drawn stand-in. A station takes its footprint width and depth from its sprite (`fw`, `fd`); `gx`, `gy` come from `room.json`. A station can name `sprite` (an id in sprites.json) and `art` (old fallback). The view is true iso (`th` 46.19, `zUnit` 92); change `view` in `room.json` and the floor, walls and hit areas follow.
- **Street.** `data/world.json`: `ground` (tile rects painted in order), `road` (rect, lane x positions, curb, crosswalk), `walk` (where the player may stand outside), `props` (by tile centre; `block:false` walks through), `clouds`. The road is blocked except the crosswalk; cars stop for the player on it.
- **Property.** `world.json` `properties`: `floor [x,y,w,d]`, `doorway [x0,x1]`, `price`, `rentAdd`, `requires`, `sign [x,y]`, `stations`. An unbought lot is fenced with a for-sale sign (walk there, click). Buying: `property:buy {id, ok}`; state `S.property {id: true}`; rent rises by `rentAdd` (money.js). A station with `shelves: n` adds n shelves of 6 to `S.shelves`; `S.shelfOwn {stationId: [first, count]}` says which are its own. `effects.shootMult` on a studio station scales shoot time while shooting there (`where.shootMult` in `js/sim/property.js`, set by `stations.js`).
- **Furniture.** `gear.json` `furniture` (also `D.gear.furniture`, `D.F`). `furniture:buy {id, ok}` puts the id in `S.furniture` (unplaced list). `layout:place {id}` starts Move furniture with that piece; placing it adds `{uid, id}` to `S.placed` and its position to `S.layout[uid]`. Decor can go back in the tray; shelf units cannot (their shelves stay).
- **Touch.** A virtual joystick shows on `(pointer: coarse)` devices, or with `?joy=1` in the address.

## Round 4: map, walking, characters, life, UI

- **Map.** `data/world.json` is generated by a script (bounds -8..32 by -14..34): two blocks of houses, a park and a garden with paths, two crosswalks, edge woods. `walkAreas` are the rects where people may walk outside; the road is walkable only on `road.crosses`.
- **Walking.** One grid (cell 0.25) over the world bounds, with a player layer and an NPC layer (`cellBlocked`). `findPath` is BFS plus string-pulling, so paths are straight where they can be. The player body is a small circle; it slides along walls. Stations are hit by their painted pixels (`hitStation`), with a glow outline on hover (white) and in reach (gold). Name tags show only on hover, in reach (with the E key), with a count, or when the guide points.
- **Characters.** `js/ui/rig.js` draws a person from boxes (legs, body, arms, head, hair, eyes) at any angle, with walk cycle, blink, breathing, carry, sit, wave and a scooter. Looks are data (`data/rig.json`). `tools/rigtest.html` shows every pose.
- **Life.** Cars (`traffic.js`) and people (`people.js`) spawn at the map edges on a timer, fewer at night, and fade in and out at the edges. People walk to spots, sit on benches, cross at the crosswalks, and step around the player. Boxes, parcels and new furniture pop in with a small bounce and dust (`fx.js`).
- **Light.** A night tint and lamp glow follow the clock (dark before 6:00, light by 6:30, dusk from 17:00).
- **UI.** Tokens at the top of `css/ui2.css` (`--g-bg` light glass, `--d-bg` dark glass, `--ink`, `--line`, blur, shadow). Cards and site rows have hairline edges and soft shadows, not thick outlines. The PC windows have light glass title bars and a floating taskbar. The title is a blurred view of the live world.

## Moving to Unity

The prototype keeps data, rules and drawing apart so each part has a Unity home.

| Prototype | Unity |
|---|---|
| `data/*.json` | ScriptableObjects (or JSON in `StreamingAssets` read at start) |
| `S` state object, `save.js` | One serialisable GameState class, saved as JSON |
| Event bus (`on`, `emit`) | C# events or a ScriptableObject event channel |
| `js/sim/*` (pure rules) | Plain C# classes with no MonoBehaviour; port them first and test them in Edit Mode |
| Iso projection (`proj.js`), `room.json` view | Orthographic camera at the iso angle over a 3D or Tilemap scene; tile units stay the same |
| Walk grid and `findPath` | NavMesh (NavMeshSurface, NavMeshAgent, NavMeshObstacle for furniture) |
| `rig.js` box characters, `rig.json` looks | One low-poly prefab with an Animator (walk, sit, carry, wave, blink); looks as material colours |
| `traffic.js`, `people.js` spawners | Spawner MonoBehaviours with object pools; spot lists as empty GameObjects |
| `fx.js` pop-in and dust | DOTween or Animator scale tween plus a small ParticleSystem |
| Night tint and lamp glow | Global light colour and intensity curves, lamp point lights |
| Stations, `hitStation` | Prefabs with colliders and an Interactable component; outline shader on hover |
| HUD, phone, PC, cards (`css/ui2.css` tokens) | UI Toolkit (UXML plus USS); the CSS tokens become USS variables; icons from `icons.js` as SVG or one sprite atlas |
