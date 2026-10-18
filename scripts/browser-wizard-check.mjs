import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:4173',out=new URL('../.qa/upgrade/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[],errors=[],remote=[];
const imagePath=name=>fileURLToPath(new URL(name,out));
const context=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))remote.push(r.url());});
async function check(name,fn){await fn();checks.push({name,passed:true});console.log(`PASS ${name}`);}
async function active(){return page.locator('.wizard-step:visible').getAttribute('data-step');}
async function next(){await page.locator('#assessment-next').click();}
async function chooseBasics(disease='copd') {
  await page.locator('#age').fill('70');await next();
  await page.locator(`[name="disease"][value="${disease}"]`).check();await next();
  await next();await page.locator('#stability').selectOption('stable');await next();
  await page.locator('[name="chestPain"]').check();assert.ok(await page.locator('#assessment-urgent').isVisible());
  await page.locator('#noRedFlags').check();assert.equal(await page.locator('[name="chestPain"]').isChecked(),false);assert.equal(await page.locator('#assessment-urgent').isVisible(),false);await next();
  await page.locator('[name="clinicalPermission"][value="yes"]').check();await next();
}
async function skipToReview(){while(await active()!=='review'){assert.ok(await page.locator('#assessment-skip').isVisible());await page.locator('#assessment-skip').click();}}
async function teachingOnly(){const cards=page.locator('#plan-sessions .session-card');assert.equal(await cards.count(),3);assert.deepEqual(await cards.locator('a').evaluateAll(items=>items.map(item=>item.getAttribute('href')).sort()),['#education','#garden','#inhaler']);assert.equal(await cards.locator('.session-footer').count(),0);assert.equal(await page.locator('#rehab-home-summary .prescription-facts').count(),0);}
async function fresh(){await page.reload();await page.locator('#senior-toggle').waitFor();await page.goto(`${base}/#assessment`);await page.locator('#age').waitFor();}
try {
  await page.goto(base);
  await check('official logo and retained patient modules',async()=>{assert.ok(await page.locator('.official-logo').isVisible());assert.equal(await page.locator('.home-tool').count(),4);assert.match(await page.locator('.home-tools').innerText(),/每日健康评估/);assert.match(await page.locator('.home-tools').innerText(),/宣教/);assert.match(await page.locator('.home-tools').innerText(),/音乐疗法/);assert.match(await page.locator('.app-footer').innerText(),/呼吸与危重症医学科三区/);await page.screenshot({path:imagePath('home-desktop.png'),fullPage:true});});
  await page.goto(`${base}/#assessment`);
  await check('age starts alone and invalid age cannot advance',async()=>{assert.equal(await page.locator('.wizard-step:visible').count(),1);assert.equal(await active(),'age');assert.equal(await page.locator('#report-file').isVisible(),false);await page.locator('#age').fill('0');await next();assert.equal(await active(),'age');assert.ok(await page.locator('#wizard-step-error').isVisible());await page.locator('#age').fill('70');await page.locator('#age').press('Enter');assert.equal(await active(),'disease');await page.locator('#assessment-back').click();assert.equal(await active(),'age');assert.equal(await page.locator('#age').inputValue(),'70');});
  await chooseBasics();
  await check('explicit safety choices and professional skip',async()=>{assert.equal(await active(),'dyspnea');await page.locator('#dyspneaScore').selectOption('2');await page.locator('#assessment-skip').click();assert.equal(await page.locator('#dyspneaScore').inputValue(),'');await skipToReview();assert.match(await page.locator('#assessment-review').innerText(),/暂未提供/);assert.equal(await page.locator('.wizard-step:visible').count(),1);await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();assert.match(await page.locator('#plan-notice').innerText(),/呼吸困难评分/);await teachingOnly();assert.equal(await page.evaluate(()=>localStorage.getItem('hulan_rehab_v1')),null);});
  await fresh();await chooseBasics('asthma');
  await page.locator('#assessment-skip').click();
  await check('optional ACT rejects invalid entry and can be skipped',async()=>{assert.equal(await active(),'disease-score');assert.ok(await page.locator('#act').isVisible());assert.equal(await page.locator('#cat').isVisible(),false);await page.locator('#act').fill('30');await next();assert.equal(await active(),'disease-score');assert.match(await page.locator('#wizard-step-error').innerText(),/ACT/);await page.locator('#assessment-skip').click();assert.equal(await page.locator('#act').inputValue(),'');await skipToReview();await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();const notice=await page.locator('#plan-notice').innerText();assert.match(notice,/未提供.*ACT/);assert.ok(!notice.includes('ACT 不超过 19'));await teachingOnly();});
  await fresh();await chooseBasics('other');
  await check('irrelevant disease score step is omitted',async()=>{await page.locator('#assessment-skip').click();assert.equal(await active(),'fev1');assert.match(await page.locator('#wizard-progress-label').innerText(),/共 12 步/);});
  await check('font mode actually enlarges and restores independently of health data',async()=>{const before=await page.locator('#fev1Percent').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));await page.locator('#senior-toggle').click();const after=await page.locator('#fev1Percent').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(after>=20&&after>before);assert.equal(await page.locator('#senior-toggle').getAttribute('aria-pressed'),'true');await page.reload();assert.equal(await page.locator('body').getAttribute('class'),'senior-mode');assert.equal(await page.evaluate(()=>localStorage.getItem('hulan_rehab_v1')),null);});
  for(const large of [false,true]) {
    if((await page.locator('#senior-toggle').getAttribute('aria-pressed')==='true')!==large)await page.locator('#senior-toggle').click();
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});await fresh();
      await check(`${width}px ${large?'large':'normal'} single-question flow has no overflow`,async()=>{
        await page.locator('#age').fill('70');
        for(let i=0;i<13;i++) {
          const step=await active();assert.equal(await page.locator('.wizard-step:visible').count(),1);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${step} overflow`);
          if(['age','disease','report','review'].includes(step)&&width!==1440)await page.screenshot({path:imagePath(`${width}-${large?'large':'normal'}-${step}.png`),fullPage:true});
          if(step==='review')break;
          if(step==='disease')await page.locator('[name="disease"][value="copd"]').check();
          if(step==='disease'){const size=await page.locator('.disease-options .wizard-choice span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(size>=(large?20:18));}
          if(step==='stability')await page.locator('#stability').selectOption('stable');
          if(step==='symptoms')await page.locator('#noRedFlags').check();
          if(step==='permission')await page.locator('[name="clinicalPermission"][value="yes"]').check();
          if(await page.locator('#assessment-skip').isVisible())await page.locator('#assessment-skip').click();else await next();
        }
        assert.equal(await active(),'review');const button=await page.locator('#assessment-finish').boundingBox();assert.ok(button.height>=48);
      });
    }
  }
  await check('keyboard focus reaches visible next control',async()=>{await page.setViewportSize({width:1440,height:900});await fresh();await page.locator('#age').focus();await page.keyboard.press('Tab');const id=await page.evaluate(()=>document.activeElement.id);assert.ok(['assessment-next','assessment-back'].includes(id));});
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:900});
    for(const view of ['home','daily','education','music','history','garden']) {
      await page.goto(`${base}/#${view}`);await page.locator(`#view-${view}`).waitFor();
      await check(`${width}px large retained ${view} view`,async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(view==='music')assert.equal(await page.locator('.music-track').count(),7);await page.screenshot({path:imagePath(`${width}-large-${view}.png`),fullPage:true});});
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  await writeFile(new URL('wizard-results.json',out),JSON.stringify({passed:checks.length,failed:0,checks,scriptErrors:errors,thirdPartyRequests:remote,browser:browser.version(),testedAt:new Date().toISOString(),fixtures:'simulated age and disease; no real patient'},null,2));
} finally {await browser.close();}
