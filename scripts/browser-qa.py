from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,sys,tempfile,math

SITE=Path(__file__).resolve().parents[1]
OUTPUT=SITE/'entrega'
URL='http://127.0.0.1:4323/'
report={'checks':[],'errors':[],'http_errors':[],'external_requests':[],'viewports':[]}
home=json.loads((SITE/'src/data/home.json').read_text(encoding='utf-8'))
normalize=lambda value:re.sub(r'\s+',' ',value).strip()

def check(name,passed,details=None):
    report['checks'].append({'name':name,'pass':bool(passed),'details':details})
    if not passed: print('FAIL',name,details)

def listen(page):
    page.on('pageerror',lambda error:report['errors'].append(str(error)))
    page.on('response',lambda response:report['http_errors'].append([response.status,response.url]) if response.status>=400 else None)
    page.on('request',lambda request:report['external_requests'].append(request.url) if not request.url.startswith(URL) else None)

with sync_playwright() as engine:
    browser=engine.chromium.launch(channel='chrome')
    for width in [1440,1280,1051,1050,1024,900,881,880,768,651,650,600,390,320]:
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        listen(page)
        page.goto(URL,wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        check(f'{width} identidad V3',page.locator('html').get_attribute('data-build')=='rhino-p01-v3')
        overflow=page.evaluate("""() => ({
          viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          outside:[...document.querySelectorAll('h1,h2,h3,p,button,a')].filter(element=>{
            if(element.classList.contains('skip-link')) return false;
            const box=element.getBoundingClientRect();
            return box.width>1 && (box.left< -1 || box.right>innerWidth+1);
          }).map(element=>element.textContent.trim().slice(0,60))
        })""")
        check(f'{width} sin desbordamiento',overflow['scroll']==width and not overflow['outside'],overflow)
        check(f'{width} servicios de eventos visibles',page.locator('.event-row').count()==3 and all(page.locator('.event-row p').nth(index).is_visible() for index in range(3)))
        for index in range(3):
            trigger=page.locator('.panel-trigger').nth(index)
            trigger.focus()
            page.keyboard.press('Enter')
            image=page.locator('.service-panel.is-active img')
            image.scroll_into_view_if_needed()
            image.wait_for(state='visible')
            page.wait_for_timeout(80)
            check(f'{width} panel {index} teclado',trigger.get_attribute('aria-expanded')=='true' and image.evaluate('(image)=>image.complete&&image.naturalWidth>0'))
            collisions=page.locator('.service-panel.is-active').evaluate("""element=>{
                const title=element.querySelector('.panel-trigger').getBoundingClientRect();
                const copy=element.querySelector('.service-copy p').getBoundingClientRect();
                return title.bottom>copy.top+1 && title.left<copy.right && title.right>copy.left;
            }""")
            check(f'{width} panel {index} sin colision',not collisions)
        page.locator('.panel-trigger').first.click()
        for index,asset in enumerate(['tasting','podcast','catering']):
            button=page.locator('.event-select').nth(index)
            button.focus()
            page.keyboard.press('Space')
            page.wait_for_timeout(100)
            check(f'{width} foto evento {asset}',button.get_attribute('aria-pressed')=='true' and asset in page.locator('#event-image').get_attribute('src') and page.locator('#event-image').evaluate('(image)=>image.complete&&image.naturalWidth>0'))
        page.locator('.event-select').first.click()
        if width in [1440,768,390]:
            for position in range(0,int(page.evaluate('document.documentElement.scrollHeight')),650):
                page.evaluate('(y)=>scrollTo(0,y)',position)
                page.wait_for_timeout(50)
            broken=page.locator('img').evaluate_all('images=>images.filter(image=>image.getBoundingClientRect().width>0&&(!image.complete||!image.naturalWidth)).map(image=>image.src)')
            check(f'{width} imagenes cargadas',not broken,broken)
            check(f'{width} nueve nodos',page.locator('.directory-node').count()==9)
            check(f'{width} sin difuminados',page.locator('body *').evaluate_all("""elements=>elements.every(element=>['', '::before', '::after'].every(pseudo=>{
                const style=getComputedStyle(element,pseudo||null);
                return !style.filter.includes('blur(') && !style.backdropFilter.includes('blur(') && style.textShadow==='none';
            }))"""))
            for selector,dialog in [('.hero-play','#video-dialog'),('.directory-node','#route-dialog')]:
                control=page.locator(selector).first
                control.click()
                check(f'{width} dialogo {dialog}',page.locator(dialog).is_visible())
                close=page.locator(dialog+' .dialog-close')
                check(f'{width} foco inicial {dialog}',close.evaluate('(element)=>element===document.activeElement'))
                page.keyboard.press('Shift+Tab')
                check(f'{width} foco contenido {dialog}',page.evaluate('(selector)=>!!document.activeElement.closest(selector)',dialog))
                page.keyboard.press('Escape')
                check(f'{width} Escape devuelve foco {dialog}',not page.locator(dialog).is_visible() and control.evaluate('(element)=>element===document.activeElement'))
            page.locator('.project-photo').first.click()
            page.keyboard.press('Escape')
            check(f'{width} foto devuelve foco visible',page.locator('.project .inline-action').first.evaluate('(element)=>element===document.activeElement'))
            if width<1051:
                page.locator('.menu-toggle').click()
                check(f'{width} menu abre',page.locator('#mobile-nav').is_visible())
                page.locator('#mobile-nav [data-pending]').click()
                page.keyboard.press('Escape')
                check(f'{width} menu dialogo foco',page.locator('.menu-toggle').evaluate('(element)=>element===document.activeElement'))
                page.locator('.menu-toggle').click()
                page.keyboard.press('Escape')
                check(f'{width} menu Escape',not page.locator('#mobile-nav').is_visible())
            text=normalize(page.locator('body').inner_text())
            expected=[home['intro']]+[paragraph for section in home['sections'] for paragraph in section['paragraphs']]+home['sections'][1]['items']
            check(f'{width} texto P01 completo',all(normalize(paragraph) in text for paragraph in expected))
            check(f'{width} P33 visible',page.get_by_role('button',name='Cuéntanos tu proyecto',exact=True).count()==1)
            page.emulate_media(reduced_motion='reduce')
            check(f'{width} movimiento reducido',page.locator('.orbit-icon').first.evaluate('(element)=>getComputedStyle(element).animationName')=='none')
            report['viewports'].append({'width':width,'height':page.evaluate('document.documentElement.scrollHeight')})
        page.close()
    page=browser.new_page()
    page.goto(URL,wait_until='networkidle')
    check('title V2',page.title()==home['metadatos']['title']['valor'])
    check('description V2',page.locator('meta[name="description"]').get_attribute('content')==home['metadatos']['description']['valor'])
    check('unico H1',page.locator('h1').count()==1 and normalize(page.locator('h1').inner_text()).lower()==home['h1'].lower())
    check('noindex',page.locator('meta[name="robots"]').get_attribute('content')=='noindex, nofollow')
    check('sin canonical',page.locator('link[rel="canonical"]').count()==0)
    check('produccion antes de eventos',page.locator('#servicios').bounding_box()['y']<page.locator('#eventos').bounding_box()['y'])
    check('contactos',page.locator('a[href^="https://wa.me/51965683542"]').count()>=1 and page.locator('a[href="mailto:info@rhinoaudiovisuales.com"]').count()==1)
    check('anclas',page.locator('a[href^="#"]').evaluate_all('links=>links.every(link=>document.getElementById(link.getAttribute("href").slice(1)))'))
    check('rutas pendientes identificadas',page.locator('[data-pending][data-path]').count()>10 and page.request.get(URL+'servicios/').status==404)
    page.close()
    context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
    page=context.new_page()
    page.goto(URL,wait_until='networkidle')
    check('sin JS produccion visible',page.locator('.service-copy').count()==3 and all(page.locator('.service-copy').nth(index).is_visible() for index in range(3)))
    check('sin JS eventos visibles',page.locator('.event-row p').count()==3 and all(page.locator('.event-row p').nth(index).is_visible() for index in range(3)))
    check('sin JS navegacion',page.locator('.desktop-nav').is_visible())
    check('sin JS videos disponibles',page.locator('a[data-video]:not([aria-hidden])').count()==5)
    context.close()
    # Verify consent and teardown without loading an external service during automated QA.
    page=browser.new_page()
    page.route('https://www.youtube-nocookie.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body='<p>QA external transport fixture</p>'))
    page.goto(URL,wait_until='networkidle')
    page.locator('.hero-play').click()
    check('video espera accion cargar',page.locator('#video-dialog iframe').count()==0)
    page.locator('#video-load').click()
    check('video construye destino correcto',page.locator('#video-dialog iframe').get_attribute('src')=='https://www.youtube-nocookie.com/embed/jGBn4_dsxNA?rel=0')
    page.locator('#video-dialog .dialog-close').click()
    check('video se descarga al cerrar',page.locator('#video-dialog iframe').count()==0)
    page.close()
    browser.close()
    with tempfile.TemporaryDirectory(prefix='rhino-v3-zoom-') as folder:
        preferences=Path(folder)/'Default'
        preferences.mkdir()
        (preferences/'Preferences').write_text(json.dumps({'partition':{'default_zoom_level':{'x':math.log(2)/math.log(1.2)}}}))
        context=engine.chromium.launch_persistent_context(folder,channel='chrome',headless=True,no_viewport=True,args=['--window-size=1440,1000'])
        page=context.pages[0]
        page.goto(URL,wait_until='networkidle')
        zoom=page.evaluate('({width:innerWidth,dpr:devicePixelRatio,scroll:document.documentElement.scrollWidth})')
        check('zoom nativo 200%',zoom['dpr']==2 and zoom['width']<=720 and zoom['width']==zoom['scroll'],zoom)
        page.screenshot(path=str(OUTPUT/'zoom-200.png'),full_page=True)
        context.close()
check('sin errores JS',not report['errors'],report['errors'])
check('sin errores HTTP',not report['http_errors'],report['http_errors'])
check('sin conexiones externas antes de cargar video',not report['external_requests'],report['external_requests'])
report['limits']='Chrome local. Transporte externo del reproductor comprobado con fixture, reproduccion real pendiente. No se envian mensajes.'
(OUTPUT/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
failures=[item for item in report['checks'] if not item['pass']]
print(json.dumps({'checks':len(report['checks']),'failures':failures},ensure_ascii=False,indent=2))
sys.exit(1 if failures else 0)
