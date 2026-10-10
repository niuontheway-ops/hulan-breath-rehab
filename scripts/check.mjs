import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=['app.mjs','assessment.mjs','ui-motion.mjs','clinical.mjs','reports.mjs','game.mjs','daily.mjs','education.mjs','music.mjs',...(await readdir(path.join(root,'scripts'))).filter(s=>s.endsWith('.mjs')).map(s=>`scripts/${s}`)];
for(const file of files){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}}
for(const lang of ['chi_sim','eng'])if((await stat(path.join(root,'assets','ocr-lang',`${lang}.traineddata.gz`))).size<100000)throw new Error('Invalid OCR model');
const html=await readFile(path.join(root,'index.html'),'utf8');
if(!html.includes('lang="zh-CN"')||!html.includes('Content-Security-Policy'))throw new Error('Missing document accessibility or content policy');
if(/<script[^>]+src="https?:/.test(html))throw new Error('Unexpected external script');
console.log(`语法与资源检查通过：${files.length} 个模块，本机 OCR 模型已包含。`);
