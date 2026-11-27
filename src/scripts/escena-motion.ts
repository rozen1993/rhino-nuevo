// Diseño «escena» de las páginas v4 (Cobertura, 25-11-2026): arranca la cabecera viva y abre el visor y los fotogramas
// al aparecer. Con movimiento reducido no se arma nada y todo se ve en su estado final.
import { EscenaViva, type EscenaConfig } from './escena-viva';
import { arranqueTranquilo } from './arranque-tranquilo';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = document.querySelector<HTMLElement>('[data-escena]');
if (hero?.dataset.escena) {
  const cfg = JSON.parse(hero.dataset.escena) as EscenaConfig;
  // Arranque tranquilo (26-11-2026): la escena se prepara cuando la página ya cargó y el visitante no se está
  // desplazando, para no trabar el primer scroll (mientras, se ve la foto fija, idéntica).
  arranqueTranquilo(hero, () => {
    const scene = new EscenaViva(hero, cfg);
    // Pausa solo visible al llegar con el teclado (convención del sitio)
    const pause = hero.parentElement?.querySelector<HTMLButtonElement>('.xh-pause');
    if (pause && scene.running) {
      pause.hidden = false;
      pause.addEventListener('click', () => {
        scene.pause(!scene.paused);
        pause.classList.toggle('resume', scene.paused);
        pause.setAttribute('aria-label', scene.paused ? 'Reanudar animación' : 'Pausar animación');
      });
      hero.addEventListener('escena:stop', () => { pause.hidden = true; });
    }
  });
}

const pieces = document.querySelectorAll<HTMLElement>('[data-x-open]');
if (pieces.length) {
  if (reduce) pieces.forEach(el => el.classList.add('x-open'));
  else {
    document.documentElement.classList.add('x-arm');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('x-open'); io.unobserve(e.target); onOpen(e.target as HTMLElement); e.target.dispatchEvent(new Event('x:open')); }
    }), { threshold: .4 });
    pieces.forEach(el => io.observe(el));
  }
}

// Extras al abrirse (26-11-2026, resto de páginas): recorrido del plano (Inmobiliario), confeti de la banda (BTL)
// y contador de disparos del visor en modo foto (Servicios). Solo con movimiento: con «reducir» no se llama.
function onOpen(el: HTMLElement) {
  // La preferencia puede cambiar con la página abierta: se consulta de nuevo al abrir cada bloque.
  if (quiet()) return;
  if (el.classList.contains('xp')) {
    const m = el.querySelector<SVGAnimateMotionElement>('animateMotion');
    setTimeout(() => { if (!quiet()) try { m?.beginElement(); } catch { /* sin SMIL: el punto queda al inicio */ } }, 2800);
  }
  if (el.classList.contains('xv-shoot')) {
    const n = el.querySelector<HTMLElement>('[data-shots]');
    // tres disparos, al ritmo del obturador del CSS (1,4 s); luego el contador queda quieto
    if (n) [0, 1, 2].forEach(i => setTimeout(() => { n.textContent = String(Math.max(1, Number(n.textContent) - 1)); }, 1600 + i * 1400));
  }
  if (el.classList.contains('xb-confeti')) confeti(el);
  if (el.classList.contains('xk')) {
    const m = el.querySelector<SVGAnimateMotionElement>('animateMotion');
    setTimeout(() => { if (!quiet()) try { m?.beginElement(); } catch { /* sin SMIL: el punto no se muestra */ } }, 2000);
  }
}

function quiet() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

function confeti(el: HTMLElement) {
  const cv = el.querySelector<HTMLCanvasElement>('.xb-canvas'); if (!cv) return;
  const d = cv.getContext('2d'); if (!d) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; d.scale(dpr, dpr);
  const hues = ['#fe802d', '#fe0840', '#ac0bd9', '#ffd65a', '#ffffff'];
  const bits = Array.from({ length: W < 700 ? 70 : 140 }, (_, i) => {
    const left = i % 2 === 0, a = (left ? -60 : -120) * Math.PI / 180 + (Math.random() - .5) * .7, v = 380 + Math.random() * 520;
    return { x: left ? 0 : W, y: H * .85, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - .5) * 12,
      w: 7 + Math.random() * 7, h: 4 + Math.random() * 4, c: hues[i % hues.length], f: Math.random() * 6 };
  });
  let prev = 0; const t0 = performance.now();
  const tick = (now: number) => {
    const dt = prev ? Math.min(.04, (now - prev) / 1000) : 0; prev = now;
    d.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += 520 * dt; b.vx *= 1 - 1.4 * dt; b.vy = Math.min(b.vy, 160 + Math.sin(b.f) * 40);
      b.x += (b.vx + Math.sin(now / 300 + b.f) * 30) * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.f += dt * 6;
      d.save(); d.translate(b.x, b.y); d.rotate(b.r); d.scale(1, Math.cos(b.f)); d.fillStyle = b.c; d.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); d.restore();
    }
    if (now - t0 < 6500 && !quiet()) requestAnimationFrame(tick); else d.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(tick);
}

// Código de tiempo del visor y de los fotogramas: corre a 25 fotogramas por segundo mientras está en pantalla.
const tcs = Array.from(document.querySelectorAll<HTMLElement>('[data-tc]'));
if (!reduce && tcs.length) {
  const shown = new Set<HTMLElement>();
  const io = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting ? shown.add(e.target as HTMLElement) : shown.delete(e.target as HTMLElement)));
  tcs.forEach(el => io.observe(el));
  const t0 = performance.now(), p = (n: number) => String(n).padStart(2, '0');
  const tick = (now: number) => {
    if (shown.size && !document.hidden) {
      const f = Math.floor((now - t0) / 40);
      const text = `00:${p(Math.floor(f / 1500) % 60)}:${p(Math.floor(f / 25) % 60)}:${p(f % 25)}`;
      shown.forEach(el => { el.textContent = text; });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- Animación y motion graphics, Estudio fotográfico (27-11-2026) ----
// Muestras animadas (P13): rotan cada 4,5 s solo mientras están a la vista y sin pausa; los botones eligen una muestra
// (y detienen la rotación). Con «reducir movimiento» no rotan: los botones cambian de muestra sin animar.
document.querySelectorAll<HTMLElement>('[data-reel]').forEach(reel => {
  const scenes = Array.from(reel.querySelectorAll<HTMLElement>('.xr-scene'));
  const chips = Array.from(reel.querySelectorAll<HTMLButtonElement>('.xr-chip'));
  const pause = reel.querySelector<HTMLButtonElement>('[data-reel-pause]');
  let k = 0, timer = 0, visible = false, stopped = quiet();
  const show = (n: number) => {
    k = n;
    scenes.forEach((sc, i) => sc.classList.toggle('on', i === n));
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === n)));
    // reinicia las animaciones CSS de la muestra elegida
    const sc = scenes[n]; sc.classList.remove('on'); void sc.offsetWidth; sc.classList.add('on');
    reel.classList.remove('playing'); void reel.offsetWidth; if (!stopped && visible) reel.classList.add('playing');
  };
  const loop = () => { clearTimeout(timer); if (!stopped && visible && !document.hidden) timer = window.setTimeout(() => { show((k + 1) % scenes.length); loop(); }, 4500); };
  const setStopped = (v: boolean) => {
    stopped = v; pause?.classList.toggle('resume', v); pause?.setAttribute('aria-label', v ? 'Reanudar muestras' : 'Pausar muestras');
    if (v) { clearTimeout(timer); reel.classList.remove('playing'); } else { show(k); loop(); }
  };
  if (stopped && pause) pause.hidden = true;
  chips.forEach((c, i) => c.addEventListener('click', () => { if (!quiet()) setStopped(true); show(i); }));
  pause?.addEventListener('click', () => setStopped(!stopped));
  reel.addEventListener('focusin', e => { if (!stopped && e.target !== pause) setStopped(true); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !stopped) { show(k); loop(); } else clearTimeout(timer); }, { threshold: .35 }).observe(reel);
  document.addEventListener('visibilitychange', loop);
  // al quitar «reducir movimiento» el reel sigue detenido y el botón ofrece «Reanudar»
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches || stopped) setStopped(true); if (pause) pause.hidden = e.matches; });
});

// Formatos (P13): al abrirse recorre una vez horizontal → vertical → cuadrado → horizontal; los botones eligen uno.
document.querySelectorAll<HTMLElement>('[data-formatos]').forEach(box => {
  const frame = box.querySelector<HTMLElement>('.xo-frame'); const btns = Array.from(box.querySelectorAll<HTMLButtonElement>('.xo-ctrl button'));
  let user = false;
  const set = (f: number) => { if (frame) frame.dataset.f = String(f); btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === f))); };
  btns.forEach((b, i) => b.addEventListener('click', () => { user = true; set(i); }));
  box.addEventListener('x:open', () => [1, 2, 0].forEach((f, i) => setTimeout(() => { if (!user && !quiet()) set(f); }, 1400 + i * 1600)));
});

// Sesiones del estudio (P09): al elegir una sesión salta el flash (solo con movimiento) y cambia la foto.
document.querySelectorAll<HTMLElement>('[data-modalidades]').forEach(box => {
  const opts = Array.from(box.querySelectorAll<HTMLButtonElement>('.xm-opt'));
  const photos = Array.from(box.querySelectorAll<HTMLElement>('.xm-ph'));
  const flash = box.querySelector<HTMLElement>('.xm-flash');
  opts.forEach((o, i) => o.addEventListener('click', () => {
    if (o.getAttribute('aria-pressed') === 'true') return;
    opts.forEach((x, j) => x.setAttribute('aria-pressed', String(j === i)));
    photos.forEach((p, j) => { p.classList.toggle('on', j === i); if (j === i) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true'); });
    if (flash && !quiet()) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
  }));
});
