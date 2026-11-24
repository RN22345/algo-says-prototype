# Algo Says: web prototype

A playable corner-isometric draft of the game: post short and long videos, go live, pack orders, hand parcels to riders or the courier, buy stock at the mall or the warehouse, shelve it, answer buyers. Plain ES modules. No build tool, no npm. It runs as static files (for example on GitHub Pages).

## Run locally

ES modules and `fetch` need http, so do not open `index.html` from disk.

```
python -m http.server 8765
```

Then open http://localhost:8765/

## Controls

W A S D walk, E use, Q phone, Esc close, Z and X (or the mouse wheel) zoom close and wide. F1 opens the developer panel. The top-right menu has New game and Dev. The game saves to the browser (localStorage) every 10 seconds and when the page is hidden.

## Folder map

| Path | Content |
|---|---|
| `index.html`, `css/style.css` | Page, HUD and window markup, styles |
| `data/tuning.json` | Every gameplay number (post length, reach, conversion, rider patience and speed, pack time, van times, prices, chat timeout, milestone targets, start cash and stock) |
| `data/products.json`, `data/clips.json` | Products and clip library |
| `data/map.json` | Map size, tile rules, walls, furniture and zones, rider slots, yard drop spots, street positions |
| `js/main.js` | Boot, fixed-timestep loop, `window.__game` |
| `js/state.js` | Shared state, loaded data, event bus |
| `js/camera.js`, `js/npcs.js`, `js/interact.js` | Camera (follow, clamp, zoom, pointer helpers), neighbour NPCs, E-key context that adds map spots (sari-sari store) |
| `js/sprites.js`, `data/sprites.json`, `img/sprites/` | Blender-rendered furniture sprites, placed by footprint centre. The old drawn shapes are the fallback |
| `js/iso.js`, `js/world.js`, `js/render.js`, `js/entities.js` | Projection and draw helpers, map and collision, rendering, player, riders, van, jeepney |
| `js/sim/post.js`, `js/sim/shop.js`, `js/sim/gear.js` | Post model (several posts at once, TikTik and YouView curves, YouView search trickle); shelves, storage, orders, packing, riders, deliveries, chats, stock warnings, missed-sales log; equipment that opens features |
| `js/mini/edit.js`, `js/mini/live.js` | Editing minigame (cut on the beat) and FaceBazaar live minigame (confirm "Mine" claims) |
| `js/ui/places.js` | Plaza Mall, Bodega Supply warehouse, courier drop-off |
| `data/gear.json` | Equipment, prices, and what each opens |
| `js/ui/*.js` | HUD, window dispatcher, inbox, Mr. Algo |
| `js/pc/desktop.js`, `js/pc/apps/*.js` | The PC desktop (E at the computer): draggable windows, taskbar, in-game clock, and one module per app (TikTik Studio, Stats, Supplier, Shop Books, Notes, Feeds, Paint, Parcel Catch, Music, Settings, locked apps) |
| `js/pc/audio.js`, `js/pc/prefs.js` | WebAudio loops and sound effects (start only after a click); PC settings kept in their own storage key |
| `js/sim/ledger.js` | Money ledger: every cash in and out is recorded in `S.ledger` |
| `data/pc.json` | Desktop data: clock speed, app lock ranks, fake feed text, Parcel Catch numbers |
| `js/input.js`, `js/save.js`, `js/dev.js` | Input, save and load, developer panel |
| `img/` | Placeholder art |

## Testing helpers

`window.__game` exposes `state`, `step(seconds)` (advance game time without the render loop), `render()`, `save()`, `newGame()` and `pc` (`open(appId)`, `openApp`, `closeApp`, `wins`, `byId`; `byId.catch.api` has the Parcel Catch state and `update(dt)`).

## Notes

The numbers are teaching-model values for testing the feel. Art is placeholder. Fonts load from Google Fonts when online and fall back to system fonts.

## PC desktop (stage 4)

Press E at the desk to open the desktop. The game keeps running underneath. Click an icon to open an app. Drag a window by its title bar. Esc closes the top window, then the desktop. "Shut down" closes everything. Saved in the save file: ledger, notes, stickers, in-game clock. Saved in `algosays.prefs`: text size, reduce motion, volume, Parcel Catch best score. Pressing E at the empty shelves opens the Supplier.

## Shop loop (2026-11-24)

Stock only sells from the shelves. Each of the 4 shelves holds one product (6 items); an empty shelf takes any product. Stand in front of a shelf with a box and press E to stock it; extra items go into the stockroom crates (storage), where E also takes a box back out. Buy stock from the Supplier site (the van brings a box to the gate), the warehouse (cheaper, carry it), or the mall (retail price, carry it). Posting or going live with no stock shows a warning and never blocks. The HUD shows missed sales, and the last two minutes by product.

## Trends, shelves, display (2026-11-24, second pass)

- **Controls:** W A S D walk, E use, Q phone, M mute, Z and X zoom, Esc close, Space (editing) and 1 to 4 (live) in minigames. Touch: joystick, E, phone and zoom buttons (shown on touch screens, or with `?touch=1`). Full screen button in the header and the frame.
- **Trends** (`js/sim/trends.js`): each product has a hidden lifecycle; about 40% of new trends fizzle. Signals: the feeds, other sellers' posts, buyers asking in the inbox, the supplier's "in demand" tag and price, and the Seller Hub site (trending items, top sellers, other sellers' posts). Six virtual rivals post by fixed habits.
- **Shelves:** 6 slots per shelf, any mix of products. Open a shelf with E. Orders reserve stock; pick each order's item from a shelf, then pack it at the table.
- **Mr. Algo** explains a finished post: what helped, what held it back, and one thing to try.
- **Display:** the 1920x1080 frame scales as one picture (`js/fit.js`). Sound effects and optional world music (`js/sound.js`).
- After an update, hard-reload (Ctrl+F5) if the game looks half-updated: browsers cache the modules.

