import {mkdir,readFile,writeFile,stat,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {EDUCATION_TOPICS,getEducation} from '../education.mjs';
import {INHALER_DEVICES,getInhaler} from '../inhaler.mjs';
import {ORIGINAL_TRACKS,originalMusicUrl} from '../music.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const app=path.join(root,'miniprogram','app');
const evidence=path.join(root,'.qa','miniprogram');
const work=path.join(evidence,'media-work');
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const ffprobe=process.env.FFPROBE_PATH||'ffprobe';
const dataOnly=process.argv.includes('--data-only');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encoding={width:480,height:480,fps:20,crf:25,maxBytes:Math.floor(1.7*1024*1024),audio:'copy'};
await mkdir(path.join(app,'data'),{recursive:true});await mkdir(work,{recursive:true});
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});if(result.error||result.status!==0)throw new Error(`${path.basename(command)} failed: ${result.error?.message||result.stderr}`);return result.stdout;}
function probe(file){return JSON.parse(run(ffprobe,['-v','error','-show_entries','stream=codec_name,width,height,bit_rate,duration,codec_type','-show_entries','format=duration,size','-of','json',file]));}
function audioHash(file){return run(ffmpeg,['-v','error','-i',file,'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-']).trim();}
function cueTime(value){const [hours,minutes,seconds]=value.split(':').map(Number);return hours*3600+minutes*60+seconds;}
function parseCaptions(vtt){return vtt.split(/\r?\n\r?\n/).map(block=>{const lines=block.trim().split(/\r?\n/);const index=lines.findIndex(line=>line.includes(' --> '));if(index<0)return null;const times=lines[index].match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);return times?{start:cueTime(times[1]),end:cueTime(times[2]),text:lines.slice(index+1).join(' ')}:null;}).filter(Boolean);}
let previous={};try{previous=JSON.parse(await readFile(path.join(evidence,'media-build.json'),'utf8'));}catch{}
const lessons=[],checks=[];
for(const topic of EDUCATION_TOPICS){
  const source=path.join(root,'assets','education-videos',topic.id+'.mp4');
  const destination=path.join(app,'media',topic.id);const output=path.join(destination,'lesson.mp4');
  await mkdir(destination,{recursive:true});
  const sourceBytes=await readFile(source),sourceSha256=hash(sourceBytes),sourceInfo=probe(source);
  const sourceDuration=Number(sourceInfo.format.duration);let bytes=null,sha256=null,audit=null;
  if(!dataOnly){
    let reusable=false;try{const existing=await readFile(output);const prior=previous.lessons?.find(item=>item.id===topic.id);reusable=prior?.sourceSha256===sourceSha256&&JSON.stringify(previous.encoding)===JSON.stringify(encoding)&&prior.sha256===hash(existing);}catch{}
    if(!reusable){
      const audioRate=Number(sourceInfo.streams.find(stream=>stream.codec_type==='audio')?.bit_rate||96000);
      const videoRate=Math.max(65000,Math.min(260000,Math.floor(1.5*1024*1024*8/sourceDuration-audioRate-16000)));
      const temporary=path.join(work,topic.id+'.mp4');
      run(ffmpeg,['-y','-v','error','-i',source,'-map','0:v:0','-map','0:a:0','-vf','scale=480:480:flags=lanczos','-r',String(encoding.fps),'-c:v','libx264','-preset','medium','-crf',String(encoding.crf),'-maxrate',String(videoRate),'-bufsize',String(videoRate*2),'-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',temporary]);
      await copyFile(temporary,output);
    }
    bytes=(await stat(output)).size;sha256=hash(await readFile(output));
    const info=probe(output),video=info.streams.find(stream=>stream.codec_type==='video');
    if(bytes>encoding.maxBytes)throw new Error(`${topic.id}: local clip exceeds package budget`);
    if(video?.codec_name!=='h264'||video.width!==480||video.height!==480)throw new Error(`${topic.id}: incorrect video format`);
    if(Math.abs(Number(info.format.duration)-sourceDuration)>.12)throw new Error(`${topic.id}: video duration changed`);
    const sourceAudioHash=audioHash(source),outputAudioHash=audioHash(output);
    if(sourceAudioHash!==outputAudioHash)throw new Error(`${topic.id}: original voice packets changed`);
    audit={duration:Number(info.format.duration),audioPacketsSha256:sourceAudioHash.replace(/^SHA256=/,''),audioPacketsPreserved:true};
    checks.push({id:topic.id,bytes,sha256,sourceSha256,sourceDuration,...audit,captionCount:parseCaptions(await readFile(path.join(root,'assets','education-videos',topic.id+'.vtt'),'utf8')).length});
    console.log(`${topic.id}: ${bytes} bytes, original audio preserved`);
  }else try{bytes=(await stat(output)).size;sha256=hash(await readFile(output));const prior=previous.lessons?.find(item=>item.id===topic.id&&item.sha256===sha256&&item.sourceSha256===sourceSha256);if(prior?.audioPacketsSha256)audit={duration:prior.duration,audioPacketsSha256:prior.audioPacketsSha256,audioPacketsPreserved:prior.audioPacketsPreserved};}catch{}
  const lesson=getEducation(topic.id);
  lessons.push({...lesson,image:{src:'/assets/chapters/'+topic.id+'.svg',alt:lesson.image.alt},video:{route:'/media/'+topic.id+'/index',packageName:'lesson-'+topic.id,packagePath:'media/'+topic.id+'/lesson.mp4',poster:'/assets/education-scenes/'+topic.id+'.webp',title:lesson.video.title,bytes,sha256,sourceSha256,duration:sourceDuration,audit,captions:parseCaptions(await readFile(path.join(root,'assets','education-videos',topic.id+'.vtt'),'utf8'))}});
  await writeFile(path.join(destination,'index.js'),'Page({});\n');
  await writeFile(path.join(destination,'index.wxml'),`<education-player topic-id="${topic.id}" />\n`);
  await writeFile(path.join(destination,'index.wxss'),'\n');
  await writeFile(path.join(destination,'index.json'),JSON.stringify({navigationBarTitleText:topic.shortName+'照护短片',usingComponents:{'education-player':'/components/education-player/index'}},null,2)+'\n');
}
const inhalers=INHALER_DEVICES.map(item=>getInhaler(item.id));
const primaryVideos=inhalers.map(item=>item.videoDetails).filter(Boolean);
const meta={version:'1.0.0',contentSourceVersion:'2.1.0',checkedAt:'2026-10-19',educationCount:lessons.length,inhalerEntries:inhalers.length,reviewedMethods:inhalers.filter(item=>item.teachingStatus==='reviewed-device-method').length,primaryVideoEntries:primaryVideos.length,uniquePrimaryVideos:new Set(primaryVideos.map(video=>video.url)).size,verifiedPrimaryVideos:new Set(primaryVideos.filter(video=>video.playbackVerified).map(video=>video.url)).size,packagedLessons:true,musicDomain:'niuontheway-ops.github.io',localMediaPolicy:'静态宣教分包按需下载，健康记录保存在手机本地；外部吸入器视频和音乐需联网。'};
const content={education:lessons,inhalers,tracks:ORIGINAL_TRACKS.map(track=>({...track,url:originalMusicUrl(track.id)})),meta};
await writeFile(path.join(app,'data','content.js'),'module.exports = '+JSON.stringify(content,null,2)+';\n');
if(!dataOnly)await writeFile(path.join(evidence,'media-build.json'),JSON.stringify({encoding,lessons:checks,totalBytes:checks.reduce((sum,item)=>sum+item.bytes,0)},null,2));
console.log(JSON.stringify({dataOnly,topics:lessons.length,inhalers:inhalers.length,tracks:content.tracks.length,videoBytes:checks.reduce((sum,item)=>sum+item.bytes,0)}));
