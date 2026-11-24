from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, hashlib

site=Path(__file__).resolve().parents[1]
out=site/'entrega/ajuste-intro-2026-11-17'
out.mkdir(parents=True,exist_ok=True)
url='http://127.0.0.1:4323/'
report={'checks':[],'errors':[],'http_errors':[],'external':[],'viewports':[],'axe':[]}
def check(name,value,detail=None):
    report['checks'].append({'name':name,'pass':bool(value),'detail':detail})
    if not value:print('FAIL',name,detail)
def listen(page):
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('response',lambda r:report['http_errors'].append([r.status,r.url]) if r.status>=400 else None)
    page.on('request',lambda r:report['external'].append(r.url) if not r.url.startswith(url) else None)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    for width in [1440,1280,1051,1024,900,881,880,768,651,650,390,320]:
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        listen(page)
        page.goto(url,wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        check(f'{width} orden',page.locator('main > section').evaluate_all('(es)=>es.slice(0,3).map(e=>e.id).join(",")')=='inicio,presentacion,servicios')
        check(f'{width} no canvas reducido',page.locator('#rhino-hero-particles canvas').count()==0)
        check(f'{width} logos a color',page.locator('.brand-strip img').evaluate_all('(es)=>es.every(e=>getComputedStyle(e).filter==="none"&&getComputedStyle(e).opacity==="1")'))
        check(f'{width} produccion primero',page.locator('#presentacion [data-pending]').count()==3)
        for i in range(3):
            b=page.locator('.panel-trigger').nth(i);b.focus();page.keyboard.press('Enter')
            im=page.locator('.service-panel.is-active img');im.scroll_into_view_if_needed()
            page.wait_for_timeout(150)
            check(f'{width} panel {i} teclado',b.get_attribute('aria-expanded')=='true')
            check(f'{width} panel {i} imagen',im.evaluate('(e)=>e.complete&&e.naturalWidth>0'))
            overlap=page.locator('.service-panel.is-active').evaluate('(e)=>{const a=e.querySelector(".panel-heading").getBoundingClientRect(),b=e.querySelector(".service-copy").getBoundingClientRect();return a.bottom>b.top+1&&a.right>b.left&&a.left<b.right}')
            check(f'{width} panel {i} sin solapamiento',not overlap)
        page.locator('.panel-trigger').first.click()
        for y in range(0,page.evaluate('document.documentElement.scrollHeight'),700):
            page.evaluate('(y)=>scrollTo(0,y)',y);page.wait_for_timeout(40)
        page.evaluate('scrollTo(0,0)')
        o=page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
        check(f'{width} sin desborde',o['width']==o['scroll'],o)
        check(f'{width} imagenes cargadas',page.locator('main img').evaluate_all('(es)=>es.every(e=>e.complete&&e.naturalWidth>0)'))
        report['viewports'].append({'width':width,'height':page.evaluate('document.documentElement.scrollHeight')})
        if width in [1440,768,390]:
            page.screenshot(path=str(out/f'home-{width}.png'),full_page=True)
            page.locator('#presentacion').screenshot(path=str(out/f'presentacion-{width}.png'))
            page.locator('#servicios').screenshot(path=str(out/f'servicios-{width}.png'))
            page.add_script_tag(path=str(site/'scripts/axe.min.js'))
            axe=page.evaluate('async()=>{const r=await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa"]}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}')
            report['axe'].append({'width':width,'violations':axe});check(f'{width} axe',not axe,axe)
        page.close()
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='no-preference')
    listen(page);page.goto(url,wait_until='networkidle')
    page.wait_for_function('document.querySelector("#rhino-hero-particles").dataset.particlesState==="active"')
    getxy='()=>window.pJSDom[0].pJS.particles.array.map(p=>[p.x,p.y])'
    first=page.evaluate(getxy);page.wait_for_timeout(350);second=page.evaluate(getxy)
    check('particles movimiento real',first!=second)
    expected=page.evaluate('pJSDom[0].pJS.canvas.el.width*pJSDom[0].pJS.canvas.el.height/10000')
    check('particles densidad desktop',abs(len(second)-expected)<=1)
    page.screenshot(path=str(out/'portada-animada-1440.png'))
    page.locator('#servicios').scroll_into_view_if_needed();page.wait_for_timeout(300)
    check('particles pausa fuera de vista',page.locator('#rhino-hero-particles').get_attribute('data-particles-state')=='paused')
    first=page.evaluate(getxy);page.wait_for_timeout(300);check('particles posiciones congeladas',first==page.evaluate(getxy))
    page.evaluate('scrollTo(0,0)');page.wait_for_timeout(300)
    check('particles reanudacion',page.locator('#rhino-hero-particles').get_attribute('data-particles-state')=='active')
    page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(200)
    check('particles cambio a reducido',page.locator('#rhino-hero-particles').get_attribute('data-particles-state')=='reduced-motion')
    first=page.evaluate(getxy);page.wait_for_timeout(300);check('particles reducido detiene',first==page.evaluate(getxy))
    page.set_viewport_size({'width':390,'height':844});page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(300)
    expected=page.evaluate('pJSDom[0].pJS.canvas.el.width*pJSDom[0].pJS.canvas.el.height/10000')
    check('particles densidad movil',abs(len(page.evaluate(getxy))-expected)<=1)
    page.locator('.menu-toggle').click();check('menu movil abre',page.locator('#site-menu').is_visible())
    page.keyboard.press('Escape');page.wait_for_function("!document.querySelector('#site-menu').open");check('menu movil cierra',not page.locator('#site-menu').is_visible())
    page.locator('#presentacion [data-pending]').first.click();check('consulta produccion abre',page.locator('#route-dialog').is_visible())
    page.keyboard.press('Escape');check('foco regresa',page.locator('#presentacion [data-pending]').first.evaluate('(e)=>e===document.activeElement'))
    norm=lambda s:re.sub(r'\s+',' ',s).strip()
    body=norm(page.locator('body').text_content())
    home=json.loads((site/'src/data/home.json').read_text(encoding='utf8'))
    for i,section in enumerate(home['sections']):
        check(f'P01 titulo {i}',norm(section['title']) in body)
        for j,para in enumerate(section['paragraphs']):check(f'P01 parrafo {i}-{j}',norm(para) in body)
        for j,item in enumerate(section['items']):
            if not item.startswith('[ESPACIO'):check(f'P01 item {i}-{j}',norm(item) in body)
    page.close()
    page=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
    page.goto(url,wait_until='networkidle')
    check('sin JS tres ofertas',page.locator('.panel-content').count()==3 and all(page.locator('.panel-content').nth(i).is_visible() for i in range(3)))
    check('sin JS collage',page.locator('.presentation-visual img').is_visible())
    page.close();browser.close()
check('sin errores JS',not report['errors'],report['errors'])
check('sin errores HTTP',not report['http_errors'],report['http_errors'])
check('sin recursos externos',not report['external'],report['external'])
baseline=json.loads((site.parent/'seguimiento/claudex-home-v3-2026-11-16/originales-sha256.json').read_text(encoding='utf-8-sig'))
changed=[n for n,h in baseline.items() if hashlib.sha256((site.parent/n).read_bytes()).hexdigest()!=h]
check('1117 originales intactos',not changed,changed)
(out/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Checks',len(report['checks']),'failures',sum(not c['pass'] for c in report['checks']))
assert all(c['pass'] for c in report['checks'])
