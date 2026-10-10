import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {EDUCATION_TOPICS,EDUCATION_VIDEO_SCRIPTS} from '../education.mjs';
import {renderFilmHTML} from './education-film-scenes.mjs';

// Render authored scenes at deterministic times and mux pre-generated narration.
// Media playback never requires the speech service or these production tools.
const root=fileURLToPath(new URL('../',import.meta.url));
const work=path.join(root,'.qa','film'),output=path.join(root,'assets','education-videos');
await mkdir(work,{recursive:true});await mkdir(output,{recursive:true});
const selected=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const topics=EDUCATION_TOPICS.filter(topic=>!selected.length||selected.includes(topic.id));
if(!topics.length)throw new Error('Select a known education topic');
if(process.argv.includes('--prepare-audio')){
  const jobs=topics.flatMap(topic=>EDUCATION_VIDEO_SCRIPTS[topic.id].map((slide,index)=>({
    text:slide.text.replaceAll('120','幺二零').replaceAll('38度','三十八摄氏度').replaceAll('7天','七天').replaceAll('PAP或CPAP','正压通气设备'),
    output:path.join(work,'audio',topic.id,index+'.mp3'),
  })));
  await writeFile(path.join(work,'speech-jobs.json'),JSON.stringify(jobs,null,2));
  console.log(`Prepared ${jobs.length} public narration scripts`);process.exit(0);
}
const fps=12;
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw new Error((r.stderr||r.error?.message||'Media generation failed').slice(-2000));return r.stdout;}
function timestamp(seconds){const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
function readable(text){return text.replaceAll('幺二零','120').replaceAll('三十八摄氏度','38℃').replaceAll('七天','7天');}
function splitCaption(cue){
  const text=readable(cue.text),pieces=text.match(/[^，。；、！？]+[，。；、！？]?/g)||[text],lines=[];
  let line='';for(const piece of pieces){if(line&&line.length+piece.length>25){lines.push(line);line='';}line+=piece;}if(line)lines.push(line);
  const total=lines.reduce((sum,line)=>sum+line.length,0);let start=cue.offset/1e7+0.3;
  return lines.map(text=>{const duration=cue.duration/1e7*text.length/total;const item={text,start,end:start+duration};start+=duration;return item;});
}
const browser=await chromium.launch({headless:true});
const logo='data:image/jpeg;base64,'+(await readFile(path.join(root,'assets','hulan-logo.jpg'))).toString('base64');
const results=[];
async function renderTopic(topic){
  const page=await browser.newPage({viewport:{width:960,height:960},deviceScaleFactor:1});
  const slides=EDUCATION_VIDEO_SCRIPTS[topic.id],dir=path.join(work,'frames',topic.id);await mkdir(dir,{recursive:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let elapsed=0,vtt='WEBVTT\n\n',frameCount=0;
  try {
    for(const [index,slide] of slides.entries()){
      const sceneDir=path.join(dir,String(index));await mkdir(sceneDir,{recursive:true});
      const audio=path.join(work,'audio',topic.id,index+'.mp3');
      const audioDuration=Number(JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',audio])).format.duration);
      const frames=Math.ceil((audioDuration+1.1)*fps),duration=frames/fps;
      let metadata;
      try{metadata=await readFile(audio.replace(/\.mp3$/,'.jsonl'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;metadata=await readFile(audio.replace(/\.mp3$/,'.srt'),'utf8');}
      const cues=metadata.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)).flatMap(splitCaption);
      await page.setContent(renderFilmHTML({topic,index,slide,logo}));await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
      for(let frame=0;frame<frames;frame++){
        const time=frame/fps,caption=cues.find(cue=>time>=cue.start&&time<cue.end)?.text||'';
        await page.evaluate(({time,duration,caption})=>window.setFrame(time,duration,caption),{time,duration,caption});
        if(frame===Math.min(18,frames-1)) {
          await page.screenshot({path:path.join(dir,`scene-${index}.png`)});
          const bounds=await page.locator('[data-film-caption]').evaluate(el=>{const r=el.getBoundingClientRect();return {bottom:r.bottom,width:r.width,scrollWidth:el.scrollWidth};}).catch(()=>null);
          if(bounds&&(bounds.bottom>960||bounds.scrollWidth>bounds.width+2))throw new Error(`${topic.id}: caption overflow`);
        }
        await page.screenshot({path:path.join(sceneDir,String(frame).padStart(5,'0')+'.jpg'),type:'jpeg',quality:88});
      }
      if(errors.length)throw new Error(errors.join('; '));
      const mp4=path.join(dir,index+'.mp4');
      run('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(sceneDir,'%05d.jpg'),'-i',audio,'-t',duration.toFixed(6),'-vf','fps=24,fade=t=in:st=0:d=0.22','-af','adelay=300|300,apad,alimiter=limit=0.95','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',mp4]);
      vtt+=`${index+1}\n${timestamp(elapsed)} --> ${timestamp(elapsed+duration)}\n${slide.title}。${slide.text}\n\n`;
      elapsed+=duration;frameCount+=frames;console.log(JSON.stringify({id:topic.id,scene:index+1,frames,duration}));
    }
    const concat=path.join(dir,'concat.txt');await writeFile(concat,slides.map((_,i)=>`file '${i}.mp4'`).join('\n'));
    const videoPath=path.join(output,`${topic.id}.mp4`);
    run('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','1','-i',concat,'-c','copy','-movflags','+faststart',videoPath]);
    await writeFile(path.join(output,`${topic.id}.vtt`),vtt);
    const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,codec_type,width,height','-of','json',videoPath]));
    const data=await readFile(videoPath);
    const result={id:topic.id,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),duration:Number(probe.format.duration),streams:probe.streams,renderedFrames:frameCount,scriptErrors:errors};
    await writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2));results.push(result);console.log(JSON.stringify(result));
  }finally{await page.close();}
}
try {
  for(let i=0;i<topics.length;i+=2)await Promise.all(topics.slice(i,i+2).map(renderTopic));
}finally{await browser.close();}
await writeFile(path.join(work,selected.length?'video-generation-selection.json':'video-generation-results.json'),JSON.stringify({voice:'zh-CN-XiaoxiaoNeural',speech:'Microsoft Edge online neural speech; authored public scripts only',frameSize:[960,960],renderFps:fps,encodingFps:24,scriptSource:'education.mjs EDUCATION_VIDEO_SCRIPTS',videos:results},null,2));
