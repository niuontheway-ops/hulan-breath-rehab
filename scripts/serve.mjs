import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.gz':'application/gzip','.bcmap':'application/octet-stream','.ttf':'font/ttf','.pfb':'application/octet-stream'};
try{await stat(path.join(root,'index.html'));}catch{console.error('请先运行 pnpm build，生成 dist 后再启动。');process.exit(1);}
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  try {
    const url=new URL(req.url,'http://localhost');let relative=decodeURIComponent(url.pathname);if(relative==='/')relative='/index.html';
    const target=path.resolve(root,'.'+relative);
    if(target!==path.resolve(root)&&!target.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`壶兰呼吸 Local: http://127.0.0.1:${port}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
