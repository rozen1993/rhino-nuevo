from pathlib import Path
from PIL import Image
import hashlib,json

SITE=Path(__file__).resolve().parents[1]
ROOT=SITE.parent
styles=SITE/'src/styles'
base=(styles/'global.css').read_text(encoding='utf-8')
(styles/'base.css').write_text('\n'.join(line for line in base.splitlines() if not line.startswith('@import')),encoding='utf-8')
(styles/'global.css').write_text('@import "tailwindcss";\n@import "./base.css";\n@import "./hero.css";\n@import "./sections.css";\n@import "./responsive.css";\n',encoding='utf-8')

def update(relative, old, new):
    file=SITE/relative
    source=file.read_text(encoding='utf-8')
    assert old in source, relative
    file.write_text(source.replace(old,new),encoding='utf-8')

update('src/pages/index.astro',"import Base from", "import EventServices from '../components/EventServices.astro';\nimport Base from")
update('src/pages/index.astro','<ServicePanels section={home.sections[1]} group="events"/>','<EventServices/>')
update('src/layouts/Base.astro','<html lang="es-PE">','<html lang="es-PE" data-build="rhino-p01-v3">')
update('src/layouts/Base.astro','<link rel="preload" href="/fonts/poppins-400.woff2" as="font" type="font/woff2" crossorigin/>','')
update('src/components/Hero.astro','<p class="hero-intro">{home.intro}</p>','<p class="hero-intro"><span class="hero-lead">{home.intro.slice(0, home.intro.indexOf(". ") + 1)}</span>{" "}<span class="hero-context">{home.intro.slice(home.intro.indexOf(". ") + 2)}</span></p>')
update('src/components/Hero.astro','<Atmosphere/>','<Atmosphere seed={29}/>')
update('src/components/Hero.astro','src="/media/camera-960.webp" srcset="/media/camera-480.webp 480w, /media/camera-960.webp 960w" sizes="(max-width: 900px) 100vw, 800px" width="960" height="640"','src="/media/camera-1600.webp" srcset="/media/camera-960.webp 960w, /media/camera-1600.webp 1600w" sizes="(max-width: 650px) 540px, 850px" width="1600" height="1067"')
update('src/components/Hero.astro','src="/media/tasting-480.webp" width="480" height="270"','src="/media/tasting-1280.webp" width="1280" height="720"')
update('src/components/ServicePanels.astro',"<div class=\"section-heading\">",'<div class="section-tick" aria-hidden="true"></div><div class="section-heading">')
update('src/components/ServicePanels.astro',"P04:'redinter',P12:'adidas'","P04:'production',P12:'camera'")
update('src/components/ServicePanels.astro','-960.webp','-1600.webp')
update('src/components/ServicePanels.astro','960w','1600w')
update('src/components/ServicePanels.astro','width="960" height="640"','width="1600" height="1067"')
update('src/components/Consultation.astro','<div class="wrap"><h2','<div class="wrap"><div class="section-tick" aria-hidden="true"></div><h2')
update('src/components/Consultation.astro','<a class="inline-action" href="mailto:', '<div class="contact-secondary"><a class="inline-action" href="mailto:')
update('src/components/Consultation.astro','Prefiero escribir por correo <Icon size={18}/></a></div>','Prefiero escribir por correo <Icon size={18}/></a><button class="inline-action" data-pending="Contacto" data-path="/contacto/">Cuéntanos tu proyecto <Icon size={18}/></button></div></div>')
update('src/components/Footer.astro','<Atmosphere waves={false}/>','<Atmosphere waves={false} seed={103}/>')
update('src/components/Footer.astro','<p class="preview-notice">Propuesta local · Páginas internas en preparación · Material del legado pendiente de validación para publicación.</p></div></footer>','</div></footer><aside class="preview-notice">Propuesta local · Páginas internas en preparación · Roles y permisos del material recuperado pendientes de validación para publicación.</aside>')

inventory=json.loads((SITE/'entrega/recursos-v2-reutilizados.json').read_text(encoding='utf-8'))
sources={
    'camera':ROOT/'web_antigua/META/img/header/fotito.jpg',
    'production':ROOT/'web_antigua/META/img/header/video.jpg',
    'tasting':ROOT/'seguimiento/claudex-home-2026-11-16/jGBn4_dsxNA-large.jpg',
    'redinter':ROOT/'seguimiento/claudex-home-2026-11-16/uj95pnrXIwI-large.jpg',
    'bloom':ROOT/'seguimiento/claudex-home-2026-11-16/HZEy7skFOnM-large.jpg',
    'adidas':ROOT/'seguimiento/claudex-home-2026-11-16/7_6xZDeL5N0-large.jpg'
}
for name,source in sources.items():
    original=Image.open(source).convert('RGB')
    width=1600 if name in ['camera','production'] else 1280
    height=round(original.height*width/original.width)
    destination=SITE/'public/media'/f'{name}-{width}.webp'
    original.resize((width,height),Image.Resampling.LANCZOS).save(destination,quality=85,method=6)
    inventory.append({'asset':destination.relative_to(SITE).as_posix(),'source':source.relative_to(ROOT).as_posix(),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'original_size':original.size,'width':width,'height':height,'bytes':destination.stat().st_size,'status':'Variante V3 desde original, sin ampliacion'})
(SITE/'entrega/recursos.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf-8')
print('Componentes y variantes V3 preparados')
