from pathlib import Path
from playwright.sync_api import sync_playwright
import json

site=Path(__file__).resolve().parents[1]
out=site/'entrega/menu-legado-2026-11-17'
out.mkdir(parents=True,exist_ok=True)
url='http://127.0.0.1:4323/'
report={'checks':[],'errors':[],'external_requests':[]}
def check(name,result,details=None):
    report['checks'].append({'name':name,'pass':bool(result),'details':details})
    if not result:print('FAIL',name,details,flush=True)
def opened(page):
    page.locator('.menu-toggle').click()
    page.wait_for_function("document.querySelector('#site-menu').open && document.querySelector('#site-menu').classList.contains('is-open')")
    page.wait_for_timeout(750)
def closed(page):
    page.wait_for_function("!document.querySelector('#site-menu').open")

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    page=browser.new_page(viewport={'width':1440,'height':990},reduced_motion='no-preference')
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('request',lambda r:report['external_requests'].append(r.url) if not r.url.startswith(url) else None)
    page.goto(url,wait_until='networkidle')
    check('menu inicialmente cerrado',not page.locator('#site-menu').evaluate('e=>e.open'))
    check('boton de escritorio visible',page.locator('.menu-toggle').is_visible())
    check('opciones vigentes',page.locator('#site-menu nav li').all_text_contents()==['Inicio','Servicios','Portafolio','Nosotros','Contacto'])
    page.locator('.menu-toggle').click();page.wait_for_timeout(160)
    clip_a=page.locator('#site-menu').evaluate('e=>getComputedStyle(e).clipPath')
    page.screenshot(path=str(out/'apertura-1440.png'))
    page.wait_for_timeout(650)
    clip_b=page.locator('#site-menu').evaluate('e=>getComputedStyle(e).clipPath')
    check('apertura circular animada',clip_a!=clip_b and clip_b.startswith('circle('),{'inicio':clip_a,'final':clip_b})
    check('foco inicial en cerrar',page.locator('.menu-close').evaluate('e=>e===document.activeElement'))
    page.keyboard.press('Shift+Tab')
    check('foco inverso contenido',page.locator('#site-menu a[href="#consulta"]').evaluate('e=>e===document.activeElement'))
    page.keyboard.press('Tab')
    check('foco contenido',page.locator('.menu-close').evaluate('e=>e===document.activeElement'))
    scroll=page.evaluate('scrollY');page.mouse.wheel(0,600);page.wait_for_timeout(180)
    check('scroll del fondo bloqueado',page.evaluate('scrollY')==scroll)
    page.keyboard.press('Escape');closed(page)
    check('Escape devuelve foco y libera scroll',page.locator('.menu-toggle').evaluate('e=>e===document.activeElement') and not page.locator('body').evaluate('e=>e.classList.contains("menu-open")'))
    opened(page);page.locator('.menu-close').click();closed(page)
    check('boton cerrar funciona',page.locator('.menu-toggle').get_attribute('aria-expanded')=='false')
    for dest in ['servicios','proyectos','consulta','inicio']:
        page.evaluate('scrollTo({top:0,behavior:"instant"})')
        opened(page);page.locator(f'#site-menu a[href="#{dest}"]').click();closed(page)
        page.wait_for_timeout(1000)
        check('ancla '+dest,page.evaluate('location.hash')=='#'+dest and page.locator('#'+dest).evaluate('e=>e===document.activeElement'))
    page.evaluate('scrollTo({top:0,behavior:"instant"})');opened(page)
    page.locator('#site-menu button[data-pending]').click()
    check('Nosotros abre aviso sin menu superpuesto',page.locator('#route-dialog').is_visible() and not page.locator('#site-menu').evaluate('e=>e.open'))
    page.keyboard.press('Escape');page.wait_for_timeout(120)
    check('aviso devuelve foco al menu',page.locator('.menu-toggle').evaluate('e=>e===document.activeElement') and not page.locator('body').evaluate('e=>e.classList.contains("menu-open")||e.classList.contains("dialog-open")'))
    # Existing video modal still operates after the navigation refactor.
    page.locator('.hero-play').click()
    check('video mantiene apertura',page.locator('#video-dialog').is_visible())
    page.keyboard.press('Escape');page.wait_for_timeout(120)
    for width,height in [(1440,990),(1050,844),(768,844),(390,844),(320,568),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate('scrollTo({top:0,behavior:"instant"})');page.wait_for_timeout(200)
        measurements=page.locator('.menu-toggle').evaluate('''e=>{const a=e.getBoundingClientRect(),b=document.querySelector('.hero-motion-control').getBoundingClientRect();return{fits:a.left>=0&&a.right<=innerWidth&&a.top>=0,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,overflow:document.documentElement.scrollWidth>innerWidth}}''')
        check(f'cabecera {width} sin cortes ni solapamiento',measurements['fits'] and not measurements['overlap'] and not measurements['overflow'],measurements)
        if width in [1440,768,390]:page.screenshot(path=str(out/f'cabecera-{width}.png'))
        opened(page)
        bounds=page.locator('#site-menu').evaluate('''e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,iw:innerWidth,ih:innerHeight,overflow:e.scrollWidth>e.clientWidth}}''')
        check(f'menu {width} pantalla completa',bounds['x']==0 and bounds['y']==0 and abs(bounds['w']-bounds['iw'])<=1 and abs(bounds['h']-bounds['ih'])<=1 and not bounds['overflow'],bounds)
        page.locator('#site-menu a[href="#consulta"]').focus()
        check(f'menu {width} ultimo enlace alcanzable',page.locator('#site-menu a[href="#consulta"]').evaluate('e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight}'))
        check(f'menu {width} cierre visible al navegar con teclado',page.locator('.menu-close').evaluate('e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth}'))
        if width in [1440,768,390]:
            page.evaluate('document.activeElement.blur()')
            item=page.locator('#site-menu a[href="#servicios"]')
            item.hover();page.wait_for_timeout(300)
            check(f'menu {width} resaltado degradado',item.evaluate('e=>getComputedStyle(e).color')=='rgb(255, 255, 255)' and item.evaluate('e=>getComputedStyle(e,"::before").transform')=='matrix(1, 0, 0, 1, 0, 0)')
            page.screenshot(path=str(out/f'menu-{width}.png'))
        page.keyboard.press('Escape');closed(page)
    # A preference change and rapid Escape must not leave a modal or lock behind.
    page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo({top:0,behavior:"instant"})')
    page.locator('.menu-toggle').click();page.keyboard.press('Escape');closed(page)
    check('cierre durante apertura limpia estado',not page.locator('body').evaluate('e=>e.classList.contains("menu-open")'))
    page.emulate_media(reduced_motion='reduce');page.locator('.menu-toggle').click()
    check('movimiento reducido sin transicion',page.locator('#site-menu').evaluate('e=>getComputedStyle(e).transitionDuration')=='0s')
    page.keyboard.press('Escape');closed(page)
    # Disabled JavaScript keeps basic same-page navigation reachable.
    nojs=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
    nojs.goto(url,wait_until='networkidle')
    check('sin JS conserva navegacion basica',nojs.locator('.nojs-nav').is_visible() and not nojs.locator('.menu-toggle').is_visible())
    browser.close()
check('sin errores JavaScript',not report['errors'],report['errors'])
check('sin conexiones externas',not report['external_requests'],report['external_requests'])
(out/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Checks',len(report['checks']),'Failures',sum(not c['pass'] for c in report['checks']),flush=True)
assert all(c['pass'] for c in report['checks'])
