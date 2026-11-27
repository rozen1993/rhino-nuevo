/* Cinemagraph en vivo (piloto P19, elegido por el dueño el 25-11-2026: variante A · pantalla completa).
   Sobre la foto nítida se dibujan, en un solo bucle:
   - los telones, que ondulan con un sombreador WebGL (desplazamiento suave de la «placa», la foto sin estrella);
   - la estrella, capa propia que se balancea desde su hilo (la luz ámbar que la rodea queda fija);
   - los focos del techo, que parpadean suave, y motas de luz que flotan en el haz.
   La foto fija queda debajo: sin WebGL, con movimiento reducido o ante cualquier fallo se ve la foto.
   Se detiene fuera de pantalla y con la pestaña oculta. Todas las medidas van en píxeles de la foto original.
   Laboratorio y fuentes: visuales-claude/2026-11-25-laboratorio-show-cinemagraph. */

type Edge = [number, number][];
export interface CinemaConfig {
  w: number; h: number;
  /** Foto sin estrella; si hay varias, se usa la del tamaño de la foto fija que eligió el navegador. */
  plate: { small: string; large: string };
  pos: [number, number];
  star: { src: string; x: number; y: number; w: number; h: number; px: number; py: number; amp: number; period: number };
  cloth: { edge: Edge; amp: number; period: number; phase: number; depth: number }[];
  pin: [number, number, number, number];
  lights: { x: number; y: number; r: number }[];
  motes: { region: [number, number, number, number]; count: number; countSmall: number };
}
interface Mote { x: number; y: number; r: number; v: number; sway: number; ph: number; life: number; span: number; a: number }

const TAU = Math.PI * 2;
const VERT = 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}';
const FRAG = `precision mediump float;varying vec2 v;uniform sampler2D tex;uniform vec2 size;uniform float t;
uniform vec3 eL;uniform vec3 eR;uniform vec4 cL;uniform vec4 cR;uniform vec4 pin;
void main(){vec2 p=v*size;float y=p.y;
float vert=smoothstep(pin.x,pin.y,y)*(1.-smoothstep(pin.z,pin.w,y));
float xl=eL.x+eL.y*y+eL.z*y*y;float wl=1.-smoothstep(xl-cL.w,xl+10.,p.x);
float xr=eR.x+eR.y*y+eR.z*y*y;float wr=smoothstep(xr-10.,xr+cR.w,p.x);
float dl=wl*vert*cL.x*(sin(6.2831853*t/cL.y+y*.011+p.x*.004+cL.z)+.35*sin(6.2831853*t/(cL.y*.53)+y*.023+cL.z*1.7));
float dr=wr*vert*cR.x*(sin(6.2831853*t/cR.y+y*.012-p.x*.004+cR.z)+.35*sin(6.2831853*t/(cR.y*.57)+y*.021+cR.z*1.3));
vec2 off=vec2(dl+dr,(dl+dr)*.22);
gl_FragColor=texture2D(tex,clamp((p-off)/size,vec2(0.),vec2(1.)));}`;

// Ajuste cuadrático x = a + b·y + c·y² de los puntos del borde de cada telón.
function fit(points: Edge): number[] {
  const s = [0, 0, 0, 0, 0], r = [0, 0, 0];
  for (const [y, x] of points) {
    for (let i = 0; i < 5; i++) s[i] += y ** i;
    for (let i = 0; i < 3; i++) r[i] += x * y ** i;
  }
  const M = [[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]];
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  return [0, 1, 2].map(k => det(M.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / D);
}
const flicker = (t: number, seed: number) => (Math.sin(t * 1.7 + seed) + Math.sin(t * 2.9 + seed * 2.3) * .6 + Math.sin(t * 5.3 + seed * .7) * .3) / 1.9;

export class Cinemagraph {
  paused = false;
  private visible = false; private ready = false; private progReady = false; private texReady = false; private raf = 0; private t0 = performance.now(); private last = 0; private prev = 0;
  private box?: HTMLDivElement; private canvas!: HTMLCanvasElement; private gl!: WebGLRenderingContext; private uT!: WebGLUniformLocation | null;
  private star!: HTMLImageElement; private lights: (HTMLSpanElement & { seed: number })[] = [];
  private dust!: HTMLCanvasElement; private dctx!: CanvasRenderingContext2D; private motes: Mote[] = [];
  private io?: IntersectionObserver; private ro?: ResizeObserver;
  private onVis = () => this.sync();

  constructor(private root: HTMLElement, private cfg: CinemaConfig) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { this.build(); } catch (e) { this.box?.remove(); this.box = undefined; console.warn('[cinemagraph] se queda la foto fija:', e); }
  }
  get running() { return !!this.box; }

  private build() {
    const c = this.cfg;
    const still = this.root.querySelector<HTMLImageElement>('.cg-still');
    const box = document.createElement('div'); box.className = 'cg-box'; box.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas'); canvas.className = 'cg-gl'; box.append(canvas);
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false, alpha: false });
    if (!gl) throw new Error('sin WebGL');
    this.box = box; this.canvas = canvas; this.gl = gl;
    // Compilación del sombreador. Se probó compilarlo en segundo plano (KHR_parallel_shader_compile) y cerraba el navegador
    // en algunas pruebas con NVIDIA + D3D11; con el arranque diferido de ShowTelon ya tarda solo unos milisegundos.
    const shader = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    const setup = () => {
      if (!this.box) return;
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[cinemagraph] se queda la foto fija:', gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog)); this.destroy(); return; }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (n: string) => gl.getUniformLocation(prog, n);
      const [L, R] = c.cloth;
      gl.uniform2f(U('size'), c.w, c.h);
      gl.uniform3fv(U('eL'), fit(L.edge)); gl.uniform3fv(U('eR'), fit(R.edge));
      gl.uniform4f(U('cL'), L.amp, L.period, L.phase, L.depth); gl.uniform4f(U('cR'), R.amp, R.period, R.phase, R.depth);
      gl.uniform4f(U('pin'), ...c.pin);
      this.uT = U('t');
      this.progReady = true; this.start();
    };
    setup();
    const pct = (v: number, total: number) => (v / total * 100) + '%';
    const S = c.star;
    const star = new Image(); star.className = 'cg-star'; star.alt = ''; star.decoding = 'async'; star.src = S.src;
    Object.assign(star.style, { left: pct(S.x, c.w), top: pct(S.y, c.h), width: pct(S.w, c.w), transformOrigin: `${pct(S.px, S.w)} ${pct(S.py, S.h)}` });
    box.append(star); this.star = star;
    this.lights = c.lights.map((l, i) => {
      const el = Object.assign(document.createElement('span'), { className: 'cg-light', seed: i * 2.1 + .4 });
      Object.assign(el.style, { left: pct(l.x, c.w), top: pct(l.y, c.h), width: pct(l.r * 2, c.w) });
      box.append(el); return el;
    });
    this.dust = document.createElement('canvas'); this.dust.className = 'cg-dust'; box.append(this.dust);
    this.dctx = this.dust.getContext('2d')!;
    const count = this.root.clientWidth < 700 ? c.motes.countSmall : c.motes.count;
    this.motes = Array.from({ length: count }, () => this.mote(true));
    (still ?? this.root).after(box);
    // Textura: la placa del mismo tamaño que la foto fija elegida por el navegador
    const img = new Image(); img.decoding = 'async';
    // La foto se decodifica en segundo plano (createImageBitmap) y recién después se sube: subir la <img> directamente
    // obligaba a decodificarla de golpe en el hilo principal (~50 ms; ~190 ms en un equipo cargado).
    img.onload = async () => {
      let src: TexImageSource = img;
      try { if ('createImageBitmap' in window) src = await createImageBitmap(img); } catch { /* se sube la <img> */ }
      if (!this.box) return;
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      if ('close' in src) (src as ImageBitmap).close();
      this.texReady = true; this.start();
    };
    img.onerror = () => this.destroy();
    const pickPlate = () => { img.src = still && still.currentSrc && !still.currentSrc.includes('1774') ? c.plate.small : c.plate.large; };
    if (still && !still.complete) still.addEventListener('load', pickPlate, { once: true }); else pickPlate();
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); });
    this.io.observe(this.root);
    document.addEventListener('visibilitychange', this.onVis);
    this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.root);
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches) this.destroy(); });
  }
  // Empieza a moverse cuando el sombreador y la textura están listos (pueden terminar en cualquier orden).
  private start() {
    if (!this.progReady || !this.texReady || this.ready || !this.box) return;
    this.ready = true; this.layout(); this.frame(performance.now());
    requestAnimationFrame(() => this.root.classList.add('cg-live'));
    this.sync();
  }
  private mote(initial: boolean): Mote {
    const [x0, y0, x1, y1] = this.cfg.motes.region;
    return {
      x: x0 + Math.random() * (x1 - x0), y: initial ? y0 + Math.random() * (y1 - y0) : y0 + (y1 - y0) * (.35 + Math.random() * .65),
      r: .8 + Math.random() * 2.2, v: 6 + Math.random() * 14, sway: 6 + Math.random() * 18, ph: Math.random() * TAU,
      life: initial ? Math.random() : 0, span: 7 + Math.random() * 8, a: .35 + Math.random() * .55,
    };
  }
  // La caja de la escena reproduce object-fit: cover con la misma posición que la foto fija.
  private layout() {
    if (!this.box) return;
    const c = this.cfg, W = this.root.clientWidth, H = this.root.clientHeight;
    const s = Math.max(W / c.w, H / c.h), bw = c.w * s, bh = c.h * s;
    Object.assign(this.box.style, { width: bw + 'px', height: bh + 'px', left: (W - bw) * c.pos[0] + 'px', top: (H - bh) * c.pos[1] + 'px' });
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.min(Math.round(bw * dpr), 2400);
    if (this.canvas.width !== cw) { this.canvas.width = cw; this.canvas.height = Math.round(cw * c.h / c.w); this.gl.viewport(0, 0, cw, this.canvas.height); }
    const dw = Math.min(Math.round(bw * dpr), 1800);
    if (this.dust.width !== dw) { this.dust.width = dw; this.dust.height = Math.round(dw * c.h / c.w); }
    if (this.ready && !this.raf) this.frame(this.last || performance.now());
  }
  private frame(now: number) {
    const c = this.cfg, gl = this.gl, t = (now - this.t0) / 1000;
    const dt = this.prev ? Math.min(.05, (now - this.prev) / 1000) : 0; this.prev = now; this.last = now;
    gl.uniform1f(this.uT, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const S = c.star;
    this.star.style.transform = `rotate(${(S.amp * Math.sin(TAU * t / S.period) + S.amp * .18 * Math.sin(TAU * t / (S.period * .43))).toFixed(3)}deg)`;
    for (const l of this.lights) l.style.opacity = (.62 + .3 * flicker(t, l.seed)).toFixed(3);
    const d = this.dctx, k = this.dust.width / c.w;
    d.clearRect(0, 0, this.dust.width, this.dust.height);
    this.motes.forEach((m, i) => {
      m.life += dt / m.span; m.y -= m.v * dt;
      if (m.life >= 1 || m.y < c.motes.region[1]) { this.motes[i] = this.mote(false); return; }
      const x = (m.x + Math.sin(t * .6 + m.ph) * m.sway) * k, y = m.y * k, a = m.a * Math.sin(Math.PI * m.life), rr = m.r * k * 3.2;
      const g = d.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(255,226,170,${a})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      d.fillStyle = g; d.beginPath(); d.arc(x, y, rr, 0, TAU); d.fill();
    });
  }
  private sync() {
    const run = this.ready && !this.paused && this.visible && !document.hidden;
    if (run && !this.raf) { this.prev = 0; const loop = (n: number) => { this.frame(n); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    if (!run && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }
  pause(p: boolean) { this.paused = p; this.sync(); }
  destroy() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.ready = false;
    this.io?.disconnect(); this.ro?.disconnect(); document.removeEventListener('visibilitychange', this.onVis);
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.box?.remove(); this.box = undefined; this.root.classList.remove('cg-live');
    this.root.dispatchEvent(new CustomEvent('cinemagraph:stop'));
  }
}
