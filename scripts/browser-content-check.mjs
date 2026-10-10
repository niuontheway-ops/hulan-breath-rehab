import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {EDUCATION_TOPICS} from '../education.mjs';
import {INHALER_DEVICES,getInhaler} from '../inhaler.mjs';
const base=process.env.HULAN_TEST_URL||'http://127.0.0.1:4173';
const out=new URL('../.qa/content/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
const page=await context.newPage(),checks=[],errors=[],external=[],videoMetrics=[],words=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
const check=async(name,run)=>{await run();checks.push({name,passed:true});console.log('PASS '+name);};
const go=async view=>{await page.goto(base+'/#'+view);await page.locator('#view-'+view).waitFor({state:'visible'});};
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
let fatalError=null;
async function createProfile(stage,cleared=true,redFlag=false){
  await go('assessment');
  await page.reload();await page.locator('#age').waitFor({state:'visible'});
  const next=()=>page.locator('#assessment-next').click();
  await page.locator('#age').fill('68');await next();
  await page.locator('[name=disease][value=copd]').check();await next();await next();
  await page.locator('#stability').selectOption(stage);await next();
  await page.locator(redFlag?'[name=chestPain]':'#noRedFlags').check();await next();
  await page.locator(`[name=clinicalPermission][value=${cleared?'yes':'no'}]`).check();await next();
  await page.locator('#dyspneaScore').selectOption('1');await next();
  while(await page.locator('.wizard-step:visible').getAttribute('data-step')!=='review')await page.locator('#assessment-skip').click();
  await page.locator('#valuesVerified').check();await page.locator('#assessment-finish').click();
  await page.locator('#view-home').waitFor({state:'visible'});
}
try{
  await go('home');
  await check('home and navigation restore a reachable inhaler teaching entry',async()=>{
    assert.ok(await page.locator('.home-inhaler-link').isVisible());
    await page.locator('.home-inhaler-link').click();await page.locator('#view-inhaler').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-inhaler]').count(),6);
  });
  await check('all original inhaler videos remain linked to the matching named device with cautions',async()=>{
    for(const device of INHALER_DEVICES){
      await page.locator(`[data-inhaler=${device.id}]`).click();
      assert.equal(await page.locator('.inhaler-video-link').getAttribute('href'),getInhaler(device.id).video);
      assert.equal(await page.locator(`[data-inhaler=${device.id}]`).getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.inhaler-steps li').count(),4);
      assert.ok(await page.locator('.inhaler-caution').isVisible());
    }
    await shot('inhaler-desktop.png');
  });
  await go('education');
  await check('education starts paused with concise actions, a local poster and expandable care details',async()=>{
    assert.equal(await page.locator('.edu-video').getAttribute('preload'),'none');
    assert.equal(await page.locator('.edu-video').evaluate(v=>v.paused),true);
    assert.equal(await page.locator('.edu-card').count(),3);
    assert.equal(await page.locator('.edu-more').evaluate(d=>d.open),false);
    assert.equal(await page.locator('.edu-emergency').count(),1);
  });
  for(const topic of EDUCATION_TOPICS){
    await check(`${topic.id}: local narration video plays, seeks and loads Chinese captions`,async()=>{
      await page.locator(`[data-topic=${topic.id}]`).click();
      const video=page.locator('.edu-video');
      assert.match(await video.getAttribute('src'),new RegExp(`/${topic.id}\\.mp4$`));
      assert.match(await video.getAttribute('poster'),new RegExp(`/${topic.id}\\.svg$`));
      await video.evaluate(v=>{v.textTracks[0].mode='hidden';return v.play();});
      await page.waitForFunction(()=>document.querySelector('.edu-video').currentTime>0.2);
      await page.waitForFunction(()=>document.querySelector('.edu-video track').readyState===2);
      const metric=await video.evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,currentTime:v.currentTime,error:v.error?.code||null,paused:v.paused,cues:v.textTracks[0].cues.length,muted:v.muted,volume:v.volume}));
      assert.equal(metric.error,null);assert.equal(metric.paused,false);assert.equal(metric.cues,4);
      assert.ok(metric.duration>30&&metric.duration<90);assert.equal(metric.width,960);assert.equal(metric.height,960);
      assert.equal(metric.muted,false);assert.ok(metric.volume>0);
      await video.evaluate(v=>{v.pause();v.currentTime=v.duration-1;});
      await page.waitForFunction(()=>{const v=document.querySelector('.edu-video');return !v.seeking&&v.currentTime>v.duration-2;});
      videoMetrics.push({id:topic.id,...metric,seekPassed:true});
      if(topic.id==='copd')await shot('copd-video-last-frame.png');
    });
  }
  await check('switching topic and leaving education pauses the previous video',async()=>{
    await page.locator('[data-topic=copd]').click();await page.locator('.edu-video').evaluate(v=>v.play());
    await page.evaluate(()=>{window.previousEducationVideo=document.querySelector('.edu-video')});
    await page.locator('[data-topic=asthma]').click();assert.equal(await page.evaluate(()=>window.previousEducationVideo.paused),true);
    await page.locator('.edu-video').evaluate(v=>v.play());await page.evaluate(()=>{window.previousEducationVideo=document.querySelector('.edu-video')});
    await page.locator('#navigation [data-page=daily]').click();await page.locator('#view-daily').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.previousEducationVideo.paused),true);
  });
  await check('MP4 and captions use correct MIME and range responses for local seeking',async()=>{
    const response=await fetch(base+'/assets/education-videos/copd.mp4',{headers:{Range:'bytes=100-199'}});
    assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'video/mp4');assert.equal((await response.arrayBuffer()).byteLength,100);
    assert.match(response.headers.get('content-range'),/^bytes 100-199\//);
    const bad=await fetch(base+'/assets/education-videos/copd.mp4',{headers:{Range:'bytes=99999999-'}});assert.equal(bad.status,416);
    const captions=await fetch(base+'/assets/education-videos/copd.vtt');assert.match(captions.headers.get('content-type'),/^text\/vtt/);assert.match(await captions.text(),/^WEBVTT/);
  });
  await check('stabilized post-exacerbation COPD creates a light, divided rehabilitation plan',async()=>{
    await createProfile('recovering');assert.equal(await page.locator('.session-card').count(),4);
    assert.match(await page.locator('#plan-notice').innerText(),/轻量/);
    await shot('recovery-plan.png');
  });
  await check('current instability, no clinician clearance and red flags still block independent training',async()=>{
    for(const [stage,cleared,red] of [['worse',true,false],['recovering',false,false],['recovering',true,true]]){
      await createProfile(stage,cleared,red);assert.equal(await page.locator('.session-card').count(),0);
    }
  });
  for(const width of [1440,390,320])for(const large of [false,true]){
    await check(`${width}px ${large?'large':'normal'}: every chapter picture and required controls remain readable`,async()=>{
      await page.setViewportSize({width,height:1000});
      for(const view of ['home','daily','assessment','education','inhaler','music','garden','history']){
        await go(view);
        const pressed=(await page.locator('#senior-toggle').getAttribute('aria-pressed'))==='true';
        if(pressed!==large)await page.locator('#senior-toggle').click();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} horizontal overflow`);
        const pictures=page.locator(`#view-${view} img:visible`);assert.ok(await pictures.count()>0,`${view} missing picture`);
        for(const image of await pictures.all()){
          await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());
          assert.ok(await image.evaluate(img=>img.complete&&img.naturalWidth>0),`${view} broken picture`);
        }
        if(width===390&&!large&&['daily','education','inhaler','assessment','music'].includes(view))words.push({view,visibleChineseCharacters:(await page.locator('#view-'+view).innerText()).match(/[\u3400-\u9fff]/g)?.length||0});
        if((width===390&&['education','inhaler','daily','assessment'].includes(view))||(width===1440&&!large&&view==='education'))await shot(`${view}-${width}-${large?'large':'normal'}.png`);
      }
    });
  }
  await check('native keyboard selection and reduced-motion preference remain available',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await go('education');
    await page.locator('[data-topic=asthma]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-topic=asthma]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.edu-video').evaluate(v=>v.paused),true);
  });
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}catch(error){fatalError=error.message;throw error;}finally{
  await writeFile(new URL('content-results.json',out),JSON.stringify({passed:checks.length,failed:fatalError?1:errors.length,fatalError,checks,scriptErrors:errors,unexpectedRequests:external,videos:videoMetrics,visibleChineseCharacters:words,testedAt:new Date().toISOString(),fixtures:'Synthetic adult profiles in a fresh browser context; no patient data'},null,2));
  await browser.close();
}
