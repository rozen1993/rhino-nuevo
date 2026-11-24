// Animaciones del diseño v4 aprobadas por el dueño el 22-11-2026 (visuales-claude/2026-11-22-animaciones).
// Solo mueven posición, escala y opacidad; con «reducir movimiento» se muestra el estado final.
// Sin JavaScript todo se ve completo: los estados iniciales («armados») solo los pone este script.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const main = document.querySelector<HTMLElement>('[data-v4]');

function onScrollFrame(fn: () => void) {
  let queued = false;
  const run = () => { queued = false; fn(); };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(run); } }, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(run));
  run();
}
const belowFold = (el: Element) => el.getBoundingClientRect().top > innerHeight * .88;
// Pone un elemento en su estado inicial sin animar ese paso: solo se anima la entrada.
const arm = (el: Element) => { el.classList.add('v4-noanim', 'v4-armed'); void (el as HTMLElement).offsetWidth; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('v4-noanim'))); };

if (main) {
  // 2 · Títulos que entran como rótulos: cada línea sube desde abajo y después se dibuja la barrita.
  const titles = Array.from(main.querySelectorAll<HTMLElement>('[data-rotulo]'));
  const originals = new Map<HTMLElement, string>();
  function splitLines(h: HTMLElement) {
    const textEl = h.querySelector<HTMLElement>('.v4-h2-text');
    const accent = h.querySelector<HTMLElement>('.presentation-accent');
    if (!textEl || !accent) return;
    if (!originals.has(h)) originals.set(h, textEl.textContent ?? '');
    const words = (originals.get(h) ?? '').split(/\s+/).filter(Boolean);
    textEl.replaceChildren(...words.map((w, i) => { const s = document.createElement('span'); s.textContent = w + (i < words.length - 1 ? ' ' : ''); return s; }));
    textEl.append(accent);
    const lines: HTMLSpanElement[][] = [];
    let top = -1;
    (Array.from(textEl.children) as HTMLSpanElement[]).forEach(el => {
      if (el === accent) return;
      if (Math.abs(el.offsetTop - top) > 4) { lines.push([]); top = el.offsetTop; }
      lines[lines.length - 1].push(el);
    });
    textEl.replaceChildren(...lines.map((ws, i) => {
      const ln = document.createElement('span'); ln.className = 'v4-ln';
      const inner = document.createElement('span'); inner.textContent = ws.map(w => w.textContent).join('');
      if (i === lines.length - 1) inner.append(accent);
      ln.append(inner); return ln;
    }));
  }
  if (!reduce) {
    titles.forEach(h => { splitLines(h); if (belowFold(h)) arm(h); });
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('v4-armed'); io.unobserve(e.target); } }), { threshold: .6, rootMargin: '0px 0px -12% 0px' });
    titles.forEach(h => h.classList.contains('v4-armed') && io.observe(h));
    let resizeTimer = 0;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => titles.forEach(splitLines), 200); });
    document.fonts?.ready.then(() => titles.forEach(h => { if (!h.classList.contains('v4-armed')) splitLines(h); }));
  }

  // 4 · Imágenes con cortinilla de color al entrar en pantalla.
  const curtains = Array.from(main.querySelectorAll<HTMLElement>('[data-curtain]')).map(f => f.parentElement as HTMLElement);
  if (!reduce) {
    curtains.forEach(c => belowFold(c) && arm(c));
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('v4-in'); e.target.classList.remove('v4-armed'); io.unobserve(e.target);
    }), { threshold: .55, rootMargin: '0px 0px -12% 0px' });
    curtains.forEach(c => c.classList.contains('v4-armed') && io.observe(c));
  }

  // Tarjetas (variante B de la tanda 3): las de cada grupo suben una tras otra cuando el grupo entra en pantalla.
  const cardGroups = Array.from(main.querySelectorAll<HTMLElement>('.v4-cards'));
  if (!reduce) {
    cardGroups.forEach(g => belowFold(g) && arm(g));
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.remove('v4-armed'); io.unobserve(e.target); }
    }), { threshold: .3, rootMargin: '0px 0px -12% 0px' });
    cardGroups.forEach(g => g.classList.contains('v4-armed') && io.observe(g));
  }

  // 3 · Frase destacada que se ilumina (T2) y filas de la lista editorial (T7) que entran escalonadas: una vez, al aparecer.
  const reveals = Array.from(main.querySelectorAll<HTMLElement>('[data-quote], [data-list]'));
  if (!reduce) {
    reveals.forEach(el => belowFold(el) && arm(el));
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.remove('v4-armed'); io.unobserve(e.target); }
    }), { threshold: .35, rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(el => el.classList.contains('v4-armed') && io.observe(el));
  }

  // T3 · claves (P16): la línea horizontal se llena con el scroll y cada clave se enciende al alcanzarla.
  main.querySelectorAll<HTMLElement>('[data-keys]').forEach(ol => {
    const lis = Array.from(ol.querySelectorAll<HTMLElement>('li'));
    const track = ol.querySelector<HTMLElement>('.v4-keys-track'), fill = ol.querySelector<HTMLElement>('.v4-keys-fill');
    const render = () => {
      const r = ol.getBoundingClientRect();
      const cx = lis.map(li => { const n = li.querySelector('.v4-step-node')!.getBoundingClientRect(); return n.left + n.width / 2 - r.left; });
      const W = cx[cx.length - 1] - cx[0];
      if (track) { track.style.left = cx[0] + 'px'; track.style.width = W + 'px'; }
      ol.style.setProperty('--track-w', W + 'px');
      const start = innerHeight * .85, end = innerHeight * .35;
      const p = reduce ? 1 : Math.max(0, Math.min(1, (start - r.top) / (start - end)));
      if (fill) fill.style.width = p * W + 'px';
      lis.forEach((li, i) => li.classList.toggle('on', p * W >= cx[i] - cx[0] - 1));
    };
    onScrollFrame(render);
    document.fonts?.ready.then(render);
  });

  // 11 · Cinta de servicios (P02): el botón (visible al recibir el foco) la detiene o la reanuda.
  main.querySelectorAll<HTMLElement>('[data-belt]').forEach(belt => {
    const btn = belt.querySelector<HTMLButtonElement>('[data-belt-pause]');
    btn?.addEventListener('click', () => {
      const paused = belt.classList.toggle('paused');
      btn.setAttribute('aria-pressed', String(paused));
      btn.textContent = paused ? 'Reanudar cinta' : 'Pausar cinta';
    });
  });

  // 12 · Iconos vivos: hacen su gesto por turnos cada vez que su grupo aparece (una ronda corta, WCAG 2.2.2),
  // y lo repiten al pasar el cursor, al tocarlos o al enfocar su tarjeta.
  const play = (icon: HTMLElement) => {
    if (reduce) return;
    icon.classList.remove('go'); void icon.offsetWidth; icon.classList.add('go');
    window.setTimeout(() => icon.classList.remove('go'), 1800);
  };
  const groups = Array.from(main.querySelectorAll<HTMLElement>('[data-live-group]'));
  const lastRound = new WeakMap<HTMLElement, number>();
  const round = (g: HTMLElement) => {
    const now = performance.now();
    if (reduce || now - (lastRound.get(g) ?? -1e9) < 4000) return;
    lastRound.set(g, now);
    Array.from(g.querySelectorAll<HTMLElement>('.v4-icon[data-live]')).forEach((icon, i) => window.setTimeout(() => play(icon), 250 + i * 650));
  };
  const groupIo = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && round(e.target as HTMLElement)), { threshold: .45 });
  groups.forEach(g => groupIo.observe(g));
  main.querySelectorAll<HTMLElement>('.v4-icon[data-live]').forEach(icon => {
    const host = icon.closest<HTMLElement>('.v4-panel, .v4-card, li') ?? icon;
    host.addEventListener('pointerenter', () => play(icon));
    host.addEventListener('focusin', () => play(icon));
    icon.addEventListener('click', () => play(icon));
  });

  // Paneles corregidos (1B): se abre el panel que se señala o se enfoca.
  main.querySelectorAll<HTMLElement>('[data-deck-v4]').forEach(deck => {
    const panels = Array.from(deck.querySelectorAll<HTMLElement>('.v4-panel'));
    let timer = 0;
    const open = (p: HTMLElement) => panels.forEach(x => x.classList.toggle('on', x === p));
    panels.forEach(p => {
      p.addEventListener('mouseenter', () => { if (!finePointer.matches) return; clearTimeout(timer); timer = window.setTimeout(() => open(p), 120); });
      p.addEventListener('mouseleave', () => clearTimeout(timer));
      p.addEventListener('focus', () => open(p));
      p.addEventListener('click', () => open(p));
    });
  });

  // 5 · Collage de cabecera con profundidad.
  const collage = main.querySelector<HTMLElement>('[data-parallax]');
  if (collage && !reduce) {
    const big = collage.querySelector<HTMLElement>('.v4-big'), small = collage.querySelector<HTMLElement>('.v4-small');
    onScrollFrame(() => {
      const r = collage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      if (big) big.style.transform = `translateY(${(p * -30).toFixed(1)}px)`;
      if (small) small.style.transform = `translateY(${(p * 55).toFixed(1)}px)`;
    });
  }

  // Muestras (E3) + 6 · tanda 4, variante C «Arrastrar y señalar», en bucle (dueño, 23-11-2026).
  // Las muestras van repetidas tres veces: se trabaja en la copia central y, al salir de ella,
  // se salta sin animación a la posición equivalente, así siempre asoma la siguiente.
  main.querySelectorAll<HTMLElement>('[data-slider]').forEach(slider => {
    const track = slider.querySelector<HTMLElement>('.v4-e3-track');
    const rail = slider.querySelector<HTMLElement>('[data-cursor-video]');
    const slides = Array.from(slider.querySelectorAll<HTMLElement>('[data-slide]'));
    const texts = Array.from(slider.querySelectorAll<HTMLElement>('[data-slide-text]'));
    const bars = Array.from(slider.querySelectorAll<HTMLElement>('.v4-bars i'));
    const count = slider.querySelector<HTMLElement>('.v4-count b');
    const n = texts.length;
    if (!track || !rail || n < 2 || slides.length < 3 * n) return;
    let pos = n, index = 0;
    const stepW = () => slides[1].offsetLeft - slides[0].offsetLeft;
    const place = (instant: boolean, dx = 0) => {
      if (instant) track.classList.add('jump');
      track.style.transform = `translateX(${-pos * stepW() + dx}px)`;
      slides.forEach((s, k) => s.classList.toggle('cur', k === pos));
      if (instant) { void track.offsetWidth; track.classList.remove('jump'); }
    };
    const normalize = () => { if (pos < n || pos >= 2 * n) { pos = n + ((pos % n) + n) % n; place(true); } };
    const move = (d: number) => {
      normalize(); pos += d; place(false);
      const next = ((pos % n) + n) % n, changed = next !== index; index = next;
      texts.forEach((t, k) => {
        t.hidden = k !== index; t.classList.remove('in');
        if (k === index && changed && !reduce) { void t.offsetWidth; t.classList.add('in'); }
      });
      bars.forEach((b, k) => b.classList.toggle('on', k === index));
      if (count) count.textContent = String(index + 1);
    };
    track.addEventListener('transitionend', e => { if (e.target === track && e.propertyName === 'transform') normalize(); });
    slider.querySelector('[data-prev]')?.addEventListener('click', () => move(-1));
    slider.querySelector('[data-next]')?.addEventListener('click', () => move(1));
    addEventListener('resize', () => { normalize(); place(true); });
    place(true);

    // Cursor «Ver video» sobre la muestra activa y «Siguiente» / «Anterior» sobre las otras (solo con ratón).
    const cursor = rail.querySelector<HTMLElement>('.v4-cursor');
    const label = cursor?.querySelector('em');
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const follow = () => { cx += (tx - cx) * .22; cy += (ty - cy) * .22; cursor!.style.translate = `${cx}px ${cy}px`; raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .5 ? requestAnimationFrame(follow) : 0; };
    const setLabel = (target: EventTarget | null) => {
      const k = slides.indexOf((target as Element | null)?.closest?.('.v4-e3-slide') as HTMLElement);
      const other = k >= 0 && k !== pos;
      cursor!.classList.toggle('nx', other); cursor!.classList.toggle('back', other && k < pos);
      if (label) label.textContent = other ? (k < pos ? 'Anterior' : 'Siguiente') : 'Ver video';
    };

    // Arrastre con ratón o dedo: desde 60 px pasa a la siguiente o a la anterior.
    let down: { x: number; y: number; id: number; moved: boolean } | null = null, dragged = false;
    rail.addEventListener('dragstart', e => e.preventDefault());
    rail.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; dragged = false; rail.classList.add('press');
    });
    rail.addEventListener('pointermove', e => {
      if (down && e.pointerId === down.id) {
        const dx = e.clientX - down.x;
        if (!down.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
          down.moved = true; normalize(); track.classList.add('drag'); rail.setPointerCapture(e.pointerId);
        }
        if (down.moved) place(false, dx);
      }
      if (!cursor || e.pointerType !== 'mouse' || !finePointer.matches) return;
      const r = rail.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!rail.classList.contains('cursor-on')) { cx = tx; cy = ty; rail.classList.add('cursor-on'); }
      if (!down?.moved) setLabel(e.target);
      if (reduce) { cursor.style.translate = `${tx}px ${ty}px`; return; }
      if (!raf) raf = requestAnimationFrame(follow);
    });
    const up = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, moved = down.moved; down = null;
      rail.classList.remove('press');
      if (!moved) return;
      dragged = true; track.classList.remove('drag');
      move(dx < -60 ? 1 : dx > 60 ? -1 : 0);
    };
    rail.addEventListener('pointerup', up); rail.addEventListener('pointercancel', up);
    rail.addEventListener('pointerleave', () => { if (!down) rail.classList.remove('cursor-on', 'press'); });
    // Un toque en la muestra activa abre su video (visor de interactions.ts o YouTube); en otra, pasa a ella.
    // Tras arrastrar no se abre nada. Va en captura para adelantarse al visor de [data-video].
    rail.addEventListener('click', e => {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
      const s = (e.target as Element).closest<HTMLElement>('.v4-e3-slide');
      if (s && !s.classList.contains('cur')) { e.preventDefault(); e.stopPropagation(); move(slides.indexOf(s) - pos); }
    }, true);
  });

  // 8 · Botón principal (tanda 5, variante C): guarda el punto por donde entra o sale el cursor
  // para que el relleno de v4.css crezca desde ahí y se recoja hacia ahí. El botón no se mueve.
  main.querySelectorAll<HTMLElement>('[data-magnet]').forEach(m => {
    const at = (e: PointerEvent) => {
      const r = m.getBoundingClientRect();
      m.style.setProperty('--fx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      m.style.setProperty('--fy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    };
    m.addEventListener('pointerenter', at); m.addEventListener('pointerleave', at);
  });

  // Pasos del cierre (A3; tanda 4, variante C con iconos vivos): la línea se llena con el scroll y cada paso se enciende al alcanzarlo.
  main.querySelectorAll<HTMLElement>('[data-steps]').forEach(ol => {
    const lis = Array.from(ol.querySelectorAll<HTMLElement>('li'));
    const track = ol.querySelector<HTMLElement>('.v4-track'), fill = ol.querySelector<HTMLElement>('.v4-fill');
    let cy: number[] = [], H = 0;
    const measure = () => {
      const r = ol.getBoundingClientRect();
      cy = lis.map(li => { const n = li.querySelector('.v4-step-node')!.getBoundingClientRect(); return n.top + n.height / 2 - r.top; });
      H = cy[cy.length - 1] - cy[0];
      if (track) { track.style.top = cy[0] + 'px'; track.style.height = H + 'px'; }
      ol.style.setProperty('--track-h', H + 'px');
    };
    const render = () => {
      measure();
      const r = ol.getBoundingClientRect(), start = innerHeight * .85, end = innerHeight * .4;
      const p = reduce ? 1 : Math.max(0, Math.min(1, (start - r.top) / ((start - end) + r.height * .5)));
      if (fill) fill.style.height = p * H + 'px';
      // «cur» marca el último paso alcanzado (lo usan las opciones de color 3 y 4).
      let last = -1;
      lis.forEach((li, i) => { const on = p * H >= cy[i] - cy[0] - 1; li.classList.toggle('on', on); if (on) last = i; });
      lis.forEach((li, i) => li.classList.toggle('cur', i === last));
    };
    onScrollFrame(render);
    document.fonts?.ready.then(render);
  });
}
