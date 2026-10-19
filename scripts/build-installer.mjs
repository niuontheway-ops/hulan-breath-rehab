import {cp,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=data=>createHash('sha256').update(data).digest('hex');
const expectedCompiler={version:'6.7.3',sha256:'9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732',isccSha256:'0a8757031b33777e4c9cbffee40f11a5062b36d25cbe144c1db73b6102b80ad7',compilerDllSha256:'85a1e3090d3a5b85319f001b7c8f9ecfad45f37eff030a67bbe29ef58b7aa2c3',url:'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe'};
const help=`node scripts/build-installer.mjs [--runtime Windows-x64-node.exe] [--compiler ISCC.exe] [--output-dir directory]\nRun pnpm build first. The installer packages the exact verified dist snapshot; package-delivery.mjs also checks the current source.\n`;

async function listFiles(directory) {
  const files=[];
  async function walk(current) {for(const entry of await readdir(current,{withFileTypes:true})) {
    const absolute=path.join(current,entry.name);
    if(entry.isSymbolicLink())throw new Error('安装内容不允许符号链接。');
    if(entry.isDirectory())await walk(absolute);
    else files.push({path:path.relative(directory,absolute).replaceAll('\\','/'),bytes:(await stat(absolute)).size,sha256:sha(await readFile(absolute))});
  }}
  await walk(directory);return files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}

export async function buildHospitalInstaller(options={}) {
  if(process.platform!=='win32')throw new Error('医院 EXE 安装包须在 Windows 上编译并验证。');
  const dist=path.join(root,'dist');
  const buildInfo=JSON.parse(await readFile(path.join(dist,'build-info.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(buildInfo.version))throw new Error('无效的应用版本。');
  for(const [name,expected] of Object.entries(buildInfo.applicationSha256||{})) {
    if(sha(await readFile(path.join(dist,name)))!==expected)throw new Error(`${name} 与 dist 构建清单不一致。`);
  }
  for(const name of ['rehab-program.mjs','rehab-workbench.mjs','assets/clinical/desktop.ico'])if(!buildInfo.applicationSha256?.[name])throw new Error(`构建缺少 ${name}。`);
  const runtime=path.resolve(options.runtime||process.execPath);
  const runtimeResult=spawnSync(runtime,['-p','JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})'],{encoding:'utf8',windowsHide:true});
  if(runtimeResult.status!==0)throw new Error('无法检查随包运行时。');
  const runtimeInfo=JSON.parse(runtimeResult.stdout);
  if(runtimeInfo.platform!=='win32'||runtimeInfo.arch!=='x64'||runtimeInfo.version!=='v24.19.0')throw new Error('安装包需要与许可证一致的 Windows x64 Node.js v24.19.0。');
  const compiler=path.resolve(options.compiler||path.join(root,'.qa','installer','toolchain','inno','ISCC.exe'));
  if(sha(await readFile(compiler))!==expectedCompiler.isccSha256||sha(await readFile(path.join(path.dirname(compiler),'ISCmplr.dll')))!==expectedCompiler.compilerDllSha256)throw new Error('请先运行 scripts/installer/prepare-toolchain.ps1，准备官方 Inno Setup 6.7.3 便携编译器。');
  const outputDirectory=path.resolve(options.outputDirectory||path.join(root,'delivery'));
  if(!outputDirectory.startsWith(path.resolve(root)+path.sep))throw new Error('安装包输出目录必须位于当前项目内。');
  const payload=path.join(root,'.qa','installer','payload');
  if(path.dirname(payload)!==path.join(root,'.qa','installer'))throw new Error('无效的安装内容目录。');
  await rm(payload,{recursive:true,force:true});await mkdir(payload,{recursive:true});
  await cp(dist,path.join(payload,'dist'),{recursive:true});
  await mkdir(path.join(payload,'scripts','desktop'),{recursive:true});
  for(const name of ['common.ps1','launch.ps1','stop.ps1','NODE-LICENSE.txt'])await cp(path.join(root,'scripts','desktop',name),path.join(payload,'scripts','desktop',name));
  await cp(path.join(root,'scripts','serve.mjs'),path.join(payload,'scripts','serve.mjs'));
  for(const name of ['打开壶兰呼吸.cmd','停止壶兰呼吸.cmd'])await cp(path.join(root,name),path.join(payload,name));
  await cp(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(payload,'THIRD_PARTY_NOTICES.md'));
  await writeFile(path.join(payload,'医院安装与使用说明.txt'),'\uFEFF'+await readFile(path.join(root,'docs','hospital-installation.md'),'utf8'),'utf8');
  await mkdir(path.join(payload,'runtime'),{recursive:true});
  await cp(runtime,path.join(payload,'runtime','node.exe'));
  const license=await readFile(path.join(root,'scripts','desktop','NODE-LICENSE.txt'));
  await writeFile(path.join(payload,'runtime','LICENSE.txt'),license);
  await writeFile(path.join(payload,'runtime','runtime-info.json'),JSON.stringify({...runtimeInfo,nodeSha256:sha(await readFile(runtime)),licenseSource:'https://raw.githubusercontent.com/nodejs/node/v24.19.0/LICENSE',licenseSha256:sha(license)},null,2));
  await writeFile(path.join(payload,'installation-info.json'),JSON.stringify({application:'hulan-breath-rehab',version:buildInfo.version,kind:'hospital-current-user',buildFingerprint:sha(await readFile(path.join(dist,'build-info.json')))}));
  const files=await listFiles(payload);
  const forbidden=files.filter(file=>/(?:^|\/)(?:\.git|\.qa|\.private|\.reference|fixtures?|node_modules|uploads|patient-data|credentials|secrets)(?:\/|$)/i.test(file.path)||/\.(?:log|env|pem|p12|pfx)$/i.test(file.path)||/(?:^|\/)\.env(?:\.|$)/i.test(file.path));
  if(forbidden.length)throw new Error('安装内容包含临时或个人资料文件。');
  await writeFile(path.join(payload,'文件校验清单.json'),JSON.stringify({application:'hulan-breath-rehab',version:buildInfo.version,files},null,2));
  await mkdir(outputDirectory,{recursive:true});
  const result=spawnSync(compiler,['/Qp',`/DAppVersion=${buildInfo.version}`,`/DPayloadDirectory=${payload}`,`/DInstallerOutputDirectory=${outputDirectory}`,path.join(root,'scripts','installer','hulan-hospital.iss')],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
  const compileLog=path.join(root,'.qa','installer','compile.log');await writeFile(compileLog,`${result.stdout||''}${result.stderr||''}`,'utf8');
  if(result.status!==0)throw new Error(`EXE 编译失败，请查看 .qa/installer/compile.log：${result.stderr||result.stdout||result.error}`);
  const installerPath=path.join(outputDirectory,`hulan-breath-rehab-${buildInfo.version}-windows-x64-setup.exe`);
  const executable=await readFile(installerPath);
  if(executable.toString('ascii',0,2)!=='MZ')throw new Error('安装包不是 Windows PE 程序。');
  const privatePaths=[root.replace(/[\\/]$/,''),process.env.USERPROFILE].filter(Boolean).flatMap(value=>[value,value.replaceAll('\\','/')]);
  for(const value of privatePaths)for(const encoding of ['utf8','utf16le'])if(executable.indexOf(Buffer.from(value,encoding))>=0)throw new Error('安装包中发现构建电脑的可见私人绝对路径，已停止交付。');
  const manifest={application:'hulan-breath-rehab',version:buildInfo.version,kind:'windows-exe-installer',archive:path.basename(installerPath),bytes:executable.length,sha256:sha(executable),files:files.length+1,platform:'win32',arch:'x64',compiler:expectedCompiler,runtime:runtimeInfo,payloadFingerprint:sha(await readFile(path.join(payload,'文件校验清单.json'))),visiblePrivatePathScan:{utf8:'pass',utf16le:'pass'},signed:false};
  await writeFile(path.join(outputDirectory,'hospital-installer-manifest.json'),JSON.stringify(manifest,null,2));
  return {installerPath,payload,...manifest};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.includes('--help')) {console.log(help);process.exit(0);}
  const options={};
  for(let index=0;index<args.length;index+=2) {
    const key={'--runtime':'runtime','--compiler':'compiler','--output-dir':'outputDirectory'}[args[index]];
    if(!key||!args[index+1])throw new Error(help);options[key]=args[index+1];
  }
  console.log(JSON.stringify(await buildHospitalInstaller(options),null,2));
}
