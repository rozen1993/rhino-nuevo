from pathlib import Path
from PIL import Image
import json,hashlib

SITE=Path(__file__).resolve().parents[1]
ROOT=SITE.parent
inventory=json.loads((SITE/'entrega/recursos.json').read_text(encoding='utf-8'))
# Remove letterboxing and embedded subtitles from the display crop only.
for name,source,box in [
    ('bloom','HZEy7skFOnM-large.jpg',(0,52,1280,668)),
    ('adidas','7_6xZDeL5N0-large.jpg',(0,0,1280,600))
]:
    original=ROOT/'seguimiento/claudex-home-2026-11-16'/source
    destination=SITE/'public/media'/f'{name}-display.webp'
    Image.open(original).convert('RGB').crop(box).save(destination,quality=87,method=6)
    inventory.append({'asset':destination.relative_to(SITE).as_posix(),'source':original.relative_to(ROOT).as_posix(),'source_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'crop':box,'bytes':destination.stat().st_size,'status':'Recorte V3 para presentacion, sin ampliacion de archivo'})
(SITE/'entrega/recursos.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf-8')
page=SITE/'src/components/Projects.astro'
source=page.read_text(encoding='utf-8')
source=source.replace("item.id + '-1280.webp'", "item.id + (['bloom', 'adidas'].includes(item.id) ? '-display.webp' : '-1280.webp')")
page.write_text(source,encoding='utf-8')
