import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {createPlan as webPlan,assessTrainingReadiness as webReadiness} from '../clinical.mjs';
import {normalizeDailyRecord as webDaily,evaluateDailyRecord as webDailyOutcome} from '../daily.mjs';

const require=createRequire(import.meta.url),app=fileURLToPath(new URL('../miniprogram/app/',import.meta.url));
const clinical=require('../miniprogram/app/core/clinical.js'),dailyCore=require('../miniprogram/app/core/daily.js');
const {today}=require('../miniprogram/app/utils/calendar.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const flags=()=>({chestPain:false,severeBreathlessness:false,fainting:false,hemoptysis:false});
const profile=(patch={})=>({age:65,disease:'copd',stability:'stable',clinicianCleared:true,redFlags:flags(),assessmentDate:today(),goal:'daily',dyspneaScale:'mmrc',dyspneaScore:1,act:null,cat:8,fev1Percent:60,fev1Fvc:62,spo2:96,...patch});

function environment({reportsOk=true,decline=false}={}){
  const memory=new Map(),cache=new Map(),toasts=[],modals=[],routes=[],order=[],pages=[],pending=[];
  const control={writeFail:false,removeFail:false};
  const wx={getStorageSync:key=>memory.has(key)?clone(memory.get(key)):'',setStorageSync:(key,value)=>{if(control.writeFail)throw new Error('Storage unavailable');memory.set(key,clone(value));},removeStorageSync:key=>{if(control.removeFail)throw new Error('Storage unavailable');memory.delete(key);},showToast:message=>toasts.push(message),showModal:message=>{modals.push(message);const promise=message.success?.({confirm:!decline,cancel:decline});if(promise?.then)pending.push(promise);return promise;},navigateTo:options=>routes.push(options.url),redirectTo:options=>routes.push(options.url),switchTab:options=>routes.push(options.url),pageScrollTo(){},setClipboardData(){}};
  const reports={clearAll:async()=>{order.push('reports');return reportsOk?{ok:true}:{ok:false,message:'报告文件尚未清除'};}};
  let pendingDefinition;
  function load(relative){
    let file=path.resolve(app,relative);if(!file.endsWith('.js'))file+='.js';if(file===path.join(app,'utils','reports.js'))return{reports};if(cache.has(file))return cache.get(file).exports;
    assert.ok(file.startsWith(app),'Only app modules are loaded');
    const module={exports:{}};cache.set(file,module);
    const sandbox={module,exports:module.exports,wx,Date,setTimeout,clearTimeout,setInterval,clearInterval,console,Page:definition=>{pendingDefinition=definition;},getCurrentPages:()=>pages,require:name=>load(path.resolve(path.dirname(file),name))};
    vm.runInNewContext(readFileSync(file,'utf8'),sandbox,{filename:file});return module.exports;
  }
  function page(name){pendingDefinition=null;load('pages/'+name+'/index.js');const definition=pendingDefinition;assert.ok(definition,'Page registered');const instance={data:clone(definition.data),setData(patch){for(const [key,value]of Object.entries(patch)){const parts=key.split('.');let target=this.data;for(const part of parts.slice(0,-1))target=target[part]??(target[part]={});target[parts.at(-1)]=value===undefined?undefined:clone(value);}}};for(const [key,value]of Object.entries(definition))if(typeof value==='function')instance[key]=value.bind(instance);pages.push(instance);instance.onLoad?.({});instance.onShow?.();return instance;}
  return {wx,memory,toasts,modals,routes,order,pages,control,load,page,settle:()=>Promise.all(pending),store:load('utils/store').store};
}
const event=(field,value)=>({currentTarget:{dataset:{field,value}},detail:{value}});
function fillAssessment(page){page.setData({draft:{...profile(),age:'65',dyspneaScore:'1',act:'',cat:'8',fev1Percent:'60',fev1Fvc:'62',spo2:'96'},scaleIndex:0});page.syncFlags();}
function completeDaily(page,{worse=false,urgent=false}={}){page.setData({statusComparedUsual:worse?'worse':'usual',ageGroup:'adult',diagnosisConfirmed:true,breathlessness:0,fatigue:0,sputumChange:false,redFlags:{...flags(),chestPain:urgent}});page.sync();page.save();}

test('native clinical port preserves source safety decisions and Shanghai-day boundaries without Intl',()=>{
  const now=new Date('2026-10-21T16:00:00Z');
  for(const patch of [{},{stability:'recovering'},{dyspneaScore:null,dyspneaScale:null},{age:17},{redFlags:{...flags(),chestPain:true}},{disease:'asthma',act:18},{clinicianCleared:false},{assessmentDate:'2026-09-01'}]){
    const input=profile({assessmentDate:'2026-10-22',...patch});assert.deepEqual(clinical.createPlan(input,now),webPlan(input,now));
  }
  for(const check of [{},{chestPain:true},{chestPain:false,severeBreathlessness:false,dizziness:false,worseSymptoms:false,clinicianCleared:true,spo2:96}])assert.deepEqual(clinical.assessTrainingReadiness(check),webReadiness(check));
});

test('native daily normalization retains the original product safeguards',()=>{
  const day='2026-10-22';for(const patch of [{},{statusComparedUsual:'worse'},{redFlags:{...flags(),hemoptysis:true}},{spo2:91},{scores:{act:0}}]){
    const input={day,topic:'copd',statusComparedUsual:'usual',breathlessness:0,fatigue:0,spo2:null,sputumChange:false,redFlags:flags(),ageGroup:'adult',diagnosisConfirmed:true,recordedAt:'2026-10-22T01:00:00.000Z',...patch};
    const a=dailyCore.normalizeDailyRecord(input,{today:day}),b=webDaily(input,{today:day});assert.deepEqual(a,b);if(a.valid)assert.deepEqual(dailyCore.evaluateDailyRecord(a.record),webDailyOutcome(b.record));
  }
});

test('sequential assessment requires real choices and permits optional scores to remain missing',()=>{
  const env=environment(),page=env.page('assessment');page.next();assert.equal(page.data.step,0);assert.match(page.data.error,/年龄/);page.setField(event('age','65'));page.next();assert.equal(page.data.step,1);page.choose(event('disease','copd'));page.next();page.choose(event('stability','stable'));page.next();page.choosePermission(event('', 'yes'));page.next();assert.equal(page.data.step,4);page.next();assert.equal(page.data.step,4);page.noFlags();page.next();assert.equal(page.data.step,5);page.skip();page.skip();assert.equal(page.data.step,7);page.choose(event('goal','daily'));page.next();page.next();
  const loaded=env.store.load();assert.equal(loaded.ok,true);assert.equal(loaded.state.profile.dyspneaScore,null);assert.equal(loaded.state.profile.fev1Percent,null);assert.equal(clinical.createPlan(clone(loaded.state.profile)).status,'review');assert.equal(env.routes.at(-1),'/pages/plan/index');
});

test('visible MRC selection stays aligned after skip, back and re-entry',()=>{
  const env=environment();assert.equal(env.store.saveProfile(profile({dyspneaScale:'mrc',dyspneaScore:2})).ok,true);const page=env.page('assessment');page.showStep(5);assert.equal(page.data.scaleIndex,1);page.skip();page.previous();page.setField(event('dyspneaScore','3'));assert.equal(page.data.scaleIndex,0);assert.equal(page.profile().dyspneaScale,'mmrc');page.chooseScale({detail:{value:1}});assert.equal(page.profile().dyspneaScale,'mrc');assert.equal(page.profile().dyspneaScore,3);
});

test('switching disease discards unrelated hidden scores instead of trapping the user behind them',()=>{
  const env=environment(),page=env.page('assessment');fillAssessment(page);page.choose(event('disease','asthma'));page.setField(event('act','26'));page.showStep(5);assert.match(page.stepError(),/ACT/);page.choose(event('disease','copd'));assert.equal(page.data.draft.act,'');assert.equal(page.profile().act,null);assert.equal(page.stepError(),'');
});

test('assessment save failure preserves the visible draft and never signals success',()=>{
  const env=environment(),page=env.page('assessment');fillAssessment(page);env.control.writeFail=true;page.save();assert.match(page.data.error,/保存|失败/);assert.equal(page.data.draft.age,'65');assert.equal(env.toasts.length,0);assert.equal(env.routes.length,0);assert.equal(env.memory.size,0);
});

test('a dangerous answer remains urgent and is never replaced by missing optional measurements',()=>{
  const env=environment(),page=env.page('assessment');fillAssessment(page);page.chooseFlag({currentTarget:{dataset:{id:'hemoptysis',value:'yes'}}});assert.equal(page.data.urgent,true);page.save();assert.equal(env.store.load().state.profile.redFlags.hemoptysis,true);assert.equal(clinical.createPlan(clone(env.store.load().state.profile)).status,'urgent');
});

test('daily pickers distinguish no answer from an explicitly chosen zero',()=>{
  const env=environment(),page=env.page('daily');page.setData({step:1});page.next();assert.equal(page.data.step,1);page.rating({currentTarget:{dataset:{field:'breathlessness'}},detail:{value:1}});page.rating({currentTarget:{dataset:{field:'fatigue'}},detail:{value:1}});assert.equal(page.data.breathlessness,0);assert.equal(page.data.fatigue,0);page.next();assert.equal(page.data.step,2);assert.equal(page.data.redFlags.chestPain,null);
});

test('daily worsening and urgent symptoms persist locally with the correct warning, not a training success',()=>{
  for(const urgent of [false,true]){const env=environment(),page=env.page('daily');completeDaily(page,{worse:true,urgent});assert.equal(page.data.saved,true);assert.equal(page.data.outcome.status,urgent?'urgent':'review');assert.equal(env.store.load().state.daily.length,1);assert.equal(env.routes.length,0);assert.equal(env.toasts.length,0);}
});

test('daily storage failures cannot show the saved result panel or lose the entered ratings',()=>{
  const env=environment(),page=env.page('daily');env.control.writeFail=true;completeDaily(page);assert.equal(page.data.saved,false);assert.equal(page.data.outcome,null);assert.match(page.data.error,/保存|失败/);assert.equal(page.data.breathlessness,0);assert.equal(env.memory.size,0);
});

test('clearing data invalidates open assessment and daily drafts before they can be saved again',async()=>{
  const env=environment();env.store.saveProfile(profile());const assessment=env.page('assessment');assessment.showStep(6);const daily=env.page('daily');daily.setData({breathlessness:4,fatigue:3});const settings=env.page('settings');settings.clear();await env.settle();
  assert.equal(env.store.load().state.profile,null);assert.equal(assessment.data.draft.age,'');assert.equal(assessment.data.step,0);assert.equal(daily.data.breathlessness,null);assert.equal(daily.data.statusComparedUsual,'');assert.equal(daily.data.saved,false);assessment.save();assert.equal(env.store.load().state.profile,null);assert.equal(env.toasts.filter(item=>item.title==='已保存在本机').length,0);assert.equal(env.order[0],'reports');
});

test('epoch checks also reject a stale save if the page did not receive a lifecycle callback',()=>{
  const env=environment(),assessment=env.page('assessment');fillAssessment(assessment);env.store.clearAll();assessment.save();assert.equal(assessment.data.draft.age,'');assert.equal(env.store.load().state.profile,null);
});

test('declining or failing a clear operation preserves health records and cannot toast full completion',async()=>{
  for(const options of [{decline:true},{reportsOk:false}]){const env=environment(options);env.store.saveProfile(profile());const settings=env.page('settings');settings.clear();await env.settle();assert.equal(env.store.load().state.profile.age,65);assert.equal(env.toasts.filter(item=>item.title==='本机资料已清除').length,0);}
});

let compiler;try{compiler=require('miniprogram-compiler');}catch{try{compiler=require('../.qa/miniprogram/tools/node_modules/miniprogram-compiler');}catch{}}
let compiled;
function tree(page,data){compiled??=new Function('global','window',compiler.wxmlToJs(app))({},{});return compiled('pages/'+page+'/index.wxml')(data);}
function text(node){return typeof node==='string'||typeof node==='number'?String(node):(node?.children||[]).map(text).join(' ');}
test('official WXML renders one assessment step and displays the actually selected scale', {skip:compiler?false:'Install project development dependencies to run the official WXML compiler.'},()=>{
  const env=environment(),page=env.page('assessment');let rendered=text(tree('assessment',page.data));assert.match(rendered,/年龄（岁）/);assert.doesNotMatch(rendered,/ACT 已有总分/);fillAssessment(page);page.showStep(5);page.chooseScale({detail:{value:1}});rendered=text(tree('assessment',page.data));assert.match(rendered,/MRC（1–5）/);assert.doesNotMatch(rendered,/年龄（岁）/);
});
test('official WXML shows daily outcome only after successful persistence', {skip:compiler?false:'Install project development dependencies to run the official WXML compiler.'},()=>{
  const env=environment(),page=env.page('daily');assert.doesNotMatch(text(tree('daily',page.data)),/查看本机记录/);completeDaily(page,{urgent:true});assert.match(text(tree('daily',page.data)),/查看本机记录/);assert.match(text(tree('daily',page.data)),/危险信号/);
});
