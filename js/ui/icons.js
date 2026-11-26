/* ICONS. One small line-icon set (24 by 24, round strokes) for the HUD, phone, PC and bag, so every screen speaks the same visual
   language. ic(name, cls) returns an inline SVG element that takes its colour from CSS (currentColor).
   Unity: export each path as an SVG or a sprite in one icon atlas; UI Toolkit can use SVG vector images directly. */
const PATHS = {
  cash: "M3 7h18v10H3z M7 7v10 M17 7v10 M12 10.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6",
  users: "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5 M16 4.3a3.3 3.3 0 0 1 0 6.4 M18 14.8c2 .7 3.2 2.5 3.5 5.2",
  shield: "M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5c-4.3-1.5-7.5-5-7.5-9.5V6z M8.8 12l2.3 2.3l4.3-4.6",
  bolt: "M13 2.5L5 13.5h6l-1 8l8-11h-6z",
  sun: "M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z M12 2v2.2 M12 19.8V22 M4.9 4.9l1.6 1.6 M17.5 17.5l1.6 1.6 M2 12h2.2 M19.8 12H22 M4.9 19.1l1.6-1.6 M17.5 6.5l1.6-1.6",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20.5a2.2 2.2 0 0 0 4 0",
  gear: "M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z M19.4 13.5l1.6 1.2l-2 3.4l-1.9-.7a7 7 0 0 1-1.9 1.1L15 20.5h-4l-.3-2a7 7 0 0 1-1.9-1.1l-1.9.7l-2-3.4l1.6-1.2a7 7 0 0 1 0-2.2L4.9 10.1l2-3.4l1.9.7a7 7 0 0 1 1.9-1.1L11 4.3h4l.3 2a7 7 0 0 1 1.9 1.1l1.9-.7l2 3.4l-1.6 1.2a7 7 0 0 1 0 2.2z",
  bag: "M5 8h14l-1 12.5H6z M9 8V6.5a3 3 0 0 1 6 0V8",
  phone: "M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z M10.5 18.5h3",
  move: "M12 3v18 M3 12h18 M12 3l-2.5 2.5 M12 3l2.5 2.5 M12 21l-2.5-2.5 M12 21l2.5-2.5 M3 12l2.5-2.5 M3 12l2.5 2.5 M21 12l-2.5-2.5 M21 12l-2.5 2.5",
  flag: "M5 21V4 M5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0",
  chat: "M4 5h16v11H9l-5 4z M8 9.5h8 M8 12.5h5",
  box: "M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z M3.5 7.5L12 12l8.5-4.5 M12 12v9",
  bank: "M3 9.5L12 4l9 5.5 M5 10v7 M9.7 10v7 M14.3 10v7 M19 10v7 M3 20h18",
  calendar: "M4 6h16v14H4z M4 10h16 M8.5 3.5v4 M15.5 3.5v4 M8 14h2 M14 14h2",
  book: "M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4z M20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z",
  play: "M8 5.5v13l10.5-6.5z",
  video: "M3.5 6h12v12h-12z M15.5 10l5-3v10l-5-3z",
  globe: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9s1.1-6.4 3.6-9z",
  chart: "M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-7",
  truck: "M2.5 6h11v10h-11z M13.5 9.5h4l3 3.5v3h-7z M6.5 18.5a1.6 1.6 0 1 0 0-3.2a1.6 1.6 0 0 0 0 3.2z M17 18.5a1.6 1.6 0 1 0 0-3.2a1.6 1.6 0 0 0 0 3.2z",
  tool: "M14.5 5.5a4 4 0 0 0-5 5L3.5 16.5l4 4l6-6a4 4 0 0 0 5-5l-2.5 2.5l-2.5-.5l-.5-2.5z",
  home: "M3.5 11L12 4l8.5 7 M6 9.5V20h12V9.5 M10 20v-5h4v5",
  sheet: "M5 3.5h14v17H5z M5 8.5h14 M5 13.5h14 M10.5 3.5v17",
  handshake: "M2.5 11l4-4l4 2l3-2l4 4 M21.5 11l-4 4 M2.5 11l6.5 6.5c.8.8 2 .8 2.8 0l5.7-5.7 M9 13.5l2 2 M11.5 11.5l2 2",
  close: "M6 6l12 12 M18 6L6 18",
  back: "M15 5l-7 7l7 7",
  plus: "M12 5v14 M5 12h14",
  min: "M6 12h12",
  max: "M6 6h12v12H6z",
  eye: "M2.5 12s3.5-6.5 9.5-6.5s9.5 6.5 9.5 6.5s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z M12 9.3a2.7 2.7 0 1 0 0 5.4a2.7 2.7 0 0 0 0-5.4z",
  sound: "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11",
  music: "M9 18V5.5l11-2V16 M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z M20 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z",
  expand: "M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5",
  restart: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4 4v4.5h4.5",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4.5a1.5 1.5 0 0 1 3 0V11 M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6 7c-2.5 0-4-1.2-5.5-3.5L3.8 14a1.5 1.5 0 0 1 2.5-1.7L8 14.5",
  parcel: "M4 7.5h16v12H4z M4 7.5l2-3.5h12l2 3.5 M12 4v6 M9.5 13h5",
  power: "M12 3v8 M7 6.5a7 7 0 1 0 10 0",
  wifi: "M4.5 10a10.5 10.5 0 0 1 15 0 M7.5 13a6.3 6.3 0 0 1 9 0 M10.5 16a2.2 2.2 0 0 1 3 0 M12 19h.01",
  coin: "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17z M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2c-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2s2.6.8 2.6 2s-1.1 2-2.6 2c-1 0-2-.4-2.6-1.2 M12 6.5V8 M12 16v1.5",
  target: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9z M12 11.2a.8.8 0 1 0 0 1.6a.8.8 0 0 0 0-1.6z"
};
const NS = "http://www.w3.org/2000/svg";
export function ic(name, cls = "") {
  const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "icn " + cls); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path"); p.setAttribute("d", PATHS[name] || PATHS.box);
  if (name === "play" || name === "bolt") p.setAttribute("class", "fill");
  s.append(p); return s;
}
export const hasIcon = n => n in PATHS;
