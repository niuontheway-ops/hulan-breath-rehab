import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {EDUCATION_TOPICS,EDUCATION_VIDEO_SCRIPTS} from '../education.mjs';

// Render authored educational slides and local Windows speech into portable MP4s.
// No external media, patient input, or remote speech service is used.
const root=fileURLToPath(new URL('../',import.meta.url));
const work=path.join(root,'.qa','content','video-build');
const output=path.join(root,'assets','education-videos');
await mkdir(work,{recursive:true});await mkdir(output,{recursive:true});
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw new Error((r.stderr||r.error?.message||'Media generation failed').slice(-2000));return r.stdout;}
const jobs=[];
for(const topic of EDUCATION_TOPICS){
  const dir=path.join(work,topic.id);await mkdir(dir,{recursive:true});
  EDUCATION_VIDEO_SCRIPTS[topic.id].forEach((slide,index)=>jobs.push({text:`${slide.title}。${slide.text}`,output:path.join(dir,`${index}.wav`)}));
}
await writeFile(path.join(work,'speech-jobs.json'),JSON.stringify(jobs));
run(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','education-speech.ps1'),'-InputFile',path.join(work,'speech-jobs.json')]);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:960,height:960},deviceScaleFactor:1});
const logo=(await readFile(path.join(root,'assets','hulan-logo.jpg'))).toString('base64');
const results=[];
function timestamp(seconds){const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
try{
  for(const topic of EDUCATION_TOPICS){
    const slides=EDUCATION_VIDEO_SCRIPTS[topic.id],dir=path.join(work,topic.id);
    const art=(await readFile(path.join(root,'assets','chapters',`${topic.id}.svg`))).toString('base64');
    let elapsed=0,vtt='WEBVTT\n\n';
    for(const [index,slide] of slides.entries()){
      const audio=path.join(dir,`${index}.wav`);
      const duration=Number(JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',audio])).format.duration)+0.65;
      await page.setContent(`<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;width:960px;height:960px;background:${index===3?'#f8efea':'#f2f8f3'};color:#124c46;font-family:'Microsoft YaHei',sans-serif;padding:36px 44px}header{display:flex;align-items:center;gap:18px;height:82px;font-size:36px}header img{width:76px;height:76px;object-fit:contain}header span{margin-left:auto;font-size:30px;color:#536d67}h1{margin:26px 0 4px;font-size:62px;line-height:1.3;text-align:center;color:${index===3?'#8e3133':'#124c46'}}.picture{display:block;width:680px;height:280px;object-fit:contain;margin:8px auto 10px;border-radius:26px}.caption{font-size:56px;line-height:1.55;letter-spacing:0;margin:0;padding:0 8px;overflow-wrap:anywhere}.progress{position:absolute;bottom:28px;left:44px;right:44px;display:flex;gap:12px}.progress i{height:8px;border-radius:8px;background:#cfddd5;flex:1}.progress i:nth-child(${index+1}){background:${index===3?'#9c393a':'#246d5b'}}</style><header><img src="data:image/jpeg;base64,${logo}" alt="壶兰呼吸"><strong>壶兰呼吸</strong><span>${escape(topic.shortName)}</span></header><h1>${escape(slide.title)}</h1><img class="picture" src="data:image/svg+xml;base64,${art}" alt=""><p class="caption">${escape(slide.text)}</p><div class="progress"><i></i><i></i><i></i><i></i></div></html>`);
      await page.evaluate(()=>document.fonts.ready);
      await page.locator('.picture').evaluate(image=>image.decode());
      const bottom=await page.locator('.caption').evaluate(el=>el.getBoundingClientRect().bottom);
      if(bottom>912)throw new Error(`Caption overflow: ${topic.id} ${index} ${bottom}`);
      const png=path.join(dir,`${index}.png`),mp4=path.join(dir,`${index}.mp4`);
      await page.screenshot({path:png});
      run('ffmpeg',['-y','-loglevel','error','-loop','1','-framerate','24','-i',png,'-i',audio,'-t',duration.toFixed(3),'-vf','fade=t=in:st=0:d=0.18','-af','apad','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',mp4]);
      vtt+=`${index+1}\n${timestamp(elapsed)} --> ${timestamp(elapsed+duration)}\n${slide.title}。${slide.text}\n\n`;
      elapsed+=duration;
    }
    const concat=path.join(dir,'concat.txt');
    await writeFile(concat,slides.map((_,i)=>`file '${i}.mp4'`).join('\n'));
    const videoPath=path.join(output,`${topic.id}.mp4`);
    run('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','1','-i',concat,'-c','copy','-movflags','+faststart',videoPath]);
    await writeFile(path.join(output,`${topic.id}.vtt`),vtt);
    const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,codec_type,width,height','-of','json',videoPath]));
    const data=await readFile(videoPath);
    results.push({id:topic.id,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),duration:Number(probe.format.duration),streams:probe.streams});
    console.log(JSON.stringify(results.at(-1)));
  }
}finally{await browser.close()}
await writeFile(path.join(root,'.qa','content','video-generation-results.json'),JSON.stringify({voice:'Microsoft Huihui',speech:'Local Windows WinRT zh-CN',frameSize:[960,960],fps:24,scriptSource:'education.mjs EDUCATION_VIDEO_SCRIPTS',videos:results},null,2));
