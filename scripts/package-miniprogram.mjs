import {mkdir,readFile,writeFile,cp,readdir,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'miniprogram'),delivery=path.join(root,'delivery');
const staging=path.join(delivery,'壶兰呼吸-微信小程序');
const args=process.argv.slice(2),pythonIndex=args.indexOf('--python');
if(pythonIndex>=0&&!args[pythonIndex+1])throw new Error('--python requires an executable path');
const python=pythonIndex>=0?args[pythonIndex+1]:process.env.PYTHON_PATH||'python';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const info=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));
assert.match(info.version,/^\d+\.\d+\.\d+$/);
const check=spawnSync(process.execPath,[path.join(root,'scripts','check-miniprogram.mjs'),'--compile'],{encoding:'utf8',windowsHide:true});
if(check.status!==0)throw new Error(check.stderr||check.stdout||'Mini Program check failed');
const checks=JSON.parse(check.stdout.trim());
const project=JSON.parse(await readFile(path.join(source,'project.config.json'),'utf8'));
assert.equal(project.appid,'touristappid','Public source delivery uses a placeholder AppID');
for(const name of ['README.md','DESIGN.md','ACCEPTANCE.md','THIRD_PARTY_NOTICES.md'])assert.ok((await stat(path.join(source,name))).size>0);

const forbidden=relative=>/(?:^|\/)(?:\.git|\.qa|node_modules|uploads|patient-data|user-data|credentials|secrets)(?:\/|$)/i.test(relative)||/(?:^|\/)project\.private\.config\.json$/i.test(relative)||/(?:^|\/)\.env(?:\.|$)|\.(?:pem|p12|pfx|key|log)$/i.test(relative);
await mkdir(delivery,{recursive:true});
assert.equal(path.dirname(path.resolve(staging)),path.resolve(delivery));
assert.ok(path.resolve(delivery).startsWith(path.resolve(root)+path.sep));
await rm(staging,{recursive:true,force:true});
await cp(source,staging,{recursive:true,filter:filename=>!forbidden(path.relative(source,filename).replaceAll('\\','/'))});
const files=[];
async function walk(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    assert.ok(!entry.isSymbolicLink(),'Source delivery cannot contain symlinks');
    const absolute=path.join(directory,entry.name),relative=path.relative(staging,absolute).replaceAll('\\','/');
    assert.ok(!forbidden(relative),'Private material in source delivery: '+relative);
    if(entry.isDirectory())await walk(absolute);
    else {
      const bytes=await readFile(absolute);
      if(/\.(?:md|json|js|wxml|wxss|svg|txt)$/.test(relative)) {
        assert.ok(!/[CDE]:[\\/]Users[\\/]|[CDE]:[\\/]chatgpt[\\/]/i.test(bytes.toString('utf8')),'Local personal path in source delivery: '+relative);
        assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')),'Private key in source delivery');
      }
      files.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});
    }
  }
}
await walk(staging);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
const manifest={application:'hulan-breath-rehab',kind:'wechat-miniprogram-source',version:info.version,appId:'placeholder',files};
await writeFile(path.join(staging,'file-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const archive=path.join(delivery,`hulan-breath-rehab-wechat-${info.version}.zip`);
assert.equal(path.dirname(path.resolve(archive)),path.resolve(delivery));
const archiveScript=String.raw`
import hashlib, json, pathlib, sys, zipfile
source, target = map(pathlib.Path, sys.argv[1:3])
paths = sorted(p for p in source.rglob('*') if p.is_file())
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in paths:
        name = file.relative_to(source).as_posix()
        info = zipfile.ZipInfo(name, (2026, 10, 22, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes(), compresslevel=9)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None, 'ZIP CRC check failed'
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Duplicate archive entry'
    assert all('\\' not in name and not name.startswith('/') and '..' not in pathlib.PurePosixPath(name).parts for name in names), 'Non-portable archive path'
    manifest = json.loads(archive.read('file-manifest.json'))
    expected = {item['path'] for item in manifest['files']} | {'file-manifest.json'}
    assert set(names) == expected, 'Unexpected or missing archive entry'
    for item in manifest['files']:
        data = archive.read(item['path'])
        assert len(data) == item['bytes'], item['path']
        assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
print(json.dumps({'verifiedFiles':len(names),'crc':'passed','sha256':'all manifest entries matched','portablePaths':True}))
`;
const zipped=spawnSync(python,['-c',archiveScript,staging,archive],{encoding:'utf8',windowsHide:true});
if(zipped.status!==0)throw new Error('ZIP creation or verification failed: '+(zipped.stderr||zipped.stdout||'Python executable not available'));
const verification=JSON.parse(zipped.stdout.trim());
const result={application:'hulan-breath-rehab',kind:'wechat-miniprogram-source',version:info.version,appId:'not-bound',releaseDate:'2026-10-22',archive:path.basename(archive),bytes:(await stat(archive)).size,sha256:sha(await readFile(archive)),verification,codePackage:checks,validationLimit:'Official template/style compilation and simulated API tests; not yet tested in WeChat DevTools or on a phone'};
const manifestPath=path.join(delivery,'wechat-delivery-manifest.json');
await writeFile(manifestPath,JSON.stringify(result,null,2)+'\n');
await writeFile(path.join(delivery,'SHA256SUMS-wechat.txt'),`${result.sha256}  ${result.archive}\n${sha(await readFile(manifestPath))}  ${path.basename(manifestPath)}\n`);
console.log(JSON.stringify(result,null,2));
