import { closeMenu, menuToggle } from './navigation';

declare global {
  interface Window {
    rhinoCases?: {id: string; title: string; context: string; video: string}[];
  }
}

document.querySelectorAll<HTMLElement>('[data-deck]').forEach(deck => {
  const panels = Array.from(deck.querySelectorAll<HTMLElement>('.service-panel'));
  function activate(selected: HTMLElement) {
    panels.forEach(panel => {
      const active = panel === selected;
      panel.classList.toggle('is-active', active);
      panel.querySelector('button')?.setAttribute('aria-expanded', String(active));
      const content = panel.querySelector<HTMLElement>('.panel-content');
      if (content) content.hidden = !active;
    });
  }
  panels.forEach(panel => panel.querySelector('button')?.addEventListener('click', () => activate(panel)));
  // Con ratón, la columna se abre al pasar el cursor. Una pausa corta evita abrir columnas al cruzarlas de paso.
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let hoverTimer = 0;
  panels.forEach(panel => {
    panel.addEventListener('mouseenter', () => {
      if (!canHover.matches || panel.classList.contains('is-active')) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => activate(panel), 120);
    });
    panel.addEventListener('mouseleave', () => window.clearTimeout(hoverTimer));
  });
  if (panels[0]) activate(panels[0]);
});

const eventButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.event-select'));
eventButtons.forEach(button => button.addEventListener('click', () => {
  eventButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const image = document.querySelector<HTMLImageElement>('#event-image');
  const caption = document.querySelector('#event-caption');
  const asset = button.dataset.eventImage;
  if (!image || !asset) return;
  image.src = '/media/' + asset + (asset === 'tasting' ? '-1280.webp' : '-960.webp');
  image.alt = button.dataset.eventCaption ?? '';
  if (caption) caption.textContent = button.dataset.eventCaption ?? '';
}));

let opener: HTMLElement | null = null;
const videoDialog = document.querySelector<HTMLDialogElement>('#video-dialog');
const videoLoad = document.querySelector<HTMLButtonElement>('#video-load');
const videoPoster = document.querySelector<HTMLImageElement>('#video-poster');
let selectedVideo = '';
function resetPlayer() {
  videoDialog?.querySelector('iframe')?.remove();
  if (videoPoster) videoPoster.hidden = false;
  if (videoLoad) videoLoad.hidden = false;
}
function openDialog(dialog: HTMLDialogElement, trigger: HTMLElement) {
  opener = trigger.getAttribute('aria-hidden') === 'true'
    ? trigger.closest('article')?.querySelector<HTMLElement>('.inline-action[data-video]') ?? trigger
    : trigger;
  if (trigger.closest('#site-menu')) {
    closeMenu(false, true);
    opener = menuToggle;
  }
  dialog.showModal();
  document.body.classList.add('dialog-open');
  dialog.querySelector<HTMLButtonElement>('.dialog-close')?.focus();
}
document.querySelectorAll<HTMLDialogElement>('dialog:not(.site-menu)').forEach(dialog => {
  dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], iframe'))
      .filter(control => control.getClientRects().length && !control.hasAttribute('disabled'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    resetPlayer();
    document.body.classList.remove('dialog-open');
    opener?.focus();
  });
});
document.querySelectorAll<HTMLElement>('[data-pending]').forEach(button => {
  button.addEventListener('click', () => {
    const dialog = document.querySelector<HTMLDialogElement>('#route-dialog');
    const title = dialog?.querySelector('#route-title');
    const description = dialog?.querySelector('#route-description');
    const contact = dialog?.querySelector<HTMLAnchorElement>('#route-contact');
    if (!dialog || !title || !description || !contact) return;
    const label = button.dataset.pending ?? button.textContent?.trim() ?? 'este servicio';
    title.textContent = label;
    description.textContent = 'Página de detalle en preparación.';
    contact.href = 'https://wa.me/51965683542?text=' + encodeURIComponent('Hola Rhino, quiero consultar sobre ' + label + '.');
    openDialog(dialog, button);
  });
});
document.querySelectorAll<HTMLAnchorElement>('[data-video]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const item = window.rhinoCases?.find(entry => entry.id === link.dataset.video);
    const title = videoDialog?.querySelector('#video-title');
    const description = videoDialog?.querySelector('#video-description');
    const videoLink = videoDialog?.querySelector<HTMLAnchorElement>('#video-link');
    // Without the optional player, the real YouTube link remains functional.
    if (!item || !videoDialog || !videoLoad || !videoPoster || !title || !description || !videoLink) return;
    event.preventDefault();
    resetPlayer();
    selectedVideo = item.video;
    title.textContent = item.title;
    description.textContent = item.context;
    videoPoster.src = '/media/' + item.id + '-1280.webp';
    videoPoster.alt = 'Fotograma de ' + item.title;
    videoLink.href = 'https://www.youtube.com/watch?v=' + item.video;
    openDialog(videoDialog, link);
  });
});
videoLoad?.addEventListener('click', () => {
  const stage = videoDialog?.querySelector('.video-stage');
  if (!videoDialog || !videoPoster || !videoLoad || !selectedVideo || !stage) return;
  const frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/' + selectedVideo + '?rel=0';
  frame.title = videoDialog.querySelector('#video-title')?.textContent ?? 'Video del portafolio';
  frame.allow = 'encrypted-media; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  videoPoster.hidden = true;
  videoLoad.hidden = true;
  stage.append(frame);
  frame.focus();
});

function alignDecorations() {
  const constellation = document.querySelector<SVGSVGElement>('.constellation-lines');
  if (constellation && constellation.getBoundingClientRect().width) {
    const bounds = constellation.getBoundingClientRect();
    constellation.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height);
    const points = Array.from(document.querySelectorAll('.node-circle')).map(node => {
      const point = node.getBoundingClientRect();
      return (point.x + point.width / 2 - bounds.x) + ' ' + (point.y + point.height / 2 - bounds.y);
    });
    constellation.querySelector('path')?.setAttribute('d', 'M' + points.join('L') + 'Z');
  }
  const curve = document.querySelector<SVGSVGElement>('.steps-line');
  if (curve && curve.getBoundingClientRect().width) {
    const bounds = curve.getBoundingClientRect();
    curve.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height);
    const points = Array.from(document.querySelectorAll('.step-icon')).map(node => {
      const point = node.getBoundingClientRect();
      return {x: point.x + point.width / 2 - bounds.x, y: point.y + point.height / 2 - bounds.y};
    });
    if (points.length === 3) {
      const [first, middle, last] = points;
      const gap = (middle.x - first.x) / 2;
      const path = 'M-20 ' + (first.y + 95) + ' Q' + (first.x / 2) + ' ' + first.y + ' ' + first.x + ' ' + first.y +
        ' C' + (first.x + gap) + ' ' + first.y + ' ' + (middle.x - gap) + ' ' + middle.y + ' ' + middle.x + ' ' + middle.y +
        ' S' + (last.x - gap) + ' ' + last.y + ' ' + last.x + ' ' + last.y +
        ' Q' + (last.x + gap) + ' ' + last.y + ' ' + (bounds.width + 20) + ' ' + (last.y + 75);
      curve.querySelectorAll('path').forEach(line => line.setAttribute('d', path));
    }
  }
}
alignDecorations();
window.addEventListener('resize', alignDecorations);
document.fonts.ready.then(alignDecorations);
export {};
