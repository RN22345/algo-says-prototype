/* PROJECTION. The iso grid from data/room.json view. P(x, y, z) turns tile coordinates (and height in tiles) into world pixels,
   toTile does the reverse for the floor. World pixels are not screen pixels: camera.js maps world to the 1920x1080 stage. */
import { D } from "../core/data.js";

export const P = (x, y, z = 0) => { const v = D.room.view; return [v.ox + (x - y) * v.tw, v.oy + (x + y) * v.th - z * v.zUnit]; };
export const toTile = (sx, sy) => { const v = D.room.view, X = (sx - v.ox) / v.tw, Y = (sy - v.oy) / v.th; return [(X + Y) / 2, (Y - X) / 2]; };
