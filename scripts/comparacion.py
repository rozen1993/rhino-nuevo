from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
import json,html

site=Path(__file__).resolve().parents[1]
root=site.parent
out=site/'entrega'
ref=Image.open(root/'seguimiento/claudex-direccion-visual-2026-11-16/mockup-original.png').convert('RGB')
parts=[('hero-completo','.hero',0,995),('marcas','.brand-strip',995,1160),('produccion','#servicios',1160,1940),('eventos','#eventos',1160,1940),('directorio','.directory',1940,2930),('proyectos','#proyectos',2930,3995),('consulta','#consulta',3995,4795),('pie','footer',4795,5606)]
coords={}
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome')
    page=b.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    page.goto('http://127.0.0.1:4323/',wait_until='networkidle')
    for name,selector,_,_ in parts:
        coords[name]=page.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}}')
    b.close()
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
full3=Image.open(out/'home-1440.png').convert('RGB')
links=[]
for name,_,y1,y2 in parts:
    reference=ref.crop((0,y1,1440,y2))
    v2path=root/'sitio-v2/entrega'/f'{name}-1440.png'
    if not v2path.exists():
        # Brand strip is not separately exported in the previous version.
        old=Image.open(root/'sitio-v2/entrega/home-1440.png').convert('RGB').crop((0,960,1440,1141))
    else:
        raw=Image.open(v2path).convert('RGB')
        old=Image.new('RGB',(1440,raw.height),'white');old.paste(raw,((1440-raw.width)//2,0))
    c=coords[name]
    current=full3.crop((0,round(c['y']),1440,round(c['y']+c['height'])))
    images=[reference,old,current]
    scaled=[im.resize((720,round(im.height/2)),Image.Resampling.LANCZOS) for im in images]
    canvas=Image.new('RGB',(2160,max(im.height for im in scaled)+55),'#eee')
    draw=ImageDraw.Draw(canvas)
    for i,(label,im) in enumerate(zip(['Referencia visual','V2 conservada','V3 — revision Claude pendiente'],scaled)):
        draw.text((i*720+16,15),label,fill='#222',font=font);canvas.paste(im,(i*720,55))
    filename=f'comparacion-{name}.png';canvas.save(out/filename)
    links.append(f'<section><h2>{html.escape(name)}</h2><p>Las tres columnas mantienen la misma escala horizontal. La altura responde al contenido real.</p><a href="{filename}"><img src="{filename}" alt="Comparación de {html.escape(name)} entre referencia, V2 y V3"></a></section>')
sheet=Image.new('RGB',(1440,max(5606,Image.open(root/'sitio-v2/entrega/home-1440.png').height,full3.height)//3+55),'#eee')
d=ImageDraw.Draw(sheet)
for i,(label,im) in enumerate(zip(['Referencia','V2','V3 — pendiente'],[ref,Image.open(root/'sitio-v2/entrega/home-1440.png'),full3])):
    d.text((i*480+12,15),label,fill='#222',font=font);sheet.paste(im.resize((480,round(im.height/3)),Image.Resampling.LANCZOS),(i*480,55))
sheet.save(out/'comparacion-completa.png')
(out/'comparacion.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rhino P01 · comparación</title><style>body{font:18px/1.6 Arial;margin:24px;color:#222}section{margin:60px 0}img{width:100%;height:auto}a{color:#8b0050}</style><h1>Referencia / V2 / V3</h1><p>V3 implementada y comprobada localmente. Revisión final de Claude pendiente por créditos. Esta comparación no representa aprobación visual.</p><p>El mockup tiene textos de prueba. V3 utiliza P01 aprobado, añade producción primero y conserva el bloque propio de eventos.</p><p><a href="home-1440.png">PNG escritorio</a> · <a href="home-768.png">PNG tableta</a> · <a href="home-390.png">PNG móvil</a> · <a href="comparacion-completa.png">Comparación completa</a> · <a href="http://127.0.0.1:4323/">Abrir home</a></p>'+''.join(links)+'</html>',encoding='utf8')
(out/'coordenadas-comparacion.json').write_text(json.dumps(coords,indent=2),encoding='utf8')
print('9 comparaciones PNG y comparacion.html generadas')
