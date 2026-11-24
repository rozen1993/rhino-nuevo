import contents from '../data/contenido-paginas.json' with { type: 'json' };
import extras from '../data/paginas-extra.json' with { type: 'json' };

// Marcadores editoriales del borrador: nunca deben llegar al HTML.
const MARKER = /\[(?:PENDIENTE|NOTA EDITORIAL|ESPACIO)[^\]]*\]/;

export const hasMarker = text => MARKER.test(text);

/**
 * Contenido listo para pintar una página interior.
 * Los espacios de muestra se sustituyen por casos reales (extras.samples) o se omite la sección.
 * Cualquier otro marcador detiene el build: la página no puede marcarse como construida sin resolverlo.
 */
export function getPageContent(page) {
  const content = contents.find(entry => entry.id === page.id);
  if (!content) throw new Error(`Falta contenido editorial para ${page.id}`);
  const extra = extras[page.id] ?? {};
  for (const [field, expected] of [['title', page.title], ['h1', page.h1], ['description', page.description]]) {
    if ((content.metadatos[field]?.valor ?? null) !== expected) throw new Error(`${page.id}: ${field} del contenido distinto del registro`);
  }
  const sections = [];
  for (const [index, section] of content.sections.entries()) {
    const placeholders = section.items.filter(hasMarker);
    const sampleSlot = placeholders.length > 0;
    if (sampleSlot && !extra.samples?.length) continue;
    const clean = { ...section, items: section.items.filter(item => !hasMarker(item)), samples: sampleSlot ? extra.samples : [],
      moments: extra.moments?.[String(index)] ?? [] };
    for (const text of [clean.title, ...clean.paragraphs, ...clean.items]) {
      if (hasMarker(text)) throw new Error(`${page.id}: marcador editorial sin resolver en «${clean.title}»`);
    }
    sections.push(clean);
  }
  if (hasMarker(content.intro) || hasMarker(content.cta ?? '')) throw new Error(`${page.id}: marcador editorial en intro o CTA`);
  const closing = content.cta ? sections.pop() : null;
  return { intro: content.intro, cta: content.cta, sections, closing, extra };
}
