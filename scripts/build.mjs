import {mkdir,readFile,writeFile,cp,stat,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const args=process.argv.slice(2);
const moduleArg=args.indexOf('--modules');
const modules=path.resolve(moduleArg>=0?args[moduleArg+1]:path.join(root,'node_modules'));
const expected={'pdfjs-dist':'5.6.205','tesseract.js':'7.0.0','tesseract.js-core':'7.0.0'};
for(const [name,version] of Object.entries(expected)) {
  let installed;
  try{installed=JSON.parse(await readFile(path.join(modules,name,'package.json'),'utf8'));}catch{throw new Error(`缺少 ${name}，请先运行 pnpm install。`);}
  if(installed.version!==version)throw new Error(`${name} 版本应为 ${version}，实际为 ${installed.version}。`);
}
if(path.dirname(dist)!==path.resolve(root))throw new Error('Invalid build directory');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
for(const name of ['index.html','styles.css','app.mjs','clinical.mjs','reports.mjs','game.mjs'])await cp(path.join(root,name),path.join(dist,name));
const vendor=path.join(dist,'assets','vendor');
await cp(path.join(root,'assets','favicon.svg'),path.join(dist,'assets','favicon.svg'));
const pdf=path.join(vendor,'pdfjs');await mkdir(pdf,{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await cp(path.join(modules,'pdfjs-dist','build',name),path.join(pdf,name));
for(const name of ['cmaps','standard_fonts','wasm'])await cp(path.join(modules,'pdfjs-dist',name),path.join(pdf,name),{recursive:true});
await cp(path.join(modules,'pdfjs-dist','LICENSE'),path.join(pdf,'LICENSE'));
const ocr=path.join(vendor,'ocr');await mkdir(path.join(ocr,'core'),{recursive:true});
for(const name of ['tesseract.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await cp(path.join(modules,'tesseract.js','dist',name),path.join(ocr,name));
await cp(path.join(modules,'tesseract.js','LICENSE.md'),path.join(ocr,'LICENSE.md'));
for(const name of await readdir(path.join(modules,'tesseract.js-core')))if(/^tesseract-core(?:-simd|-relaxedsimd)?-lstm\.(?:js|wasm|wasm\.js)$/.test(name))await cp(path.join(modules,'tesseract.js-core',name),path.join(ocr,'core',name));
await cp(path.join(modules,'tesseract.js-core','LICENSE'),path.join(ocr,'core','LICENSE'));
const hashes={};
for(const lang of ['chi_sim','eng']) {
  const source=path.join(root,'assets','ocr-lang',`${lang}.traineddata.gz`);
  if((await stat(source)).size<100000)throw new Error(`OCR语言包缺失或损坏：${lang}`);
  const data=await readFile(source);hashes[lang]=createHash('sha256').update(data).digest('hex');
  await mkdir(path.join(ocr,'lang'),{recursive:true});await cp(source,path.join(ocr,'lang',`${lang}.traineddata.gz`));
}
await writeFile(path.join(dist,'build-info.json'),JSON.stringify({application:'hulan-breath-rehab',version:'1.0.0',dependencies:expected,ocrModelsSha256:hashes},null,2));
console.log('已构建 dist：应用、PDF 解析、中英文 OCR 模型均为本机资源。');
