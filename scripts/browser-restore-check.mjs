import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'package.json'));
const {chromium}=require('playwright');
const out=path.join(root,'.qa');await mkdir(out,{recursive:true});
const base='http://127.0.0.1:4173';
const launchOptions={headless:true};
if(process.env.HULAN_MUSIC_TEST_PROXY)launchOptions.proxy={server:process.env.HULAN_MUSIC_TEST_PROXY,bypass:'127.0.0.1,localhost'};
const browser=await chromium.launch(launchOptions);
const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
assert.deepEqual(await context.storageState(),{cookies:[],origins:[]});
const page=await context.newPage();const errors=[],remote=[];let passed=0;
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))remote.push(request.url());});
const day=()=>page.evaluate(()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;});
async function check(name,run){await run();passed++;console.log(`PASS ${name}`);}
async function go(name){const link=page.locator(`a[data-page="${name}"]`);if(await link.isVisible())await link.click();else await page.evaluate(name=>{location.hash=name;},name);await page.locator(`#view-${name}`).waitFor({state:'visible'});}
async function dailyStable({topic='copd',date}={}) {
  await go('daily');const form=page.locator('.daily-form');
  await form.locator('[name="topic"]').selectOption(topic);
  if(date)await form.locator('[name="day"]').fill(date);
  await form.locator('[name="statusComparedUsual"]').selectOption('usual');
  await form.locator('[name="ageGroup"]').selectOption('adult');
  await form.locator('[name="diagnosisConfirmed"]').selectOption('yes');
  await form.locator('[name="breathlessness"]').fill('2');await form.locator('[name="fatigue"]').fill('3');
  await form.locator('[name="sputumAmount"]').selectOption('usual');await form.locator('[name="sputumColor"]').selectOption('usual');
  await form.locator('[name^="red-"]').evaluateAll(inputs=>inputs.forEach(input=>{if(input.checked)input.click();}));
  return form;
}
async function enterGarden(){await go('garden');const form=page.locator('#readiness-form');await form.waitFor();await form.locator('input[type="checkbox"]').evaluateAll(inputs=>inputs.forEach(input=>input.click()));await form.locator('button[type="submit"]').click();await page.locator('.game-shell').waitFor();}
function simulatedWav() {
  const sampleRate=8000,length=sampleRate*8;const bytes=Buffer.alloc(44+length*2);
  bytes.write('RIFF',0);bytes.writeUInt32LE(36+length*2,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(length*2,40);
  for(let i=0;i<length;i++)bytes.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/sampleRate)*400),44+i*2);
  return bytes;
}
try {
  await page.goto(base);assert.equal(await page.evaluate(()=>localStorage.length),0);
  await check('official logo bytes, visible institution, and restored entry points',async()=>{
    const response=await context.request.get(`${base}/assets/hulan-logo.jpg`);assert.equal(response.headers()['content-type'],'image/jpeg');const source=await readFile(path.join(root,'assets/hulan-logo.jpg'));assert.equal(createHash('sha256').update(await response.body()).digest('hex'),createHash('sha256').update(source).digest('hex'));
    assert.equal(await page.locator('.official-logo').evaluate(image=>image.complete&&image.naturalWidth===623),true);assert.match(await page.locator('.topbar-brand').innerText(),/呼吸与危重症医学科三区/);assert.match(await page.locator('.footer-institution').innerText(),/莆田学院附属医院/);
    for(const name of ['daily','education','music'])assert.ok(await page.locator(`.home-tools a[href="#${name}"]`).isVisible());await page.screenshot({path:path.join(out,'restored-home-desktop.png'),fullPage:true});
  });
  await check('all twelve education topics have in-app cards, precautions, and sources',async()=>{
    await go('education');const buttons=page.locator('.edu-topic-picker button');assert.equal(await buttons.count(),12);
    for(let i=0;i<12;i++){await buttons.nth(i).click();assert.ok(await page.locator('.edu-card').count()>=3);assert.ok(await page.locator('.edu-emergency').isVisible());assert.ok(await page.locator('.edu-more a').count()>=2);assert.equal(await buttons.nth(i).getAttribute('aria-pressed'),'true');}
    await page.locator('[data-topic="copd"]').click();await page.screenshot({path:path.join(out,'education-copd.png'),fullPage:true});
  });
  await check('daily assessment starts with no invented health history',async()=>{await go('daily');assert.equal(await page.locator('.daily-chart circle').count(),0);assert.match(await page.locator('.daily-history-table').innerText(),/尚无/);assert.equal(await page.locator('.daily-form [name="topic"] option').count(),12);});
  const today=await day();let form=await dailyStable();
  await check('a daily score creates a real trend point and preserves MRC scale',async()=>{
    await form.locator('[name="dyspneaScale"]').selectOption('mrc');await form.locator('[name="dyspneaScore"]').selectOption('3');await form.locator('button[type="submit"]').click();await page.locator('.daily-result-recorded').waitFor();assert.equal(await page.locator('.daily-table tbody tr').count(),1);assert.match(await page.locator('.daily-table').innerText(),/MRC 3/);await page.locator('[data-daily-metric]').selectOption('mrc');assert.equal(await page.locator('.daily-chart circle').count(),1);assert.equal(await page.evaluate(()=>localStorage.length),0);
  });
  await check('same-day edits update one record without losing other days and topics',async()=>{
    const previous=new Date(`${today}T12:00:00+08:00`);previous.setUTCDate(previous.getUTCDate()-1);const previousDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(previous);
    form=await dailyStable({date:previousDay});await form.locator('[name="breathlessness"]').fill('4');await form.locator('button[type="submit"]').click();assert.equal(await page.locator('.daily-table tbody tr').count(),2);
    form=await dailyStable({date:today});await form.locator('[name="fatigue"]').fill('4');await form.locator('button[type="submit"]').click();assert.equal(await page.locator('.daily-table tbody tr').count(),2);
    form=await dailyStable({topic:'quit'});await form.locator('button[type="submit"]').click();assert.equal(await page.locator('.daily-form [name="topic"]').inputValue(),'quit');assert.equal(await page.locator('.daily-table tbody tr').count(),1);await page.locator('.daily-form [name="topic"]').selectOption('copd');assert.equal(await page.locator('.daily-table tbody tr').count(),2);await page.screenshot({path:path.join(out,'daily-assessment.png'),fullPage:true});
  });
  await check('only opted-in normalized daily records persist, with training history preserved',async()=>{
    await page.locator('#privacy-footer').click();await page.locator('#save-local').check();await page.locator('#privacy-dialog .dialog-close').click();const payload=JSON.parse(await page.evaluate(()=>localStorage.getItem('hulan_rehab_v1')));assert.equal(payload.dailyRecords.length,3);assert.ok(!JSON.stringify(payload).includes('recordText'));await page.reload();await go('daily');assert.equal(await page.locator('.daily-table tbody tr').count(),2);await go('history');assert.match(await page.locator('#history-health').innerText(),/3 条记录/);
  });
  await check('ACT frequency reminder and incomplete score date validation are visible',async()=>{
    form=await dailyStable({topic:'asthma'});await form.locator('.daily-score-panel summary').click();assert.match(await form.locator('.daily-score-panel').innerText(),/过去 4 周/);await form.locator('[name="score-act"]').fill('22');await form.locator('button[type="submit"]').click();assert.ok(await page.locator('.daily-errors').isVisible());assert.match(await page.locator('.daily-errors').innerText(),/实际完成/);await form.locator('[name="scoreDate"]').fill(today);await form.locator('button[type="submit"]').click();await page.locator('.daily-result-recorded').waitFor();
  });
  await page.locator('#demo-button').click();
  await check('unsaved dangerous daily symptoms pause training before submission',async()=>{
    form=await dailyStable();await form.locator('[name="red-chestPain"]').check();await go('garden');assert.equal(await page.locator('.game-shell').count(),0);assert.match(await page.locator('#garden-gate').innerText(),/危险症状/);await go('daily');assert.ok(await page.locator('[name="red-chestPain"]').isChecked());
  });
  await check('saved worsening daily health blocks a previously ready plan',async()=>{
    form=await dailyStable();await form.locator('[name="statusComparedUsual"]').selectOption('worse');await form.locator('button[type="submit"]').click();await go('garden');assert.equal(await page.locator('#readiness-form').count(),0);assert.match(await page.locator('#garden-gate').innerText(),/复核/);form=await dailyStable();await form.locator('button[type="submit"]').click();
  });
  await check('new high daily MRC also pauses a previously ready plan',async()=>{
    form=await dailyStable();await form.locator('[name="dyspneaScale"]').selectOption('mrc');await form.locator('[name="dyspneaScore"]').selectOption('4');await form.locator('button[type="submit"]').click();await go('garden');assert.equal(await page.locator('#readiness-form').count(),0);assert.match(await page.locator('#garden-gate').innerText(),/呼吸困难等级/);form=await dailyStable();await form.locator('[name="dyspneaScore"]').selectOption('2');await form.locator('button[type="submit"]').click();
  });
  await check('music keeps all original tracks and waits for explicit playback',async()=>{
    await go('music');assert.equal(await page.locator('[data-music-track]').count(),7);assert.match(await page.locator('#music-container').innerText(),/本地音乐/);assert.deepEqual(remote,[]);await page.screenshot({path:path.join(out,'music-therapy.png'),fullPage:true});
  });
  await check('real original MP3 loads, plays, and pauses from the restored player',async()=>{
    await page.locator('[data-music-track="anni"]').click();await page.locator('[data-music-play]').click();await page.locator('[data-music-status]').filter({hasText:/正在播放/}).waitFor({timeout:40000});await page.waitForFunction(()=>document.querySelector('[data-music-duration]').textContent!=='0:00',{},{timeout:20000});assert.ok(remote.length>=1);assert.ok(remote.every(url=>url.startsWith('https://niuontheway-ops.github.io/human-breath/')));await page.locator('[data-music-play]').click();assert.match(await page.locator('[data-music-status]').innerText(),/暂停/);
  });
  const beforeLocalRequests=remote.length;
  await check('a simulated device WAV plays offline with actual progress and volume',async()=>{
    await page.locator('#local-music-file').setInputFiles({name:'simulated-relaxation.wav',mimeType:'audio/wav',buffer:simulatedWav()});await page.locator('[data-music-play]').click();await page.locator('[data-music-status]').filter({hasText:/正在播放/}).waitFor();await page.waitForFunction(()=>document.querySelector('[data-music-position]').textContent!=='0:00');assert.equal(await page.locator('[data-music-title]').innerText(),'simulated-relaxation.wav');assert.equal(remote.length,beforeLocalRequests);await page.locator('#music-volume').fill('0.1');assert.match(await page.locator('[data-music-volume-label]').innerText(),/10%/);await page.locator('[data-music-stop]').click();
  });
  await check('training opt-in starts music and timed guidance pauses it',async()=>{
    await page.locator('[data-music-training]').check();await enterGarden();await page.locator('[data-game-action="primary"]').click();await page.locator('#training-music-status').filter({hasText:/正在播放/}).waitFor();await page.locator('.game-shell[data-status="awaiting-confirmation"]').waitFor({timeout:8000});assert.match(await page.locator('#training-music-status').innerText(),/暂停/);await page.locator('[data-game-action="stop"]').click();await go('music');await page.locator('[data-music-training]').uncheck();
  });
  await check('human animation moves in both real-time phases and freezes on pause',async()=>{
    await enterGarden();await page.locator('[data-game-action="primary"]').click();await page.waitForFunction(()=>Number(document.querySelector('[data-game-patient]').dataset.expansion)>0.2);
    const first=await page.locator('[data-game-abdomen]').getAttribute('transform');assert.equal(await page.locator('[data-game-inhale-flow]').getAttribute('data-active'),'true');await page.screenshot({path:path.join(out,'person-inhale.png'),fullPage:true});
    await page.locator('.game-shell[data-phase="exhale"]').waitFor({timeout:4000});const second=await page.locator('[data-game-abdomen]').getAttribute('transform');assert.notEqual(first,second);assert.equal(await page.locator('[data-game-exhale-flow]').getAttribute('data-active'),'true');await page.screenshot({path:path.join(out,'person-exhale.png'),fullPage:true});await page.locator('[data-game-action="pause"]').click();const frozen=await page.locator('[data-game-abdomen]').getAttribute('transform');await page.waitForTimeout(300);assert.equal(await page.locator('[data-game-abdomen]').getAttribute('transform'),frozen);assert.equal(await page.locator('[data-game-patient]').getAttribute('data-motion'),'paused');
  });
  await check('all restored pages and human animation fit 375px and 320px phones',async()=>{
    for(const width of [375,320]){
      await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('.sidebar a[data-page]:visible').count(),5);await page.screenshot({path:path.join(out,`person-mobile-${width}.png`),fullPage:true});
      for(const name of ['home','daily','education','music']){await go(name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${width}`);assert.ok(await page.locator('.topbar-brand').isVisible());}
      await go('garden');if(!(await page.locator('[data-game-action="primary"]').count()))await enterGarden();await page.locator('[data-game-action="primary"]').click();await page.locator('[data-game-action="pause"]').click();
    }
    await go('home');await page.screenshot({path:path.join(out,'restored-home-mobile.png'),fullPage:true});
  });
  await page.setViewportSize({width:1440,height:1100});await page.emulateMedia({reducedMotion:'reduce'});
  await check('reduced-motion preference makes a static person while preserving phase guidance',async()=>{
    await enterGarden();await page.locator('[data-game-action="primary"]').click();assert.equal(await page.locator('[data-game-patient]').getAttribute('data-motion'),'reduced');const pose=await page.locator('[data-game-abdomen]').getAttribute('transform');await page.locator('.game-shell[data-phase="exhale"]').waitFor({timeout:4000});assert.equal(await page.locator('[data-game-abdomen]').getAttribute('transform'),pose);await page.locator('[data-game-action="stop"]').click();
  });
  await check('exiting demo restores real test daily history and excludes simulation records',async()=>{await page.locator('#exit-demo').click();await go('history');assert.match(await page.locator('#history-health').innerText(),/4 条记录/);assert.equal(await page.locator('.history-row').count(),0);assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('hulan_rehab_v1'))).dailyRecords.length,4);});
  assert.deepEqual(errors,[]);
  const result={passed,failed:0,scriptErrors:errors,musicRequests:[...new Set(remote)],fixtures:'simulated isolated browser context',clinicalValidation:false,testedAt:new Date().toISOString()};
  await writeFile(path.join(out,'restore-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
