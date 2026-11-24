import registry from '../data/page-registry.json' with { type: 'json' };
import { site } from '../config/site.mjs';

export const pages = registry;
const HTML_TYPES = new Set(['html', 'plantilla_404']);
const TARGETS = new Set(['preview', 'production']);

/** @typedef {'preview' | 'production'} BuildTarget */
/** @typedef {{target: BuildTarget, origin: string | null}} BuildConfig */

export function validateOrigin(value) {
  if (value == null || value === '') return null;
  // Check the input before URL normalization can remove a path or default port.
  if (typeof value !== 'string' || !/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\/?$/i.test(value)) {
    throw new Error('El dominio canónico debe ser solo un origen HTTPS público.');
  }
  let url;
  try { url = new URL(value); } catch { throw new Error('El dominio canónico debe ser un origen HTTPS válido.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' ||
      url.search || url.hash || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
      /(?:^|\.)localhost$/i.test(url.hostname)) {
    throw new Error('El dominio canónico debe ser solo HTTPS + host público, sin ruta, puerto ni credenciales.');
  }
  return url.origin;
}

export function validatePath(path, type = 'html') {
  if (type === 'plantilla_404') {
    if (path !== null) throw new Error('La 404 no tiene URL editorial.');
    return true;
  }
  if (type === 'pdf') {
    if (path !== '/Brochure.pdf') throw new Error('El PDF conserva /Brochure.pdf exactamente.');
    return true;
  }
  if (typeof path !== 'string' || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(path)) {
    throw new Error(`Ruta HTML inválida: ${path}`);
  }
  return true;
}

export function validateRegistry(entries = pages) {
  const ids = new Set(), paths = new Set(), titles = new Set(), descriptions = new Set();
  for (const page of entries) {
    if (!/^P\d{2}$/.test(page.id) || ids.has(page.id)) throw new Error(`ID duplicado o inválido: ${page.id}`);
    ids.add(page.id);
    if (!['html', 'plantilla_404', 'pdf', 'reserva'].includes(page.type)) throw new Error(`Tipo inválido: ${page.id}`);
    validatePath(page.path, page.type);
    if (page.path !== null && paths.has(page.path)) throw new Error(`Ruta duplicada: ${page.path}`);
    paths.add(page.path);
    if (typeof page.implemented !== 'boolean' || typeof page.publicationApproved !== 'boolean' || typeof page.indexable !== 'boolean') {
      throw new Error(`Estados incompletos: ${page.id}`);
    }
    if (page.publicationApproved && !page.implemented) throw new Error(`No se puede aprobar una página sin construir: ${page.id}`);
    if (!HTML_TYPES.has(page.type)) {
      if (page.title !== null || page.description !== null || page.h1 !== null || page.indexable) throw new Error(`Metadatos HTML en ${page.type}: ${page.id}`);
      if (page.type === 'reserva' && (page.implemented || page.publicationApproved)) throw new Error(`No construir reservas vacías: ${page.id}`);
      continue;
    }
    for (const [field, max] of [['title', 60], ['description', 155]]) {
      const text = page[field];
      if (field === 'description' && text === null) continue;
      if (typeof text !== 'string' || !text.trim() || text !== text.normalize('NFC') || [...text].length > max) {
        throw new Error(`${field} inválido en ${page.id}; límite editorial NFC ${max}.`);
      }
      const values = field === 'title' ? titles : descriptions;
      if (values.has(text.toLocaleLowerCase('es'))) throw new Error(`${field} duplicado: ${page.id}`);
      values.add(text.toLocaleLowerCase('es'));
    }
    if (typeof page.h1 !== 'string' || !page.h1.trim()) throw new Error(`Falta H1: ${page.id}`);
    if (page.publicationApproved && page.indexable && !page.description) throw new Error(`Descripción pendiente en ${page.id}.`);
    if ((page.id === 'P34' || page.type === 'plantilla_404') && page.indexable) throw new Error(`${page.id} debe conservar noindex.`);
  }
  for (const page of entries) {
    if (page.parentId && !ids.has(page.parentId)) throw new Error(`Padre ausente: ${page.id}`);
    for (const id of page.relatedIds ?? []) if (!ids.has(id)) throw new Error(`Relación ausente: ${page.id} -> ${id}`);
  }
  return true;
}

export function getPage(id, entries = pages) {
  const page = entries.find(entry => entry.id === id);
  if (!page) throw new Error(`Página desconocida: ${id}`);
  return page;
}

/** @returns {BuildConfig} */
export function getBuildConfig(env = process.env) {
  const target = env.RHINO_BUILD_TARGET || 'preview';
  if (!TARGETS.has(target)) throw new Error(`RHINO_BUILD_TARGET inválido: ${target}`);
  const origin = validateOrigin(env.RHINO_SITE_URL || site.canonicalOrigin);
  if (target === 'production' && !origin) throw new Error('Falta confirmar canonicalOrigin antes de generar el artefacto de producción.');
  return { target: /** @type {BuildTarget} */ (target), origin };
}

function resolveConfig(options = {}) {
  const target = options.target ?? 'preview';
  if (!TARGETS.has(target)) throw new Error(`Target inválido: ${target}`);
  const origin = validateOrigin(options.origin === undefined ? site.canonicalOrigin : options.origin);
  if (target === 'production' && !origin) throw new Error('Producción requiere el dominio canónico confirmado.');
  return { target, origin, registry: options.registry ?? pages };
}

export function isIndexable(page, config) {
  return config.target === 'production' && Boolean(config.origin) && page.type === 'html' &&
    page.implemented && page.publicationApproved && page.indexable && page.id !== 'P34';
}

/** Nombre corto para migas: la parte del title antes de la marca; si el title no la lleva, el H1. */
export function getShortName(page) {
  if (page.id === 'P01') return 'Inicio';
  const [lead] = page.title.split(/ [·|] /);
  return lead !== page.title && [...lead].length <= [...page.h1].length ? lead : page.h1;
}

export function getBreadcrumbs(page, options = {}) {
  const { registry: entries, target } = resolveConfig(options);
  if (page.id === 'P01' || page.type !== 'html') return [];
  const trail = [];
  const visited = new Set([page.id]);
  let parentId = page.parentId;
  while (parentId) {
    if (visited.has(parentId)) throw new Error(`Ciclo en breadcrumbs de ${page.id}`);
    visited.add(parentId);
    const parent = getPage(parentId, entries);
    if (parent.implemented && parent.type === 'html' && parent.indexable &&
        (target !== 'production' || parent.publicationApproved)) {
      trail.unshift({ id: parent.id, name: getShortName(parent), path: parent.path, current: false });
    }
    parentId = parent.parentId;
  }
  trail.push({ id: page.id, name: getShortName(page), path: page.path, current: true });
  return trail;
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function getGraph(page, canonical, breadcrumbs, options, entries) {
  if (!canonical) return null;
  const origin = new URL(canonical).origin;
  const orgId = `${origin}/#organization`, webId = `${origin}/#website`, pageId = `${canonical}#webpage`;
  const graph = [{
    '@type': 'Organization', '@id': orgId, name: site.name, url: `${origin}/`,
    logo: `${origin}${site.logo}`, telephone: site.telephone, email: site.email,
  }, {
    '@type': 'WebSite', '@id': webId, url: `${origin}/`, name: site.name, inLanguage: site.language,
    publisher: { '@id': orgId },
  }, {
    '@type': 'WebPage', '@id': pageId, url: canonical, name: page.title,
    ...(page.description ? { description: page.description } : {}), inLanguage: site.language,
    isPartOf: { '@id': webId }, about: { '@id': orgId },
  }];
  // Service is opt-in and must be represented by the page's visible, confirmed offer.
  if (options.service?.confirmedVisible === true) {
    if (!page.schemaCandidates?.some(type => type.startsWith('Service')) || !options.service.name?.trim()) {
      throw new Error(`Service no autorizado por la ficha o sin nombre: ${page.id}`);
    }
    graph.push({ '@type': 'Service', '@id': `${canonical}#service`, name: options.service.name,
      ...(options.service.description ? { description: options.service.description } : {}),
      url: canonical, provider: { '@id': orgId } });
  }
  if (breadcrumbs.length >= 2 && breadcrumbs.every(crumb => {
    const entry = getPage(crumb.id, entries);
    return entry.implemented && entry.publicationApproved && entry.indexable;
  })) {
    const id = `${canonical}#breadcrumbs`;
    graph[2].breadcrumb = { '@id': id };
    graph.push({ '@type': 'BreadcrumbList', '@id': id, itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem', position: index + 1, name: crumb.name, item: `${origin}${crumb.path}`,
    })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function getSeo(page, options = {}) {
  const config = resolveConfig(options);
  if (!HTML_TYPES.has(page.type)) throw new Error(`No generar HTML para ${page.type}: ${page.id}`);
  validatePath(page.path, page.type);
  if (!page.implemented) throw new Error(`Página no construida: ${page.id}`);
  if (page.publicationApproved && page.indexable && !page.description) throw new Error(`Descripción pendiente: ${page.id}`);
  const indexable = isIndexable(page, config);
  const canonical = indexable ? `${config.origin}${page.path}` : null;
  const breadcrumbs = getBreadcrumbs(page, config);
  const image = config.origin ? { ...site.socialImage, url: `${config.origin}${site.socialImage.path}` } : null;
  return {
    title: page.title, description: page.description,
    robots: indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    canonical, url: canonical, image,
    breadcrumbs, graph: getGraph(page, canonical, breadcrumbs, options, config.registry),
    language: site.language, locale: site.locale, siteName: site.name,
  };
}

export function getSitemapPages(options = {}) {
  const config = resolveConfig(options);
  validateRegistry(config.registry);
  return config.registry.filter(page => isIndexable(page, config))
    .map(page => ({ id: page.id, path: page.path, url: `${config.origin}${page.path}` }));
}

export function renderSitemap(options = {}) {
  const urls = getSitemapPages(options);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(page => `  <url><loc>${page.url}</loc></url>`).join('\n') + '\n</urlset>\n';
}

export function renderRobots(options = {}) {
  const config = resolveConfig(options);
  const hasUrls = getSitemapPages(config).length > 0;
  return '# La exclusión de previews se sirve mediante noindex legible.\nUser-agent: *\nAllow: /\n' +
    (hasUrls ? `Sitemap: ${config.origin}/sitemap.xml\n` : '');
}

validateRegistry();
