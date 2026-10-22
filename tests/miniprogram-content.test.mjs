import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {EDUCATION_TOPICS,getEducation} from '../education.mjs';
import {INHALER_DEVICES,getInhaler} from '../inhaler.mjs';
import {ORIGINAL_TRACKS,originalMusicUrl} from '../music.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const app=path.join(root,'miniprogram','app');
const require=createRequire(import.meta.url);
const content=require('../miniprogram/app/data/content.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function instance(relative,wxApi={}){
  let definition;const notices=[];const sandbox={Page:object=>definition=object,Component:object=>definition=object,wx:wxApi,require:name=>{
    if(name==='../../data/content')return content;
    if(name==='../../utils/presentation')return {refresh:page=>page.setData({senior:true,reducedMotion:true}),notice:(...message)=>notices.push(message)};
    if(name==='../../utils/store')return {store:{load:()=>({ok:true,state:{settings:{senior:true,reducedMotion:true}}})}};
    throw new Error('Unexpected native module '+name);
  }};
  vm.runInNewContext(readFileSync(path.join(app,relative),'utf8'),sandbox,{filename:relative});
  const page={data:clone(definition.data),properties:{topicId:'copd'},setData(patch){Object.assign(this.data,clone(patch));}};
  for(const [key,value] of Object.entries(definition.methods||definition))if(typeof value==='function')page[key]=value.bind(page);
  return {page,definition,notices};
}
function choose(page,id){const index=page.data.options.findIndex(item=>item.id===id);assert.ok(index>0,'device must be selectable');page.chooseDevice({detail:{value:index}});}

test('native teaching retains 12 topics, 27 distinct entries, original videos and 7 tracks',()=>{
  assert.deepEqual(content.education.map(item=>item.id),EDUCATION_TOPICS.map(item=>item.id));
  assert.deepEqual(content.inhalers.map(item=>item.id),INHALER_DEVICES.map(item=>item.id));
  assert.equal(content.meta.reviewedMethods,19);assert.equal(content.meta.primaryVideoEntries,18);assert.equal(content.meta.uniquePrimaryVideos,12);assert.equal(content.meta.verifiedPrimaryVideos,8);
  for(const item of content.inhalers){const original=getInhaler(item.id);assert.deepEqual(item.steps,original.steps);assert.deepEqual(item.videoDetails,original.videoDetails);assert.deepEqual(item.legacyVideos,original.legacyVideos);if(item.teachingStatus==='needs-device-review'){assert.equal(item.steps.length,0);assert.equal(item.videoDetails,null);}}
  assert.equal(content.tracks.length,7);for(const [index,item] of content.tracks.entries()){assert.equal(item.name,ORIGINAL_TRACKS[index].name);assert.equal(item.url,originalMusicUrl(item.id));}
});

test('all packaged lessons match the audited output, preserve voice and stay below each package limit',()=>{
  assert.equal(content.education.length,12);let total=0;
  for(const lesson of content.education){
    const audit=lesson.video.audit,directory=path.join(app,'media',lesson.id);
    const bytes=readFileSync(path.join(app,lesson.video.packagePath));assert.equal(hash(bytes),lesson.video.sha256);assert.equal(bytes.length,lesson.video.bytes);assert.ok(bytes.length<1.7*1024*1024);assert.equal(audit.audioPacketsPreserved,true);assert.match(audit.audioPacketsSha256,/^[a-f0-9]{64}$/);assert.ok(Math.abs(audit.duration-lesson.video.duration)<=.12);
    const source=readFileSync(path.join(root,'assets','education-videos',lesson.id+'.mp4'));assert.equal(hash(source),lesson.video.sourceSha256);
    const packageBytes=readdirSync(directory).reduce((sum,name)=>sum+statSync(path.join(directory,name)).size,0);assert.ok(packageBytes<2*1024*1024);total+=packageBytes;
    assert.equal(lesson.video.route,'/media/'+lesson.id+'/index');assert.match(readFileSync(path.join(directory,'index.wxml'),'utf8'),new RegExp('topic-id="'+lesson.id+'"'));
    assert.deepEqual(lesson.sections,getEducation(lesson.id).sections);assert.ok(lesson.video.captions.length>0);for(const cue of lesson.video.captions){assert.ok(cue.start>=0&&cue.end>cue.start&&cue.end<=audit.duration+.12);assert.equal(typeof cue.text,'string');}
  }
  assert.ok(total<30*1024*1024);
});

test('disease selection changes local content and navigates only to the selected static lesson',()=>{
  const navigated=[];const {page}=instance('pages/learn/index.js',{navigateTo:options=>navigated.push(options.url)});
  page.onLoad({topic:'asthma'});page.onShow();assert.equal(page.data.topic.id,'asthma');assert.equal(page.data.senior,true);assert.equal(navigated.length,0);
  for(let index=0;index<12;index++){page.changeTopic({detail:{value:index}});page.watchLesson();assert.equal(page.data.topic.id,content.education[index].id);assert.equal(navigated.at(-1),content.education[index].video.route);}
  assert.equal(page.data.detailsOpen,false);page.toggleDetails();assert.equal(page.data.detailsOpen,true);
});

test('native inhaler search and type filter never display another device as a match',()=>{
  const {page}=instance('pages/inhaler/index.js');page.onLoad();page.onShow();assert.equal(page.data.current,null);assert.equal(page.data.options.length,28);
  choose(page,'respimat');assert.equal(page.data.current.id,'respimat');assert.equal(page.data.current.methodReady,true);
  page.search({detail:{value:'不存在的型号'}});assert.equal(page.data.current,null);assert.equal(page.data.matchCount,0);assert.equal(page.data.options.length,1);
  page.search({detail:{value:''}});assert.equal(page.data.current.id,'respimat');page.changeCategory({detail:{value:2}});assert.equal(page.data.current,null);assert.ok(page.data.options.some(item=>item.id==='handihaler'));assert.equal(page.data.options.some(item=>item.id==='respimat'),false);
  choose(page,'handihaler');assert.equal(page.data.current.id,'handihaler');assert.match(page.data.current.breathCue,/慢|深/);
  page.changeCategory({detail:{value:0}});choose(page,'jiankechang');assert.equal(page.data.current.methodReady,false);assert.equal(page.data.current.steps.length,0);assert.equal(page.data.current.videoDetails,null);
});

test('external teaching links are copied only on request and retain actual verification limits',()=>{
  const copied=[];const {page,notices}=instance('pages/inhaler/index.js',{setClipboardData:options=>{copied.push(options.data);options.success();}});page.onLoad();assert.equal(copied.length,0);
  for(const id of ['genuair','handihaler','nexthaler','spacer']){choose(page,id);assert.equal(page.data.current.videoDetails.playbackVerified,false);assert.ok(page.data.current.videoDetails.availability);}
  choose(page,'breztri');assert.match(page.data.current.videoDetails.scope,/pMDI|手口/);page.copyLink({currentTarget:{dataset:{kind:'video',url:page.data.current.videoDetails.url}}});assert.equal(copied[0],getInhaler('breztri').videoDetails.url);assert.match(notices[0][0],/浏览器/);
  page.copyLink({currentTarget:{dataset:{kind:'video',url:'javascript:alert(1)'}}});assert.equal(copied.length,1);
});

function audioEnvironment(){const audios=[];const wx={createInnerAudioContext(){const listeners={};const audio={listeners,stopped:0,destroyed:0,played:0,onPlay(fn){listeners.play=fn;},onPause(fn){listeners.pause=fn;},onStop(fn){listeners.stop=fn;},onError(fn){listeners.error=fn;},play(){this.played++;},pause(){listeners.pause?.();},stop(){this.stopped++;listeners.stop?.();},destroy(){this.destroyed++;}};audios.push(audio);return audio;},switchTab(){}};return {wx,audios};}
test('music loads nothing before a deliberate play and ignores events from a replaced player',()=>{
  const {wx,audios}=audioEnvironment();const {page}=instance('pages/music/index.js',wx);page.onLoad();page.onShow();assert.equal(audios.length,0);
  page.selectTrack({currentTarget:{dataset:{id:'chuxue'}}});assert.equal(audios.length,0);page.play();assert.equal(audios.length,1);const first=audios[0];assert.equal(first.src,originalMusicUrl('chuxue'));assert.equal(first.autoplay,false);assert.equal(first.volume,.25);assert.equal(first.played,1);assert.equal(page.data.playing,false);first.listeners.play();assert.equal(page.data.playing,true);
  page.selectTrack({currentTarget:{dataset:{id:'anni'}}});assert.equal(first.destroyed,1);assert.equal(page.data.playing,false);first.listeners.play();assert.equal(page.data.playing,false);assert.equal(audios.length,1);page.play();assert.equal(audios[1].src,originalMusicUrl('anni'));
});

test('music stops on hide and unload, does not resume itself, and reports playback failure',()=>{
  const {wx,audios}=audioEnvironment();const {page}=instance('pages/music/index.js',wx);page.onLoad();page.onShow();page.play();audios[0].listeners.play();page.onHide();assert.equal(audios[0].stopped,1);assert.equal(audios[0].destroyed,1);assert.equal(page.data.playing,false);page.play();assert.equal(audios.length,1);page.onShow();assert.equal(audios.length,1);page.play();assert.equal(audios.length,2);audios[1].listeners.error();assert.equal(page.data.playing,false);assert.equal(page.data.loading,false);assert.match(page.data.error,/无法播放/);assert.equal(audios[1].destroyed,1);page.onUnload();
});

test('a stalled music load can be cancelled and still releases audio if native stop throws',()=>{
  const {wx,audios}=audioEnvironment();const {page}=instance('pages/music/index.js',wx);page.onLoad();page.onShow();page.play();assert.equal(page.data.loading,true);audios[0].stop=()=>{throw new Error('native stop unavailable');};page.pause();assert.equal(audios[0].destroyed,1);assert.equal(page.data.loading,false);assert.equal(page.data.playing,false);audios[0].listeners.play();assert.equal(page.data.playing,false);
});

function videoEnvironment({defer=false,cached=false,wrongSize=false}={}){
  const calls={copies:[],deletes:[],pauses:0};let copyCallback;
  const fs={stat(options){if(cached)options.success({stats:{size:wrongSize?1:content.education[0].video.bytes}});else options.fail();},copyFile(options){calls.copies.push({source:options.srcPath,target:options.destPath});if(defer)copyCallback=options.success;else options.success();},unlink(options){calls.deletes.push(options.filePath);options.success();}};
  const wx={env:{USER_DATA_PATH:'wxfile://usr'},getFileSystemManager:()=>fs,createVideoContext:()=>({pause(){calls.pauses++;}}),navigateBack(){}};
  return {wx,calls,complete:()=>copyCallback?.()};
}
function videoPage(environment){const result=instance('components/education-player/index.js',environment.wx);result.definition.lifetimes.attached.call(result.page);return result;}

test('a local lesson is copied from its downloaded package to the phone only after play is requested',()=>{
  const environment=videoEnvironment(),{page}=videoPage(environment);assert.equal(page.data.videoSrc,'');assert.equal(environment.calls.copies.length,0);page.prepareVideo();assert.equal(environment.calls.copies.length,1);
  const copy=environment.calls.copies[0];assert.equal(copy.source,'media/copd/lesson.mp4');assert.match(copy.target,/^wxfile:\/\/usr\/hulan-lesson-copd-[a-f0-9]{12}\.mp4$/);assert.equal(page.data.videoSrc,copy.target);assert.equal(page.data.playRequested,true);assert.equal(page.data.loading,false);
  const cue=page.data.topic.video.captions[0];page.timeUpdate({detail:{currentTime:(cue.start+cue.end)/2}});assert.equal(page.data.caption,cue.text);page.videoError();assert.equal(page.data.videoSrc,'');assert.match(page.data.error,/暂时无法播放/);assert.ok(page.data.topic.sections.length>0);
});

test('hiding a lesson stops playback and prevents a pending file copy from triggering hidden autoplay',()=>{
  const environment=videoEnvironment({defer:true}),{page,definition}=videoPage(environment);page.prepareVideo();assert.equal(page.data.loading,true);definition.pageLifetimes.hide.call(page);environment.complete();assert.equal(page.data.videoSrc,'');assert.equal(page.data.playRequested,false);assert.equal(page.data.loading,false);assert.equal(environment.calls.pauses,1);
  definition.pageLifetimes.show.call(page);assert.equal(page.data.playRequested,false);assert.equal(environment.calls.copies.length,1);
});

test('lesson cache reuse is size checked and replacements affect only the named static lesson file',()=>{
  const cached=videoEnvironment({cached:true}),first=videoPage(cached);first.page.prepareVideo();assert.equal(cached.calls.copies.length,0);assert.ok(first.page.data.videoSrc);
  const stale=videoEnvironment({cached:true,wrongSize:true}),second=videoPage(stale);second.page.prepareVideo();assert.equal(stale.calls.copies.length,1);assert.equal(stale.calls.deletes.length,1);assert.equal(stale.calls.deletes[0],stale.calls.copies[0].target);
});

test('teaching native sources contain no cloud, upload, login, background fetch or web-view fallback',()=>{
  const files=['pages/learn/index.js','pages/inhaler/index.js','pages/music/index.js','components/education-player/index.js','pages/learn/index.wxml','pages/inhaler/index.wxml','pages/music/index.wxml','components/education-player/index.wxml'];
  for(const name of files){const source=readFileSync(path.join(app,name),'utf8');assert.doesNotMatch(source,/wx\.(?:request|uploadFile|downloadFile|connectSocket|login|getUserProfile|getUserInfo|getPhoneNumber|cloud)\b|<web-view\b/);assert.doesNotMatch(source,/getClipboardData\s*\(/);}
});

let nativeCompiler;
try{nativeCompiler=require('miniprogram-compiler');}catch{try{nativeCompiler=require('../.qa/miniprogram/tools/node_modules/miniprogram-compiler');}catch{}}
let compiledViews;
function nativeTree(relative,data){
  if(!compiledViews){const code=nativeCompiler.wxmlToJs(app,{wxmlList:['pages/learn/index.wxml','pages/inhaler/index.wxml','pages/music/index.wxml','components/education-player/index.wxml']});compiledViews=new Function('global','window',code)({},{});}
  return compiledViews(relative)(data);
}
function nodes(tree){const result=[];function visit(node){if(node&&typeof node==='object'){result.push(node);for(const child of node.children||[])visit(child);}}visit(tree);return result;}
function renderedText(tree){function text(node){if(typeof node==='string'||typeof node==='number')return String(node);return (node?.children||[]).map(text).join(' ');}return text(tree);}
function withClass(tree,name){return nodes(tree).filter(node=>String(node.attr?.class||'').split(/\s+/).includes(name));}
const compilerOptions={skip:nativeCompiler?false:'Install the documented optional miniprogram test tooling before official template rendering.'};

test('official WXML renderer hides absent or unmatched inhalers and distinguishes missing methods and videos',compilerOptions,()=>{
  const {page}=instance('pages/inhaler/index.js');page.onLoad();let tree=nativeTree('pages/inhaler/index.wxml',page.data);assert.equal(withClass(tree,'device-body').length,0);
  choose(page,'breztri');tree=nativeTree('pages/inhaler/index.wxml',page.data);assert.equal(withClass(tree,'device-body').length,1);assert.match(renderedText(tree),/按顺序练习/);assert.match(renderedText(tree),/复制原视频链接/);assert.doesNotMatch(renderedText(tree),/核对来源/);
  page.toggleDetails();tree=nativeTree('pages/inhaler/index.wxml',page.data);assert.match(renderedText(tree),/核对来源/);assert.match(renderedText(tree),/首次使用 \/ 久未使用/);
  choose(page,'jiankechang');tree=nativeTree('pages/inhaler/index.wxml',page.data);assert.match(renderedText(tree),/先核对专属说明/);assert.doesNotMatch(renderedText(tree),/按顺序练习/);assert.doesNotMatch(renderedText(tree),/复制原视频链接/);
  page.search({detail:{value:'不存在的型号'}});tree=nativeTree('pages/inhaler/index.wxml',page.data);assert.equal(withClass(tree,'device-body').length,0);assert.match(renderedText(tree),/没有匹配项/);
});

test('official WXML renderer keeps care details collapsed and renders large-text state and errors only when present',compilerOptions,()=>{
  const {page}=instance('pages/learn/index.js');page.onLoad({});page.onShow();let tree=nativeTree('pages/learn/index.wxml',page.data);assert.equal(withClass(tree,'details-body').length,0);assert.equal(withClass(tree,'error').length,0);assert.equal(withClass(tree,'senior').length,1);assert.match(renderedText(tree),/今天记住这几件事/);
  page.toggleDetails();tree=nativeTree('pages/learn/index.wxml',page.data);assert.equal(withClass(tree,'details-body').length,1);assert.match(renderedText(tree),/资料来源/);page.setData({storageError:'本机存储暂时不可用'});tree=nativeTree('pages/learn/index.wxml',page.data);assert.equal(withClass(tree,'error').length,1);assert.match(renderedText(tree),/本机存储暂时不可用/);
});

test('official WXML renderer switches music between play, cancel-loading and pause with real state',compilerOptions,()=>{
  const environment=audioEnvironment(),{page}=instance('pages/music/index.js',environment.wx);page.onLoad();page.onShow();let tree=nativeTree('pages/music/index.wxml',page.data);assert.match(renderedText(tree),/播放 · 需联网/);assert.doesNotMatch(renderedText(tree),/取消加载|暂停音乐/);assert.equal(withClass(tree,'error').length,0);
  page.play();tree=nativeTree('pages/music/index.wxml',page.data);assert.match(renderedText(tree),/取消加载/);assert.doesNotMatch(renderedText(tree),/播放 · 需联网|暂停音乐/);environment.audios[0].listeners.play();tree=nativeTree('pages/music/index.wxml',page.data);assert.match(renderedText(tree),/暂停音乐/);assert.doesNotMatch(renderedText(tree),/播放 · 需联网|取消加载/);
  environment.audios[0].listeners.error();tree=nativeTree('pages/music/index.wxml',page.data);assert.equal(withClass(tree,'error').length,1);assert.match(renderedText(tree),/无法播放/);
});

test('official WXML renderer mounts local video only after explicit preparation and removes it on playback error',compilerOptions,()=>{
  const environment=videoEnvironment(),{page,definition}=videoPage(environment);let tree=nativeTree('components/education-player/index.wxml',page.data);assert.equal(nodes(tree).filter(node=>node.tag==='wx-video').length,0);assert.equal(withClass(tree,'error').length,0);assert.match(renderedText(tree),/播放本地短片/);
  page.prepareVideo();tree=nativeTree('components/education-player/index.wxml',page.data);const video=nodes(tree).find(node=>node.tag==='wx-video');assert.ok(video);assert.equal(video.attr.src,page.data.videoSrc);assert.equal(video.attr.autoplay,true);assert.doesNotMatch(renderedText(tree),/播放本地短片/);
  definition.pageLifetimes.hide.call(page);tree=nativeTree('components/education-player/index.wxml',page.data);assert.equal(nodes(tree).find(node=>node.tag==='wx-video').attr.autoplay,false);page.videoError();tree=nativeTree('components/education-player/index.wxml',page.data);assert.equal(nodes(tree).filter(node=>node.tag==='wx-video').length,0);assert.equal(withClass(tree,'error').length,1);assert.match(renderedText(tree),/重新载入本地短片/);
});
