/* Loads every data/*.json into D. Everything tunable lives there.
   D.P is a product map, D.SITE the live site values, D.sitesBase the untouched values (platform updates are replayed from it after a load). */
export const D = {};
const FILES = ["config", "time", "products", "shots", "viewers", "sites", "lessons", "gear", "room", "market", "assets", "intro", "events"];

export async function loadData() {
  const res = await Promise.all(FILES.map(f => fetch(`data/${f}.json`, { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(`data/${f}.json ${r.status}`); return r.json(); })));
  FILES.forEach((f, i) => { D[f] = res[i]; });
  D.products = D.products.products; D.gear = D.gear.gear; D.lessons = D.lessons.lessons; D.assets = D.assets.assets;
  D.P = Object.fromEntries(D.products.map(p => [p.id, p]));
  D.G = Object.fromEntries(D.gear.map(g => [g.id, g]));
  D.sitesBase = JSON.parse(JSON.stringify(D.sites.sites));
  D.SITE = D.sites.sites;
  return D;
}

/* Add delta to a D.SITE value by key path, for example "tiktik.patience" or "youview.search.base". */
export function bumpSite(path, delta) {
  const k = path.split("."); let o = D.SITE;
  for (let i = 0; i < k.length - 1; i++) o = o[k[i]];
  o[k[k.length - 1]] = +(o[k[k.length - 1]] + delta).toFixed(4);
}
export function resetSites() { D.SITE = JSON.parse(JSON.stringify(D.sitesBase)); D.sites.sites = D.SITE; }
