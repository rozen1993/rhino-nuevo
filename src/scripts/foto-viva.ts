// «Servicios para tu proyecto» de la home (opción A del laboratorio servicios-home, 27-11-2026):
// 1) acordeón de tres escenas: clic, Enter o Espacio en el nombre; con ratón también al pasar el cursor (pausa corta);
// 2) foto viva: un canvas sobre cada foto dibuja luces que respiran, velas, monitores, pantalla LED, piloto de grabación,
//    burbujas en las copas y confeti. Solo corre a la vista y con la pestaña visible; con «reducir movimiento» no se crea.
// Coordenadas en píxeles de la foto original, con el mismo encuadre (object-position) que la <img>.
import { arranqueTranquilo } from './arranque-tranquilo';

interface Light { x: number; y: number; r: number; color?: string }
interface Fx {
  w: number; h: number; pos: [number, number];
  lights?: Light[]; candles?: Light[]; monitors?: { x: number; y: number; w: number; h: number }[];
  led?: { x: number; y: number; w: number; h: number; period: number }; rec?: { x: number; y: number; r: number };
  bubbles?: { x: number; y: number; w: number; h: number }[]; confetti?: { region: [number, number, number, number]; count: number; countSmall?: number };
}
interface Bit { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; hue: string; f: number }
interface Bubble { g: { x: number; y: number; w: number; h: number }; x: number; y: number; v: number; r: number; s: number }

const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const wob = (t: number, s: number) => (Math.sin(t * 1.3 + s) + Math.sin(t * 2.1 + s * 1.7) * .5) / 1.5;
const HUES = ['254,128,45', '254,8,64', '172,11,217', '255,214,90', '255,255,255'];

class FotoViva {
  private cv = document.createElement('canvas'); private d: CanvasRenderingContext2D;
  private box = { s: 1, x: 0, y: 0 }; private raf = 0; private prev = 0; private seen = false; private t0 = performance.now();
  private bits: Bit[] = []; private bub: Bubble[] = []; private bsp: number[] = [];
  constructor(private m: HTMLElement, private c: Fx) {
    this.cv.setAttribute('aria-hidden', 'true'); m.append(this.cv);
    this.d = this.cv.getContext('2d')!;
    const conf = c.confetti;
    if (conf) { const n = m.clientWidth < 500 ? (conf.countSmall ?? conf.count) : conf.count; this.bits = Array.from({ length: n }, () => this.bit(true)); }
    new ResizeObserver(() => this.layout()).observe(m);
    new IntersectionObserver(([e]) => { this.seen = e.isIntersecting; this.sync(); }).observe(m);
    document.addEventListener('visibilitychange', () => this.sync());
    reduce.addEventListener('change', () => this.sync());
  }
  private bit(initial: boolean): Bit {
    const [x0, y0, x1, y1] = this.c.confetti!.region;
    return { x: x0 + Math.random() * (x1 - x0), y: initial ? y0 + Math.random() * (y1 - y0) : y0 - 20, vx: (Math.random() - .5) * 26, vy: 45 + Math.random() * 55,
      r: Math.random() * TAU, vr: (Math.random() - .5) * 6, w: 7 + Math.random() * 8, h: 3 + Math.random() * 4, hue: HUES[Math.floor(Math.random() * HUES.length)], f: Math.random() * TAU };
  }
  private layout() {
    const W = this.m.clientWidth, H = this.m.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    this.cv.width = Math.max(1, Math.round(W * dpr)); this.cv.height = Math.max(1, Math.round(H * dpr));
    const s = Math.max(W / this.c.w, H / this.c.h);
    this.box = { s: s * dpr, x: (W - this.c.w * s) * this.c.pos[0] * dpr, y: (H - this.c.h * s) * this.c.pos[1] * dpr };
  }
  private sync() {
    const run = this.seen && !document.hidden && !reduce.matches;
    if (run && !this.raf) { this.prev = 0; const loop = (n: number) => { this.frame(n); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    if (!run && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; this.d.clearRect(0, 0, this.cv.width, this.cv.height); }
  }
  private frame(now: number) {
    const c = this.c, d = this.d, b = this.box, t = (now - this.t0) / 1000, dt = this.prev ? Math.min(.05, (now - this.prev) / 1000) : 0; this.prev = now;
    const X = (v: number) => b.x + v * b.s, Y = (v: number) => b.y + v * b.s, R = (v: number) => v * b.s;
    d.clearRect(0, 0, this.cv.width, this.cv.height);
    d.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
      const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.45, `rgba(${rgb},${a * .35})`); g.addColorStop(1, `rgba(${rgb},0)`);
      d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
    };
    (c.lights ?? []).forEach((l, i) => glow(X(l.x), Y(l.y), R(l.r), l.color ?? '255,214,160', .38 + .22 * wob(t, i * 1.9)));
    (c.candles ?? []).forEach((l, i) => glow(X(l.x), Y(l.y), R(l.r) * (1 + .06 * Math.sin(t * 11 + i)), '255,190,110', .45 + .2 * Math.sin(t * 9 + i) * Math.sin(t * 13.7 + i * 2) + .1 * Math.random()));
    (c.monitors ?? []).forEach((m, i) => { d.fillStyle = `rgba(190,150,255,${.16 + .1 * Math.sin(t * 2.3 + i) + .05 * Math.sin(t * 7.1 + i)})`; d.fillRect(X(m.x), Y(m.y), R(m.w), R(m.h)); });
    if (c.led) {
      const L = c.led, p = ((t / L.period) % 1) * 1.6 - .3, x = X(L.x) + R(L.w) * p, g = d.createLinearGradient(x - R(L.w) * .25, 0, x + R(L.w) * .25, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,230,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      d.save(); d.beginPath(); d.rect(X(L.x), Y(L.y), R(L.w), R(L.h)); d.clip(); d.fillStyle = g; d.fillRect(X(L.x), Y(L.y), R(L.w), R(L.h)); d.restore();
    }
    // burbujas que suben dentro de las copas
    (c.bubbles ?? []).forEach((g, i) => { this.bsp[i] = (this.bsp[i] ?? 0) + dt; if (this.bsp[i] > .12) { this.bsp[i] = 0; this.bub.push({ g, x: g.x + (Math.random() - .5) * g.w * .7, y: g.y + g.h, v: 50 + Math.random() * 70, r: 1 + Math.random() * 1.6, s: Math.random() * 9 }); } });
    this.bub = this.bub.filter(u => {
      u.y -= u.v * dt; if (u.y < u.g.y) return false;
      d.fillStyle = `rgba(255,248,220,${Math.min(1, (u.g.y + u.g.h - u.y) / 20) * .85})`; d.beginPath(); d.arc(X(u.x + Math.sin(t * 6 + u.s) * 1.2), Y(u.y), Math.max(.8, R(u.r) * 1.3), 0, TAU); d.fill(); return true;
    });
    d.globalCompositeOperation = 'source-over';
    // confeti que cae girando (el giro en Y se simula achatando la altura)
    if (c.confetti) {
      const y1 = c.confetti.region[3];
      this.bits.forEach((u, i) => {
        u.x += (u.vx + Math.sin(t * 1.7 + u.f) * 16) * dt; u.y += u.vy * dt; u.r += u.vr * dt; u.f += dt * 5;
        if (u.y > y1 + 20) { this.bits[i] = this.bit(false); return; }
        d.save(); d.translate(X(u.x), Y(u.y)); d.rotate(u.r); d.scale(1, Math.cos(u.f)); d.fillStyle = `rgba(${u.hue},.9)`; d.fillRect(-R(u.w) / 2, -R(u.h) / 2, R(u.w), R(u.h)); d.restore();
      });
    }
    if (c.rec && Math.floor(t / .8) % 2 === 0) { const r = R(c.rec.r); d.fillStyle = '#ff3b3b'; d.shadowColor = '#ff3b3b'; d.shadowBlur = r * 3; d.beginPath(); d.arc(X(c.rec.x), Y(c.rec.y), r, 0, TAU); d.fill(); d.shadowBlur = 0; }
  }
}

document.querySelectorAll<HTMLElement>('[data-sv]').forEach(deck => {
  const panels = Array.from(deck.querySelectorAll<HTMLElement>('.sv-p'));
  // el texto de un panel cerrado sale del recorrido con el teclado en el acto (inert), aunque se desvanezca un instante
  const open = (p: HTMLElement) => { panels.forEach(x => {
    const on = x === p; x.classList.toggle('on', on);
    x.querySelector('.sv-trigger')?.setAttribute('aria-expanded', String(on));
    const body = x.querySelector<HTMLElement>('.sv-copy'); if (body) body.inert = !on;
  }); };
  open(panels.find(p => p.classList.contains('on')) ?? panels[0]);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let hoverT = 0;
  panels.forEach(p => {
    p.querySelector('.sv-trigger')?.addEventListener('click', () => open(p));
    // con ratón también se abre al pasar el cursor (pausa de 140 ms, como en el laboratorio)
    p.addEventListener('pointerenter', () => { if (fine.matches && !p.classList.contains('on')) { clearTimeout(hoverT); hoverT = window.setTimeout(() => open(p), 140); } });
    p.addEventListener('pointerleave', () => clearTimeout(hoverT));
  });
  // las fotos vivas se preparan cuando la página ya cargó y el visitante no se está desplazando (no traban el primer scroll)
  if (!reduce.matches) arranqueTranquilo(deck, () => deck.querySelectorAll<HTMLElement>('[data-foto-viva]').forEach(m => new FotoViva(m, JSON.parse(m.dataset.fotoViva!))));
});
