// Origen de la consulta (plan SEM 25-11-2026, §6 opción b, elegida por criterio de Claude con delegación del dueño).
// Si la visita llega desde un anuncio de Google (gclid o utm_medium=cpc), los enlaces de WhatsApp de esa sesión
// añaden «(anuncio de Google)» al final del mensaje prellenado. Así, en la hoja de consultas se sabe qué
// mensajes vinieron de Ads sin enviar datos personales a ninguna analítica: solo se guarda una marca en la sesión.
const KEY = 'rhino-origen-anuncio';
const NOTE = ' (anuncio de Google)';

const params = new URLSearchParams(location.search);
const fromAd = params.has('gclid') || params.has('gbraid') || params.has('wbraid') || params.get('utm_medium') === 'cpc';
try { if (fromAd) sessionStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento: solo esta página */ }
let marked = fromAd;
try { marked = marked || sessionStorage.getItem(KEY) === '1'; } catch { /* nada */ }

if (marked) {
  document.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me/"]').forEach(a => {
    const url = new URL(a.href);
    const text = url.searchParams.get('text') ?? '';
    if (text.endsWith(NOTE)) return;
    // encodeURIComponent (espacios como %20): WhatsApp no siempre convierte «+» en espacio
    url.searchParams.delete('text');
    const rest = url.searchParams.toString();
    a.href = `${url.origin}${url.pathname}?text=${encodeURIComponent(text + NOTE)}${rest ? '&' + rest : ''}`;
  });
}
