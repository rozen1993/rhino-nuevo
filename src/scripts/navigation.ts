// Menú orbital (src/components/OrbitalMenu.astro): diálogo modal nativo que se abre como un iris desde el botón.
// Primer nivel en órbita alrededor del centro «R». «Servicios» y «Portafolio» abren un segundo nivel con la
// variante C del laboratorio de componentes («Giro de órbita», elegida el 23-11-2026): las opciones giran y se
// apagan, el centro se voltea y las páginas hijas entran girando hasta su sitio. En pantallas pequeñas el segundo
// nivel es una lista. Escape vuelve al primer nivel y, desde ahí, cierra. Con «reducir movimiento» no hay animación.
export const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
// El botón es fijo, pero la cabecera forma una capa aislada (isolation: isolate) y las secciones posteriores con
// posición propia lo tapaban al desplazarse (p. ej., los botones de reproducir de Proyectos en la home). Se saca de la
// cabecera al principio del <body>, tras «Saltar al contenido», para que quede siempre encima sin cambiar el orden de foco.
if (menuToggle && menuToggle.parentElement !== document.body) {
  const skip = document.querySelector('.skip-link');
  if (skip?.parentElement === document.body) skip.after(menuToggle); else document.body.prepend(menuToggle);
}
const menu = document.querySelector<HTMLDialogElement>('#site-menu');
// El menú vive al final del <body> (26-11-2026): cuando deja de ser modal durante el cierre, fuera de la cabecera
// (que tiene su propio apilado) puede quedar por encima del botón del menú y de la barra de redes.
if (menu && menu.parentElement !== document.body) document.body.append(menu);
const closeButton = menu?.querySelector<HTMLButtonElement>('[data-menu-close]');
const backButton = menu?.querySelector<HTMLButtonElement>('[data-om-back]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
type Level = 'main' | 'servicios' | 'portafolio';
// Temporada navideña: en noviembre y diciembre (hora de Lima), el Show navideño ocupa el lugar de Pantallas LED en el
// menú; el resto del año se queda Pantallas LED. Se decide en cada visita, así que no hace falta volver a publicar.
(() => {
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', month: 'numeric' }).format(new Date()));
  if (month !== 11 && month !== 12) return;
  const slot = document.querySelector('#site-menu [data-season-slot]');
  const tpl = document.querySelector<HTMLTemplateElement>('#site-menu template[data-season-item]');
  const item = tpl?.content.firstElementChild;
  if (slot && item) slot.replaceWith(item.cloneNode(true));
})();
type Placed = HTMLElement & { _a?: number; _rx?: number; _ry?: number };
const levels = {
  main: menu?.querySelector<HTMLElement>('[data-level="main"]'),
  servicios: menu?.querySelector<HTMLElement>('[data-level="servicios"]'),
  portafolio: menu?.querySelector<HTMLElement>('[data-level="portafolio"]'),
};
let level: Level | 'closed' = 'closed';
let anims: Animation[] = [];
let raf = 0, raf2 = 0, timer = 0;
let list = false;

const D = (ms: number) => (reducedMotion.matches ? 0 : ms);
const anim = (el: Element, kf: Keyframe[], o: { duration: number; delay?: number; easing?: string; fill?: FillMode }) => {
  const a = el.animate(kf, { duration: D(o.duration), delay: D(o.delay ?? 0), easing: o.easing ?? 'cubic-bezier(.16,1,.3,1)', fill: o.fill ?? 'both' });
  anims.push(a);
  return a;
};
const ease = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
function stop() {
  anims.forEach(a => a.cancel()); anims = [];
  cancelAnimationFrame(raf); cancelAnimationFrame(raf2); clearTimeout(timer);
}
const itemsOf = (el?: HTMLElement | null) => (el ? Array.from(el.querySelectorAll<Placed>('.om-li')) : []);

// Geometría en unidades de diseño (1100 × 720 en escritorio; 390 × 700 en pantallas pequeñas), escalada con --s.
function pos(li: Placed, a: number, rx: number, ry: number, k = 1) {
  const r = a * Math.PI / 180;
  li.style.left = `${(rx * k * Math.cos(r)).toFixed(1)}px`;
  li.style.top = `${(ry * k * Math.sin(r)).toFixed(1)}px`;
}
function place(li: Placed, a: number, rx: number, ry: number) { li._a = a; li._rx = rx; li._ry = ry; pos(li, a, rx, ry); }
function layout() {
  if (!menu) return;
  list = innerWidth < 900 || innerHeight < 620;
  menu.classList.toggle('list', list);
  // En móvil en horizontal la órbita no baja de 0,8 para que cada opción tenga al menos 44 px de toque.
  const s = list ? Math.max(.8, Math.min(innerWidth / 390, innerHeight / 700, 1.3)) : Math.min(innerWidth / 1100, (innerHeight - 40) / 720, 1.15);
  menu.style.setProperty('--s', s.toFixed(3));
  const R = list ? 132 : 250;
  levels.main?.style.setProperty('--R', `${R}px`);
  itemsOf(levels.main).forEach(li => place(li, Number(li.dataset.a), R, R));
  const sub = [...itemsOf(levels.servicios), ...itemsOf(levels.portafolio)];
  if (list) { sub.forEach(li => { li.style.left = ''; li.style.top = ''; }); return; }
  const inner = sub.filter(li => li.dataset.ring === 'inner'), outer = sub.filter(li => li.dataset.ring === 'outer'), port = sub.filter(li => li.dataset.ring === 'port');
  inner.forEach((li, i) => place(li, -90 + i * 360 / inner.length, 222, 168));
  outer.forEach((li, i) => place(li, -75 + i * 360 / outer.length, 440, 292));
  port.forEach((li, i) => place(li, -45 + i * 90, 256, 205));
}

function show(key: Level) {
  (Object.keys(levels) as Level[]).forEach(k => { const el = levels[k]; if (el) el.hidden = k !== key; });
  if (backButton) backButton.hidden = key === 'main';
  menu?.querySelectorAll<HTMLButtonElement>('[data-sub]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.sub === key)));
  if (menu) menu.scrollTop = 0;
  level = key;
}
// Las opciones salen del centro hasta su sitio (apertura y regreso al primer nivel).
function burst(el: HTMLElement, base = 0) {
  const hub = el.querySelector('.om-hub'), glow = el.querySelector('.om-glow');
  if (hub) anim(hub, [{ opacity: 0, scale: .55, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0)' }], { duration: 380, delay: base });
  if (glow) anim(glow, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: base + 80 });
  el.querySelectorAll('.om-ring, .om-dots, .om-lines').forEach(r => anim(r, [{ opacity: 0, scale: .9 }, { opacity: 1, scale: 1 }], { duration: 480, delay: base + 100 }));
  itemsOf(el).forEach((li, i) => {
    if (list && el !== levels.main) { anim(li, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { duration: 380, delay: base + 140 + i * 28 }); return; }
    const x = -parseFloat(li.style.left || '0'), y = -parseFloat(li.style.top || '0'), outer = li.dataset.ring === 'outer';
    anim(li, [{ translate: `${x}px ${y}px`, scale: .35, opacity: 0 }, { translate: '0 0', scale: 1, opacity: 1 }], { duration: 460, delay: base + 180 + (outer ? 260 + i * 28 : i * 55) });
  });
}
// Las opciones vuelven al centro y se apagan.
function collapse(el: HTMLElement) {
  itemsOf(el).forEach((li, i) => {
    if (list && el !== levels.main) { anim(li, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }); return; }
    const x = -parseFloat(li.style.left || '0'), y = -parseFloat(li.style.top || '0');
    anim(li, [{ translate: '0 0', scale: 1, opacity: 1 }, { translate: `${x}px ${y}px`, scale: .3, opacity: 0 }], { duration: 300, delay: i * 22, easing: 'cubic-bezier(.7,0,.84,0)' });
  });
  const hub = el.querySelector('.om-hub'), glow = el.querySelector('.om-glow');
  if (hub) anim(hub, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: .55 }], { duration: 260, delay: 60, easing: 'cubic-bezier(.7,0,.84,0)' });
  if (glow) anim(glow, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 });
  el.querySelectorAll('.om-ring, .om-dots, .om-lines').forEach(r => anim(r, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 }));
}
function focusFirst(el?: HTMLElement | null) { el?.querySelector<HTMLElement>('.om-hub-link, .om-item')?.focus({ preventScroll: true }); }

function enterSub(key: Level) {
  const main = levels.main, sub = levels[key];
  if (level !== 'main' || !main || !sub) return;
  stop();
  if (list || reducedMotion.matches) {
    collapse(main);
    timer = window.setTimeout(() => { stop(); show(key); burst(sub); focusFirst(sub); }, D(360));
    return;
  }
  // C · giro de órbita
  const hub = main.querySelector('.om-hub'), mi = itemsOf(main), si = itemsOf(sub);
  if (hub) anim(hub, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 300, delay: 200, easing: 'cubic-bezier(.7,0,.84,0)' });
  main.querySelectorAll('.om-ring, .om-dots, .om-lines, .om-glow').forEach(r => anim(r, [{ opacity: 1, rotate: '0deg' }, { opacity: 0, rotate: '60deg' }], { duration: 500, easing: 'ease-in' }));
  const t0 = performance.now(), T1 = 560;
  let started = false;
  const startSub = () => {
    started = true; sub.hidden = false;
    if (backButton) backButton.hidden = false;
    const shub = sub.querySelector('.om-hub');
    if (shub) anim(shub, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 320 });
    sub.querySelectorAll('.om-ring, .om-glow').forEach(r => anim(r, [{ opacity: 0, rotate: '-60deg' }, { opacity: 1, rotate: '0deg' }], { duration: 700 }));
    si.forEach(li => { li.style.opacity = '0'; });
    const t1 = performance.now(), T2 = 820;
    const inn = () => {
      const y = Math.min(1, (performance.now() - t1) / T2);
      si.forEach(li => {
        const yy = Math.max(0, Math.min(1, (y - (li.dataset.ring === 'outer' ? .18 : 0)) / .82)), e = easeOut(yy);
        pos(li, (li._a ?? 0) - 120 * (1 - e), li._rx ?? 0, li._ry ?? 0, .6 + .4 * e); li.style.opacity = String(e);
      });
      if (y < 1) raf2 = requestAnimationFrame(inn);
      else { si.forEach(li => { li.style.opacity = ''; }); focusFirst(sub); }
    };
    raf2 = requestAnimationFrame(inn);
  };
  const out = () => {
    const x = Math.min(1, (performance.now() - t0) / T1), e = ease(x);
    mi.forEach(li => { pos(li, (li._a ?? 0) + 110 * e, li._rx ?? 0, li._ry ?? 0, 1 - .35 * e); li.style.opacity = String(1 - e); });
    if (x >= .5 && !started) startSub();
    if (x < 1) raf = requestAnimationFrame(out);
    else {
      mi.forEach(li => { pos(li, li._a ?? 0, li._rx ?? 0, li._ry ?? 0); li.style.opacity = ''; });
      main.querySelectorAll('.om-ring, .om-dots, .om-lines, .om-glow, .om-hub').forEach(el => el.getAnimations().forEach(a => a.cancel()));
      show(key);
    }
  };
  raf = requestAnimationFrame(out);
}

function backMain() {
  if (level === 'main' || level === 'closed') return;
  const from = level, cur = levels[from];
  stop();
  if (cur) collapse(cur);
  timer = window.setTimeout(() => {
    stop(); show('main');
    if (levels.main) burst(levels.main);
    menu?.querySelector<HTMLElement>(`[data-sub="${from}"]`)?.focus({ preventScroll: true });
  }, D(380));
}

function origin() {
  const r = menuToggle?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 45, y: 45 };
}
function openMenu() {
  if (!menu || !menuToggle || menu.open) return;
  stop(); layout();
  menu.showModal();
  document.body.classList.add('menu-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  show('main');
  const { x, y } = origin(), R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
  anim(menu, [{ clipPath: `circle(25px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }], { duration: 770, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'none' });
  if (levels.main) burst(levels.main, 300);
  focusFirst(levels.main);
}
let closing = false;
function finishClose(returnFocus: boolean) {
  stop();
  closing = false;
  // Las opciones recuperan su sitio para la próxima apertura (el cierre las movió con estilos en línea).
  menu?.querySelectorAll<HTMLElement>('.om-li').forEach(li => { li.style.opacity = ''; li.style.scale = ''; });
  if (menu?.open) menu.close();
  if (menu) { menu.style.overscrollBehavior = ''; menu.style.zIndex = ''; }
  document.body.classList.remove('menu-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  level = 'closed';
  if (returnFocus) menuToggle?.focus({ preventScroll: true });
}
// Cierre «órbita que se recoge» (laboratorio de componentes, tanda 3, variante B; pedido del dueño el 24-11-2026:
// el cierre anterior era brusco). Es la apertura al revés: las opciones giran hacia atrás mientras vuelven al centro,
// una tras otra; los anillos se desvanecen girando; el centro se encoge y el círculo blanco se cierra despacio
// hacia el botón (1,1 s, curva suave al empezar y al terminar).
// Exportada: interactions.ts la usa para cerrar el menú al abrir otro diálogo desde él.
export function closeMenu(returnFocus = false, immediate = false) {
  if (!menu?.open || closing) return;
  if (immediate || reducedMotion.matches) { finishClose(returnFocus); return; }
  stop();
  closing = true;
  // El scroll se libera al empezar el cierre, no al terminar (26-11-2026): durante los 1,16 s de la animación el menú
  // seguía siendo modal y un gesto de touchpad iniciado en ese tiempo quedaba enganchado al menú hasta acabar su inercia.
  releaseScroll();
  const cur = level !== 'closed' ? levels[level] : null;
  if (cur) {
    cur.querySelectorAll('.om-ring, .om-dots, .om-lines').forEach(r => anim(r, [{ opacity: 1, rotate: '0deg', scale: 1 }, { opacity: 0, rotate: '-35deg', scale: .88 }], { duration: 620, delay: 60, easing: 'cubic-bezier(.65,0,.35,1)' }));
    const glow = cur.querySelector('.om-glow'), hub = cur.querySelector('.om-hub');
    if (glow) anim(glow, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 260, easing: 'ease-in-out' });
    if (hub) anim(hub, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: .62 }], { duration: 460, delay: 300, easing: 'cubic-bezier(.65,0,.35,1)' });
    const items = itemsOf(cur), orbit = !(list && cur !== levels.main);
    if (!orbit) items.forEach((li, i) => anim(li, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 12px' }], { duration: 320, delay: i * 14, easing: 'ease-in' }));
    else if (items.length) {
      const t0 = performance.now(), T = 640, stagger = 45;
      const step = () => {
        const now = performance.now();
        items.forEach((li, i) => {
          const e = ease(Math.max(0, Math.min(1, (now - t0 - i * stagger) / T)));
          pos(li, (li._a ?? 0) - 70 * e, li._rx ?? 0, li._ry ?? 0, 1 - .78 * e);
          li.style.opacity = String(1 - e); li.style.scale = String(1 - .35 * e);
        });
        if (now - t0 < T + stagger * items.length) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
  }
  const { x, y } = origin(), R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
  anim(menu, [{ clipPath: `circle(${R}px at ${x}px ${y}px)` }, { clipPath: `circle(26px at ${x}px ${y}px)`, offset: .92 }, { clipPath: `circle(0px at ${x}px ${y}px)` }], { duration: 720, delay: 420, easing: 'cubic-bezier(.65,0,.35,1)' });
  timer = window.setTimeout(() => finishClose(returnFocus), 1160);
}

// Al elegir una página en el menú (26-11-2026). El menú es un diálogo modal que bloquea el scroll de lo que hay debajo;
// si el visitante empieza a deslizar (touchpad o rueda) justo al hacer clic, mientras carga la página nueva, Chrome
// engancha ese gesto al menú y la página nueva no se mueve hasta que el gesto y su inercia terminan (2–5 s, medido
// en el Chrome del dueño). Por eso, en el mismo clic, el menú deja de ser modal (se ve igual) y se libera el scroll.
// El menú sigue visible igual, pero deja de ser modal y ya no retiene el scroll de la página.
function releaseScroll() {
  if (!menu) return;
  if (menu.open && menu.matches(':modal')) {
    // al volver a abrirse sin modal, el navegador enfoca el primer enlace del menú (el logo): se deja el foco donde estaba
    const keep = menu.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    menu.close(); menu.show();
    if (keep) keep.focus({ preventScroll: true, focusVisible: false } as FocusOptions); else (document.activeElement as HTMLElement | null)?.blur();
  }
  // fuera de la capa superior, se mantiene por encima del botón del menú y de la barra de redes
  menu.style.zIndex = '60';
  menu.style.overscrollBehavior = 'auto';
  document.body.classList.remove('menu-open');
}
menu?.addEventListener('click', event => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return;
  releaseScroll();
});
// Si se vuelve con «atrás» y el navegador restaura la página tal como quedó, el menú aparece cerrado.
addEventListener('pageshow', event => {
  if (!event.persisted || !menu?.open) return;
  finishClose(false);
});

menuToggle?.addEventListener('click', () => (menu?.open ? closeMenu(true) : openMenu()));
closeButton?.addEventListener('click', () => closeMenu(true));
backButton?.addEventListener('click', backMain);
menu?.querySelectorAll<HTMLButtonElement>('[data-sub]').forEach(b => b.addEventListener('click', () => enterSub(b.dataset.sub as Level)));
menu?.addEventListener('cancel', event => {
  event.preventDefault();
  if (level === 'main' || level === 'closed') closeMenu(true); else backMain();
});
menu?.addEventListener('close', () => {
  if (menu.open) return;
  stop(); document.body.classList.remove('menu-open'); menuToggle?.setAttribute('aria-expanded', 'false'); level = 'closed';
});
// Foco atrapado dentro del menú (Tab y Mayús+Tab dan la vuelta).
menu?.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = Array.from(menu.querySelectorAll<HTMLElement>('button, a[href]'))
    .filter(c => c.getClientRects().length && !c.hasAttribute('disabled') && !c.closest('[hidden]'));
  const first = controls[0], last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !menu.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
});
let resizeTimer = 0;
addEventListener('resize', () => {
  if (!menu?.open || closing) return;
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { stop(); layout(); if (level !== 'closed') show(level); }, 150);
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stop(); });
