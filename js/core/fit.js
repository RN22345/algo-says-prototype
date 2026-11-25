/* Scale the 1920x1080 frame to fit the window (landscape phones too). getScale() returns the current scale for drag maths. */
export const W = 1920, H = 1080;
let k = 1;
export const getScale = () => k;
export function fit() {
  const stage = document.getElementById("stage"), frame = document.getElementById("frame"); if (!stage || !frame) return;
  const sw = stage.clientWidth, sh = stage.clientHeight; if (!sw || !sh) return;
  k = Math.max(0.05, Math.min(sw / W, sh / H));
  const ox = Math.floor((sw - W * k) / 2), oy = Math.floor((sh - H * k) / 2);
  frame.style.transform = `translate(${ox}px,${oy}px) scale(${k})`;
  document.documentElement.classList.toggle("portrait", window.innerHeight > window.innerWidth);
  document.documentElement.classList.toggle("small", k < 0.5);
}
export function initFit() {
  fit();
  new ResizeObserver(fit).observe(document.getElementById("stage"));
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 150));
  document.addEventListener("fullscreenchange", fit);
}
export function toggleFull() {
  const r = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen(); else if (r.requestFullscreen) r.requestFullscreen().catch(() => {});
}
