import {mkdir,readFile,writeFile,cp,readdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildHospitalInstaller} from './build-installer.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const delivery=path.join(root,'delivery');
const dist=path.join(root,'dist');
const args=process.argv.slice(2);
const runtimeArg=args.indexOf('--runtime');
if(runtimeArg>=0&&!args[runtimeArg+1])throw new Error('--runtime 需要指定 Windows x64 Node.js v24.19.0 的 node.exe。');
const runtime=path.resolve(runtimeArg>=0?args[runtimeArg+1]:process.execPath);
const sha=data=>createHash('sha256').update(data).digest('hex');
const buildInfo=JSON.parse(await readFile(path.join(dist,'build-info.json'),'utf8'));
if(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version!==buildInfo.version)throw new Error('源码版本与 dist 不一致，请先重新构建再交付。');
for(const [name,expected] of Object.entries(buildInfo.applicationSha256||{}))if(sha(await readFile(path.join(root,name)))!==expected)throw new Error(`${name} 已更新，请先重新构建 dist 再交付。`);
if(!buildInfo.applicationSha256?.['assessment.mjs'])throw new Error('dist 缺少逐步评估，请先重新构建。');
for(const name of ['rehab-program.mjs','rehab-workbench.mjs','rehab-design.css','mobile-install.mjs','manifest.webmanifest','meditation.mjs','assets/clinical/desktop.ico'])if(!buildInfo.applicationSha256?.[name])throw new Error(`dist 缺少 ${name}，请先重新构建。`);
await mkdir(delivery,{recursive:true});
if(!path.resolve(delivery).startsWith(path.resolve(root)+path.sep))throw new Error('交付目录必须位于项目内。');
const web=path.join(delivery,'壶兰呼吸-网页发布版');
const source=path.join(delivery,'壶兰呼吸-源代码备份');
for(const target of [web,source]) {
  if(path.dirname(path.resolve(target))!==path.resolve(delivery))throw new Error('无效的交付目录。');
  await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
}
const rootFiles=[...new Set([...Object.keys(buildInfo.applicationSha256).filter(name=>!name.includes('/')), 'package.json','pnpm-lock.yaml','README.md','THIRD_PARTY_NOTICES.md','.gitignore','打开壶兰呼吸.cmd','停止壶兰呼吸.cmd','安装桌面快捷方式.cmd'])];
for(const name of rootFiles)await cp(path.join(root,name),path.join(source,name));
for(const name of ['scripts','tests','docs','.github'])await cp(path.join(root,name),path.join(source,name),{recursive:true,filter:target=>!/(?:^|[\\/])(?:\.qa|\.git|node_modules|uploads|patient-data)(?:[\\/]|$)/.test(target)});
await mkdir(path.join(source,'assets'),{recursive:true});
for(const name of ['favicon.svg','hulan-logo.jpg','rehab-garden.webp','chapters','clinical','education-videos','education-scenes','mobile','ocr-lang'])await cp(path.join(root,'assets',name),path.join(source,'assets',name),{recursive:true});
try{await cp(path.join(root,'assets','access-qr.svg'),path.join(source,'assets','access-qr.svg'));}catch(error){if(error.code!=='ENOENT')throw error;}
await cp(dist,web,{recursive:true});
await writeFile(path.join(web,'部署说明.txt'),`本文件夹用于静态 HTTPS 网页发布，入口为 index.html，适配患者手机浏览器及主屏幕打开。保留 manifest.webmanifest、assets/mobile/ 和全部 assets/vendor/ 资源。GitHub Pages 子路径使用相对资源地址。\n\n患者通过手机浏览器打开网页，点击“添加到手机桌面”查看本机操作。iPhone 使用 Safari 的分享菜单添加到主屏幕；Android 使用浏览器的安装或添加到主屏幕菜单。真实系统安装需患者主动确认，浏览器支持可能不同。\n\n手机桌面入口需要联网加载网页，不自动缓存疾病视频或 OCR 模型，也不提供跨设备健康记录同步。报告在本机处理，不需要上传接口。完整源代码另附。\n`,'utf8');
async function manifest(directory) {
  const files=[];
  async function walk(current) {for(const entry of await readdir(current,{withFileTypes:true})) {const absolute=path.join(current,entry.name);if(entry.isSymbolicLink())throw new Error('交付包不包含符号链接。');if(entry.isDirectory())await walk(absolute);else files.push({path:path.relative(directory,absolute).replaceAll('\\','/'),bytes:(await stat(absolute)).size,sha256:sha(await readFile(absolute))});}}
  await walk(directory);return files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
const packages=[];
for(const directory of [web,source]) {
  const files=await manifest(directory);
  const forbidden=files.filter(file=>/(?:^|\/)(?:\.git|\.qa|\.reference|\.runtime|node_modules|uploads|patient-data|credentials|secrets)(?:\/|$)/i.test(file.path)||/\.(?:log|env|pem|p12|pfx)$/i.test(file.path)||/(?:^|\/)\.env(?:\.|$)/i.test(file.path));
  if(forbidden.length)throw new Error('交付包包含禁止的临时或个人资料文件。');
  await writeFile(path.join(directory,'文件校验清单.json'),JSON.stringify({application:'hulan-breath-rehab',version:buildInfo.version,files},null,2));
  const zipPath=directory+'.zip';
  const zipped=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','archive.ps1'),'-SourceDirectory',directory,'-DestinationFile',zipPath],{encoding:'utf8',windowsHide:true});
  if(zipped.status!==0)throw new Error(`ZIP 打包失败：${zipped.stderr||zipped.stdout}`);
  packages.push({directory:path.basename(directory),archive:path.basename(zipPath),bytes:(await stat(zipPath)).size,sha256:sha(await readFile(zipPath)),files:files.length+1});
}
const installer=await buildHospitalInstaller({runtime,outputDirectory:delivery});
packages.unshift({kind:installer.kind,archive:installer.archive,bytes:installer.bytes,sha256:installer.sha256,files:installer.files,platform:installer.platform,arch:installer.arch,signed:installer.signed});
await writeFile(path.join(delivery,'delivery-manifest.json'),JSON.stringify({application:'hulan-breath-rehab',version:buildInfo.version,runtime:installer.runtime,packages},null,2));
console.log(JSON.stringify({delivery,packages},null,2));
