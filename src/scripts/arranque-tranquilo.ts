// Arranque tranquilo de las cabeceras animadas (26-11-2026). Preparar una animación pesada (WebGL del Show, lienzo de
// la escena viva de Cobertura y Catering) ocupa al navegador un momento; si coincide con el primer scroll del visitante,
// la página no responde. Esta función espera a que la página termine de cargar, a que el elemento esté a la vista y a
// que el visitante lleve un rato sin desplazarse, y recién entonces llama a `start`. Mientras tanto se ve la foto fija.
// Con «reducir movimiento» no llama a nada.
export function arranqueTranquilo(el: HTMLElement, start: () => void, calmaMs = 700) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let last = performance.now(), started = false, inView = true;
  const mark = () => { last = performance.now(); };
  const evs = ['wheel', 'touchstart', 'touchmove', 'scroll', 'keydown'] as const;
  evs.forEach(e => addEventListener(e, mark, { passive: true }));
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) setTimeout(attempt, 200); });
  io.observe(el);
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 60));
  function attempt() {
    if (started || !inView || document.readyState !== 'complete') return;
    if (performance.now() - last < calmaMs) { setTimeout(attempt, 350); return; }
    idle(() => {
      if (started || !inView || performance.now() - last < calmaMs) { setTimeout(attempt, 350); return; }
      started = true; io.disconnect(); evs.forEach(e => removeEventListener(e, mark));
      start();
    });
  }
  if (document.readyState === 'complete') setTimeout(attempt, 250);
  else addEventListener('load', () => setTimeout(attempt, 250), { once: true });
}
