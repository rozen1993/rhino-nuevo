from pathlib import Path
from playwright.sync_api import sync_playwright
import json, math

site = Path(__file__).resolve().parents[1]
out = site / 'entrega/particulas-tres-bloques-2026-11-17'
out.mkdir(parents=True, exist_ok=True)
url = 'http://127.0.0.1:4323/'
report = {'checks': [], 'errors': [], 'external_requests': []}
fields = ['rhino-hero-particles', 'rhino-directory-particles', 'rhino-footer-particles']

def check(name, result, details=None):
    report['checks'].append({'name': name, 'pass': bool(result), 'details': details})
    if not result: print('FAIL', name, details, flush=True)

def data(page, ident):
    return page.evaluate('''id => {
      const host = document.getElementById(id);
      const p = window.pJSDom?.find(e => e.pJS.canvas.el.parentElement === host)?.pJS;
      return { state: host.dataset.particlesState, points: p?.particles.array.map(v => [v.x,v.y]) ?? [],
        count: p?.particles.array.length ?? 0, mouse: p?.interactivity.mouse, status: p?.interactivity.status,
        speed: p?.particles.move.speed, size: p?.particles.size.value };
    }''', ident)

def visit(page, ident):
    page.locator('#' + ident).evaluate("e => e.parentElement.scrollIntoView({block:'start',behavior:'instant'})")
    page.wait_for_function("id => document.getElementById(id).dataset.particlesState === 'active'", arg=ident)
    page.wait_for_timeout(180)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome')
    page = browser.new_page(viewport={'width': 1440, 'height': 990}, reduced_motion='no-preference')
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('request', lambda r: report['external_requests'].append(r.url) if not r.url.startswith(url) else None)
    page.goto(url, wait_until='networkidle')
    visit(page, fields[0])
    check('dos bloques fuera de vista no se inicializan', all(data(page, i)['count'] == 0 for i in fields[1:]))

    for ident in fields:
        visit(page, ident)
        a = data(page, ident); page.wait_for_timeout(250); b = data(page, ident)
        movement = sum(math.dist(x,y) for x,y in zip(a['points'],b['points'])) / max(1,a['count'])
        check(ident + ' movimiento visible', movement > 5, {'mean_px_250ms': movement, 'count': a['count']})
        check(ident + ' parametros del legado', a['speed'] == 2 and a['size'] == 7)
        bounds = page.locator('#'+ident).bounding_box()
        # Empty left margin in each field, below the top wave and header.
        x, y = 25, max(210, bounds['y'] + 210)
        page.mouse.move(x,y); page.wait_for_timeout(80)
        d = data(page,ident)
        check(ident + ' cursor local con scroll', d['status'] == 'mousemove' and abs(d['mouse']['pos_y'] - (y-bounds['y'])) < 1, d['mouse'])
        counts = [data(page,i)['count'] for i in fields]
        page.mouse.click(x,y)
        check(ident + ' clic agrega cuatro en este bloque', data(page,ident)['count'] == counts[fields.index(ident)] + 4)
        check(ident + ' clic no altera otros bloques', all(data(page,i)['count'] == counts[n] for n,i in enumerate(fields) if i != ident))
        control = page.locator('[data-particles-toggle][aria-controls="'+ident+'"]')
        control.focus(); page.keyboard.press('Enter'); page.wait_for_timeout(100)
        a = data(page,ident); page.wait_for_timeout(180)
        check(ident + ' pausa por teclado', a['points'] == data(page,ident)['points'] and control.get_attribute('aria-pressed') == 'false')
        check(ident + ' nombre accesible actualiza', control.get_attribute('aria-label').startswith('Activar'))
        page.keyboard.press('Enter'); page.wait_for_timeout(180)
        check(ident + ' reanuda', a['points'] != data(page,ident)['points'])

    check('una carga compartida de particles.js', page.locator('script[data-rhino-particles]').count() == 1)
    check('tres instancias sin duplicados', page.evaluate('pJSDom.length') == 3 and page.locator('[data-particles-host] canvas').count() == 3)
    a = data(page, fields[0]); page.wait_for_timeout(180)
    check('portada fuera de pantalla en pausa', a['points'] == data(page,fields[0])['points'])
    a = data(page, fields[1]); page.wait_for_timeout(180)
    check('directorio fuera de pantalla en pausa', a['points'] == data(page,fields[1])['points'])

    for ident, selector in [(fields[1], '.directory-node'), (fields[2], '.site-footer button[data-pending="Nosotros"]')]:
        visit(page,ident)
        control = page.locator(selector).first
        count = data(page,ident)['count']; control.click()
        check(ident + ' enlace de contenido funciona', page.locator('#route-dialog').is_visible())
        check(ident + ' enlace no agrega particulas', data(page,ident)['count'] == count)
        page.keyboard.press('Escape')
        check(ident + ' foco regresa', control.evaluate('e=>e===document.activeElement'))
    check('telefono y correo conservados', page.locator('.footer-contacts a').evaluate_all("es=>es.map(e=>e.getAttribute('href'))") == ['tel:+51965683542','mailto:info@rhinoaudiovisuales.com'])

    for width in [1440,768,390,320]:
        page.set_viewport_size({'width':width,'height':990 if width==1440 else 844})
        page.wait_for_timeout(220)
        for ident, name in [(fields[1],'servicios-extras'),(fields[2],'pie')]:
            visit(page,ident)
            measurements = page.locator('#'+ident).evaluate('''e=>{
              const s=e.parentElement, c=s.querySelector('[data-particles-toggle]').getBoundingClientRect();
              const targets=s.querySelectorAll('h2,.directory-copy p,.directory-node,.footer-logo,.footer-tagline,.footer-contacts,nav');
              const overlaps=[...targets].filter(t=>{const b=t.getBoundingClientRect();return c.left<b.right&&c.right>b.left&&c.top<b.bottom&&c.bottom>b.top}).map(t=>t.className);
              return { overflow:document.documentElement.scrollWidth>innerWidth, overlaps,
                canvasFits:Math.abs(e.querySelector('canvas').width-s.getBoundingClientRect().width)<2,
                controlFits:c.left>=0&&c.right<=innerWidth };
            }''')
            check(f'{name} {width} encaja sin solapamientos', not measurements['overflow'] and not measurements['overlaps'] and measurements['canvasFits'] and measurements['controlFits'], measurements)
            if width != 320:
                page.locator('#'+ident).locator('..').screenshot(path=str(out/f'{name}-{width}.png'), animations='allow')

    # All three visible together: pause only one; no global state leakage.
    page.set_viewport_size({'width':1440,'height':10000}); page.evaluate('scrollTo({top:0,behavior:"instant"})'); page.wait_for_timeout(300)
    control=page.locator('[aria-controls="'+fields[1]+'"][data-particles-toggle]')
    control.click(); a=[data(page,i) for i in fields]; page.wait_for_timeout(220); b=[data(page,i) for i in fields]
    check('pausa independiente con tres bloques visibles', a[1]['points']==b[1]['points'] and a[0]['points']!=b[0]['points'] and a[2]['points']!=b[2]['points'])

    reduced=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    reduced.on('pageerror',lambda e:report['errors'].append(str(e)))
    reduced.goto(url,wait_until='networkidle')
    reduced.locator('#pie').scroll_into_view_if_needed();reduced.wait_for_timeout(180)
    check('movimiento reducido no carga libreria ni canvas', reduced.locator('script[data-rhino-particles]').count()==0 and reduced.locator('[data-particles-host] canvas').count()==0)
    reduced.locator('[aria-controls="'+fields[2]+'"][data-particles-toggle]').click()
    reduced.wait_for_function("document.getElementById('rhino-footer-particles').dataset.particlesState==='active'")
    a=data(reduced,fields[2]);reduced.wait_for_timeout(200)
    check('activacion voluntaria solo en pie', a['points']!=data(reduced,fields[2])['points'] and reduced.locator('[data-particles-host] canvas').count()==1)
    browser.close()

check('sin errores JavaScript', not report['errors'], report['errors'])
check('sin peticiones externas', not report['external_requests'], report['external_requests'])
(out/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Checks',len(report['checks']),'Failures',sum(not c['pass'] for c in report['checks']),flush=True)
assert all(c['pass'] for c in report['checks'])
