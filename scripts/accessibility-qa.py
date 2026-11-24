from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import json,io,re,sys

SITE=Path(__file__).resolve().parents[1]
OUTPUT=SITE/'entrega'
results=[]
def luminance(rgb):
    values=[channel/255 for channel in rgb[:3]]
    linear=[value/12.92 if value<=.04045 else ((value+.055)/1.055)**2.4 for value in values]
    return sum(value*weight for value,weight in zip(linear,[.2126,.7152,.0722]))

with sync_playwright() as engine:
    browser=engine.chromium.launch(channel='chrome')
    for width in [1440,1024,768,390,320]:
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        page.goto('http://127.0.0.1:4323/',wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        page.add_script_tag(path=str(SITE/'scripts/axe.min.js'))
        axe=page.evaluate("""async()=>{
          const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
          return {
            violations:result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})),
            incomplete:result.incomplete.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)}))
          };
        }""")
        targets=page.evaluate("""()=>{
          const targets=[];
          document.querySelectorAll('.color-field *, .gradient-action, .gradient-action *').forEach(element=>{
            if(element.closest('[aria-hidden="true"],svg,.sr-only'))return;
            const style=getComputedStyle(element),box=element.getBoundingClientRect();
            if(!box.width||!box.height||style.visibility==='hidden')return;
            const color=style.color==='rgba(0, 0, 0, 0)'?style.webkitTextStrokeColor:style.color;
            for(const node of element.childNodes){
              if(node.nodeType!==Node.TEXT_NODE||!node.textContent.trim())continue;
              const range=document.createRange(); range.selectNodeContents(node);
              const rects=[...range.getClientRects()].map(rect=>({x:rect.x,y:rect.y+scrollY,w:rect.width,h:rect.height}));
              targets.push({text:node.textContent.trim(),color,size:parseFloat(style.fontSize),weight:parseInt(style.fontWeight),rects});
            }
          });
          return targets;
        }""")
        page.add_style_tag(content='body * { color:transparent!important; -webkit-text-stroke:0 transparent!important; text-shadow:none!important } svg:not(.network):not(.wave):not(.top-wave):not(.constellation-lines):not(.steps-line) { visibility:hidden!important }')
        screenshot=Image.open(io.BytesIO(page.screenshot(full_page=True))).convert('RGB')
        samples=[]
        for target in targets:
            rgb=[float(number) for number in re.findall(r'[\d.]+',target['color'])[:3]]
            foreground=luminance(rgb)
            contrasts=[]
            for rect in target['rects']:
                for horizontal in [.1,.3,.5,.7,.9]:
                    for vertical in [.25,.5,.75]:
                        x=min(screenshot.width-1,max(0,int(rect['x']+rect['w']*horizontal)))
                        y=min(screenshot.height-1,max(0,int(rect['y']+rect['h']*vertical)))
                        background=luminance(screenshot.getpixel((x,y)))
                        contrasts.append((max(foreground,background)+.05)/(min(foreground,background)+.05))
            needed=3 if target['size']>=24 or (target['size']>=18.66 and target['weight']>=700) else 4.5
            ratio=min(contrasts) if contrasts else 0
            samples.append({'text':target['text'],'min':round(ratio,2),'required':needed,'pass':ratio>=needed})
        results.append({'width':width,'axe':axe,'gradient_contrast':samples})
        page.close()
    browser.close()
(OUTPUT/'accessibility.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
failures=[{'width':result['width'],'axe':result['axe']['violations'],'contrast':[sample for sample in result['gradient_contrast'] if not sample['pass']]} for result in results]
print(json.dumps(failures,ensure_ascii=False,indent=2))
sys.exit(1 if any(item['axe'] or item['contrast'] for item in failures) else 0)
