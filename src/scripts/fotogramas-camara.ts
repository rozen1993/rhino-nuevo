// Pantallas de cámara de los fotogramas «escena» (Cobertura, 25-11-2026). Estilo C elegido por el dueño:
// - photo: la imagen reencuadra con zoom, aparece la regla de tercios, el punto del sujeto se enciende y dispara (contador +1).
// - reel: las imágenes de distintos eventos pasan una tras otra (el dueño pidió simplificarlo: «que pasen las imágenes nomás»).
// - rec: grabación; el código de tiempo lo mueve escena-motion.ts.
// Histograma en Fotografías y Registro; medidores de audio en Registro. Todo corre solo mientras el fotograma está en pantalla;
// con movimiento reducido queda quieto en su imagen principal.

const frames = Array.from(document.querySelectorAll<HTMLElement>('.xf-frame[data-cam]'));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (frames.length && !reduce) {
  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    const fr = e.target as HTMLElement;
    if (e.isIntersecting) visible.add(fr); else visible.delete(fr);
  }), { threshold: .25 });
  frames.forEach(fr => io.observe(fr));
  const on = (fr: HTMLElement) => visible.has(fr) && !document.hidden && !!fr.closest('.x-open');
  const q = <T extends Element = HTMLElement>(fr: HTMLElement, s: string) => fr.querySelector<T>(s);
  const t0 = performance.now(), p2 = (n: number) => String(n).padStart(2, '0');

  // ---- Fotografías: reencuadre + regla de tercios (ciclo de 5,6 s) ----
  const SHOTS = [
    { tx: '0%', ty: '0%', s: 1.04, x: 66.67, y: 33.33 },
    { tx: '-5%', ty: '2%', s: 1.16, x: 66.67, y: 33.33 },
    { tx: '4%', ty: '-1%', s: 1.1, x: 33.33, y: 66.67 },
    { tx: '-2%', ty: '-3%', s: 1.22, x: 66.67, y: 66.67 },
  ];
  frames.filter(fr => fr.dataset.cam === 'photo').forEach((fr, i) => {
    const g3 = q(fr, '.xc-g3'), pt = q(fr, '.xc-pt'), shots = q(fr, '[data-shots]'), cnt = q(fr, '.xc-cnt');
    if (!g3 || !pt || !shots || !cnt) return;
    let k = 0;
    const cycle = () => {
      if (!on(fr)) return;
      k = (k + 1) % SHOTS.length; const c = SHOTS[k];
      fr.style.setProperty('--b', '1.6px');
      fr.style.setProperty('--tx', c.tx); fr.style.setProperty('--ty', c.ty); fr.style.setProperty('--s', String(c.s));
      g3.classList.add('on'); pt.classList.remove('on');
      setTimeout(() => { fr.style.setProperty('--b', '0px'); pt.style.left = c.x + '%'; pt.style.top = c.y + '%'; pt.classList.add('on'); }, 1150);
      setTimeout(() => {
        fr.style.setProperty('--br', '.55'); setTimeout(() => fr.style.setProperty('--br', '1'), 90);
        shots.textContent = String(+(shots.textContent || 0) + 1);
        cnt.classList.remove('roll'); void cnt.offsetWidth; cnt.classList.add('roll');
      }, 1750);
      setTimeout(() => { g3.classList.remove('on'); pt.classList.remove('on'); }, 2600);
    };
    setTimeout(() => { cycle(); setInterval(cycle, 5600); }, 1800 + i * 400);
  });

  // ---- Video resumen: las imágenes pasan una tras otra con un leve acercamiento (1,8 s cada una) ----
  const SLIDE = 1800;
  const reels = frames.filter(fr => fr.dataset.cam === 'reel').map(fr => ({ fr, imgs: Array.from(fr.querySelectorAll<HTMLElement>('.xc-mont img')), el: q(fr, '[data-elapsed]'), start: -1, cur: -1 }));

  // ---- Histogramas y medidores ----
  const histos = frames.map(fr => q<HTMLCanvasElement>(fr, '[data-histo]')).filter(Boolean).map(c => ({ c: c!, x: c!.getContext('2d')!, ph: Math.random() * 6, fr: c!.closest('.xf-frame') as HTMLElement }));
  const meters = Array.from(document.querySelectorAll<HTMLElement>('.xf-frame .xc-meter')).map(m => ({ fr: m.closest('.xf-frame') as HTMLElement, bar: m.querySelector('i') as HTMLElement, peak: m.querySelector('u') as HTMLElement, v: .3, p: .3, hold: 0 }));
  const drawHisto = (h: typeof histos[number], t: number) => {
    const { c, x } = h, W = c.width, H = c.height; x.clearRect(0, 0, W, H);
    x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const v = .55 * Math.exp(-((u - .18 - .03 * Math.sin(t * .7 + h.ph)) ** 2) / .012) + .35 * Math.exp(-((u - .55 - .05 * Math.sin(t * .5 + h.ph)) ** 2) / .02)
        + .2 * Math.exp(-((u - .86) ** 2) / .004) * (.6 + .4 * Math.sin(t * 1.3 + h.ph)) + .03 * Math.random();
      x.lineTo(u * W, H - Math.min(1, v) * (H - 6));
    }
    x.lineTo(W, H); x.closePath();
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#fe802dcc'); g.addColorStop(.5, '#fe0840cc'); g.addColorStop(1, '#ac0bd9cc');
    x.fillStyle = g; x.fill();
  };

  let last = 0;
  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    reels.forEach(r => {
      if (!on(r.fr) || !r.imgs.length) { r.start = -1; return; }
      if (r.start < 0) r.start = now;
      const ms = now - r.start, k = Math.floor(ms / SLIDE) % r.imgs.length;
      if (r.el) { const e = Math.floor(ms / 1000) % 600; r.el.textContent = `00:${p2(Math.floor(e / 60))}:${p2(e % 60)}`; }
      if (k !== r.cur) { r.imgs.forEach(x => x.classList.remove('on')); const im = r.imgs[k]; void im.offsetWidth; im.classList.add('on'); r.cur = k; }
    });
    if (now - last > 80) {
      last = now;
      histos.forEach(h => { if (on(h.fr)) drawHisto(h, t); });
      meters.forEach((m, i) => {
        if (!on(m.fr)) return;
        const target = .25 + .5 * Math.abs(Math.sin(t * (2.2 + i * .4)) * Math.sin(t * 5.1 + i)) + .2 * Math.random();
        m.v += (target - m.v) * .6;
        if (m.v > m.p) { m.p = m.v; m.hold = 14; } else if (m.hold-- <= 0) m.p = Math.max(m.v, m.p - .02);
        m.bar.style.height = (m.v * 100).toFixed(1) + '%'; m.peak.style.bottom = (m.p * 100).toFixed(1) + '%';
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Sin movimiento: histograma fijo para que la pantalla no quede vacía.
if (frames.length && reduce) {
  frames.forEach(fr => {
    const c = fr.querySelector<HTMLCanvasElement>('[data-histo]'); const x = c?.getContext('2d'); if (!c || !x) return;
    x.beginPath(); x.moveTo(0, c.height);
    for (let i = 0; i <= 64; i++) { const u = i / 64, v = .55 * Math.exp(-((u - .18) ** 2) / .012) + .35 * Math.exp(-((u - .55) ** 2) / .02) + .12 * Math.exp(-((u - .86) ** 2) / .004); x.lineTo(u * c.width, c.height - Math.min(1, v) * (c.height - 6)); }
    x.lineTo(c.width, c.height); x.closePath();
    const g = x.createLinearGradient(0, 0, c.width, 0); g.addColorStop(0, '#fe802dcc'); g.addColorStop(.5, '#fe0840cc'); g.addColorStop(1, '#ac0bd9cc'); x.fillStyle = g; x.fill();
  });
}
