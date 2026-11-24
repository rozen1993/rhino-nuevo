// particles.js stays a local classic script: the legacy vendor relies on
// non-strict globals. All fields share its download, never its live instance.
interface ParticleInstance {
  canvas: { el: HTMLCanvasElement };
  particles: { move: { enable: boolean }; array: unknown[] };
  interactivity: {
    status: string;
    mouse: { pos_x: number | null; pos_y: number | null };
  };
  fn: {
    drawAnimFrame?: number;
    particlesEmpty: () => void;
    particlesCreate: () => void;
    vendors: { draw: () => void; densityAutoParticles: () => void };
    modes: { pushParticles: (count: number, mouse: { pos_x: number; pos_y: number }) => void };
  };
}

type ParticleWindow = Window & {
  particlesJS?: (id: string, config: object) => void;
  pJSDom?: Array<{ pJS: ParticleInstance }>;
};

const particleWindow = window as ParticleWindow;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const smallScreen = matchMedia('(max-width: 650px)');
let libraryLoading: Promise<void> | undefined;

function loadLibrary(): Promise<void> {
  if (particleWindow.particlesJS) return Promise.resolve();
  if (!libraryLoading) libraryLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/particles.min.js';
    script.async = true;
    script.dataset.rhinoParticles = 'local-v2.0.0';
    script.onload = () => particleWindow.particlesJS ? resolve() : reject(new Error('Particles unavailable'));
    script.onerror = () => reject(new Error('Particles could not load'));
    document.head.append(script);
  });
  return libraryLoading;
}

function initializeField(host: HTMLElement) {
  const section = host.closest<HTMLElement>('.color-field');
  if (!section || !host.id) return;
  const motionControl = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-particles-toggle]'))
    .find(button => button.getAttribute('aria-controls') === host.id);
  let motionOverride: boolean | undefined;
  let instance: ParticleInstance | undefined;
  let starting = false;
  let running = false;
  let failed = false;
  let pageActive = true;
  const initialBounds = section.getBoundingClientRect();
  let inView = initialBounds.bottom > 0 && initialBounds.top < innerHeight;

  const wantsMotion = () => motionOverride ?? !reducedMotion.matches;
  const canRun = () => inView && pageActive && !document.hidden && wantsMotion();

  function updateControl() {
    if (!motionControl) return;
    const action = wantsMotion() ? 'Pausar animación' : 'Activar animación';
    const label = motionControl.dataset.particlesLabel;
    motionControl.hidden = false;
    motionControl.setAttribute('aria-pressed', String(wantsMotion()));
    motionControl.setAttribute('aria-label', label ? `${action} de ${label}` : action);
    motionControl.textContent = action;
  }

  function clearPointer() {
    if (!instance) return;
    instance.interactivity.status = 'mouseleave';
    instance.interactivity.mouse.pos_x = null;
    instance.interactivity.mouse.pos_y = null;
  }

  function pause() {
    running = false;
    clearPointer();
    if (instance) {
      instance.particles.move.enable = false;
      if (instance.fn.drawAnimFrame !== undefined) cancelAnimationFrame(instance.fn.drawAnimFrame);
      instance.fn.drawAnimFrame = undefined;
    }
    const reduced = reducedMotion.matches && motionOverride === undefined;
    section!.dataset.particlesActive = String(!!instance && !reduced);
    host.dataset.particlesState = reduced ? 'reduced-motion' : 'paused';
  }

  function resume() {
    if (!instance || running || !canRun()) return;
    running = true;
    host.dataset.particlesState = 'active';
    section!.dataset.particlesActive = 'true';
    instance.particles.move.enable = true;
    instance.fn.vendors.draw();
  }

  async function sync() {
    if (failed) return;
    if (!canRun()) { pause(); return; }
    if (instance) { resume(); return; }
    if (starting) return;
    starting = true;
    try {
      await loadLibrary();
      // Changes while the shared download is pending must not start an
      // offscreen field or override a newly chosen motion preference.
      if (!canRun() || !host.isConnected) return;
      particleWindow.particlesJS!(host.id, {
        particles: {
          // The selected panoramic hero has a sparser field; other sections
          // retain the legacy density. Movement and pointer response are shared.
          number: { value: section!.classList.contains('hero-panorama') ? 42 : 80, density: { enable: true, value_area: 800 } },
          color: { value: '#ffffff' },
          shape: { type: 'circle' },
          opacity: { value: .4, random: true, anim: { enable: false } },
          size: { value: 7, random: true, anim: { enable: false } },
          line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: .3, width: 1 },
          // Legacy density initialization on narrow canvases needs movement
          // enabled until the line color exists. Cancel its first queued frame
          // immediately afterwards and let this field own its animation loop.
          move: { enable: true, speed: 2, direction: 'none', random: true, straight: false, out_mode: 'bounce', bounce: false }
        },
        interactivity: {
          detect_on: 'canvas',
          // The owning section forwards pointer positions, so the decorative
          // canvas can stay non-interactive over real navigation and buttons.
          events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: false }, resize: true },
          modes: { grab: { distance: 312, line_linked: { opacity: .7 } } }
        },
        retina_detect: false
      });
      instance = particleWindow.pJSDom?.find(entry => entry.pJS.canvas.el.parentElement === host)?.pJS;
      if (!instance) throw new Error('Particles instance unavailable');
      if (instance.fn.drawAnimFrame !== undefined) cancelAnimationFrame(instance.fn.drawAnimFrame);
      instance.fn.drawAnimFrame = undefined;
      instance.particles.move.enable = false;
      instance.canvas.el.setAttribute('aria-hidden', 'true');
      resume();
    } catch {
      failed = true;
      pause();
      host.dataset.particlesState = 'failed';
      section!.dataset.particlesActive = 'false';
      if (motionControl) motionControl.hidden = true;
      // Keep the section's static SVG when its optional canvas cannot load.
    } finally {
      starting = false;
    }
  }

  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    void sync();
  }, { threshold: 0 }).observe(section);
  document.addEventListener('visibilitychange', () => { void sync(); });
  reducedMotion.addEventListener('change', () => {
    motionOverride = undefined;
    updateControl();
    void sync();
  });
  motionControl?.addEventListener('click', () => {
    motionOverride = !wantsMotion();
    updateControl();
    void sync();
  });

  function pointerPosition(event: MouseEvent | PointerEvent) {
    const bounds = instance!.canvas.el.getBoundingClientRect();
    return {
      pos_x: (event.clientX - bounds.left) * instance!.canvas.el.width / bounds.width,
      pos_y: (event.clientY - bounds.top) * instance!.canvas.el.height / bounds.height
    };
  }
  function isControl(event: Event) {
    return event.target instanceof Element && !!event.target.closest('a,button');
  }
  section.addEventListener('pointermove', event => {
    if (!instance || !running || isControl(event)) {
      clearPointer();
      return;
    }
    Object.assign(instance.interactivity.mouse, pointerPosition(event));
    instance.interactivity.status = 'mousemove';
  });
  section.addEventListener('pointerleave', clearPointer);
  section.addEventListener('pointerup', event => { if (event.pointerType === 'touch') clearPointer(); });
  section.addEventListener('click', event => {
    if (!instance || !running || isControl(event)) return;
    const available = (smallScreen.matches ? 75 : 200) - instance.particles.array.length;
    if (available > 0) instance.fn.modes.pushParticles(Math.min(4, available), pointerPosition(event));
  });
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!instance) return;
      // The vendor changes canvas dimensions but retains old coordinates.
      // Redistribute once layout settles to avoid clusters along mobile edges.
      pause();
      instance.fn.particlesEmpty();
      instance.fn.particlesCreate();
      instance.fn.vendors.densityAutoParticles();
      void sync();
    }, 120);
  });
  window.addEventListener('pagehide', () => { pageActive = false; pause(); });
  window.addEventListener('pageshow', () => { pageActive = true; void sync(); });
  updateControl();
  void sync();
}

document.querySelectorAll<HTMLElement>('[data-particles-host]').forEach(initializeField);

export {};
