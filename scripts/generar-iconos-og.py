from playwright.sync_api import sync_playwright
from PIL import Image
import pathlib, base64
def data(p,mime): return f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
ROOT=pathlib.Path(r'c:/Users/MARCO/Desktop/MASTER-SEO/sitio-v3/public')
logo=data(ROOT/'media/logo-rhino.png','image/png'); font=data(ROOT/'fonts/poppins-700.woff2','font/woff2'); font6=data(ROOT/'fonts/poppins-600.woff2','font/woff2')
GRAD='linear-gradient(45deg,#fe802d 8%,#fe0840 50%,#ac0bd9 90%)'
ICON=f"""<html><body style="margin:0"><div id=c style="width:512px;height:512px;background:{GRAD};display:grid;place-items:center">
<img src="{logo}" style="width:72%;"></div></body></html>"""
OG=f"""<html><head><style>@font-face{{font-family:P;src:url({font}) format('woff2');font-weight:700}}@font-face{{font-family:P;src:url({font6}) format('woff2');font-weight:600}}
body{{margin:0}}#c{{width:1200px;height:630px;background:{GRAD};position:relative;overflow:hidden;font-family:P,Arial,sans-serif;color:#fff}}
.w{{position:absolute;left:0;right:0;bottom:-2px;height:120px;background:radial-gradient(120% 100% at 50% 100%,#ffffff2e 0 45%,transparent 46%)}}
.in{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center}}
.b{{display:flex;align-items:center;gap:22px}}.b img{{width:150px}}.b span{{font-weight:700;font-size:76px;letter-spacing:2px}}
h1{{margin:0;font-weight:600;font-size:58px;letter-spacing:.5px}}p{{margin:0;font-weight:600;font-size:26px;letter-spacing:6px;opacity:.92}}</style></head>
<body><div id=c><div class=w></div><div class=in><div class=b><img src="{logo}"><span>RHINO</span></div><h1>Productora audiovisual en Lima</h1><p>RHINO AUDIOVISUALES</p></div></div></body></html>"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1200,'height':700})
    pg.set_content(ICON); pg.wait_for_function("[...document.images].every(i=>i.complete&&i.naturalWidth>0)"); pg.wait_for_timeout(200); pg.locator('#c').screenshot(path='iconos/icon-512.png')
    pg.set_content(OG); pg.wait_for_function("[...document.images].every(i=>i.complete&&i.naturalWidth>0)"); pg.evaluate("document.fonts.load('600 58px P')"); pg.evaluate("document.fonts.load('700 76px P')"); pg.wait_for_function("document.fonts.check('600 58px P')&&document.fonts.check('700 76px P')"); pg.wait_for_timeout(300); pg.locator('#c').screenshot(path='iconos/og-rhino.png')
    b.close()
big=Image.open('iconos/icon-512.png').convert('RGB')
big.save(ROOT/'media/logo-rhino-cuadrado-512.png',optimize=True)
big.resize((192,192),Image.LANCZOS).save(ROOT/'media/icon-192.png',optimize=True)
big.resize((180,180),Image.LANCZOS).save(ROOT/'apple-touch-icon.png',optimize=True)
big.resize((48,48),Image.LANCZOS).save(ROOT/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])
og=Image.open('iconos/og-rhino.png').convert('RGB'); print(og.size); og.save(ROOT/'media/og-rhino.png',optimize=True)
for f in ['media/logo-rhino-cuadrado-512.png','media/icon-192.png','apple-touch-icon.png','favicon.ico','media/og-rhino.png']:
    q=ROOT/f; print(f, Image.open(q).size, q.stat().st_size//1024,'KB')
