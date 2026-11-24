// Avanza el slider de logos un logo por segundo, como el slick de la web antigua (autoplaySpeed 1000).
// Se detiene fuera de pantalla, con la pestaña oculta, con el cursor encima y si el sistema pide reducir movimiento.
const STEP_MS = 1000;
const SPEED_MS = 400;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll<HTMLElement>('[data-logo-slider]').forEach(slider => {
  const track = slider.querySelector<HTMLElement>('.logo-track');
  const first = track?.querySelector<HTMLElement>('.logo-slide');
  if (!track || !first) return;
  const total = track.querySelectorAll('.logo-slide:not(.is-copy)').length;
  let index = 0;
  let timer = 0;
  let visible = false;
  let hovered = false;

  const place = (animate: boolean) => {
    track.style.transition = animate ? `transform ${SPEED_MS}ms ease` : 'none';
    track.style.transform = index ? `translateX(${-index * first.getBoundingClientRect().width}px)` : '';
  };
  const step = () => {
    index += 1;
    place(true);
  };
  // Al llegar a la copia, vuelve sin animación al inicio: el salto no se nota porque las dos tiras son iguales.
  track.addEventListener('transitionend', () => {
    if (index >= total) {
      index = 0;
      place(false);
    }
  });
  const sync = () => {
    const run = visible && !hovered && !document.hidden && !reduceMotion.matches;
    if (run && !timer) timer = window.setInterval(step, STEP_MS);
    if (!run && timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(slider);
  slider.addEventListener('mouseenter', () => { hovered = true; sync(); });
  slider.addEventListener('mouseleave', () => { hovered = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  const mode = () => slider.classList.toggle('is-sliding', !reduceMotion.matches);
  reduceMotion.addEventListener('change', () => {
    index = 0;
    place(false);
    mode();
    sync();
  });
  window.addEventListener('resize', () => place(false));
  mode();
});
