import {mkdir,readFile,writeFile,cp,readdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const delivery=path.join(root,'delivery');
const dist=path.join(root,'dist');
const args=process.argv.slice(2);
const runtimeArg=args.indexOf('--runtime');
const runtime=path.resolve(runtimeArg>=0?args[runtimeArg+1]:process.execPath);
const sha=data=>createHash('sha256').update(data).digest('hex');
const runtimeCheck=spawnSync(runtime,['-p','JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})'],{encoding:'utf8',windowsHide:true});
if(runtimeCheck.status!==0)throw new Error('无法读取电脑包的 Node.js 运行时。');
const runtimeInfo=JSON.parse(runtimeCheck.stdout);
if(runtimeInfo.platform!=='win32'||runtimeInfo.arch!=='x64'||runtimeInfo.version!=='v24.19.0')throw new Error('电脑包需要与所附许可证对应的 Windows x64 Node.js v24.19.0。');
const buildInfo=JSON.parse(await readFile(path.join(dist,'build-info.json'),'utf8'));
for(const [name,expected] of Object.entries(buildInfo.applicationSha256||{}))if(sha(await readFile(path.join(root,name)))!==expected)throw new Error(`${name} 已更新，请先重新构建 dist 再交付。`);
if(!buildInfo.applicationSha256?.['assessment.mjs'])throw new Error('dist 缺少逐步评估，请先重新构建。');
await mkdir(delivery,{recursive:true});
if(!path.resolve(delivery).startsWith(path.resolve(root)+path.sep))throw new Error('交付目录必须位于项目内。');
const desktop=path.join(delivery,'壶兰呼吸-电脑本地版');
const web=path.join(delivery,'壶兰呼吸-网页发布版');
const source=path.join(delivery,'壶兰呼吸-源代码备份');
for(const target of [desktop,web,source]) {
  if(path.dirname(path.resolve(target))!==path.resolve(delivery))throw new Error('无效的交付目录。');
  await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
}
const rootFiles=['index.html','styles.css','interaction.css','patient-content.css','app.mjs','assessment.mjs','ui-motion.mjs','clinical.mjs','reports.mjs','game.mjs','daily.mjs','education.mjs','inhaler.mjs','music.mjs','package.json','pnpm-lock.yaml','README.md','THIRD_PARTY_NOTICES.md','.gitignore','打开壶兰呼吸.cmd','安装桌面快捷方式.cmd','停止壶兰呼吸.cmd'];
for(const name of rootFiles)await cp(path.join(root,name),path.join(source,name));
for(const name of ['scripts','tests','docs','.github'])await cp(path.join(root,name),path.join(source,name),{recursive:true,filter:target=>!/(?:^|[\\/])(?:\.qa|\.git|node_modules|uploads|patient-data)(?:[\\/]|$)/.test(target)});
await mkdir(path.join(source,'assets'),{recursive:true});
for(const name of ['favicon.svg','hulan-logo.jpg','rehab-garden.webp','chapters','education-videos','ocr-lang'])await cp(path.join(root,'assets',name),path.join(source,'assets',name),{recursive:true});
try{await cp(path.join(root,'assets','access-qr.svg'),path.join(source,'assets','access-qr.svg'));}catch(error){if(error.code!=='ENOENT')throw error;}
await cp(source,path.join(desktop,'源代码备份'),{recursive:true});
await cp(dist,path.join(desktop,'dist'),{recursive:true});
await cp(dist,web,{recursive:true});
await mkdir(path.join(desktop,'scripts'),{recursive:true});
await cp(path.join(root,'scripts','serve.mjs'),path.join(desktop,'scripts','serve.mjs'));
await cp(path.join(root,'scripts','desktop'),path.join(desktop,'scripts','desktop'),{recursive:true});
for(const name of ['打开壶兰呼吸.cmd','安装桌面快捷方式.cmd','停止壶兰呼吸.cmd','THIRD_PARTY_NOTICES.md'])await cp(path.join(root,name),path.join(desktop,name));
await mkdir(path.join(desktop,'runtime'),{recursive:true});
await cp(runtime,path.join(desktop,'runtime','node.exe'));
await cp(path.join(root,'scripts','desktop','NODE-LICENSE.txt'),path.join(desktop,'runtime','LICENSE.txt'));
await writeFile(path.join(desktop,'runtime','runtime-info.json'),JSON.stringify({...runtimeInfo,nodeSha256:sha(await readFile(runtime)),licenseSource:'https://raw.githubusercontent.com/nodejs/node/v24.19.0/LICENSE',licenseSha256:sha(await readFile(path.join(root,'scripts','desktop','NODE-LICENSE.txt')))},null,2));
await writeFile(path.join(desktop,'电脑使用说明.txt'),`壶兰呼吸 · 呼吸医学科三区\n\n1. 将整个电脑包解压到一个固定文件夹。不要在 ZIP 压缩包内直接运行。\n2. 双击“安装桌面快捷方式.cmd”，桌面上会出现“壶兰呼吸康复训练”。\n3. 此后双击桌面快捷方式，即可在系统默认浏览器打开。也可双击“打开壶兰呼吸.cmd”。\n4. 服务隐藏运行，不需要保留命令行窗口。关闭浏览器后服务仍在本机运行；需要停止时双击“停止壶兰呼吸.cmd”，或关闭电脑。\n5. 本包自带 Windows x64 Node.js v24.19.0 和 PDF / 中英文 OCR 资源，不要求另行安装 Node.js，也不需要联网安装依赖。\n6. 请通过启动文件打开，不要直接双击 dist/index.html：网页模块和 OCR 需要本机 HTTP 服务。\n7. 本机服务只监听 http://127.0.0.1:4196/，同一版本重复打开会复用服务。它不对其他手机或电脑开放。\n8. 疾病宣教短片、字幕和插画可离线播放。原版音乐、吸入剂外部视频和参考资料需要联网；设备音乐可离线播放。\n9. 健康资料默认只留在本次页面，刷新或关闭后清除。只有主动开启“在这台设备记住健康画像、每日评估与训练记录”后，结构化资料才保存在当前浏览器的本机存储中。不同浏览器、手机网页和电脑本地版之间不会自动同步。\n10. 如需移动文件夹，请先停止服务，再重新运行安装桌面快捷方式。\n\n源代码备份：见“源代码备份”文件夹。运行依赖、OCR 模型和许可：见 dist/assets/vendor/、runtime/ 和 THIRD_PARTY_NOTICES.md。\n`,'utf8');
await writeFile(path.join(web,'部署说明.txt'),`本文件夹是静态网页发布版。将全部内容部署到支持 HTTPS 的静态网站（含 GitHub Pages），网页入口为 index.html。\n\n保留 assets/vendor/ 下的 PDF、OCR、语言模型及许可证，不需要服务器上传接口。发布地址确定后，二维码应指向实际可访问的 HTTPS 地址。网页评估记录保存在访问者自己的浏览器，不会自动同步到电脑本地版。\n\n本文件夹不是双击运行的电脑包。电脑离线使用请选择“壶兰呼吸-电脑本地版”。疾病短片随包提供；原版音乐、吸入剂外部视频和参考资料链接需要联网。\n`,'utf8');
async function manifest(directory) {
  const files=[];
  async function walk(current) {for(const entry of await readdir(current,{withFileTypes:true})) {const absolute=path.join(current,entry.name);if(entry.isSymbolicLink())throw new Error('交付包不包含符号链接。');if(entry.isDirectory())await walk(absolute);else files.push({path:path.relative(directory,absolute).replaceAll('\\','/'),bytes:(await stat(absolute)).size,sha256:sha(await readFile(absolute))});}}
  await walk(directory);return files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
const packages=[];
for(const directory of [desktop,web,source]) {
  const files=await manifest(directory);
  const forbidden=files.filter(file=>/(?:^|\/)(?:\.git|\.qa|\.reference|\.runtime|node_modules|uploads|patient-data)(?:\/|$)/.test(file.path)||/\.(?:log|env)$/i.test(file.path));
  if(forbidden.length)throw new Error('交付包包含禁止的临时或个人资料文件。');
  await writeFile(path.join(directory,'文件校验清单.json'),JSON.stringify({application:'hulan-breath-rehab',version:buildInfo.version,files},null,2));
  const zipPath=directory+'.zip';
  const zipped=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','desktop','archive.ps1'),'-SourceDirectory',directory,'-DestinationFile',zipPath],{encoding:'utf8',windowsHide:true});
  if(zipped.status!==0)throw new Error(`ZIP 打包失败：${zipped.stderr||zipped.stdout}`);
  packages.push({directory:path.basename(directory),archive:path.basename(zipPath),bytes:(await stat(zipPath)).size,sha256:sha(await readFile(zipPath)),files:files.length+1});
}
await writeFile(path.join(delivery,'delivery-manifest.json'),JSON.stringify({application:'hulan-breath-rehab',version:buildInfo.version,runtime:runtimeInfo,packages},null,2));
console.log(JSON.stringify({delivery,packages},null,2));
