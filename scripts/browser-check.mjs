import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const arg=process.argv.indexOf('--modules');
const modules=arg>=0?path.resolve(process.argv[arg+1]):path.join(root,'node_modules');
const require=createRequire(path.join(modules,'package.json'));
const {chromium}=require('playwright');
const {PDFDocument,StandardFonts}=require('pdf-lib');
const out=path.join(root,'.qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
// A nonpersistent context starts empty and never opens a user's browser profile.
assert.deepEqual(await context.storageState(),{cookies:[],origins:[]});
const page=await context.newPage();
const errors=[];const remoteRequests=[];let passed=0;let activeCheck=null;
page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4173')&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))remoteRequests.push(request.url());});
async function check(name,fn){activeCheck=name;await fn();passed++;console.log(`PASS ${name}`);activeCheck=null;}
async function go(name){const link=page.locator(`a[data-page="${name}"]`);if(await link.isVisible())await link.click();else await page.evaluate(name=>{location.hash=name;},name);await page.locator(`#view-${name}`).waitFor({state:'visible'});}
async function openEmptyTestPage(){await page.goto('http://127.0.0.1:4173');assert.equal(await page.evaluate(()=>localStorage.length),0);}
async function demo(){await page.locator('#demo-button').click();await page.locator('.session-card').first().waitFor();}
async function teachingOnly(){
  const cards=page.locator('#plan-sessions .session-card');assert.equal(await cards.count(),3);
  assert.deepEqual(await cards.locator('a').evaluateAll(items=>items.map(item=>item.getAttribute('href')).sort()),['#education','#garden','#inhaler']);
  assert.equal(await cards.locator('.session-footer').count(),0);assert.doesNotMatch((await cards.allTextContents()).join(' '),/分钟起步|每周\s*\d|负荷\s*\d/);
}
const stepOrder=['age','disease','goal','stability','symptoms','permission','dyspnea','disease-score','fev1','ratio','oxygen','report','review'];
const currentStep=()=>page.locator('#assessment-form .wizard-step:visible').getAttribute('data-step');
async function fillRequiredStep(step){
  if(step==='age'&&await page.locator('#age').inputValue()==='')await page.locator('#age').fill('62');
  if(step==='disease'&&await page.locator('#assessment-form input[name="disease"]:checked').count()===0)await page.locator('input[name="disease"][value="copd"]').check();
  if(step==='stability'&&await page.locator('#stability').inputValue()==='')await page.locator('#stability').selectOption('stable');
  if(step==='symptoms'&&await page.locator('[data-step="symptoms"] input:checked').count()===0)await page.locator('#noRedFlags').check();
  if(step==='permission'&&await page.locator('[name="clinicalPermission"]:checked').count()===0)await page.locator('[name="clinicalPermission"][value="yes"]').check();
}
async function visitStep(target){
  await go('assessment');
  for(let moves=0;moves<stepOrder.length*2;moves++){
    const step=await currentStep();if(step===target)return;
    if(stepOrder.indexOf(step)>stepOrder.indexOf(target))await page.locator('#assessment-back').click();
    else {await fillRequiredStep(step);await page.locator('#assessment-next').click();}
    assert.notEqual(await currentStep(),step,`Wizard could not leave ${step}: ${await page.locator('#wizard-step-error').textContent()}`);
  }
  throw new Error(`Wizard did not reach ${target}`);
}
async function enterGarden(){await go('garden');await page.locator('#readiness-form').waitFor();for(const input of await page.locator('#readiness-form input[type="checkbox"]').all())await input.check();await page.locator('#readiness-form button[type="submit"]').click();await page.locator('.game-shell').waitFor();}
try {
  await openEmptyTestPage();
  await check('empty patient state offers teaching without invented prescription or records',async()=>{await teachingOnly();assert.equal(await page.locator('#rehab-home-summary .prescription-facts').count(),0);assert.equal(await page.evaluate(()=>localStorage.length),0);await page.screenshot({path:path.join(out,'home-desktop.png'),fullPage:true});});
  await check('mobile 375px and 320px have no horizontal overflow',async()=>{for(const width of [375,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`home-mobile-${width}.png`),fullPage:true});}await page.setViewportSize({width:1440,height:1050});});
  await check('one-question wizard allows skipping professional details while withholding training',async()=>{
    await visitStep('dyspnea');
    while(await currentStep()!=='review'){
      assert.equal(await page.locator('#assessment-form .wizard-step:visible').count(),1);
      await page.locator('#assessment-skip').click();
    }
    await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();
    assert.match(await page.locator('#plan-notice').innerText(),/未提供 MRC \/ mMRC/);
    await teachingOnly();assert.equal(await page.locator('#rehab-home-summary .prescription-facts').count(),0);await go('garden');assert.equal(await page.locator('#readiness-form').count(),0);assert.equal(await page.locator('.game-shell').count(),0);assert.equal(await page.evaluate(()=>localStorage.length),0);
    await visitStep('age');assert.equal(await page.locator('#age').inputValue(),'62');
  });
  await check('simulation is labelled and its clinician programme is separate from teaching',async()=>{await demo();assert.ok(await page.locator('#demo-banner').isVisible());await teachingOnly();assert.equal(await page.locator('#rehab-home-summary .prescription-facts').count(),1);await page.screenshot({path:path.join(out,'plan-desktop.png'),fullPage:true});});
  await check('editing an assessment cannot reuse a stale safe plan',async()=>{await visitStep('age');await page.locator('#age').fill('63');await go('garden');assert.equal(await page.locator('#readiness-form').count(),0);assert.match(await page.locator('#garden-gate').innerText(),/资料已修改/);});
  await check('chest pain blocks all exercise even before submission',async()=>{await visitStep('symptoms');await page.locator('input[name="chestPain"]').check();await go('garden');assert.match(await page.locator('#garden-gate').innerText(),/急救/);assert.equal(await page.locator('.game-shell').count(),0);});
  await page.locator('#exit-demo').click();
  await go('assessment');
  await check('text report candidates require explicit confirmation',async()=>{await visitStep('report');await page.locator('.paste-details summary').click();await page.locator('#report-text').fill('SIMULATED REPORT\nFEV1 %pred 65%\nFEV1/FVC 68%\nSpO2 96%\nmMRC 2');await page.locator('#parse-text').click();assert.equal(await page.locator('#report-candidates input:checked').count(),0);assert.equal(await page.locator('#fev1Percent').inputValue(),'');for(const input of await page.locator('#report-candidates input[type="checkbox"]').all())await input.check();await page.locator('#apply-candidates').click();assert.equal(await page.locator('#fev1Percent').inputValue(),'65');assert.equal(await page.locator('#fev1Fvc').inputValue(),'68');assert.equal(await page.locator('#dyspneaScore').inputValue(),'2');assert.ok(!(await page.locator('#valuesVerified').isChecked()));});
  const dataUrl=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1500;c.height=700;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='44px Arial';['SIMULATED REPORT - NOT A PATIENT','FEV1 %pred 65%','FEV1/FVC 68%','SpO2 96%','mMRC 2'].forEach((t,i)=>x.fillText(t,60,100+i*110));return c.toDataURL('image/png');});
  const png=Buffer.from(dataUrl.split(',')[1],'base64');await writeFile(path.join(out,'simulated-report.png'),png);
  await check('real image OCR stays local and proposes recognizable numbers',async()=>{await page.locator('#report-file').setInputFiles({name:'simulated-report.png',mimeType:'image/png',buffer:png});await page.locator('#report-status').filter({hasText:/本机处理完成/}).waitFor({timeout:90000});const text=await page.locator('#report-candidates').innerText();assert.match(text,/65/);assert.match(text,/68/);assert.match(text,/96/);assert.equal(await page.locator('#report-candidates input:checked').count(),0);await page.screenshot({path:path.join(out,'report-ocr-desktop.png'),fullPage:true});});
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const p=pdf.addPage([600,700]);['SIMULATED REPORT - NOT A PATIENT','FEV1 %pred 72%','FEV1/FVC 70%','SpO2 97%','MRC 2'].forEach((t,i)=>p.drawText(t,{x:40,y:650-i*75,size:20,font}));const pdfBytes=Buffer.from(await pdf.save());
  await check('real PDF text extraction preserves MRC numbering',async()=>{await page.locator('#report-file').setInputFiles({name:'simulated-report.pdf',mimeType:'application/pdf',buffer:pdfBytes});await page.locator('#report-status').filter({hasText:/本机处理完成/}).waitFor({timeout:30000});const text=await page.locator('#report-candidates').innerText();assert.match(text,/72/);assert.match(text,/MRC（1–5）/);assert.equal(await page.locator('#report-candidates input:checked').count(),0);});
  const scan=await PDFDocument.create();const image=await scan.embedPng(png);scan.addPage([750,350]).drawImage(image,{x:0,y:0,width:750,height:350});const scanBytes=Buffer.from(await scan.save());
  await check('real scanned PDF runs local OCR',async()=>{await page.locator('#report-file').setInputFiles({name:'simulated-scan.pdf',mimeType:'application/pdf',buffer:scanBytes});await page.locator('#report-status').filter({hasText:/本机处理完成/}).waitFor({timeout:90000});assert.match(await page.locator('#report-candidates').innerText(),/65/);});
  await check('PDF and OCR make no third-party requests',async()=>{assert.deepEqual(remoteRequests,[]);assert.deepEqual(await page.evaluate(()=>indexedDB.databases()),[]);});
  await check('stable manual assessment keeps teaching separate from an unconfirmed medical dose',async()=>{await visitStep('age');await page.locator('#age').fill('62');await visitStep('disease');await page.locator('input[name="disease"][value="copd"]').check();await visitStep('stability');await page.locator('#stability').selectOption('stable');await visitStep('symptoms');await page.locator('#noRedFlags').check();await visitStep('permission');await page.locator('[name="clinicalPermission"][value="yes"]').check();await visitStep('dyspnea');await page.locator('#dyspneaScore').selectOption('2');await visitStep('review');await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();assert.match(await page.locator('#plan-notice').innerText(),/慢阻肺/);await teachingOnly();assert.equal(await page.locator('#rehab-home-summary .prescription-facts').count(),0);assert.equal(await page.evaluate(()=>localStorage.length),0);});
  await check('low ACT blocks asthma exercise while retaining education',async()=>{await visitStep('disease');await page.locator('input[name="disease"][value="asthma"]').check();await visitStep('disease-score');await page.locator('#act').fill('15');await visitStep('review');await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();assert.match(await page.locator('#plan-notice').innerText(),/ACT/);await teachingOnly();assert.equal(await page.locator('#rehab-home-summary .prescription-facts').count(),0);await go('garden');assert.equal(await page.locator('#readiness-form').count(),0);assert.equal(await page.locator('.game-shell').count(),0);assert.match(await page.locator('#garden-gate').innerText(),/ACT/);});
  await check('optional local storage persists only normalized values and restores consent',async()=>{await page.locator('#privacy-footer').click();await page.locator('#save-local').check();await page.locator('#privacy-dialog .dialog-close').click();const saved=await page.evaluate(()=>localStorage.getItem('hulan_rehab_v1'));assert.ok(saved);assert.ok(!saved.includes('SIMULATED REPORT'));assert.ok(!saved.includes('simulated-report'));await page.reload();await page.locator('#privacy-footer').click();assert.ok(await page.locator('#save-local').isChecked());await page.locator('#save-local').uncheck();await page.locator('#privacy-dialog .dialog-close').click();assert.equal(await page.evaluate(()=>localStorage.length),0);});
  await demo();await enterGarden();
  await check('garden renders and cannot confirm before real elapsed time',async()=>{await page.screenshot({path:path.join(out,'garden-desktop.png'),fullPage:true});await page.locator('[data-game-action="primary"]').click();assert.ok(await page.locator('[data-game-action="primary"]').isDisabled());await page.locator('.game-shell[data-phase="exhale"]').waitFor({timeout:4000});await page.locator('.game-shell[data-status="awaiting-confirmation"]').waitFor({timeout:8000});assert.match(await page.locator('[data-game-action="primary"]').innerText(),/完成这一轮/);await page.locator('[data-game-action="primary"]').click();assert.match(await page.locator('[data-game-progress-label]').innerText(),/1 \/ 20/);await page.locator('[data-game-action="pause"]').click();assert.equal(await page.locator('.game-shell').getAttribute('data-status'),'paused');});
  await check('mobile game and assessment stay within viewport',async()=>{await page.setViewportSize({width:375,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'garden-mobile.png'),fullPage:true});await page.locator('[data-game-action="stop"]').click();assert.equal(await page.locator('.game-shell').count(),0);await go('assessment');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'assessment-mobile.png'),fullPage:true});});
  await page.setViewportSize({width:1440,height:1050});await page.clock.install();await go('garden');await enterGarden();
  await check('20 rounds complete once with encouragement and one self-reported record (controlled clock)',async()=>{
    await page.locator('[data-game-action="primary"]').click();
    for(let i=0;i<20;i++){await page.clock.runFor(6100);assert.equal(await page.locator('.game-shell').getAttribute('data-status'),'awaiting-confirmation');await page.locator('[data-game-action="primary"]').click();}
    await page.locator('.completion-card').waitFor();assert.match(await page.locator('.completion-card').innerText(),/太棒了/);await page.locator('[data-feeling="comfortable"]').click();await go('history');assert.equal(await page.locator('.history-row').count(),1);assert.match(await page.locator('.history-row').innerText(),/20/);assert.match(await page.locator('.history-row').innerText(),/120/);await page.screenshot({path:path.join(out,'history-desktop.png'),fullPage:true});
  });
  await check('exiting simulation restores prior test profile without retaining demo records',async()=>{await page.locator('#exit-demo').click();await go('history');assert.equal(await page.locator('.history-row').count(),0);assert.equal(await page.evaluate(()=>localStorage.length),0);});
  assert.deepEqual(errors,[]);
  const result={passed,failed:0,scriptErrors:errors,thirdPartyRequests:remoteRequests,ocr:'real local image + scanned PDF',gameTiming:'first round real elapsed; completion uses controlled test clock',fixtures:'simulated',testedAt:new Date().toISOString()};
  await writeFile(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch(error){
  await writeFile(path.join(out,'browser-results.json'),JSON.stringify({passed,failed:1,failedCheck:activeCheck||'setup',error:error.message,scriptErrors:errors,thirdPartyRequests:remoteRequests,fixtures:'simulated',testedAt:new Date().toISOString()},null,2));
  throw error;
} finally {await browser.close();}
