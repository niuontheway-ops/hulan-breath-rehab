import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {INHALER_DEVICES,getInhaler} from '../inhaler.mjs';

const base=(process.env.HULAN_TEST_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const out=new URL('../.qa/inhaler-expansion/browser/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
const page=await context.newPage(),checks=[],errors=[],external=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external.push(request.url());});
const check=async(name,fn)=>{await fn();checks.push({name,passed:true});console.log('PASS '+name);};
const selected=()=>page.getByRole('combobox',{name:'选择手中的吸入装置',exact:true});
try{
  await page.goto(base+'/#inhaler');await page.locator('.inhaler-library').waitFor();
  await check('Complete catalogue is reachable through a native device selector',async()=>{assert.equal(await selected().locator('option').count(),INHALER_DEVICES.length+1);assert.ok(INHALER_DEVICES.length>6);assert.match(await page.locator('.inhaler-scope').innerText(),/已核实.*大陆产品/);});
  await check('Every device presents matching instructions and honest video availability',async()=>{
    for(const item of INHALER_DEVICES){await selected().selectOption(item.id);const data=getInhaler(item.id);assert.equal(await page.locator('.inhaler-teaching-heading h3').innerText(),data.name);assert.equal(await page.locator('.inhaler-steps li').count(),data.steps.length);assert.ok(await page.locator('.inhaler-breath-cue').isVisible());if(data.video){const link=page.locator('.inhaler-video-link');assert.equal(await link.getAttribute('href'),new URL(data.video).href);assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer');}else{assert.equal(await page.locator('.inhaler-video-link').count(),0);assert.match(await page.locator('.inhaler-media-body').innerText(),/尚未|未找到|待|核对/);}}
  });
  await check('New soft-mist and capsule devices are distinct from legacy capsule teaching',async()=>{for(const id of ['respimat','handihaler','breezhaler','capsule']){await selected().selectOption(id);assert.match(await page.locator('.inhaler-teaching-heading h3').innerText(),new RegExp(getInhaler(id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}});
  await check('Search finds device aliases and never substitutes an unrelated teaching panel',async()=>{
    const search=page.getByRole('searchbox',{name:'搜索药名或吸入装置'});await search.fill('能倍乐');assert.ok(await selected().locator('option').count()>=2);await selected().selectOption('respimat');assert.ok(await page.locator('.inhaler-panel').isVisible());await search.fill('不存在的装置型号');assert.equal(await page.locator('.inhaler-panel').isVisible(),false);assert.match(await page.locator('.inhaler-result-status').innerText(),/未找到/);await search.fill('');assert.equal(await selected().inputValue(),'respimat');assert.ok(await page.locator('.inhaler-panel').isVisible());
  });
  await check('Category filtering retains explicit selection and shows only that category',async()=>{
    await page.locator('.inhaler-browse>summary').click();const filter=page.getByRole('combobox',{name:'按装置类别筛选'});await filter.selectOption('dpi');assert.equal(await page.locator('.inhaler-panel').isVisible(),false);for(const option of await selected().locator('option').all()){const id=await option.getAttribute('value');if(id)assert.equal(getInhaler(id).category,'dpi');}await selected().selectOption('turbuhaler');assert.ok(await page.locator('.inhaler-panel').isVisible());await filter.selectOption('all');
  });
  await check('All six original video entries remain available as clearly labelled secondary sources',async()=>{for(const id of ['breztri','turbuhaler','ellipta','bevespi','capsule','accuhaler']){await selected().selectOption(id);const source=page.locator('.inhaler-panel>.edu-more').last();await source.locator('summary').click();assert.equal(await page.locator('.inhaler-legacy-video').count(),1);assert.match(await source.innerText(),/不是已核实/);}});
  await check('Video and sources are never loaded in the background',async()=>{assert.deepEqual(external,[]);assert.equal(await page.locator('#inhaler-container iframe').count(),0);assert.equal(await page.locator('#inhaler-container video[autoplay]').count(),0);});
  await check('Desktop and mobile large-text layouts retain readable controls without overflow',async()=>{
    for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});if(width===390)await page.locator('#senior-toggle').click();await selected().selectOption('respimat');await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const clipped=await page.locator('#inhaler-container :is(button,input,select)').evaluateAll(items=>items.filter(item=>item.getBoundingClientRect().width>0&&item.getBoundingClientRect().right>innerWidth+1).length);assert.equal(clipped,0);await page.screenshot({path:fileURLToPath(new URL('inhaler-'+width+'.png',out)),fullPage:true});}
  });
  await check('Keyboard focus reaches the search and device selector visibly',async()=>{const search=page.getByRole('searchbox',{name:'搜索药名或吸入装置'});await search.focus();await page.keyboard.press('Tab');const focused=await page.evaluate(()=>({outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth}));assert.notEqual(focused.outline,'none');assert.notEqual(focused.width,'0px');});
  await check('Disposal and re-entry do not duplicate teaching controls',async()=>{await page.evaluate(()=>location.hash='home');await page.locator('#view-home').waitFor({state:'visible'});assert.equal(await page.locator('.inhaler-library').count(),0);await page.evaluate(()=>location.hash='inhaler');await page.locator('.inhaler-library').waitFor();assert.equal(await page.locator('.inhaler-library').count(),1);});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}finally{await writeFile(new URL('results.json',out),JSON.stringify({base,checks,passed:checks.length,errors,external,devices:INHALER_DEVICES.length},null,2));await browser.close();}
