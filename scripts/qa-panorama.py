from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io, json, re

site=Path(__file__).resolve().parents[1]
out=site/'entrega/portada-B-2026-11-17'
out.mkdir(parents=True,exist_ok=True)
url='http://127.0.0.1:4323/'
home=json.loads((site/'src/data/home.json').read_text(encoding='utf8'))
report={'checks':[],'errors':[],'external_requests':[],'http_errors':[],'contrast':[],'axe':[]}
def check(name,result,details=None):
    report['checks'].append({'name':name,'pass':bool(result),'details':details})
    if not result:print('FAIL',name,details,flush=True)
def norm(s):return re.sub(r'\s+',' ',s).strip()
def listen(page):
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('request',lambda r:report['external_requests'].append(r.url) if not r.url.startswith(url) else None)
    page.on('response',lambda r:report['http_errors'].append([r.url,r.status]) if r.status>=400 else None)
def luminance(rgb):
    c=[v/255 for v in rgb[:3]]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
def sample_contrast(page):
    boxes=page.locator('.panorama-lead,.panorama-context').evaluate_all('''es=>es.map(e=>{
      const r=document.createRange();r.selectNodeContents(e);
      return {name:e.className,rows:[...r.getClientRects()].map(b=>({x:b.x,y:b.y,width:b.width,height:b.height}))};
    })''')
    style=page.add_style_tag(content='.panorama-content,.particles-layer,.network,.panorama-waves{visibility:hidden!important}')
    im=Image.open(io.BytesIO(page.screenshot())).convert('RGB')
    result=[]
    for item in boxes:
        values=[]
        for row in item['rows']:
            for y in [int(row['y']+row['height']*.2),int(row['y']+row['height']*.5),int(row['y']+row['height']*.8)]:
                for x in range(max(0,int(row['x'])),min(im.width,int(row['x']+row['width'])),6):
                    if 0<=y<im.height:values.append(1.05/(luminance(im.getpixel((x,y)))+.05))
        result.append({'selector':item['name'],'min_ratio':round(min(values),3)})
    style.evaluate('e=>e.remove()')
    return result
points="id=>window.pJSDom?.find(e=>e.pJS.canvas.el.parentElement.id===id)?.pJS.particles.array.map(p=>[p.x,p.y])??[]"
wave="()=>[...document.querySelectorAll('.wave-current')].map(e=>getComputedStyle(e).transform)"
hero='rhino-hero-particles'
fields=[hero,'rhino-directory-particles','rhino-footer-particles']
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    for width in [1874,1440,1301,1300,1280,1152,1101,1100,768,650,390,320]:
        page=browser.new_page(viewport={'width':width,'height':1000},reduced_motion='reduce')
        listen(page);page.goto(url,wait_until='networkidle');page.evaluate('document.fonts.ready')
        check(f'{width} sin desbordamiento',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        measures=page.locator('.hero').evaluate('''e=>{
          const b=e.getBoundingClientRect();
          const content=[...e.querySelectorAll('h1,.panorama-lead,.panorama-context,.panorama-action,.menu-toggle,.hero-motion-control,.panorama-whatsapp')];
          const fit=content.every(n=>{const r=n.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1});
          const text=[...e.querySelectorAll('h1,.panorama-lead,.panorama-context')].map(n=>n.getBoundingClientRect());
          const controls=[...e.querySelectorAll('.panorama-action,.menu-toggle,.hero-motion-control,.panorama-whatsapp')].map(n=>n.getBoundingClientRect());
          const overlap=controls.some(a=>text.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
          const h=e.querySelector('h1'),r=document.createRange();r.selectNodeContents(h);
          return {fit,overlap,headlineLines:r.getClientRects().length,height:b.height};
        }''')
        check(f'{width} contenido contenido en portada',measures['fit'],measures)
        check(f'{width} controles no invaden texto',not measures['overlap'])
        if width>=1280:check(f'{width} titular en una linea',measures['headlineLines']==1,measures)
        intro=' '.join(page.locator('.panorama-lead,.panorama-context').all_text_contents())
        check(f'{width} intro aprobada completa',norm(intro)==norm(home['intro']))
        order=page.locator('main > section').evaluate_all('es=>es.map(e=>e.id)')
        check(f'{width} orden preservado',order==['inicio','presentacion','servicios','servicios-extras','proyectos','consulta'],order)
        values=sample_contrast(page);report['contrast'].append({'width':width,'samples':values})
        check(f'{width} contraste textos sobre degradado',all(x['min_ratio']>=4.5 for x in values),values)
        if width in [1874,1440,768,390]:
            page.locator('.hero').screenshot(path=str(out/f'portada-{width}.png'))
        if width in [1440,390]:
            page.add_script_tag(path=str(site/'scripts/axe.min.js'))
            violations=page.evaluate('''async()=>{const r=await axe.run(document.querySelector('.hero'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}''')
            report['axe'].append({'width':width,'scope':'hero','violations':violations});check(f'{width} axe portada',not violations,violations)
            for y in range(0,page.evaluate('document.documentElement.scrollHeight'),700):page.evaluate('y=>scrollTo(0,y)',y);page.wait_for_timeout(35)
            page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/f'home-{width}.png'),full_page=True)
        page.close()

    page=browser.new_page(viewport={'width':1440,'height':990},reduced_motion='no-preference');listen(page)
    page.goto(url,wait_until='networkidle');page.wait_for_function("document.querySelector('#rhino-hero-particles').dataset.particlesState==='active'")
    check('campos fuera de pantalla aun sin canvas',page.locator('#rhino-directory-particles canvas,#rhino-footer-particles canvas').count()==0)
    a=page.evaluate(points,hero);wa=page.evaluate(wave);page.wait_for_timeout(450)
    check('particulas movimiento real',a!=page.evaluate(points,hero))
    check('ondas movimiento real',wa!=page.evaluate(wave))
    page.locator('.hero-motion-control').click();page.wait_for_timeout(80)
    a=page.evaluate(points,hero);wa=page.evaluate(wave);page.wait_for_timeout(400)
    check('pausa detiene particulas',a==page.evaluate(points,hero))
    check('pausa detiene ondas',wa==page.evaluate(wave))
    page.locator('.hero-motion-control').click();page.wait_for_timeout(200)
    check('reanuda ambos efectos',a!=page.evaluate(points,hero) and wa!=page.evaluate(wave))
    page.locator('.menu-toggle').click();page.wait_for_timeout(800)
    check('menu fullscreen funciona',page.locator('#site-menu').evaluate('e=>e.open&&Math.abs(e.getBoundingClientRect().width-innerWidth)<1'))
    page.keyboard.press('Escape');page.wait_for_function("!document.querySelector('#site-menu').open")
    check('escape devuelve foco',page.locator('.menu-toggle').evaluate('e=>e===document.activeElement'))
    check('WhatsApp autorizado',page.locator('.panorama-whatsapp').get_attribute('href')=='https://wa.me/51965683542')
    page.locator('.panorama-action').click();page.wait_for_timeout(1000)
    check('CTA lleva a consulta',page.evaluate('location.hash')=='#consulta' and page.locator('#consulta').evaluate('e=>e.getBoundingClientRect().top<innerHeight'))
    a=page.evaluate(points,hero);wa=page.evaluate(wave);page.wait_for_timeout(300)
    check('salir de portada pausa ambos',a==page.evaluate(points,hero) and wa==page.evaluate(wave))
    trigger=page.locator('.inline-action[data-video]').first;trigger.click()
    check('video de portafolio abre',page.locator('#video-dialog').is_visible());page.keyboard.press('Escape');page.wait_for_timeout(120)
    check('video restaura foco',trigger.evaluate('e=>e===document.activeElement'))
    for ident in fields[1:]:
        page.locator('#'+ident).evaluate("e=>e.parentElement.scrollIntoView({block:'start',behavior:'instant'})")
        page.wait_for_function("id=>document.getElementById(id).dataset.particlesState==='active'",arg=ident)
        a=page.evaluate(points,ident);page.wait_for_timeout(200)
        check(ident+' sigue animado',a!=page.evaluate(points,ident))
    check('una libreria para tres instancias',page.locator('script[data-rhino-particles]').count()==1 and page.evaluate('pJSDom.length')==3)
    page.evaluate('scrollTo({top:0,behavior:"instant"})');page.wait_for_timeout(250)
    page.locator('.hero').screenshot(path=str(out/'portada-animada-1440.png'))
    page.close()

    reduced=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');listen(reduced)
    reduced.goto(url,wait_until='networkidle')
    check('movimiento reducido no carga canvas',reduced.locator('[data-particles-host] canvas').count()==0)
    check('movimiento reducido desactiva ondas',reduced.locator('.wave-current').first.evaluate('e=>getComputedStyle(e).animationName')=='none')
    reduced.locator('.hero-motion-control').click();reduced.wait_for_function("document.querySelector('#rhino-hero-particles').dataset.particlesState==='active'")
    a=reduced.evaluate(points,hero);reduced.wait_for_timeout(250);check('optin reducido activa particulas',a!=reduced.evaluate(points,hero))
    reduced.locator('.hero-motion-control').click();reduced.wait_for_timeout(80);a=reduced.evaluate(points,hero);reduced.wait_for_timeout(200)
    check('optin reducido permite pausar',a==reduced.evaluate(points,hero))
    browser.close()

check('sin errores JavaScript',not report['errors'],report['errors'])
check('sin errores de recursos',not report['http_errors'],report['http_errors'])
check('sin peticiones externas',not report['external_requests'],report['external_requests'])
(out/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Checks',len(report['checks']),'Failures',sum(not c['pass'] for c in report['checks']),flush=True)
assert all(c['pass'] for c in report['checks'])
