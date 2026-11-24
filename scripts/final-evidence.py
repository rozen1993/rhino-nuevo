from pathlib import Path
import json, time, hashlib
from playwright.sync_api import sync_playwright

site=Path(__file__).resolve().parents[1]
root=site.parent
out=site/'entrega'
results={}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    page.add_init_script("window.metrics={lcp:0,cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries())window.metrics.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.metrics.cls+=e.value}).observe({type:'layout-shift',buffered:true});")
    cdp=page.context.new_cdp_session(page)
    cdp.send('Network.enable')
    cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
    cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':200000,'uploadThroughput':100000})
    cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    page.goto('http://127.0.0.1:4323/',wait_until='networkidle')
    page.wait_for_timeout(1000)
    results['laboratorio_una_muestra']=page.evaluate('({ ...window.metrics,bytes:performance.getEntriesByType("resource").reduce((n,r)=>n+r.transferSize,performance.getEntriesByType("navigation")[0].transferSize),requests:performance.getEntriesByType("resource").length})')
    page.close()
    page=browser.new_page(viewport={'width':390,'height':844})
    page.goto('http://127.0.0.1:4323/',wait_until='networkidle')
    page.locator('.menu-toggle').click()
    page.screenshot(path=str(out/'estado-menu-390.png'))
    page.keyboard.press('Escape')
    page.locator('[data-pending="Producción audiovisual"]').first.click()
    page.screenshot(path=str(out/'estado-destino-pendiente-390.png'))
    page.keyboard.press('Escape')
    page.locator('.inline-action[data-video="tasting"]').click()
    page.screenshot(path=str(out/'estado-video-poster-390.png'))
    responses=[]
    page.on('response',lambda r: responses.append({'url':r.url,'status':r.status}) if 'youtube-nocookie.com/embed/' in r.url else None)
    page.locator('#video-load').click()
    page.wait_for_timeout(8000)
    frame=next((f for f in page.frames if 'youtube-nocookie.com/embed/' in f.url),None)
    record={'responses':responses,'iframe_loaded':bool(frame),'playback_confirmed':False}
    if frame:
        try:
            record['visible_text']=frame.locator('body').inner_text(timeout=4000)[:1200]
            button=frame.locator('.ytp-large-play-button')
            if button.count():
                button.click(timeout=4000)
                page.wait_for_timeout(4000)
                record['video']=frame.locator('video').evaluate_all('(vs)=>vs.map(v=>({currentTime:v.currentTime,paused:v.paused,readyState:v.readyState,error:v.error?.code}))')
                record['playback_confirmed']=any(v['currentTime']>0 and not v['paused'] for v in record['video'])
        except Exception as e: record['diagnostic']=str(e)[:500]
    page.screenshot(path=str(out/'estado-video-real-390.png'))
    results['video_real_tasting']=record
    page.keyboard.press('Escape')
    browser.close()
baseline=json.loads((root/'seguimiento/claudex-home-v3-2026-11-16/originales-sha256.json').read_text(encoding='utf-8-sig'))
changed=[name for name,sha in baseline.items() if not (root/name).is_file() or hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha]
results['originales']={'archivos':len(baseline),'cambiados':changed}
(out/'evidencia-final.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(results,ensure_ascii=False))
assert not changed
