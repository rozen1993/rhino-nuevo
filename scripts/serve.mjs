import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain','.pdf':'application/pdf','.ico':'image/x-icon'};
createServer(async(req,res)=>{
  try {
    let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end();}
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    const data=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Robots-Tag':'noindex, follow','Cache-Control':'no-store'});res.end(data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','X-Robots-Tag':'noindex, follow'});res.end('Esta página no está incluida en la propuesta local. Vuelve al inicio.');}
}).listen(4323,'127.0.0.1',()=>console.log('Rhino local: http://127.0.0.1:4323'));
