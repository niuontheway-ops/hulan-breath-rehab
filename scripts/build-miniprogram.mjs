import {mkdir,readFile,writeFile,cp,readdir,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const app=path.join(root,'miniprogram','app');
const topics=['copd','asthma','bronchiectasis','lungcancer','pneumoconiosis','ild','pneumothorax','effusion','tb','corpulmonale','osa','quit'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceInfo=[];
await mkdir(path.join(app,'core'),{recursive:true});
for(const name of ['clinical','daily','game','meditation']) {
  const original=await readFile(path.join(root,name+'.mjs'),'utf8');
  const cutoff={daily:'\nfunction metricValue(',game:'\nconst encouragements = [',meditation:'\nfunction natureDefs('}[name];
  if(cutoff&&!original.includes(cutoff))throw new Error('Pure module boundary needs review: '+name);
  const selected=cutoff?original.slice(0,original.indexOf(cutoff)):original;
  const names=[...selected.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map(match=>match[1]);
  if(!names.length)throw new Error('No module exports: '+name);
  let code=selected.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/(\w+)\.mjs['"];?\r?\n/gm,(_match,items,file)=>`const {${items}}=require('./${file}');\n`).replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g,'');
  code=code.replace(/Object\.hasOwn\(/g,'hasOwn(');
  if(name==='clinical') {
    const dateBlock=/const calendar = new Intl\.DateTimeFormat\('en-CA',[\s\S]*?const today = Date\.UTC\(part\('year'\), part\('month'\) - 1, part\('day'\)\);/;
    if(!dateBlock.test(code))throw new Error('Clinical calendar adapter needs review');
    code=code.replace(dateBlock,"const today = Date.parse(shanghaiDay(now) + 'T00:00:00.000Z');");
    code="const shanghaiDay=date=>new Date(date.getTime()+8*3600000).toISOString().slice(0,10);\n"+code;
  }
  if(name==='daily') {
    const dateBlock=/function shanghaiDay\(date\) \{[\s\S]*?\r?\n\}/;
    if(!dateBlock.test(code))throw new Error('Daily calendar adapter needs review');
    code=code.replace(dateBlock,"function shanghaiDay(date) { return new Date(date.getTime()+8*3600000).toISOString().slice(0,10); }");
  }
  const header="// Generated from the corresponding project module by scripts/build-miniprogram.mjs.\nconst hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);\n";
  const output=header+code+`\nmodule.exports={${names.join(',')}};\n`;
  if(/\bimport\s|\bexport\s+(?:function|const)|new Intl\./.test(output))throw new Error('Unsupported module or date dependency: '+name);
  await writeFile(path.join(app,'core',name+'.js'),output,'utf8');
  sourceInfo.push({source:name+'.mjs',sourceSha256:digest(original),output:'core/'+name+'.js',outputSha256:digest(output)});
}
await mkdir(path.join(app,'assets','chapters'),{recursive:true});
await mkdir(path.join(app,'assets','education-scenes'),{recursive:true});
for(const name of ['hulan-logo.jpg','rehab-garden.webp'])await cp(path.join(root,'assets',name),path.join(app,'assets',name));
for(const name of await readdir(path.join(root,'assets','chapters')))if(name.endsWith('.svg'))await cp(path.join(root,'assets','chapters',name),path.join(app,'assets','chapters',name));
for(const name of topics.map(id=>id+'.webp'))await cp(path.join(root,'assets','education-scenes',name),path.join(app,'assets','education-scenes',name));
for(const name of await readdir(path.join(app,'assets','education-scenes')))if(name.endsWith('.webp')&&!topics.includes(name.slice(0,-5))){const target=path.join(app,'assets','education-scenes',name);if(path.dirname(target)!==path.join(app,'assets','education-scenes'))throw new Error('Invalid generated asset');await rm(target);}
const config=JSON.parse(await readFile(path.join(app,'app.json'),'utf8'));
config.subPackages=topics.map(id=>({name:'lesson-'+id,root:'media/'+id,pages:['index']}));
await writeFile(path.join(app,'app.json'),JSON.stringify(config,null,2)+'\n');
await writeFile(path.join(app,'core','source-manifest.json'),JSON.stringify({sourceVersion:JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,adapters:['Pure functions only; browser rendering excluded','CommonJS module syntax','Object.hasOwn compatibility','Shanghai calendar without Intl'],files:sourceInfo},null,2)+'\n');
await mkdir(path.join(root,'miniprogram','docs'),{recursive:true});
for(const name of ['clinical-rules.md','rehab-evidence-2026.md','inhaler-mainland-evidence.md','inhaler-video-sources.md','education-film-design.md','education-video-generation.md'])await cp(path.join(root,'docs',name),path.join(root,'miniprogram','docs',name));
await cp(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(root,'miniprogram','THIRD_PARTY_NOTICES.md'));
console.log(JSON.stringify({generatedModules:sourceInfo.length,subpackages:config.subPackages.length,logoBytes:(await stat(path.join(app,'assets','hulan-logo.jpg'))).size}));
