import contents from '../data/contenido-paginas.json' with { type: 'json' };
import extras from '../data/paginas-extra.json' with { type: 'json' };

// Marcadores editoriales del borrador: nunca deben llegar al HTML.
const MARKER = /\[(?:PENDIENTE|NOTA EDITORIAL|ESPACIO)[^\]]*\]/;

export const hasMarker = text => MARKER.test(text);

/** Página con contenido temporal de maqueta (extra.temporal): nunca entra al artefacto de producción. */
export const hasTemporal = page => Boolean(extras[page.id]?.temporal);

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
  // Contenido temporal (27-11-2026, autorizado por el dueño solo para maquetar y mostrar avances): quita las notas
  // [PENDIENTE…] del texto de la ficha y rellena los huecos de muestra con material provisional (extra.temporal.slots).
  // Una página con contenido temporal nunca puede aprobarse para publicar.
  const temporal = extra.temporal;
  if (temporal && page.publicationApproved) throw new Error(`${page.id}: tiene contenido temporal y no puede aprobarse para publicar`);
  const tidy = text => temporal?.stripPending ? text.replace(/\s*\[PENDIENTE[^\]]*\]/g, '').trim() : text;
  const sections = [];
  for (const [index, section] of content.sections.entries()) {
    const placeholders = section.items.filter(hasMarker);
    const sampleSlot = placeholders.length > 0;
    const slot = temporal?.slots?.[String(index)];
    if (sampleSlot && !extra.samples?.length && !slot) continue;
    const clean = { ...section, paragraphs: section.paragraphs.map(tidy),
      items: [...section.items.filter(item => !hasMarker(item)), ...(sampleSlot && slot?.items ? slot.items : [])],
      samples: sampleSlot && !slot ? extra.samples : [], temporal: Boolean(sampleSlot && slot),
      moments: extra.moments?.[String(index)] ?? [] };
    for (const text of [clean.title, ...clean.paragraphs, ...clean.items]) {
      if (hasMarker(text)) throw new Error(`${page.id}: marcador editorial sin resolver en «${clean.title}»`);
    }
    sections.push(clean);
  }
  const intro = tidy(content.intro);
  if (hasMarker(intro) || hasMarker(content.cta ?? '')) throw new Error(`${page.id}: marcador editorial en intro o CTA`);
  const closing = content.cta ? sections.pop() : null;
  return { intro, cta: content.cta, sections, closing, extra };
}
