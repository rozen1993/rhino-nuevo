import {readFileSync,readdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('dist/index.html','utf8');
const notFound=readFileSync('dist/404.html','utf8');
const home=JSON.parse(readFileSync('src/data/home.json','utf8'));
const head=html.slice(0,html.indexOf('</head>'));
assert.equal((html.match(/<h1\b/g)||[]).length,1);
assert(html.includes(`<title>${home.metadatos.title.valor}</title>`));
// Preview: noindex legible por el rastreador, sin canonical, sitemap sin URLs (contrato F6 y src/lib/seo.mjs).
for(const page of [html,notFound]){
  assert(page.includes('<meta name="robots" content="noindex, follow">'),'robots del preview');
  assert(!/<link[^>]+rel="canonical"/.test(page),'canonical en preview');
  assert.equal((page.match(/<meta charset=/g)||[]).length,1,'charset duplicado');
  assert.equal((page.match(/name="viewport"/g)||[]).length,1,'viewport duplicado');
}
assert(!/googletagmanager|google-analytics|gtag\(|ProfessionalService/.test(html));
assert(!/\[(?:PENDIENTE|NOTA EDITORIAL|ESPACIO)/.test(html),'Marcador editorial en la home');
assert(!readFileSync('dist/sitemap.xml','utf8').includes('<loc>'),'sitemap del preview con URLs');
assert(!readFileSync('dist/robots.txt','utf8').includes('Disallow: /'),'robots.txt bloquea el rastreo');
assert.deepEqual(readdirSync('dist').filter(x=>x.endsWith('.html')).sort(),['404.html','google80f6e07cd88e4276.html','index.html']);
// Iconos, imagen social y logo del schema presentes
for(const file of ['favicon.ico','apple-touch-icon.png','media/icon-192.png','media/og-rhino.png','media/logo-rhino-cuadrado-512.png'])assert(existsSync('dist/'+file),`Falta ${file}`);
assert(head.includes('href="/favicon.ico"')&&head.includes('rel="apple-touch-icon"'));
// Encabezados sin texto auxiliar
for(const [,text] of html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gs)){const t=text.replace(/<[^>]+>/g,'');assert(!/mostrar detalle|[^\s\d]\d{2}$/.test(t.trim()),`Encabezado con texto auxiliar: ${t.trim()}`);}
// Páginas interiores generadas: todas las HTML del registro marcadas como construidas
const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const registry=JSON.parse(readFileSync('src/data/page-registry.json','utf8'));
const interior=registry.filter(p=>p.type==='html'&&p.implemented&&p.path!=='/');
for(const page of interior){
  const file='dist'+page.path+'index.html';
  assert(existsSync(file),`${page.id}: falta ${file}`);
  const doc=readFileSync(file,'utf8');
  assert.equal((doc.match(/<h1\b/g)||[]).length,1,`${page.id} debe tener un H1`);
  assert(doc.includes(`<title>${escape(page.title)}</title>`),`${page.id}: title distinto del registro`);
  assert(doc.includes('<meta name="robots" content="noindex, follow">')&&!/rel="canonical"/.test(doc),`${page.id}: robots/canonical del preview`);
  assert(!/\[(?:PENDIENTE|NOTA EDITORIAL|ESPACIO)/.test(doc),`${page.id}: marcador editorial`);
  assert(doc.includes('aria-label="Ruta de navegación"'),`${page.id}: sin migas visibles`);
  assert.equal((doc.match(/<meta charset=/g)||[]).length,1,`${page.id}: charset duplicado`);
  for(const [,src] of doc.matchAll(/(?:src|href)="(\/[^"#?]+)"/g))assert(existsSync('dist'+src)||existsSync('dist'+src+'index.html'),`${page.id}: recurso ausente ${src}`);
}
assert(html.includes('href="/servicios/cobertura-de-eventos/"'),'La home no enlaza P05');
// P37: el brochure conserva nombre y ruta exactos (contrato F6)
assert(existsSync('dist/Brochure.pdf')&&readFileSync('dist/Brochure.pdf').subarray(0,5).toString()==='%PDF-','Falta /Brochure.pdf');
const sources=[...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(x=>x[1]);
for(const source of sources)assert(existsSync('dist'+source),`Recurso ausente ${source}`);
assert(home.metadatos.title.valor.length<=60&&home.metadatos.description.valor.length<=155);
console.log(`Build verificado: P01, 404 y ${interior.length} páginas interiores;`+'  noindex de preview, sin duplicados en el head, iconos e imagen social, encabezados limpios, recursos locales y sin tracking.');
