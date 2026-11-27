/* Escena viva: cabecera a pantalla completa con movimiento dibujado sobre la foto nítida, sin WebGL.
   Primera página: Cobertura de eventos (P05), aprobada por el dueño el 25-11-2026 tras la prueba
   (visuales-claude/2026-11-25-prueba-cobertura-diseno-show). Capas: haces de luz que barren despacio, brillo que recorre
   la pantalla LED, focos que respiran, bokeh que flota, monitor que late, punto rojo de grabación y vapor (Catering).
   La foto queda debajo: con movimiento reducido no se crea nada. Se detiene fuera de pantalla y con la pestaña oculta.
   Medidas en píxeles de la foto original. */

export interface EscenaConfig {
  w: number; h: number; pos: [number, number]; posMobile?: [number, number];
  lights?: { x: number; y: number; r: number }[];
  beams?: { x: number; y: number; angle: number; spread: number; len: number; sweep: number; period: number; alpha: number; color: string }[];
  led?: { x: number; y: number; w: number; h: number; period: number };
  monitor?: { x: number; y: number; w: number; h: number };
  rec?: { x: number; y: number; r: number };
  // Vapor que sube de tazas o fuentes (Catering, 26-11-2026): x, y = donde nace; w = ancho por donde sale. Opcionales por fuente:
  // alpha (intensidad), size, rise (velocidad de subida), drift (deriva lateral), every (segundos entre bocanadas) y period/on/off
  // (solo emite durante «on» segundos de cada «period», desplazado «off»).
  steam?: { x: number; y: number; w: number; alpha?: number; size?: number; rise?: number; drift?: number; every?: number; period?: number; on?: number; off?: number }[];
  bokeh?: { region: [number, number, number, number]; count: number; countSmall: number; hues?: string[] };
  // Efectos añadidos el 26-11-2026 para el resto de páginas de servicios:
  // flash = destello de estudio cada «every» s (Fotografía); pulse = ondas que salen de un altavoz o de una notificación;
  // blink = luces de navegación (drone): «duty» fracción encendida del «period»; sweep = franja de sol que cruza despacio un área;
  // confetti = papelitos que caen y giran dentro de «region».
  flash?: { x: number; y: number; r: number; every: number; off?: number; color?: string }[];
  pulse?: { x: number; y: number; r: number; period: number; rings?: number; color?: string; alpha?: number; width?: number }[];
  blink?: { x: number; y: number; r: number; period: number; duty?: number; off?: number; color: string; double?: boolean }[];
  sweep?: { x: number; y: number; w: number; h: number; period: number; band: number; alpha: number; color: string; skew?: number }[];
  confetti?: { region: [number, number, number, number]; count: number; countSmall: number; hues?: string[] };
  // shapes = formas de motion graphics (círculo, cuadrado redondeado, triángulo, anillo) que flotan, giran y laten (Animación, 27-11-2026).
  shapes?: { region: [number, number, number, number]; count: number; countSmall: number; hues?: string[] };
}
interface Shape { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; kind: number; hue: string; ph: number; a: number }
interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; hue: string; flip: number }
interface Dot { x: number; y: number; r: number; vx: number; vy: number; life: number; span: number; hue: string; a: number }
interface Puff { i: number; x: number; y: number; vy: number; vx: number; r: number; life: number; span: number; seed: number; amp: number; lobes: [number, number, number][] }

const TAU = Math.PI * 2;
const wobble = (t: number, s: number) => (Math.sin(t * 1.3 + s) + Math.sin(t * 2.1 + s * 1.7) * .5) / 1.5;
const HUES = ['255,170,110', '255,90,150', '210,120,255'];

export class EscenaViva {
  private box?: HTMLDivElement; private cv!: HTMLCanvasElement; private ctx!: CanvasRenderingContext2D;
  private led?: HTMLSpanElement; private rec?: HTMLSpanElement; private monitor?: HTMLSpanElement;
  private lights: (HTMLSpanElement & { seed: number })[] = []; private bokeh: Dot[] = []; private bits: Bit[] = []; private shapes: Shape[] = []; private puffs: Puff[] = []; private spawn: number[] = [];
  private raf = 0; private prev = 0; private visible = false; private t0 = performance.now();
  paused = false;
  private io?: IntersectionObserver; private ro?: ResizeObserver; private onVis = () => this.sync();

  constructor(private root: HTMLElement, private cfg: EscenaConfig) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.build();
  }
  get running() { return !!this.box; }

  private build() {
    const c = this.cfg, box = document.createElement('div');
    box.className = 'ev-box'; box.setAttribute('aria-hidden', 'true'); this.box = box;
    const pct = (v: number, t: number) => (v / t * 100) + '%';
    const place = (el: HTMLElement, r: { x: number; y: number; w?: number; h?: number; r?: number }) => Object.assign(el.style, {
      left: pct(r.x, c.w), top: pct(r.y, c.h), width: pct(r.w ?? (r.r ?? 0) * 2, c.w), ...(r.h ? { height: pct(r.h, c.h) } : {}),
    });
    if (c.led) { this.led = document.createElement('span'); this.led.className = 'ev-led'; place(this.led, c.led); box.append(this.led); }
    this.lights = (c.lights ?? []).map((s, i) => {
      const e = Object.assign(document.createElement('span'), { className: 'ev-light', seed: i * 1.9 + .3 });
      place(e, s); box.append(e); return e;
    });
    this.cv = document.createElement('canvas'); this.cv.className = 'ev-canvas'; box.append(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    if (c.rec) { this.rec = document.createElement('span'); this.rec.className = 'ev-rec'; place(this.rec, c.rec); box.append(this.rec); }
    if (c.monitor) { this.monitor = document.createElement('span'); this.monitor.className = 'ev-monitor'; place(this.monitor, c.monitor); box.append(this.monitor); }
    this.puffs = (c.steam ?? []).flatMap((st, i) => st.period ? [] : Array.from({ length: Math.round(30 * .09 / (st.every ?? .09)) }, () => this.puff(i, true)));
    const small = this.root.clientWidth < 700;
    this.bokeh = c.bokeh ? Array.from({ length: small ? c.bokeh.countSmall : c.bokeh.count }, () => this.dot(true)) : [];
    this.shapes = c.shapes ? Array.from({ length: small ? c.shapes.countSmall : c.shapes.count }, (_, i) => this.shape(i)) : [];
    this.bits = c.confetti ? Array.from({ length: small ? c.confetti.countSmall : c.confetti.count }, () => this.bit(true)) : [];
    this.root.append(box);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }); this.io.observe(this.root);
    document.addEventListener('visibilitychange', this.onVis);
    this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.root);
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches) this.destroy(); });
    this.layout(); requestAnimationFrame(() => this.root.classList.add('ev-live'));
  }
  private shape(i: number): Shape {
    const f = this.cfg.shapes!, [x0, y0, x1, y1] = f.region, hues = f.hues ?? ['254,128,45', '254,8,64', '172,11,217', '255,255,255'];
    return { x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 10, rot: Math.random() * TAU,
      vr: (Math.random() - .5) * .6, s: 12 + Math.random() * 26, kind: i % 4, hue: hues[i % hues.length], ph: Math.random() * TAU, a: .35 + Math.random() * .3 };
  }
  private bit(initial: boolean): Bit {
    const f = this.cfg.confetti!, [x0, y0, x1, y1] = f.region, hues = f.hues ?? ['254,128,45', '254,8,64', '172,11,217', '255,214,90', '255,255,255'];
    return { x: x0 + Math.random() * (x1 - x0), y: initial ? y0 + Math.random() * (y1 - y0) : y0 - 20, vx: (Math.random() - .5) * 30, vy: 40 + Math.random() * 50,
      rot: Math.random() * TAU, vr: (Math.random() - .5) * 6, w: 7 + Math.random() * 7, h: 3 + Math.random() * 4, hue: hues[Math.floor(Math.random() * hues.length)], flip: Math.random() * TAU };
  }
  private dot(initial: boolean): Dot {
    const [x0, y0, x1, y1] = this.cfg.bokeh!.region;
    return { x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), r: 6 + Math.random() * 18, vx: (Math.random() - .5) * 6, vy: -2 - Math.random() * 5,
      life: initial ? Math.random() : 0, span: 6 + Math.random() * 8, hue: (this.cfg.bokeh!.hues ?? HUES)[Math.floor(Math.random() * (this.cfg.bokeh!.hues ?? HUES).length)], a: .18 + Math.random() * .3 };
  }
  private puff(i: number, initial = false): Puff {
    const s = this.cfg.steam![i], k = s.size ?? 1;
    return { i, x: s.x + (Math.random() - .5) * s.w * .5, y: s.y, vy: -(38 + Math.random() * 16) * (s.rise ?? 1), vx: (s.drift ?? 0) * (.6 + Math.random() * .8),
      r: s.w * (.08 + Math.random() * .05) * k, life: initial ? Math.random() : 0, span: 4.2 + Math.random() * 2, seed: Math.random() * 9,
      amp: s.w * (.18 + Math.random() * .22), lobes: Array.from({ length: 3 }, () => [(Math.random() - .5) * 1.1, (Math.random() - .5) * .9, .55 + Math.random() * .5] as [number, number, number]) };
  }
  // La caja reproduce object-fit: cover con la misma posición que la foto fija.
  private layout() {
    if (!this.box) return;
    const c = this.cfg, W = this.root.clientWidth, H = this.root.clientHeight;
    const s = Math.max(W / c.w, H / c.h), bw = c.w * s, bh = c.h * s;
    // mismo encuadre que la foto fija, que cambia de posición a 760 px (también al girar el teléfono)
    const pos = c.posMobile && matchMedia('(max-width: 760px)').matches ? c.posMobile : c.pos;
    Object.assign(this.box.style, { width: bw + 'px', height: bh + 'px', left: (W - bw) * pos[0] + 'px', top: (H - bh) * pos[1] + 'px' });
    const cw = Math.min(Math.round(bw * Math.min(devicePixelRatio || 1, 2)), 2000);
    if (this.cv.width !== cw) { this.cv.width = cw; this.cv.height = Math.round(cw * c.h / c.w); }
    if (!this.raf) this.frame(performance.now());
  }
  private frame(now: number) {
    const c = this.cfg, t = (now - this.t0) / 1000, d = this.ctx, k = this.cv.width / c.w;
    const dt = this.prev ? Math.min(.05, (now - this.prev) / 1000) : 0; this.prev = now;
    d.clearRect(0, 0, this.cv.width, this.cv.height);
    d.globalCompositeOperation = 'lighter';
    (c.beams ?? []).forEach((b, i) => {
      const ang = (b.angle + b.sweep * Math.sin(TAU * t / b.period + i * 1.7)) * Math.PI / 180, half = b.spread * Math.PI / 360;
      const x = b.x * k, y = b.y * k, L = b.len * k, a = b.alpha * (.8 + .2 * wobble(t, i));
      const g = d.createLinearGradient(x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L);
      g.addColorStop(0, `rgba(${b.color},${a})`); g.addColorStop(.55, `rgba(${b.color},${a * .35})`); g.addColorStop(1, `rgba(${b.color},0)`);
      d.fillStyle = g; d.beginPath(); d.moveTo(x, y);
      d.lineTo(x + Math.cos(ang - half) * L, y + Math.sin(ang - half) * L);
      d.lineTo(x + Math.cos(ang + half) * L, y + Math.sin(ang + half) * L); d.closePath(); d.fill();
    });
    this.bokeh.forEach((m, i) => {
      m.life += dt / m.span; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.life >= 1) { this.bokeh[i] = this.dot(false); return; }
      const a = m.a * Math.sin(Math.PI * m.life), x = m.x * k, y = m.y * k, r = m.r * k;
      const g = d.createRadialGradient(x, y, r * .55, x, y, r);
      g.addColorStop(0, `rgba(${m.hue},${a})`); g.addColorStop(1, `rgba(${m.hue},0)`);
      d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
    });
    // Franja de sol que cruza un área (recortada a ella), inclinada «skew» px.
    (c.sweep ?? []).forEach((w, i) => {
      const ph = ((t / w.period + i * .37) % 1), x0 = w.x * k, y0 = w.y * k, W = w.w * k, H = w.h * k, B = w.band * k, sk = (w.skew ?? 0) * k;
      const cx = x0 - B + ph * (W + 2 * B), a = w.alpha * Math.sin(Math.PI * ph);
      d.save(); d.beginPath(); d.rect(x0, y0, W, H); d.clip();
      const g = d.createLinearGradient(cx - B, 0, cx + B, 0);
      g.addColorStop(0, `rgba(${w.color},0)`); g.addColorStop(.5, `rgba(${w.color},${a})`); g.addColorStop(1, `rgba(${w.color},0)`);
      d.fillStyle = g; d.beginPath(); d.moveTo(cx - B - sk, y0); d.lineTo(cx + B - sk, y0); d.lineTo(cx + B + sk, y0 + H); d.lineTo(cx - B + sk, y0 + H); d.closePath(); d.fill();
      d.restore();
    });
    // Ondas: anillos que se expanden y se apagan (altavoces, notificaciones).
    (c.pulse ?? []).forEach((pu, i) => {
      const n = pu.rings ?? 3;
      for (let j = 0; j < n; j++) {
        const ph = ((t / pu.period + j / n + i * .21) % 1), r = pu.r * (.15 + .85 * ph) * k;
        d.strokeStyle = `rgba(${pu.color ?? '255,255,255'},${(pu.alpha ?? .35) * (1 - ph) ** 1.6})`; d.lineWidth = (pu.width ?? 2) * k * (1.4 - ph * .6);
        d.beginPath(); d.arc(pu.x * k, pu.y * k, r, 0, TAU); d.stroke();
      }
    });
    // Destellos de estudio: subida brusca y caída suave.
    (c.flash ?? []).forEach(fl => {
      const ph = ((t + (fl.off ?? 0)) % fl.every), a = ph < .06 ? ph / .06 : Math.exp(-(ph - .06) * 7);
      if (a < .01) return;
      const x = fl.x * k, y = fl.y * k, r = fl.r * k, g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${fl.color ?? '255,250,240'},${.85 * a})`); g.addColorStop(.35, `rgba(${fl.color ?? '255,250,240'},${.35 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
    });
    // Luces de navegación: fijas o con doble parpadeo.
    (c.blink ?? []).forEach(bl => {
      const ph = ((t + (bl.off ?? 0)) % bl.period) / bl.period, duty = bl.duty ?? .5;
      const on = bl.double ? (ph < .06 || (ph > .14 && ph < .2)) : ph < duty;
      if (!on) return;
      const x = bl.x * k, y = bl.y * k, r = bl.r * k, g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,.95)`); g.addColorStop(.18, `rgba(${bl.color},.9)`); g.addColorStop(1, `rgba(${bl.color},0)`);
      d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
    });
    d.globalCompositeOperation = 'source-over';
    // Confeti: papelitos que caen girando (el giro en Y se simula achatando la altura).
    if (c.confetti) {
      const [, , , y1] = c.confetti.region;
      this.bits.forEach((b, i) => {
        b.x += (b.vx + Math.sin(t * 1.7 + b.flip) * 18) * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.flip += dt * 5;
        if (b.y > y1 + 20) { this.bits[i] = this.bit(false); return; }
        d.save(); d.translate(b.x * k, b.y * k); d.rotate(b.rot); d.scale(1, Math.cos(b.flip));
        d.fillStyle = `rgba(${b.hue},.9)`; d.fillRect(-b.w * k / 2, -b.h * k / 2, b.w * k, b.h * k); d.restore();
      });
    }
    // Formas de motion graphics: derivan dentro de su zona (rebotan en los bordes), giran y laten con una curva suave.
    if (c.shapes) {
      const [x0, y0, x1, y1] = c.shapes.region;
      for (const m of this.shapes) {
        m.x += m.vx * dt; m.y += m.vy * dt; m.rot += m.vr * dt;
        if (m.x < x0 || m.x > x1) m.vx *= -1; if (m.y < y0 || m.y > y1) m.vy *= -1;
        const pulse = .75 + .35 * Math.sin(t * 1.3 + m.ph) ** 2, r = m.s * pulse * k;
        d.save(); d.translate(m.x * k, m.y * k); d.rotate(m.rot); d.globalAlpha = m.a;
        d.fillStyle = d.strokeStyle = `rgb(${m.hue})`; d.lineWidth = 3 * k; d.beginPath();
        if (m.kind === 0) { d.arc(0, 0, r, 0, TAU); d.fill(); }
        else if (m.kind === 1) { d.roundRect(-r, -r, r * 2, r * 2, r * .35); d.fill(); }
        else if (m.kind === 2) { d.moveTo(0, -r); d.lineTo(r * .9, r * .7); d.lineTo(-r * .9, r * .7); d.closePath(); d.fill(); }
        else { d.arc(0, 0, r, 0, TAU); d.stroke(); }
        d.restore();
      }
      d.globalAlpha = 1;
    }
    // Vapor: bocanadas que suben, se ensanchan, ondulan y se desvanecen.
    (c.steam ?? []).forEach((st, i) => {
      this.spawn[i] = (this.spawn[i] ?? 0) + dt;
      const on = !st.period || ((t + (st.off ?? 0)) % st.period) < (st.on ?? st.period);
      if (on && this.spawn[i] > (st.every ?? .09)) { this.spawn[i] = 0; this.puffs.push(this.puff(i)); }
    });
    this.puffs = this.puffs.filter(p => {
      p.life += dt / p.span; if (p.life >= 1) return false;
      // sube, se ensancha y ondula: la ondulación crece con la altura, como un hilo de vapor que se deshace
      const st = c.steam![p.i], rise = -p.vy * p.life * p.span;
      const x = (p.x + p.vx * p.life * p.span + Math.sin(t * 1.1 + p.seed * .3 + p.life * 5) * p.amp * p.life) * k, y = (p.y - rise) * k;
      const r = (p.r * (1 + p.life * 3.2)) * k, a = (st.alpha ?? .5) * Math.sin(Math.PI * Math.min(1, p.life * 2.2)) * (1 - p.life) ** 1.1;
      // bordes irregulares: tres lóbulos que se separan al subir
      for (const [ox, oy, rr] of p.lobes) {
        const lx = x + ox * r * p.life * 1.4, ly = y + oy * r * p.life, lr = r * rr;
        const g = d.createRadialGradient(lx, ly, 0, lx, ly, lr);
        g.addColorStop(0, `rgba(255,255,255,${a * .55})`); g.addColorStop(.6, `rgba(255,255,255,${a * .25})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        d.fillStyle = g; d.beginPath(); d.arc(lx, ly, lr, 0, TAU); d.fill();
      }
      return true;
    });
    if (this.led && c.led) this.led.style.setProperty('--p', ((t / c.led.period) % 1 * 260 - 80).toFixed(1) + '%');
    for (const l of this.lights) l.style.opacity = (.6 + .3 * wobble(t, l.seed)).toFixed(3);
    if (this.rec) this.rec.style.opacity = String(Math.floor(t / .8) % 2 ? .25 : 1);
    if (this.monitor) this.monitor.style.opacity = (.55 + .25 * Math.sin(t * 2.3) + .1 * Math.sin(t * 7.1)).toFixed(3);
  }
  private sync() {
    const run = !!this.box && !this.paused && this.visible && !document.hidden;
    if (run && !this.raf) { this.prev = 0; const loop = (n: number) => { this.frame(n); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    if (!run && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }
  pause(p: boolean) { this.paused = p; this.sync(); }
  destroy() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.io?.disconnect(); this.ro?.disconnect(); document.removeEventListener('visibilitychange', this.onVis);
    this.box?.remove(); this.box = undefined; this.root.classList.remove('ev-live');
    this.root.dispatchEvent(new CustomEvent('escena:stop'));
  }
}
