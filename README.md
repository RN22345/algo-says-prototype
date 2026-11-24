# Algo Says: web prototype

Stage 0. A playable corner-isometric draft of the game: post a video, pack orders, hand parcels to riders, restock, answer buyers. Plain ES modules. No build tool, no npm. It runs as static files (for example on GitHub Pages).

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
| `js/iso.js`, `js/world.js`, `js/render.js`, `js/entities.js` | Projection and draw helpers, map and collision, rendering, player, riders, van, jeepney |
| `js/sim/post.js`, `js/sim/shop.js` | Post model; orders, packing, riders, deliveries, chats, interaction |
| `js/ui/*.js` | HUD, windows, studio, running post, restock, inbox, Mr. Algo |
| `js/input.js`, `js/save.js`, `js/dev.js` | Input, save and load, developer panel |
| `img/` | Placeholder art |

## Testing helpers

`window.__game` exposes `state`, `step(seconds)` (advance game time without the render loop), `render()`, `save()` and `newGame()`.

## Notes

The numbers are teaching-model values for testing the feel. Art is placeholder. Fonts load from Google Fonts when online and fall back to system fonts.
