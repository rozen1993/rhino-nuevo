import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { site } from '../src/config/site.mjs';
import {
  pages, getPage, validateOrigin, validatePath, validateRegistry, getBuildConfig,
  getSeo, getBreadcrumbs, getSitemapPages, renderSitemap, renderRobots, serializeJsonLd,
  getShortName,
} from '../src/lib/seo.mjs';

const origin = 'https://rhino.example'; // Test fixture, never a production decision.
const clone = () => structuredClone(pages);
const approved = (entries, id) => Object.assign(getPage(id, entries), { implemented: true, publicationApproved: true });

test('37 entries preserve exact F6 metadata and distinguish HTML/reserves/404/PDF', () => {
  const source = JSON.parse(readFileSync(new URL('../../docs/seo/fase6-2026-11-04/fichas-37.json', import.meta.url), 'utf8'));
  assert.equal(pages.length, 37);
  assert.equal(pages.filter(p => p.type === 'html').length, 33);
  assert.equal(pages.filter(p => p.type === 'reserva').length, 2);
  assert.deepEqual(pages.filter(p => p.implemented).map(p => p.id),
    ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P10', 'P12', 'P14', 'P15', 'P16', 'P17', 'P18', 'P21', 'P23', 'P36']);
  assert(pages.every(p => !p.publicationApproved));
  for (const page of pages) {
    const row = source.rows.find(row => row.id === page.id);
    assert.equal(page.path, row.url);
    for (const field of ['title', 'h1', 'description']) assert.equal(page[field], row.metadatos[field].valor);
  }
  assert.equal(getPage('P37').path, '/Brochure.pdf');
  assert.equal(getPage('P36').path, null);
  assert.throws(() => getPage('P99'), /desconocida/);
});

test('public HTTPS origins reject credentials, paths, ports, injection and localhost', () => {
  assert.equal(validateOrigin(null), null);
  assert.equal(validateOrigin('https://rhino.example/'), origin);
  for (const value of ['http://rhino.example', 'https://user:secret@rhino.example', 'https://rhino.example:1234', 'https://rhino.example:443',
    'https://rhino.example/service', 'https://rhino.example?utm_source=x', 'https://rhino.example#hash',
    'https://localhost', 'https://127.0.0.1', 'javascript:alert(1)', '//rhino.example',
    'https://rhino.example/<script>', 'https://rhino.example/../service/', 'https://rhino.example/a/..', 'https://-rhino.example']) {
    assert.throws(() => validateOrigin(value), undefined, value);
  }
});

test('routes cannot normalize unsafe input into another destination', () => {
  for (const path of ['//evil.example/', '/a/../', '/%2e%2e/', '/servicios', '/servicios/?x=1', '/a/#b', '/a\\b/', '/Brochure.pdf/']) {
    assert.throws(() => validatePath(path));
  }
  assert(validatePath('/servicios/video-corporativo/'));
  assert(validatePath('/Brochure.pdf', 'pdf'));
  assert.throws(() => validatePath('/brochure.pdf', 'pdf'));
  assert.throws(() => validatePath('/404/', 'plantilla_404'));
});

test('preview is default; crawler can read its noindex and sitemap remains empty', () => {
  assert.equal(getBuildConfig({}).target, 'preview');
  assert.deepEqual(getBuildConfig({ RHINO_BUILD_TARGET: 'production', RHINO_SITE_URL: origin }), { target: 'production', origin });
  assert.throws(() => getBuildConfig({ RHINO_BUILD_TARGET: 'anything' }), /inválido/);
  const preview = getSeo(getPage('P01'), { origin, target: 'preview' });
  assert.equal(preview.robots, 'noindex, follow');
  assert.equal(preview.canonical, null);
  assert.equal(preview.graph, null);
  assert.equal(preview.image.url, origin + site.socialImage.path);
  const withoutHost = getSeo(getPage('P01'), { origin: null });
  assert.equal(withoutHost.image, null);
  assert(!renderRobots().includes('Disallow: /'));
  assert(!renderRobots().includes('Sitemap:'));
  assert.equal(getSitemapPages().length, 0);
  assert(!renderSitemap().includes('<loc>'));
  assert.throws(() => getSeo(getPage('P01'), { target: 'production', origin: null }), /dominio/);
});

test('production indexes only built approved HTML and emits matching URLs and schema', () => {
  const entries = clone();
  const home = approved(entries, 'P01');
  const config = { origin, target: 'production', registry: entries };
  const seo = getSeo(home, config);
  assert.equal(seo.canonical, origin + '/');
  assert.equal(seo.url, seo.canonical);
  assert.match(seo.robots, /^index, follow/);
  assert.deepEqual(getSitemapPages(config).map(p => p.id), ['P01']);
  assert(renderSitemap(config).includes(`<loc>${seo.canonical}</loc>`));
  assert(renderRobots(config).includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.deepEqual(seo.graph['@graph'].map(p => p['@type']), ['Organization', 'WebSite', 'WebPage']);
  assert.equal(seo.graph['@graph'][0].telephone, '+51965683542');
  assert(!JSON.stringify(seo.graph).match(/aggregateRating|Review|LocalBusiness|ProfessionalService|openingHours|address|price|VideoObject/));
  assert.equal(getSeo(getPage('P01'), { origin, target: 'production' }).canonical, null);
  assert.equal(getSitemapPages({ origin, target: 'production' }).length, 0);
});

test('thanks, error, reserves and PDF cannot enter HTML sitemap/canonical by inheritance', () => {
  const entries = clone();
  const thanks = approved(entries, 'P34');
  const error = approved(entries, 'P36');
  const config = { origin, target: 'production', registry: entries };
  for (const page of [thanks, error]) {
    const seo = getSeo(page, config);
    assert.equal(seo.canonical, null);
    assert.equal(seo.graph, null);
    assert.equal(seo.robots, 'noindex, follow');
  }
  assert.deepEqual(getSitemapPages(config), []);
  for (const id of ['P25', 'P26', 'P37']) assert.throws(() => getSeo(getPage(id), config), /No generar HTML/);
  assert.throws(() => getSeo(getPage('P09'), config), /no construida/);
});

test('metadata validation detects duplicates, accidental approvals and unresolved case descriptions', () => {
  let entries = clone();
  getPage('P02', entries).title = getPage('P01').title;
  assert.throws(() => validateRegistry(entries), /title duplicado/);
  entries = clone();
  getPage('P02', entries).description = getPage('P01').description;
  assert.throws(() => validateRegistry(entries), /description duplicado/);
  entries = clone();
  getPage('P02', entries).title = 'x'.repeat(61);
  assert.throws(() => validateRegistry(entries), /límite editorial/);
  entries = clone();
  getPage('P09', entries).publicationApproved = true;
  assert.throws(() => validateRegistry(entries), /sin construir/);
  entries = clone();
  approved(entries, 'P28');
  assert.throws(() => validateRegistry(entries), /Descripción pendiente/);
  entries = clone();
  getPage('P25', entries).implemented = true;
  assert.throws(() => validateRegistry(entries), /reservas/);
  entries = clone();
  getPage('P34', entries).indexable = true;
  assert.throws(() => validateRegistry(entries), /noindex/);
});

test('breadcrumbs only link available parents and structured breadcrumbs match visible route', () => {
  const entries = clone();
  approved(entries, 'P01');
  const service = approved(entries, 'P03');
  const config = { origin, target: 'production', registry: entries };
  assert.deepEqual(getBreadcrumbs(service, config).map(c => c.id), ['P01', 'P03']);
  approved(entries, 'P02');
  const breadcrumbs = getBreadcrumbs(service, config);
  assert.deepEqual(breadcrumbs.map(c => c.id), ['P01', 'P02', 'P03']);
  const graph = getSeo(service, config).graph['@graph'];
  const schema = graph.find(item => item['@type'] === 'BreadcrumbList');
  assert.deepEqual(schema.itemListElement.map(item => item.item), breadcrumbs.map(c => origin + c.path));
  assert.deepEqual(schema.itemListElement.map(item => item.name), breadcrumbs.map(c => c.name));
  assert.deepEqual(breadcrumbs.map(c => c.name), ['Inicio', 'Servicios audiovisuales', 'Producción audiovisual']);
  getPage('P02', entries).parentId = 'P03';
  assert.throws(() => getBreadcrumbs(service, config), /Ciclo/);
});

test('short names drop the brand from the title or fall back to the H1', () => {
  assert.equal(getShortName(getPage('P01')), 'Inicio');
  assert.equal(getShortName(getPage('P04')), 'Video corporativo');
  assert.equal(getShortName(getPage('P19')), 'Show Infantil Navideño');
  assert.equal(getShortName(getPage('P05')), getPage('P05').h1);
  for (const page of pages.filter(p => p.type === 'html')) {
    const name = getShortName(page);
    assert(name.trim() && !/Rhino Audiovisuales$/.test(name) || page.id === 'P32' || page.id === 'P27', `${page.id}: ${name}`);
  }
});

test('Service requires explicit visible evidence and ignores unsupported claims', () => {
  const entries = clone();
  const servicePage = approved(entries, 'P03');
  const config = { origin, target: 'production', registry: entries };
  assert(!getSeo(servicePage, config).graph['@graph'].some(item => item['@type'] === 'Service'));
  const service = getSeo(servicePage, { ...config, service: { confirmedVisible: true, name: servicePage.h1, price: 12 } }).graph['@graph'].find(item => item['@type'] === 'Service');
  assert(service);
  assert(!('price' in service));
  assert.equal(service.provider['@id'], origin + '/#organization');
  const home = approved(entries, 'P01');
  assert.throws(() => getSeo(home, { ...config, service: { confirmedVisible: true, name: 'test' } }), /no autorizado/);
});

test('JSON-LD cannot close its script element and preserves its literal content', () => {
  const data = { name: '</script><script>alert("x")</script>', another: 'a&b\u2028\u2029' };
  const encoded = serializeJsonLd(data);
  assert(!encoded.includes('<'));
  assert(!encoded.includes('&'));
  assert.deepEqual(JSON.parse(encoded), data);
});
