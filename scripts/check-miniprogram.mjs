import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url)),app=path.join(root,'miniprogram','app');
const config=JSON.parse(await readFile(path.join(app,'app.json'),'utf8'));
const project=JSON.parse(await readFile(path.join(root,'miniprogram','project.config.json'),'utf8'));
assert.equal(project.miniprogramRoot,'app/');assert.equal(project.compileType,'miniprogram');assert.equal(project.setting.urlCheck,true);
assert.ok(config.pages.length>=10);assert.ok(config.subPackages.length===12);assert.ok(config.tabBar.list.length<=5);
const files=[];async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink(),'No symlinks in app');const file=path.join(directory,entry.name);if(entry.isDirectory())await walk(file);else files.push({file,name:path.relative(app,file).replaceAll('\\','/'),bytes:(await stat(file)).size});}}
await walk(app);
const packageRoots=config.subPackages.map(item=>item.root+'/');
const sizes=[{name:'main',bytes:files.filter(item=>!packageRoots.some(prefix=>item.name.startsWith(prefix))).reduce((sum,item)=>sum+item.bytes,0)},...config.subPackages.map(pkg=>({name:pkg.name,root:pkg.root,bytes:files.filter(item=>item.name.startsWith(pkg.root+'/')).reduce((sum,item)=>sum+item.bytes,0)}))];
for(const item of sizes)assert.ok(item.bytes<2*1024*1024,`${item.name} exceeds conservative uncompressed 2MB budget: ${item.bytes}`);
assert.ok(files.reduce((sum,item)=>sum+item.bytes,0)<30*1024*1024,'Total code package must remain below 30MB');
const routes=[...config.pages,...config.subPackages.flatMap(pkg=>pkg.pages.map(page=>pkg.root+'/'+page))];
for(const route of routes)for(const ext of ['js','json','wxml','wxss'])assert.ok(files.some(item=>item.name===route+'.'+ext),'Missing route file: '+route+'.'+ext);
const require=createRequire(import.meta.url);const prior={wx:globalThis.wx,Page:globalThis.Page,Component:globalThis.Component};
globalThis.wx={};
const nativeTags=new Set(['view','text','block','image','button','input','textarea','picker','picker-view','picker-view-column','switch','slider','label','radio','radio-group','checkbox','checkbox-group','video','canvas','scroll-view','navigator','progress','rich-text','cover-view','cover-image','movable-view','movable-area']);
let checkedJs=0,checkedTemplates=0;
try {
  for(const item of files){
    assert.ok(!/(?:^|\/)(?:\.git|\.qa|node_modules|uploads|patient-data|user-data)(?:\/|$)/i.test(item.name),'Private/development directory in app');
    assert.ok(!/\.(?:pem|pfx|key|log|env)$/i.test(item.name),'Private material in app');
    if(item.name.endsWith('.json'))JSON.parse(await readFile(item.file,'utf8'));
    if(item.name.endsWith('.js')){
      const result=spawnSync(process.execPath,['--check',item.file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
      const source=await readFile(item.file,'utf8');assert.ok(!/\b(?:wx|platform|api|wxApi)\s*\.\s*(?:request|uploadFile|connectSocket|cloud|login|getUserProfile|getUserInfo|getLocation)\b/.test(source),'Unexpected network/account API: '+item.name);checkedJs++;
    }
    if(item.name.endsWith('.wxml')){
      const template=await readFile(item.file,'utf8');assert.ok(!/<web-view\b|<iframe\b|<script\b/.test(template),'Native page must not load a web shell');
      for(const match of template.matchAll(/wx:(if|elif|for)\s*=\s*"([^"]*)"/g))assert.ok(match[2].startsWith('{{')&&match[2].endsWith('}}'),'Literal wx:'+match[1]+' condition in '+item.name+': '+match[2]);
      const pageConfig=JSON.parse(await readFile(item.file.replace(/\.wxml$/,'.json'),'utf8'));
      for(const match of template.matchAll(/<([a-z][a-z0-9-]*)(?:\s|\/?\>)/g))assert.ok(nativeTags.has(match[1])||Object.hasOwn(pageConfig.usingComponents||{},match[1]),'Unregistered WXML tag '+match[1]+' in '+item.name);
      let definition;globalThis.Page=value=>{definition=value;};globalThis.Component=value=>{definition=value;};
      const js=item.file.replace(/\.wxml$/,'.js');delete require.cache[require.resolve(js)];require(js);
      assert.ok(definition,'Missing page/component definition in '+item.name);
      const handlers={...definition,...definition.methods};
      for(const match of template.matchAll(/(?:bind|catch)(?::)?[a-zA-Z-]+\s*=\s*"([^"]+)"/g))if(!match[1].includes('{{'))assert.equal(typeof handlers[match[1]],'function','Missing handler '+match[1]+' in '+item.name);
      checkedTemplates++;
    }
  }
} finally {for(const key of Object.keys(prior)){if(prior[key]===undefined)delete globalThis[key];else globalThis[key]=prior[key];}}
let compiled=null;
if(process.argv.includes('--compile')) {
  const tools=process.env.MINIPROGRAM_TOOLS_ROOT||path.join(root,'.qa','miniprogram','tools');
  let compiler,compilerVersion;try{compiler=require('miniprogram-compiler');compilerVersion=require('miniprogram-compiler/package.json').version;}catch{const qaRequire=createRequire(path.join(tools,'package.json'));compiler=qaRequire('miniprogram-compiler');compilerVersion=qaRequire('miniprogram-compiler/package.json').version;}
  const originalError=console.error;const diagnostics=[];console.error=(...args)=>diagnostics.push(args.map(String).join(' '));
  try {
    const wxml=compiler.wxmlToJs(app),wxss=compiler.wxssToJs(app);
    assert.equal(diagnostics.length,0,diagnostics.join('\n'));assert.ok(wxml.includes('先做一次评估')&&wxml.includes('patient-mouth'),'Compiled WXML omitted key content');
    assert.ok(wxss.includes('hero-title')&&wxss.includes('patient-mouth'),'Compiled WXSS omitted page styles');
    compiled={compiler:'miniprogram-compiler',version:compilerVersion,wxmlBytes:Buffer.byteLength(wxml),wxssBytes:Buffer.byteLength(wxss)};
  } finally {console.error=originalError;}
}
const result={checkedJs,checkedTemplates,pages:routes.length,files:files.length,totalBytes:files.reduce((sum,item)=>sum+item.bytes,0),packages:sizes,networkApiAudit:'no health upload, cloud or account APIs',compiled};
await mkdir(path.join(root,'.qa','miniprogram'),{recursive:true});await writeFile(path.join(root,'.qa','miniprogram','package-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
