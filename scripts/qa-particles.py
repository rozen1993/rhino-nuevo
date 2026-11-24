from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import json,io,math,time

site=Path(__file__).resolve().parents[1]
out=site/'entrega/particulas-2026-11-17'
out.mkdir(parents=True,exist_ok=True)
url='http://127.0.0.1:4323/'
report={'checks':[],'errors':[],'external_requests':[]}
def check(name,result,details=None):
    report['checks'].append({'name':name,'pass':bool(result),'details':details})
    if not result:print('FAIL',name,details)
xy='()=>pJSDom[0].pJS.particles.array.map(p=>[p.x,p.y])'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    page=browser.new_page(viewport={'width':1440,'height':990})
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('request',lambda r:report['external_requests'].append(r.url) if not r.url.startswith(url) else None)
    page.goto(url,wait_until='networkidle')
    report['default_prefers_reduced_motion']=page.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')
    if report['default_prefers_reduced_motion']:page.locator('.hero-motion-control').click()
    page.wait_for_function('document.querySelector("#rhino-hero-particles").dataset.particlesState==="active"')
    config=page.evaluate('()=>{const p=pJSDom[0].pJS,e=document.querySelector("#rhino-hero-particles"),s=getComputedStyle(e);return {count:p.particles.array.length,speed:p.particles.move.speed,size:p.particles.size.value,density:p.particles.number.density.enable,opacity:s.opacity,mask:s.maskImage,pointer:s.pointerEvents}}')
    report['effective_config']=config
    check('configuracion visible como legado',config['count']>=140 and config['speed']==2 and config['size']==7 and config['opacity']=='1' and config['mask']=='none',config)
    a=page.evaluate(xy);page.wait_for_timeout(300);b=page.evaluate(xy)
    mean=sum(math.hypot(x[0]-y[0],x[1]-y[1]) for x,y in zip(a,b))/len(a)
    check('desplazamiento perceptible',mean>5,{'mean_css_px_in_300ms':mean})
    page.mouse.move(700,440);page.wait_for_timeout(150)
    check('cursor grab activo',page.evaluate('pJSDom[0].pJS.interactivity.status==="mousemove"&&pJSDom[0].pJS.interactivity.mouse.pos_x===700'))
    count=len(page.evaluate(xy));page.mouse.click(700,440)
    check('clic fondo agrega cuatro',len(page.evaluate(xy))==count+4)
    # Record actual browser frames with cursor moving; no synthesized particles.
    frames=[];durations=[]
    for i in range(36):
        start=time.monotonic()
        page.mouse.move(650+180*math.sin(i/8),420+110*math.cos(i/8))
        page.wait_for_timeout(80)
        data=page.screenshot()
        frames.append(Image.open(io.BytesIO(data)).convert('RGB').resize((960,660),Image.Resampling.LANCZOS))
        durations.append(round((time.monotonic()-start)*1000))
    frames[0].save(out/'particulas-en-movimiento.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=False)
    page.screenshot(path=str(out/'portada-cursor-1440.png'))
    # A real CTA remains actionable and does not trigger decorative clicks.
    count=len(page.evaluate(xy));page.locator('.hero-play').click()
    check('CTA video abre',page.locator('#video-dialog').is_visible())
    check('CTA no agrega particulas',len(page.evaluate(xy))==count)
    page.keyboard.press('Escape')
    page.locator('.hero-motion-control').click();page.wait_for_timeout(100)
    a=page.evaluate(xy);page.wait_for_timeout(250)
    check('control pausa real',a==page.evaluate(xy) and page.locator('.hero-motion-control').inner_text()=='Activar animación')
    page.locator('.hero-motion-control').click();page.wait_for_timeout(150)
    check('control reanuda',a!=page.evaluate(xy))
    page.locator('#servicios').scroll_into_view_if_needed();page.wait_for_timeout(250)
    a=page.evaluate(xy);page.wait_for_timeout(200)
    check('fuera de vista pausa',a==page.evaluate(xy))
    page.evaluate('scrollTo(0,0)');page.wait_for_timeout(200)
    check('volver reanuda',a!=page.evaluate(xy))
    for _ in range(25):page.mouse.click(700,440)
    check('clics tienen limite',len(page.evaluate(xy))<=200)
    for width in [1440,1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':900});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(250)
        check(f'{width} sin desbordamiento',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        overlap=page.evaluate('()=>{const a=document.querySelector(".hero-motion-control").getBoundingClientRect(),b=document.querySelector("h1").getBoundingClientRect();return a.bottom>b.top&&a.top<b.bottom&&a.left<b.right&&a.right>b.left}')
        check(f'{width} control no tapa titulo',not overlap)
        bounds=page.evaluate('()=>{const p=pJSDom[0].pJS;return p.particles.array.every(v=>v.x>=-v.radius&&v.y>=-v.radius&&v.x<=p.canvas.el.width+v.radius&&v.y<=p.canvas.el.height+v.radius)}')
        check(f'{width} particulas redistribuidas',bounds)
        page.screenshot(path=str(out/f'portada-{width}.png'))
    page.set_viewport_size({'width':390,'height':844});page.locator('.menu-toggle').click()
    check('menu movil funciona',page.locator('#site-menu').is_visible());page.keyboard.press('Escape')
    # Default reduced motion leaves the library unloaded, but explicit opt-in works.
    reduced=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    reduced.goto(url,wait_until='networkidle')
    check('reducido inicia estatico',reduced.locator('#rhino-hero-particles canvas').count()==0)
    check('reducido sin libreria cargada',reduced.locator('script[data-rhino-particles]').count()==0)
    reduced.locator('.hero-motion-control').click();reduced.wait_for_function('document.querySelector("#rhino-hero-particles").dataset.particlesState==="active"')
    a=reduced.evaluate(xy);reduced.wait_for_timeout(250)
    check('activacion voluntaria funciona',a!=reduced.evaluate(xy))
    reduced.locator('.hero-motion-control').click();a=reduced.evaluate(xy);reduced.wait_for_timeout(250)
    check('pausa voluntaria funciona',a==reduced.evaluate(xy))
    mobile=browser.new_page(viewport={'width':320,'height':844},reduced_motion='no-preference')
    mobile.goto(url,wait_until='networkidle');mobile.wait_for_function('document.querySelector("#rhino-hero-particles").dataset.particlesState==="active"')
    a=mobile.evaluate(xy);mobile.wait_for_timeout(250)
    check('movil carga directa animada',a!=mobile.evaluate(xy))
    browser.close()
check('sin errores JS',not report['errors'],report['errors'])
check('sin peticiones externas',not report['external_requests'],report['external_requests'])
(out/'qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
print('Checks',len(report['checks']),'failures',sum(not c['pass'] for c in report['checks']))
assert all(c['pass'] for c in report['checks'])
