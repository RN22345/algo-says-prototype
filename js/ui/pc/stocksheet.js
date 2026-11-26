/* STOCK SHEET (D-107). A spreadsheet-looking window: one row per product with units on shelves, in boxes on the floor, at the door, on the way, unit cost and price.
   Reads S only. Refreshes on stock, cash and gear events. Clicking a cell selects it (shown in the formula bar). */
import { D } from "../../core/data.js";
import { S, fmtMoney } from "../../core/state.js";
import { fmtDay } from "../../core/clock.js";
import { on } from "../../core/bus.js";
import { h, art, clear } from "../ui.js";

const EVS = ["stock:changed", "cash:changed", "gear:changed", "order:new", "order:packed", "post:created"];
const COLS = [["Product", "name"], ["On shelves", "shelf"], ["In boxes", "box"], ["At the door", "door"], ["On the way", "way"], ["Cost each", "cost"], ["Price", "price"]];
const LET = "ABCDEFG";

function rows() {
  return D.products.map(p => {
    const shelf = S.shelves.reduce((a, sh) => a + sh.filter(x => x === p.id).length, 0), box = S.boxes[p.id] || 0;
    const door = S.doorBoxes.reduce((a, b) => a + (b.items[p.id] || 0), 0) + S.doorSamples.filter(x => x === p.id).length;
    const ds = S.deliveries.filter(d => d.items[p.id]), way = ds.reduce((a, d) => a + d.items[p.id], 0);
    return { p, shelf, box, door, way, eta: ds.length ? Math.min(...ds.map(d => d.at)) : null, cost: Math.round(p.cost * (S.market.costMult[p.id] || 1)), price: p.price };
  });
}

export function buildStock(body) {
  let selCell = "A1", selText = "Product";
  const fx = h("div", { class: "fx" }, h("span", { class: "nm" }, "A1"), h("span", { class: "f" }, "fx"), h("span", { class: "v" }, "Product"));
  const grid = h("div", { class: "sheet-grid" });
  body.append(h("div", { class: "sheet" }, h("div", { class: "sheet-menu" }, ...["File", "Edit", "View", "Insert", "Format"].map(m => h("span", {}, m)), h("span", { class: "grow" }), h("span", { class: "ttl" }, "stock_sheet.tab")), fx, h("div", { class: "sheet-wrap" }, grid)));
  const cell = (r, c, text, cls = "") => {
    const id = LET[c] + r;
    return h("div", { class: "c " + cls + (id === selCell ? " sel" : ""), onClick: () => { selCell = id; selText = text; fx.querySelector(".nm").textContent = id; fx.querySelector(".v").textContent = text; draw(); } }, text);
  };
  function draw() {
    clear(grid); const data = rows();
    grid.append(h("div", { class: "c corner" }), ...LET.split("").map(l => h("div", { class: "c colh" }, l)));
    grid.append(h("div", { class: "c rowh" }, "1"), ...COLS.map(([t], i) => cell(1, i, t, "hd")));
    data.forEach((r, i) => {
      const n = i + 2;
      grid.append(h("div", { class: "c rowh" }, String(n)),
        h("div", { class: "c pn" + (LET[0] + n === selCell ? " sel" : ""), onClick: () => { selCell = "A" + n; selText = r.p.name; fx.querySelector(".nm").textContent = "A" + n; fx.querySelector(".v").textContent = r.p.name; draw(); } }, art(r.p.icon), r.p.name),
        cell(n, 1, String(r.shelf), "num" + (r.shelf ? "" : " zero")), cell(n, 2, String(r.box), "num" + (r.box ? "" : " zero")), cell(n, 3, String(r.door), "num" + (r.door ? "" : " zero")),
        cell(n, 4, r.way ? `${r.way} (${fmtDay(r.eta)})` : "0", "num" + (r.way ? "" : " zero")), cell(n, 5, fmtMoney(r.cost), "num"), cell(n, 6, fmtMoney(r.price), "num"));
    });
    const n = data.length + 2, sum = k => data.reduce((a, r) => a + r[k], 0), val = data.reduce((a, r) => a + (r.shelf + r.box + r.door) * r.cost, 0);
    grid.append(h("div", { class: "c rowh" }, String(n)), h("div", { class: "c tot" }, "Total units"), cell(n, 1, String(sum("shelf")), "num tot"), cell(n, 2, String(sum("box")), "num tot"), cell(n, 3, String(sum("door")), "num tot"), cell(n, 4, String(sum("way")), "num tot"),
      h("div", { class: "c tot num span2", style: { gridColumn: "span 2" } }, "Stock at cost: " + fmtMoney(val)));
  }
  draw();
  const offs = EVS.map(ev => on(ev, draw));
  return { refresh: draw, destroy: () => offs.forEach(f => f()) };
}
