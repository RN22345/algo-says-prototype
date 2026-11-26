# Handoff: round 3 (D-105 to D-109), written 2026-11-26

The work may be unfinished. Check before trusting anything below.

## What the user asked

Finish the prototype as a whole game. Specifically:

- The camera follows the player.
- The player can explore outside.
- The player can buy more property (a studio room, a stockroom).
- An inventory for items and stock.
- The phone looks like a phone.
- The desk PC looks like a real desktop (wallpaper, icons, taskbar, windows).
- The art is redone in the artist's style, including Mr. Algo and the HUD.
- Fix any art that sits off the isometric axes.

## Done and committed (lead model)

- **Decisions:** D-105 to D-109 in `DECISIONS.md`.
- **Build brief:** `07_PROTOTYPE/PLAN_R3.md`, with the shared rules, the art contract, and briefs A and B.
- **Artist art:**
  - The artist's PDF is in `05_ART/artist_pdf/`.
  - `cut_artist_assets.py` cuts it into `07_PROTOTYPE/img/v/` and `data/sprites.json`.
  - It also shears off-axis sprites onto the ±30° axes (`fix=True`).
- **Blender art:** `05_ART/blender/voxel_kit.py` renders the furniture, stations, houses, sign and fences. Pass it an absolute output path.
- **Sources:** `05_ART/SOURCES.md` is updated.
- **Projection:** the artist uses true isometric. Set `view.th` to 46.19 and `view.zUnit` to 92 in `data/room.json`. Builder A was told to do this.

## Update: both builders finished and the work is committed. Builder A: camera, street, property, furniture tray, joystick, save v3. Lead smoke test: a reseller new game renders the new world with no errors after a hard reload. Open items are in PROGRESS.md (mirrored neighbour houses face away from the road; the shelf unit cannot go back in the tray; touch not tested on a real phone; the shell canvas is about 38 MB, so check it on a low-end phone).

## Original state (two Sonnet builders) (two Sonnet builders, not committed)

- **Builder A, the world:**
  - Owns `js/ui/room.js`, `outside.js`, `layout.js`, new `js/ui/world*.js`, `js/sim/property.js`, `data/room.json`, new `data/world.json`, and `css/world.css`.
  - Work: camera follow and zoom, the street block (artist tiles, the road blocked except at the crosswalk), property purchase, furniture from the inventory, sprite hookup, the touch joystick, and save version 3.
- **Builder B, the screens:**
  - Owns `js/ui/phone*`, `js/ui/browser.js`, new `js/ui/pc/*`, `js/ui/hud.js`, new `js/ui/inventory.js`, `js/ui/sites/*`, `showTitle` in `js/main.js`, and `css/ui2.css`.
  - Work: a phone with a frame and home-screen apps, a desktop OS look with draggable windows and a browser with fake addresses, a Stock Sheet, Property and furniture shopping, the inventory bar and bag panel (key I), the HUD restyle with the artist's icons, and the title screen.
- **Update: Builder B finished.** Phone, desktop PC, inventory, HUD and title are all built and tested in both start modes, and its report is in `PROGRESS.md`.
  - B's open items: rent is computed as base plus `rentAdd` in `js/ui/pc/helpers.js` `weeklyRent` (check it matches `money.js`); `ic_energy`, `ic_followers` and `ic_rank` icons do not exist yet (emoji used); the "In hand" slot reads orders with status `picked`.
  - Not run end to end: the studio and results screens.
- Both were told to write what they finished and what they did not into `PROGRESS.md` and `README.md`. If the account ran out mid-task, they stopped wherever they were. Their files may be half-edited.

## Next session: steps

1. Run `git status` and `git diff --stat` to see what the builders changed. Read the newest part of `PROGRESS.md`.
2. Run `node --check` on every changed JS file. Load every JSON file in `data/` with a parser.
3. Run the game with `python 07_PROTOTYPE/tools/serve.py 8771` (launch config "proto2") at http://localhost:8771. Then:
   - Start a new game in both modes (Affiliate and Reseller). The console must show no errors.
   - Walk with WASD and with clicks. Use stations. Run the intro steps.
   - Check Move furniture, the camera, and walking outside.
   - Check that the phone apps and PC windows open.
   - Buy a property and a piece of furniture, then place it.
   - Check the inventory: the bar and the I key.
4. Finish whatever `PROGRESS.md` lists as not done, against `PLAN_R3.md`. Per D-90, Sonnet subagents write the code (at most 2 at a time); the lead reviews and tests.
5. Check the art in the game. Sprites draw at P(footprint centre) minus (ax, ay)/2. If one sits wrong, fix its anchor or footprint in the cut script or the voxel kit and re-run the script. Do not hand-edit `sprites.json`.
6. Add a `LOG.md` entry. Commit. Do not push without the user's OK.

## Known gaps and notes

- **Player art:** the artist's player has one pose, front only. The game mirrors it and bobs it while walking. A back view and walk frames are on the artist's list.
- **Courier:** the courier is the artist's delivery person, who walks to the door. There is no scooter.
- **Supplier van:** the artist's truck only faces +y.
- **Missions:** the mockup shows "Daily Missions". Missions are fine, but not as login rewards (the not-doing list). Missions and Seller Rank are not built. The rank badges are cut but unused.
- **Usage:** weekly usage on the first account was at 90% or more. The user is switching accounts.
