from pathlib import Path
from playwright.sync_api import sync_playwright
import json

SITE=Path(__file__).resolve().parents[1]
OUTPUT=SITE/'entrega'
URL='http://127.0.0.1:4323/'
sections=[('.hero','hero-completo'),('.brand-strip','marcas'),('#servicios','produccion'),('#eventos','eventos'),('.directory','directorio'),('#proyectos','proyectos'),('#consulta','consulta'),('footer','pie')]
measurements=[]
with sync_playwright() as engine:
    browser=engine.chromium.launch(channel='chrome')
    for width in [1440,768,390]:
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        page.goto(URL,wait_until='networkidle')
        assert page.locator('html').get_attribute('data-build')=='rhino-p01-v3'
        page.evaluate('document.fonts.ready')
        for position in range(0,int(page.evaluate('document.documentElement.scrollHeight')),650):
            page.evaluate('(y)=>scrollTo(0,y)',position)
            page.wait_for_timeout(75)
        page.evaluate('scrollTo(0,0)')
        page.screenshot(path=str(OUTPUT/f'home-{width}.png'),full_page=True)
        page.screenshot(path=str(OUTPUT/f'hero-{width}.png'))
        details=[]
        for selector,name in sections:
            element=page.locator(selector)
            element.screenshot(path=str(OUTPUT/f'{name}-{width}.png'))
            details.append({'name':name,'box':element.bounding_box()})
        measurements.append({'width':width,'height':page.evaluate('document.documentElement.scrollHeight'),'scrollWidth':page.evaluate('document.documentElement.scrollWidth'),'sections':details})
        page.close()
    browser.close()
(OUTPUT/'medidas.json').write_text(json.dumps(measurements,indent=2),encoding='utf-8')
print([(item['width'],item['height'],item['scrollWidth']) for item in measurements])
