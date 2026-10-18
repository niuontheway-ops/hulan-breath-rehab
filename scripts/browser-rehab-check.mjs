import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'.qa','rehab-redesign','qa');
const base=(process.env.REHAB_BASE||'http://127.0.0.1:4173').replace(/\/$/,'');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
const checks=[],errors=[],requests=[],responses=[];
let fatal=null,downloadNumber=0;
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))requests.push(request.url());});
page.on('response',response=>{if(response.status()>=400)responses.push({url:response.url(),status:response.status()});});
page.on('dialog',dialog=>dialog.accept());
const today=()=>page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
const later=()=>page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+14);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);});
const clinic=()=>page.locator('#view-clinic');
const form=name=>clinic().locator(`[data-clinic-form="${name}"]`);
const input=(name,group)=>form(group).locator(`[name="${name}"]`);
async function navigate(route){await page.goto(`${base}/#${route}`);await page.locator(route==='clinic'||route==='programme'?'#view-clinic':`#view-${route}`).waitFor({state:'visible'});}
async function step(name){await clinic().locator(`.clinical-workflow [data-clinic-step="${name}"]`).click();}
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log(`PASS ${name}`);}catch(error){checks.push({name,passed:false,error:error.message});throw error;}}
async function screenshot(name){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function fillProfile(age=65,{mmrc=1,fev1=65}={}){
  await navigate('assessment');
  for(let i=0;i<16&&await page.locator('.wizard-step:visible').getAttribute('data-step')!=='age';i++)await page.locator('#assessment-back').click();
  assert.equal(await page.locator('.wizard-step:visible').getAttribute('data-step'),'age');
  for(let i=0;i<16;i++){
    const active=await page.locator('.wizard-step:visible').getAttribute('data-step');
    if(active==='age')await page.locator('#age').fill(String(age));
    if(active==='disease')await page.locator('[name="disease"][value="copd"]').check();
    if(active==='stability')await page.locator('#stability').selectOption('stable');
    if(active==='symptoms')await page.locator('#noRedFlags').check();
    if(active==='permission')await page.locator('[name="clinicalPermission"][value="yes"]').check();
    if(active==='dyspnea')await page.locator('#dyspneaScore').selectOption(String(mmrc));
    if(active==='disease-score')await page.locator('#cat').fill('12');
    if(active==='fev1')await page.locator('#fev1Percent').fill(String(fev1));
    if(active==='ratio')await page.locator('#fev1Fvc').fill('66');
    if(active==='oxygen')await page.locator('#spo2').fill('96');
    if(active==='review'){
      await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();
      await page.locator('#view-home').waitFor({state:'visible'});return;
    }
    if(active==='report')await page.locator('#assessment-skip').click();else await page.locator('#assessment-next').click();
  }
  throw new Error('Assessment wizard did not finish');
}
async function fillProgramme({imt=false,supervision='hybrid'}={}){
  for(const [name,value] of Object.entries({durationWeeks:8,frequencyPerWeek:3,aerobicActivity:'合成验收平地步行',aerobicIntensity:'合成目标 Borg 2–3，按现场评估与方案界限执行',aerobicMinutes:1,workMinutes:0.1,restMinutes:0.1,spo2Min:90,hrMax:120,borgMax:4}))await input(name,'programme').fill(String(value));
  await input('aerobicMode','programme').selectOption('interval');
  await input('supervision','programme').selectOption(supervision);
  await input('reviewAt','programme').fill(await later());
  await input('imtEnabled','programme').setChecked(imt);
  if(imt){
    const mip=await input('mipMeasurementId','programme').locator('option').evaluateAll(items=>items.find(item=>item.value)?.value||'');
    await input('mipMeasurementId','programme').selectOption(mip);
    await input('imtUnit','programme').selectOption('device-level');
    for(const [name,value] of Object.entries({deviceName:'合成验收训练器（非设备直连）',imtLoad:2,imtMin:1,imtMax:3,imtBreaths:12,imtSets:2,imtDays:5}))await input(name,'programme').fill(String(value));
    await input('deviceCompatible','programme').check();
  }
  await input('attested','programme').check();
}
async function approve(){await form('programme').getByRole('button',{name:'医护确认方案',exact:true}).click();}
async function addMeasurement({kind='mip',value=60,unit='cmH2O',posture='sitting',side='',maneuver='',method='合成验收静态口压',protocol='合成验收：同仪器、标准口器、重复性已核对'}={}){
  await input('kind','measurement').selectOption(kind);
  for(const [name,current] of Object.entries({value,method,protocol}))await input(name,'measurement').fill(String(current));
  for(const [name,current] of Object.entries({unit,quality:'acceptable',posture,side,maneuver}))await input(name,'measurement').selectOption(current);
  await form('measurement').locator('button[type="submit"]').click();
}
async function saveBaseline(){await input('assessedAt','baseline').fill(await today());await form('baseline').locator('button[type="submit"]').click();}
async function fillSession({phase='pre',spo2=95,hr=100,borg=3,actualMinutes=0}={}){
  const current=await page.evaluate(()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16));
  await input('observedAt','session').fill(current);
  await input('phase','session').selectOption(phase);
  for(const [name,value] of Object.entries({spo2,hr,borg,actualMinutes}))await input(name,'session').fill(String(value));
  for(const name of ['chestPain','severeBreathlessness','fainting','hemoptysis','dizziness','worseSymptoms'])await input(name,'session').uncheck();
  await input('symptomsChecked','session').check();
}
async function saveSession(){await form('session').locator('button[type="submit"]').click();}
async function exported(label='record'){
  await step('review');
  const pending=page.waitForEvent('download');await clinic().locator('[data-export-clinic]').click();
  const download=await pending;const target=path.join(out,`${++downloadNumber}-${label}.json`);await download.saveAs(target);
  return {target,data:JSON.parse(await readFile(target,'utf8'))};
}
async function upload(data){
  await clinic().locator('[data-import-clinic]').setInputFiles({name:'synthetic-case.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>/导入|资料格式|方案.*(?:完整|不正确)|读数无效|记录.*无效|数量或格式|身体状况/.test(document.querySelector('#view-clinic .clinical-message')?.textContent||''),{},{timeout:5000});
}

try{
  await navigate('clinic');
  await check('No profile cannot confirm a clinician programme',async()=>{
    await step('plan');await fillProgramme();await approve();
    assert.match(await clinic().innerText(),/成人健康画像|当前评估|医护评估并允许/);
    assert.equal(await clinic().locator('.clinical-status.ready').count(),0);
  });
  await check('Patient sequential assessment accepts explicitly entered synthetic clinical data',async()=>{
    await fillProfile();await navigate('clinic');await step('plan');
    assert.match(await clinic().innerText(),/慢阻肺.*65 岁/);
  });
  await check('Restored forms keep draft and confirmation submissions distinct',async()=>{
    assert.equal(await form('programme').getByRole('button',{name:'保存草稿',exact:true}).getAttribute('value'),'draft');
    await fillProgramme();await form('programme').getByRole('button',{name:'保存草稿',exact:true}).click();
    assert.match(await clinic().locator('.workbench-heading').innerText(),/待医护复核/);assert.match(await clinic().innerText(),/草稿已保存/);
  });
  await check('Missing muscle tests block IMT but do not block a reviewed general programme',async()=>{
    await fillProgramme({imt:true});await approve();assert.match(await clinic().innerText(),/IMT.*MIP|MIP.*IMT/);
    await fillProgramme();await approve();assert.match(await clinic().locator('.workbench-heading').innerText(),/方案已确认/);
    const noMuscle=await exported('no-muscle-approved');assert.equal(noMuscle.data.baseline.measurements.length,0);assert.equal(noMuscle.data.programme.status,'confirmed');
  });
  await check('Without real observations the review does not invent trend points',async()=>{
    assert.match(await clinic().innerText(),/还没有可绘制/);
    assert.equal(await clinic().locator('svg circle').count(),0);
  });
  await check('Manual MIP and side-specific diaphragm measurements retain their original protocol and units',async()=>{
    await step('assess');await addMeasurement();
    await addMeasurement({kind:'diaphragm-excursion',value:18,unit:'mm',posture:'supine',side:'right',maneuver:'quiet',method:'合成验收超声 M 型',protocol:'合成验收同操作者同声窗'});
    await saveBaseline();assert.equal(await clinic().locator('.measurement-list .measurement-row').count(),2);
    assert.match(await clinic().innerText(),/右侧.*平静呼吸/s);await screenshot('professional-baseline-desktop');
    await step('plan');await fillProgramme({imt:true});await approve();
    assert.match(await clinic().locator('.workbench-heading').innerText(),/方案已确认/);
    const record=await exported('approved');assert.equal(record.data.programme.imt.load,2);assert.equal(record.data.programme.imt.unit,'device-level');
    assert.equal(record.data.baseline.measurements[1].side,'right');assert.equal(record.data.baseline.measurements[1].unit,'mm');
  });
  await check('Unconfirmed pre-training state cannot start the timer',async()=>{
    await navigate('programme');await step('monitor');await clinic().locator('[data-start-timer]').click();
    assert.equal(await clinic().locator('[data-timer-clock]').innerText(),'00:00');
    assert.match(await clinic().innerText(),/停止|求救|急救|核对|确认|缺少/);
  });
  await check('Historical manual readings cannot stand in for today’s pre-training check',async()=>{
    await fillSession();const yesterday=await page.evaluate(()=>{const d=new Date(Date.now()-86400000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
    await input('observedAt','session').fill(yesterday);await clinic().locator('[data-start-timer]').click();
    assert.equal(await clinic().locator('[data-timer-clock]').innerText(),'00:00');assert.match(await clinic().innerText(),/今天|本次.*读数|当下/);
  });
  await check('Confirmed pre-check starts a real clock; repeated start preserves elapsed time',async()=>{
    await fillSession();await saveSession();await fillSession();await clinic().locator('[data-start-timer]').click();
    await page.waitForTimeout(1300);const before=await clinic().locator('[data-timer-clock]').innerText();assert.notEqual(before,'00:00');
    if(await clinic().locator('[data-start-timer]').isDisabled())assert.equal(await clinic().locator('[data-start-timer]').isDisabled(),true);else await clinic().locator('[data-start-timer]').click();
    await page.waitForTimeout(350);
    const after=await clinic().locator('[data-timer-clock]').innerText();assert.ok(after>=before,`${before} reset to ${after}`);
    await page.waitForFunction(()=>document.querySelector('[data-timer-phase]')?.textContent.includes('恢复'),{},{timeout:9000});
    await screenshot('interval-recovery-desktop');
  });
  await check('Manual out-of-range observation stops the clock and pause stays frozen',async()=>{
    await fillSession({phase:'during',spo2:89,actualMinutes:0.1});await input('spo2','session').press('Tab');
    const changed=await clinic().locator('[data-timer-clock]').innerText();await page.waitForTimeout(500);assert.equal(await clinic().locator('[data-timer-clock]').innerText(),changed);
    await saveSession();
    assert.match(await clinic().innerText(),/超出.*界限|停止并复核/);
    const before=await clinic().locator('[data-timer-clock]').innerText();await page.waitForTimeout(800);assert.equal(await clinic().locator('[data-timer-clock]').innerText(),before);
    await clinic().locator('[data-stop-timer]').click();await fillSession({phase:'post',actualMinutes:0.12});await saveSession();
    assert.equal(await clinic().locator('.metric-strip strong').first().innerText(),'1');
    const record=await exported('pre-during-post');assert.equal(record.data.sessions.filter(item=>item.phase==='post').length,1);
    assert.ok(record.data.sessions.some(item=>item.phase==='pre'));assert.ok(record.data.sessions.some(item=>item.phase==='during'&&item.assessment.status==='stop'));
  });
  let backup;
  await check('JSON export and explicit import preserve the synthetic case with no cross-demo merge',async()=>{
    backup=await exported('round-trip');const count=backup.data.baseline.measurements.length;
    await clinic().locator('[data-clear-clinic]').click();await step('review');await upload(backup.data);
    assert.match(await clinic().innerText(),/已导入/);
    const restored=await exported('restored');assert.equal(restored.data.id,backup.data.id);assert.equal(restored.data.baseline.measurements.length,count);assert.equal(restored.data.sessions.length,backup.data.sessions.length);
    const opposite={...backup.data,simulated:true};await upload(opposite);assert.match(await clinic().innerText(),/真实.*示例.*不匹配|状态不匹配/);
    const unchanged=await exported('after-rejected-demo');assert.equal(unchanged.data.simulated,false);assert.equal(unchanged.data.id,backup.data.id);
  });
  await check('Imported values cannot inject HTML or turn malformed observations into clinical facts',async()=>{
    const unsafe=structuredClone(backup.data);unsafe.programme.durationWeeks='<img src="data:,invalid" onerror="window.__rehabUnsafe=true">';
    await upload(unsafe);await step('plan');assert.equal(await page.evaluate(()=>window.__rehabUnsafe),undefined);
    assert.equal(await clinic().locator('img[src="data:,invalid"]').count(),0);
    await step('review');const malformed=structuredClone(backup.data);malformed.sessions[0].spo2=-50;await upload(malformed);
    assert.match(await clinic().innerText(),/无效|不正确|失败|格式|核对/);
  });
  await check('Same-protocol reassessment compares actual values and isolates unmatched laterality',async()=>{
    await clinic().locator('[data-new-assessment]').click();
    assert.equal(await clinic().locator('[data-remove-measurement]').count(),0);
    await addMeasurement({value:63});
    await addMeasurement({kind:'diaphragm-excursion',value:20,unit:'mm',posture:'supine',side:'right',maneuver:'quiet',method:'合成验收超声 M 型',protocol:'合成验收同操作者同声窗'});
    await addMeasurement({kind:'diaphragm-excursion',value:20,unit:'mm',posture:'supine',side:'left',maneuver:'quiet',method:'合成验收超声 M 型',protocol:'合成验收同操作者同声窗'});
    await saveBaseline();await step('review');
    assert.match(await clinic().innerText(),/变化 \+3/);assert.match(await clinic().innerText(),/变化 \+2/);assert.match(await clinic().innerText(),/左侧.*不作比较/s);
    await screenshot('same-protocol-review-desktop');
  });
  await check('Baseline changes invalidate confirmation and profile changes cannot silently reuse it',async()=>{
    await step('plan');assert.match(await clinic().locator('.workbench-heading').innerText(),/待医护复核/);
    await fillProgramme({imt:true});await approve();assert.match(await clinic().locator('.workbench-heading').innerText(),/方案已确认/);
    await fillProfile(66);await navigate('programme');assert.match(await clinic().innerText(),/健康画像已更改|病例或健康画像已更改|尚不能用于训练|待医护复核/);
  });
  await check('Stable greater severity permits supervised PR and requires a present clinician at each session',async()=>{
    await fillProfile(66,{mmrc:3,fev1:25});await navigate('clinic');await step('plan');await fillProgramme();await approve();
    assert.match(await clinic().innerText(),/院内医护监督|现场医护监督|院内监督/);
    assert.match(await clinic().locator('.workbench-heading').innerText(),/待医护复核/);
    await fillProgramme({supervision:'clinic'});await approve();assert.match(await clinic().locator('.workbench-heading').innerText(),/方案已确认/);
    await navigate('programme');await step('monitor');await fillSession();await input('supervised','session').uncheck();await clinic().locator('[data-start-timer]').click();
    assert.equal(await clinic().locator('[data-timer-clock]').innerText(),'00:00');assert.match(await clinic().innerText(),/本次有现场医护监督|现场医护监督/);
    await input('supervised','session').check();await clinic().locator('[data-start-timer]').click();await page.waitForTimeout(1100);
    assert.notEqual(await clinic().locator('[data-timer-clock]').innerText(),'00:00');await clinic().locator('[data-stop-timer]').click();
  });
  await check('A simulated case remains separate and cannot overwrite real measurements or storage',async()=>{
    await navigate('clinic');const before=await exported('real-before-demo');
    await navigate('home');await page.locator('#demo-button').click();await navigate('clinic');assert.match(await clinic().innerText(),/模拟病例/);
    const demo=await exported('simulated');assert.equal(demo.data.simulated,true);assert.notEqual(demo.data.id,before.data.id);
    assert.equal(await page.evaluate(()=>localStorage.getItem('hulan.rehab-workbench.v1')),null);
    await page.locator('#exit-demo').click();await navigate('clinic');const after=await exported('real-after-demo');assert.deepEqual(after.data,before.data);
  });
  await check('Without explicit consent refresh discards the workbench case',async()=>{
    assert.equal(await page.evaluate(()=>localStorage.getItem('hulan.rehab-workbench.v1')),null);
    await page.reload();await clinic().waitFor({state:'visible'});await step('assess');assert.equal(await clinic().locator('[data-remove-measurement]').count(),0);
  });
  await check('Explicit opt-in preserves profile and workbench through a browser reload',async()=>{
    await fillProfile();await page.locator('#privacy-open').click();await page.locator('#save-local').check();await page.locator('#privacy-dialog .dialog-close').click();
    await navigate('clinic');await addMeasurement();await saveBaseline();await page.reload();await clinic().waitFor({state:'visible'});await step('assess');
    assert.equal(await clinic().locator('[data-remove-measurement]').count(),1);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hulan.rehab-workbench.v1')).consent),true);
  });
  await check('Keyboard operation and reduced-motion preference preserve usable workflow',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    await clinic().locator('.clinical-workflow [data-clinic-step="plan"]').focus();await page.keyboard.press('Enter');assert.ok(await form('programme').isVisible());
    await screenshot('reduced-motion-keyboard-desktop');
  });
  await check('320px large text keeps each professional step within the viewport',async()=>{
    await page.setViewportSize({width:320,height:900});if(await page.locator('#senior-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#senior-toggle').click();
    for(const name of ['assess','plan','monitor','review']){
      await step(name);const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(layout.scroll<=layout.width,`${name}: ${JSON.stringify(layout)}`);
      await screenshot('mobile-320-large-'+name);
    }
  });
  await check('Official logo, original 7 music tracks, 12 local videos and 6 inhaler teaching entries remain',async()=>{
    await page.setViewportSize({width:1440,height:1000});await navigate('home');assert.equal(await page.locator('.official-logo').getAttribute('src'),'assets/hulan-logo.jpg');assert.match(await page.locator('.app-footer').innerText(),/呼吸与危重症医学科三区/);
    await navigate('music');assert.equal(await page.locator('[data-music-track]').count(),7);
    await navigate('inhaler');assert.equal(await page.locator('[data-inhaler]').count(),6);assert.ok(await page.locator('.inhaler-video-link').isVisible());
    await navigate('education');assert.equal(await page.locator('.edu-topic-picker [data-topic]').count(),12);
    const videos=(await readdir(path.join(root,'assets','education-videos'))).filter(name=>name.endsWith('.mp4'));assert.equal(videos.length,12);
    await page.locator('.edu-video').evaluate(async video=>{video.muted=true;await video.play();});await page.waitForTimeout(1000);
    assert.ok(await page.locator('.edu-video').evaluate(video=>video.currentTime>0));await page.locator('.edu-video').evaluate(video=>video.pause());
  });
  await check('Application emits no script errors during the synthetic workflow',async()=>{assert.deepEqual(errors,[]);});
}catch(error){fatal=error;console.error(error.stack);await screenshot('failure').catch(()=>{});}
finally{
  await writeFile(path.join(out,'rehab-browser-results.json'),JSON.stringify({application:'hulan-breath-rehab',testedAt:new Date().toISOString(),base,browser:browser.version(),passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length,checks,scriptErrors:errors,externalRequests:requests,httpErrors:responses,fixtures:'Synthetic values entered in real workflow; no real patient material; no actual device connection',limitations:'Browser automation does not establish medical efficacy or real-device performance'},null,2));
  await browser.close();
}
if(fatal)process.exitCode=1;
