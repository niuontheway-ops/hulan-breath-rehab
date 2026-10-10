import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid local server port');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.wasm':'application/wasm','.gz':'application/gzip','.bcmap':'application/octet-stream','.ttf':'font/ttf','.pfb':'application/octet-stream'};
try{await stat(path.join(root,'index.html'));}catch{console.error('请先运行 pnpm build，生成 dist 后再启动。');process.exit(1);}
const buildInfo=await readFile(path.join(root,'build-info.json'));
const fingerprint=createHash('sha256').update(buildInfo).digest('hex');
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end('Forbidden');return;}
  try {
    const url=new URL(req.url,'http://localhost');let relative=decodeURIComponent(url.pathname);if(relative==='/')relative='/index.html';
    if(relative==='/__hulan_health__') {
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify({application:'hulan-breath-rehab',fingerprint,pid:process.pid}));return;
    }
    const target=path.resolve(root,'.'+relative);
    if(target!==path.resolve(root)&&!target.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const data=await readFile(target);
    const headers={'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Accept-Ranges':'bytes','Content-Length':data.length};
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      const start=match?.[1]?Number(match[1]):match?.[2]?Math.max(0,data.length-Number(match[2])):NaN;
      const end=match?.[1]&&match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=data.length||end<start){res.writeHead(416,{...headers,'Content-Range':`bytes */${data.length}`,'Content-Length':0});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(req.method==='HEAD'?undefined:data.subarray(start,end+1));return;
    }
    res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`壶兰呼吸 Local: http://127.0.0.1:${port}`));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请使用其他端口或关闭原服务。`:error.message);process.exit(1);});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
