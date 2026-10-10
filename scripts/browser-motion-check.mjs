import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base=process.env.HULAN_TEST_URL||'http://127.0.0.1:4173';
const out=new URL('../.qa/motion/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[],errors=[],remote=[],metrics={};
const contexts=[];
const output=name=>fileURLToPath(new URL(name,out));
async function context(options={}) {
  const value=await browser.newContext({locale:'zh-CN',timezoneId:'Asia/Shanghai',viewport:{width:1440,height:1000},...options});
  assert.deepEqual(await value.storageState(),{cookies:[],origins:[]});
  contexts.push(value);
  value.on('page',page=>{
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{
      const url=request.url();
      if(!url.startsWith(base)&&!url.startsWith('blob:')&&!url.startsWith('data:'))remote.push(url);
    });
  });
  return value;
}
async function check(name,run) {
  try {await run();checks.push({name,passed:true});console.log(`PASS ${name}`);}
  catch(error){checks.push({name,passed:false,error:error.message});throw error;}
}
const settle=page=>page.waitForTimeout(450);
const active=page=>page.locator('.wizard-step:visible').getAttribute('data-step');
const next=page=>page.locator('#assessment-next').click();
const choice=(page,value)=>page.locator('.wizard-choice').filter({has:page.locator(`[name="disease"][value="${value}"]`)});
async function surface(locator) {
  return locator.evaluate(el=>{
    const style=getComputedStyle(el),after=getComputedStyle(el,'::after');
    const matrix=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform);
    return {transform:style.transform,scaleX:matrix.a,scaleY:matrix.d,x:matrix.e,y:matrix.f,shadow:style.boxShadow,marker:after.content,markerOpacity:Number(after.opacity),outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth};
  });
}
async function screenshot(page,name) {await page.screenshot({path:output(name),fullPage:true});}
async function startDisease(page) {
  await page.goto(`${base}/#assessment`);await page.locator('#age').fill('70');await next(page);await settle(page);
  assert.equal(await active(page),'disease');
}
async function choose(page,value) {
  await choice(page,value).click();await page.mouse.move(0,0);await settle(page);
  assert.ok(await page.locator(`[name="disease"][value="${value}"]`).isChecked());
}
let video;
try {
  const desktop=await context(),page=await desktop.newPage();
  await page.goto(base);await page.locator('#hero-action').waitFor();
  await check('new illustration loads locally and official brand remains visible',async()=>{
    assert.ok(await page.locator('.official-logo').isVisible());
    const image=await page.locator('.garden-art').evaluate(el=>({loaded:el.complete&&el.naturalWidth>0,width:el.naturalWidth,src:el.getAttribute('src')}));
    assert.ok(image.loaded);assert.equal(image.src,'assets/rehab-garden.webp');metrics.illustration=image;
    assert.match(await page.locator('.topbar-brand').innerText(),/呼吸与危重症医学科三区/);
    await screenshot(page,'after-home-1440.png');
  });
  await startDisease(page);
  await screenshot(page,'after-disease-unselected-1440.png');
  await check('mouse selection rises, grows, and shows a check beyond color',async()=>{
    metrics.mouseBefore=await surface(choice(page,'copd'));await choose(page,'copd');metrics.mouseSelected=await surface(choice(page,'copd'));
    assert.ok(metrics.mouseSelected.y<metrics.mouseBefore.y);assert.ok(metrics.mouseSelected.scaleX>metrics.mouseBefore.scaleX);
    assert.match(metrics.mouseSelected.marker,/✓/);assert.equal(metrics.mouseSelected.markerOpacity,1);
    assert.notEqual(metrics.mouseSelected.shadow,metrics.mouseBefore.shadow);
    assert.equal(await active(page),'disease');await screenshot(page,'after-disease-selected-1440.png');
  });
  await check('pointer press compresses and release restores the selected elevation',async()=>{
    const label=choice(page,'copd');await label.scrollIntoViewIfNeeded();const rect=await label.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.waitForTimeout(130);
    assert.equal(await label.getAttribute('data-pressing'),'true');metrics.mousePressed=await surface(label);
    assert.ok(metrics.mousePressed.scaleX<1);assert.ok(metrics.mousePressed.y>0);await screenshot(page,'after-disease-pressed-1440.png');
    await page.mouse.up();await page.mouse.move(0,0);await settle(page);
    assert.equal(await label.getAttribute('data-pressing'),null);assert.ok((await surface(label)).y<0);
  });
  await check('repeated choices preserve native single selection without advancing',async()=>{
    for(const value of ['asthma','other','copd']){await choose(page,value);assert.equal(await page.locator('[name="disease"]:checked').count(),1);assert.equal(await active(page),'disease');}
  });
  await check('keyboard Space and arrow keys select with a visible focus outline',async()=>{
    await page.locator('[name="disease"][value="asthma"]').focus();await page.keyboard.press('Space');await settle(page);
    assert.ok(await page.locator('[name="disease"][value="asthma"]').isChecked());metrics.keyboardSelected=await surface(choice(page,'asthma'));
    assert.ok(metrics.keyboardSelected.y<0);assert.equal(metrics.keyboardSelected.markerOpacity,1);assert.equal(metrics.keyboardSelected.outlineStyle,'solid');
    assert.ok(parseFloat(metrics.keyboardSelected.outlineWidth)>=2);
    await page.keyboard.press('ArrowDown');assert.ok(await page.locator('[name="disease"][value="bronchiectasis"]').isChecked());
    assert.equal(await active(page),'disease');await choose(page,'copd');
  });
  await check('Next and Back preserve disease and native select values without skipping',async()=>{
    await next(page);assert.equal(await active(page),'goal');await page.locator('#goal').selectOption('endurance');
    assert.equal(await page.locator('#goal').inputValue(),'endurance');assert.ok(await page.locator('#goal').evaluate(el=>el.closest('.field').classList.contains('field-picked')));
    await next(page);assert.equal(await active(page),'stability');await page.locator('#stability').selectOption('stable');
    await page.locator('#assessment-back').click();assert.equal(await active(page),'goal');assert.equal(await page.locator('#goal').inputValue(),'endurance');
    await page.locator('#assessment-back').click();assert.equal(await active(page),'disease');assert.ok(await page.locator('[name="disease"][value="copd"]').isChecked());
    await next(page);assert.equal(await active(page),'goal');await next(page);assert.equal(await active(page),'stability');assert.equal(await page.locator('#stability').inputValue(),'stable');
  });
  await check('native selects reach review and submitted health summary',async()=>{
    await next(page);assert.equal(await active(page),'symptoms');await page.locator('#noRedFlags').check();await next(page);
    await page.locator('[name="clinicalPermission"][value="yes"]').check();await next(page);assert.equal(await active(page),'dyspnea');
    await page.locator('#dyspneaScore').selectOption('1');await next(page);
    while(await active(page)!=='review'){assert.ok(await page.locator('#assessment-skip').isVisible());await page.locator('#assessment-skip').click();}
    const summary=await page.locator('#assessment-review').innerText();assert.match(summary,/稳定/);assert.match(summary,/mMRC 1 分/);assert.match(summary,/慢阻肺/);
    await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();await page.locator('#view-home').waitFor();
    assert.match(await page.locator('#profile-summary').innerText(),/mMRC 呼吸困难/);assert.match(await page.locator('#profile-summary').innerText(),/1分/);
    assert.ok(await page.locator('.session-card').count()>0);assert.equal(await page.evaluate(()=>localStorage.getItem('hulan_rehab_v1')),null);
  });
  await check('education and music choices retain native pressed states with elevation',async()=>{
    await page.goto(`${base}/#education`);const topics=page.locator('.edu-topic-picker button');await topics.nth(1).click();await page.mouse.move(0,0);await settle(page);
    assert.equal(await topics.nth(1).getAttribute('aria-pressed'),'true');assert.ok((await surface(topics.nth(1))).y<0);
    await page.goto(`${base}/#music`);const tracks=page.locator('.music-track');assert.equal(await tracks.count(),7);await tracks.nth(1).click();await page.mouse.move(0,0);await settle(page);
    assert.equal(await tracks.nth(1).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.music-track[aria-pressed="true"]').count(),1);assert.ok((await surface(tracks.nth(1))).y<0);
  });
  const touch=await context({viewport:{width:390,height:900},isMobile:true,hasTouch:true,deviceScaleFactor:1,recordVideo:{dir:output('video'),size:{width:390,height:900}}});
  const phone=await touch.newPage();video=phone.video();await startDisease(phone);
  await check('real touch tap rises and grows while staying on the same question',async()=>{
    metrics.touchBefore=await surface(choice(phone,'copd'));await screenshot(phone,'after-disease-unselected-390.png');await choice(phone,'copd').tap();await settle(phone);
    metrics.touchSelected=await surface(choice(phone,'copd'));assert.ok(metrics.touchSelected.y<metrics.touchBefore.y);assert.ok(metrics.touchSelected.scaleX>metrics.touchBefore.scaleX);assert.equal(await choice(phone,'copd').getAttribute('data-pressing'),null);
    assert.equal(metrics.touchSelected.markerOpacity,1);assert.equal(await active(phone),'disease');await screenshot(phone,'after-disease-selected-390.png');
    await choice(phone,'asthma').tap();await settle(phone);assert.equal(await phone.locator('[name="disease"]:checked').count(),1);await choice(phone,'copd').tap();await settle(phone);
    await phone.locator('#assessment-next').tap();assert.equal(await active(phone),'goal');await phone.locator('#assessment-back').tap();await settle(phone);assert.ok(await phone.locator('[name="disease"][value="copd"]').isChecked());
  });
  await touch.close();await video.saveAs(output('selection-touch-390.webm'));video=null;
  const mobile=await context({viewport:{width:390,height:900},isMobile:true,hasTouch:true,deviceScaleFactor:1});const narrow=await mobile.newPage();
  for(const large of [false,true])for(const width of [390,320]) {
    await narrow.setViewportSize({width,height:900});await narrow.goto(base);await narrow.locator('#senior-toggle').waitFor();
    if((await narrow.locator('#senior-toggle').getAttribute('aria-pressed')==='true')!==large)await narrow.locator('#senior-toggle').tap();
    await check(`${width}px ${large?'large':'normal'} home and selected options have no horizontal overflow`,async()=>{
      assert.ok(await narrow.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(narrow,`after-home-${width}-${large?'large':'normal'}.png`);
      await startDisease(narrow);await choice(narrow,'copd').tap();await settle(narrow);assert.ok(await narrow.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const selected=choice(narrow,'copd'),bounds=await selected.boundingBox();assert.ok(bounds.height>=48);
      const font=await selected.locator('span').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(font>=(large?20:18));
      const clipped=await selected.evaluate(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth;});assert.equal(clipped,false);
      await screenshot(narrow,`after-disease-${width}-${large?'large':'normal'}.png`);
    });
  }
  for(const view of ['daily','education','music','garden','history']) {
    await check(`320px large ${view} view retains layout without overflow`,async()=>{
      await narrow.goto(`${base}/#${view}`);await narrow.locator(`#view-${view}`).waitFor();assert.ok(await narrow.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    });
  }
  const reduced=await context({viewport:{width:390,height:900},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const calm=await reduced.newPage();
  await startDisease(calm);
  await check('reduced motion removes spatial movement while preserving check and shadow selection',async()=>{
    const before=await surface(choice(calm,'copd'));await choice(calm,'copd').tap();await settle(calm);const after=await surface(choice(calm,'copd'));metrics.reducedBefore=before;metrics.reducedSelected=after;
    assert.equal(after.transform,'none');assert.equal(after.markerOpacity,1);assert.match(after.marker,/✓/);assert.notEqual(after.shadow,before.shadow);assert.match(after.shadow,/inset/);assert.equal(await choice(calm,'copd').getAttribute('data-pressing'),null);
    assert.equal(await choice(calm,'copd').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await screenshot(calm,'after-disease-reduced-motion-390.png');
    await next(calm);assert.equal(await calm.locator('.wizard-step:visible').evaluate(el=>el.getAnimations().length),0);
  });
  await check('no page script errors or default external requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);});
} finally {
  for(const value of contexts)await value.close().catch(()=>{});
  if(video)await video.saveAs(output('selection-touch-390.webm')).catch(()=>{});
  await writeFile(new URL('motion-results.json',out),JSON.stringify({passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks,metrics,scriptErrors:errors,thirdPartyRequests:remote,browser:browser.version(),testedAt:new Date().toISOString(),fixtures:'Synthetic age and disease in fresh browser contexts; no patient data'},null,2));
  await browser.close();
}
