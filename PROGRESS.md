# Progress

- Step 1 done: core (bus, data, state, clock, save, assets, fit, sound), iso room from data/room.json, HUD, clock and energy, bed (nap and sleep), door, Mr. Algo and guided start. Tested: boots, room draws, stations clickable.
- Step 2 done: affiliate catalogue, sample request and delivery to the door, Tool Shop, supplier, Seller Hub, phone (inbox, feeds, orders, wallet, playbook), dev panel.
- Sims written: viewer model (calibrated in Node), market, rivals, events (calendar and random), posts, orders, stock, money, energy, lessons, algo3, updates.
- Next: studio (shot board, shoot, editor, post), results page.
- Step 3 done: studio (shot board with drag and tap, shoot with live preview and camera notes, block editor behind editVideo, post form). Tested by script and by a real drag.
- Step 4 done: viewer model, results page (retention over blocks, pinned comments, where people left), Mr. Algo's 3 Things, ALGO SAYS cards, Playbook with evidence and "may be outdated".
- Step 5 done: market signals (feeds, rivals, Seller Hub trending and leaderboard), calendar and random events with signals first, dev panel lists and triggers events.
- Step 6 done: tier 2 (Tool Shop gate, supplier, door, shelves, packing, courier, cash on delivery, returns). Tested end to end.
- Step 7 done: platform updates (rumour, then rule change, Playbook flags).
- Step 8 done: dev panel, README.
- Tested with all feature flags off and editorMode auto: no console errors.
- Left: real touch test on a phone, audio check by ear, more art swaps when the artist delivers, longer balance playtest.
- Round 2 fixes: Algo bubble never blocks clicks and auto-hides; spotlight follows the open PC to the Request sample button; PC opens on Affiliate at the start; phone closes when a window opens; fixed-height shot slots; clear price card; editor Play with playhead, overlays and full-width timeline; advice names locked gear; img/_have.json removes 404 noise.

## Round 3, Builder B (screens)

Done:
- Phone rebuilt as a real phone: body, bezel, notch, status bar, home screen with 7 app icons and unread badges, home bar, slide-up from the bottom right. Apps: Messages (list and detail), TikTik and YouView (own colours, Feed and My posts), Orders (Orders and My posts), Bank (cash, rent, ledger), Calendar (courier, supplier, deliveries, samples, rent, announced market events), Playbook.
- Desk PC rebuilt: monitor with wallpaper, 7 desktop icons, taskbar with start menu, window buttons and clock; windows drag, resize, minimise, maximise, close; several browser windows with tabs, back and forward, address bar and bookmark bar; Stock Sheet spreadsheet window; Property site; Tool Shop furniture section.
- Inventory bar and bag (key I): Orders, Stock, Furniture (Place), Gear.
- HUD restyled to the artist kit; settings menu; goal on the clipboard board.
- Title screen with sky, clouds, hills and the gold ALGO SAYS logo text.
- `tools/make_have.py` now also lists `img/v` (key `v`).

New events: `bag:toggle`, `bag:open {tab}`, `pc:opened`, `pc:closed`; `phone:open` takes `{app}` as well as `{tab}`. Emitted for Builder A: `property:buy {id, ok}`, `furniture:buy {id, ok}`, `layout:place {id}`. `modal()` takes `keepPhone` and its `modal:open` event now carries `(key, {keepPhone})`.
New state: `S.ui = { pbSeen: {} }` (Playbook badge). Property and furniture state from Builder A are only read.

Not done or uncertain:
- Rent shown on the Bank and Property pages is computed as base rent plus `rentAdd` of owned rooms (`weeklyRent` in `js/ui/pc/helpers.js`). If `js/sim/money.js` charges differently, change that one function.
- `ic_energy`, `ic_followers` and `ic_rank` do not exist in `img/v/`: the energy and followers pills use emoji. Seller Rank is not shown.
- The inventory "In hand" slot lists orders with status `picked` (used by room.js for the carried box). No other carried-item state exists yet.
- Not tested on a real touch device or at phone screen sizes. Window drag uses pointer events, so it should work on touch.
- Mr. Algo's speech bubble can sit over the PC taskbar start button while the intro is talking.

## Round 3, Builder A (world)

Done:
- Camera (follow with dead zone, clamp, wheel and pinch zoom 0.7 to 1.3) over the canvas, hit layer and name tags. Floor clicks, `pointerTile` and `stationRect` are correct under the camera; the intro spotlight follows it (`camera:moved`).
- Street block (`data/world.json`): ground tiles (grass, sidewalk, road, crosswalk, floors) drawn once to an offscreen shell, lane marks, both sidewalks, a crosswalk, props (trees, lamps, benches, bins, bushes, mailbox, neighbour houses mirrored across the road), clouds drifting at the edges. The road is blocked except the crosswalk; two lanes of cars (hue-tinted green car sprites) stop for the player on the crosswalk.
- Outside: the courier and the sample rider walk from the curb to the door (`ch_courier_0`, sample rider tinted), the supplier van parks in the curb strip, doorstep boxes and parcels use `it_box` and `it_parcel`. Old scooter and prism drawings stay as fallbacks.
- Property (studio room, stockroom): fenced lots with for-sale signs, buy card, walls and floor appear, doorway gap in the shared low wall, rent rises (`rentAdd` in money.js), studio set with `shootMult 0.75`, two shelf units (4 new shelves), crates. `property:buy {id, ok}`, `S.property`.
- Furniture: `furniture:buy`, `S.furniture` (unplaced), tray in Move furniture, `layout:place {id}`, placed pieces in `S.placed`, put back in tray, doorway keep-clear, pieces stay inside rooms. Shelf units placed from the tray add 2 shelves each; the shelves screen shows only the clicked unit's shelves.
- Art hookup by the contract for stations, furniture, props, vehicles, items, player (facing by mirror, bob while walking, `ch_player_<front|back>_<n>` frames used if they ever exist; carried order shows `it_box` above the head). Tall items in front of the player are drawn faded.
- Touch joystick (`pointer: coarse` or `?joy=1`). Save version 3 (old saves reset).

Tested: `node --check` on every JS file, all JSON parsed, browser runs of both start modes (no console errors), walking through the doorways by BFS and by joystick events, clicks under the camera, buying both rooms, furniture buy, place, put back, shelf unit shelves screen, rent after buying, sign card, cars stopping for the crosswalk (stepped in script), courier and van visuals, old v2 save reset.

Not done or uncertain:
- Not checked on a real touch device (pinch and joystick were tested with synthetic events only). The browser pane was hidden while testing, so frame rate was not measured; one frame costs about 0.4 ms of CPU.
- The shell canvas is about 3600 x 2700 px (about 38 MB). Fine on desktop; check on low-end phones.
- `ch_player_front_0` is the only player frame: walking is a bob, not a cycle, and there is no back view.
- Mirrored neighbour houses show the door on the far side; the lead should check how it looks.
- The shelf-unit furniture cannot go back in the tray (its shelves stay in `S.shelves`).
- Builder B's Property page should use `D.world.properties`, `S.property` and `property:buy`; `property:bought` and `furniture:bought` are emitted after a buy.

## Round 4 (lead model, no subagents, on Rnwn's request)

Done:
- Bigger map (40 by 48 tiles): houses on both sides of the road, a park, a garden, two crosswalks, edge woods. Bench, bin and lamp sprites scaled to match.
- Walking: one walk grid with player and NPC layers, BFS plus string-pulling, wall sliding, smaller body. Pixel-perfect station hits with a hover and in-reach outline. Tags only when useful.
- Box-rig characters for the player, courier, rider and passers-by: walk cycle, eyes and blink, breathing, carry, sit, wave, scooter.
- Traffic: fewer cars, longer gaps, night headlights, fade at the map edges. People: spawn at the edges, walk, sit on benches, use crosswalks, avoid the player.
- Pop-in with dust for boxes, parcels and new stations. Night tint and lamp glow drawn on the canvas.
- UI redesign: artist HUD PNGs removed; glass stat strip, goal line, clock, dock; calm and hidden modes; line icons; soft cards, buttons, toasts and modals; PC with light glass windows and a floating taskbar; blurred live title.
- Time runs 2x (`minPerRealSec` 3).
- Fixes found while testing: Move furniture dropped the piece on the same click (now fixed); the game frame could scroll and push the HUD off screen (now `overflow: clip`); feed cards had an inline navy border; the bag panel was fixed-height.

Tested in the browser pane: title, HUD, phone home, PC (TikTik, Supplier), bag, Move pick and drop, hover outline and tag, click to walk and open, supplier order to van to door to inventory bar, dawn light, phone landscape size. No console errors. Simulations stepped by script (2,400 steps in 74 ms; up to 9 people; sitting and crossing work).

Not done or uncertain:
- Not played on a real phone. The pane was hidden, so frame rate was not measured.
- Houses across the road face away from it.
- The studio, editor and results screens got the soft theme through shared classes only; they were not checked one by one.
