import {createPlan, validateProfile, assessTrainingReadiness} from './clinical.mjs';
import {readReport, parseReportText, disposeReportWorker} from './reports.mjs';
import {mountGame} from './game.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey = 'hulan_rehab_v1';
const diseaseNames = {copd:'慢阻肺',asthma:'哮喘',bronchiectasis:'支气管扩张',other:'其他 / 待评估'};
const fieldNames = {fev1Percent:'FEV₁ 预计值百分比',fev1Fvc:'FEV₁/FVC（%）',spo2:'SpO₂（%）',act:'ACT 总分',cat:'CAT 总分',dyspneaScale:'呼吸困难量表类型',dyspneaScore:'呼吸困难评分'};
const statusNames = {ready:'已生成起步建议',review:'需要医护复核',urgent:'立即停止训练',incomplete:'等待资料补全'};
const icons = {
  home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v11h5v-6h4v6h5V9"/>',
  clipboard:'<path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M8 12h8M8 16h5"/>',
  leaf:'<path d="M20 3C9 2 3 7 4 14c1 6 8 7 12 2 3-4 4-8 4-13Z"/><path d="M3 21 15 9M8 15v-5M9 15h5"/>',
  chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  heart:'<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 4 1 9 8 14 7-5 12-10 8-14Z"/>',
  shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  external:'<path d="M14 3h7v7m0-7-11 11M11 5H5v15h15v-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  wind:'<path d="M3 8h12c5 0 5-6 1-6M3 12h16c4 0 4 6 0 6M3 16h7c4 0 4 5 0 5"/>',
  walk:'<circle cx="13" cy="4" r="2"/><path d="m7 11 4-4 4 2 3 3m-7-5-1 8-4 6m4-6 5 6M4 13l3-2"/>',
  activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  book:'<path d="M12 5c-4-2-7-1-9 0v15c3-2 6-2 9 0 3-2 6-2 9 0V5c-2-1-5-2-9 0v15"/>',
  check:'<path d="m5 12 4 4 10-10"/>',
};
function icon(name) { return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">${icons[name] || icons.leaf}</svg>`; }
function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
function localDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;
}
const state = {profile:null,records:[],persist:false,isDemo:false,plan:null,assessmentDirty:false};
let game = null;
let reportResult = null;
let importInProgress = false;
let importGeneration = 0;
let toastTimer;
let savedState = null;

function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('#toast').hidden = true;},4000); }
function saveState() {
  if(state.isDemo) return;
  try {
    if(state.persist) localStorage.setItem(storageKey,JSON.stringify({version:1,consent:true,profile:state.profile,records:state.records}));
    else localStorage.removeItem(storageKey);
    $('#storage-status').textContent = state.persist ? '已开启本机保存。原始报告不保存。' : '当前仅在本次页面中使用，刷新后清除。';
  } catch { state.persist = false; $('#save-local').checked = false; $('#storage-status').textContent = '浏览器无法保存；资料仅保留在当前页面。'; }
}
function readStorage() {
  try {
    const item = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if(item?.version !== 1 || item.consent !== true) return;
    const restorable=item.profile && (validateProfile(item.profile).valid || createPlan(item.profile,new Date()).status==='urgent');
    state.profile = restorable ? item.profile : null;
    state.records = Array.isArray(item.records) ? item.records.filter(r => typeof r?.id==='string' && Number.isFinite(r.completedCycles) && r.completedCycles>0 && Number.isFinite(r.activeDurationMs) && r.activeDurationMs>=0 && !Number.isNaN(new Date(r.finishedAt).getTime()) && r.selfReported===true && !r.isDemo).slice(-500) : [];
    state.persist = true;
  } catch { state.persist = false; }
}
function makePlan() {
  state.plan = state.profile ? createPlan(state.profile,new Date()) : null;
  if(state.assessmentDirty) {
    const draft=createPlan(profileFromForm(),new Date());
    state.plan=draft.status==='urgent'?draft:{...draft,status:'review',title:'评估资料已修改，请先核对',subtitle:'提交当前评估后，再开始训练。',reasons:['当前表单有尚未提交的新资料，原方案暂时停用。'],sessions:[],weekly:[],breathing:{inhaleSeconds:2,exhaleSeconds:4,cycles:0}};
  }
  return state.plan;
}
function metric(value,unit='') { return value == null ? '<strong>—</strong>' : `<strong>${escape(value)}<small>${escape(unit)}</small></strong>`; }
function renderHome() {
  const plan = makePlan();
  $('#demo-banner').hidden = !state.isDemo;
  $('#export-plan').hidden = !plan;
  if(!state.profile) {
    $('#hero-title').innerHTML = '了解你，<br>才能更好地陪伴你。';
    $('#hero-description').innerHTML = '带上肺功能报告和症状评分，<br>一起找到适合你的训练起点。';
    $('#hero-action').innerHTML = '开始健康评估 <span>↗</span>'; $('#hero-action').href='#assessment';
    $('#profile-summary').innerHTML = `<div class="profile-status"><i></i>尚未评估</div><div class="profile-placeholder"><strong>从一份健康评估开始</strong><p>了解疾病、肺功能与症状，<br>让建议更贴近你的日常。</p></div><div class="profile-metrics"><div class="profile-metric"><span>FEV₁ / 预计值</span>${metric(null)}</div><div class="profile-metric"><span>呼吸困难评分</span>${metric(null)}</div><div class="profile-metric"><span>血氧饱和度</span>${metric(null)}</div><div class="profile-metric"><span>当前疾病</span><strong style="font-size:14px">待录入</strong></div></div>`;
  } else {
    const p=state.profile;
    $('#hero-title').textContent=plan.status==='ready' ? '今天，也按自己的节奏来。' : plan.title;
    $('#hero-description').textContent=plan.status==='ready' ? `${diseaseNames[p.disease]} · ${plan.subtitle}` : plan.subtitle;
    $('#hero-action').innerHTML=plan.status==='ready' ? '开始花园练习 <span>↗</span>' : '核对与更新评估 <span>↗</span>'; $('#hero-action').href=plan.status==='ready'?'#garden':'#assessment';
    $('#profile-summary').innerHTML=`<div class="profile-status ${escape(plan.status)}"><i></i>${statusNames[plan.status]}</div><div class="profile-metrics"><div class="profile-metric"><span>FEV₁ / 预计值</span>${metric(p.fev1Percent,'%')}</div><div class="profile-metric"><span>${p.disease==='asthma'?'ACT 哮喘控制':p.dyspneaScale==='mrc'?'MRC 原评分':'mMRC 呼吸困难'}</span>${metric(p.disease==='asthma'?p.act:p.dyspneaScore,'分')}</div><div class="profile-metric"><span>血氧饱和度</span>${metric(p.spo2,'%')}</div><div class="profile-metric"><span>当前疾病</span><strong style="font-size:14px">${escape(diseaseNames[p.disease])}</strong></div></div><p class="field-help">评估日期：${escape(p.assessmentDate)}</p>`;
  }
  const notice=$('#plan-notice');
  notice.hidden=!plan;
  if(plan) {
    notice.className=`notice ${plan.status==='urgent'?'notice-danger':plan.status==='ready'?'notice-ready':''}`;
    notice.innerHTML=`<h3>${escape(plan.title)}</h3><p>${escape(plan.subtitle)}</p>${plan.status==='ready'?'':`<ul>${plan.reasons.map(r=>`<li>${escape(r)}</li>`).join('')}</ul>`}`;
  }
  $('#plan-summary').textContent = plan?.status==='ready' ? '先与医护确认这些起步建议；可以分段完成，也可以休息。' : '完成合适的安全评估后，这里会出现你的训练建议。';
  const sessions=$('#plan-sessions');
  if(plan?.status==='ready') {
    const types={breathing:{icon:'wind',tag:'呼吸节奏'},walking:{icon:'walk',tag:'日常活动'},strength:{icon:'activity',tag:'舒缓活动'},education:{icon:'book',tag:'健康教育'}};
    sessions.innerHTML=plan.sessions.map(s=>{const t=types[s.kind] || types.education;return `<article class="card session-card"><div class="session-top"><span class="icon-chip">${icon(t.icon)}</span><span class="session-tag">${t.tag}</span></div><h3>${escape(s.title)}</h3><p>${escape(s.instruction)}</p><div class="session-footer"><span>${escape(s.minutes)} 分钟起步 · ${escape(s.intensity)}</span>${s.kind==='breathing'?'<a href="#garden" class="text-link">开始练习 →</a>':''}</div><p class="field-help" style="margin-top:10px;margin-bottom:0">${escape(s.frequency)}</p></article>`;}).join('')+`<div class="plan-detail-note"><details><summary>为什么适合我的起点？查看理由与本周安排 ↓</summary><ul>${plan.reasons.map(r=>`<li>${escape(r)}</li>`).join('')}</ul><ul>${plan.weekly.map(w=>`<li>${escape(w.day)}：${escape(w.label)}</li>`).join('')}</ul><ul>${plan.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul><p>规则版本：${escape(plan.ruleVersion)} · <button class="btn-quiet" data-show-sources>查看依据</button></p></details></div>`;
    sessions.querySelector('[data-show-sources]')?.addEventListener('click',()=>$('#sources-dialog').showModal());
  } else {
    sessions.innerHTML=`<div class="session-empty"><span class="icon-chip">${icon('leaf')}</span><div><strong>${plan?.status==='urgent'?'现在优先寻求医疗帮助':plan?.status==='review'?'先复核，花园可以等你':'你的专属小目标，还差一步'}</strong><p>${plan?'按上方提示补充评估或联系医护，暂不进行自主训练。':'完成肺功能与症状评估，建议会根据你的状态调整。'}</p></div><a href="#assessment" class="text-link">${plan?'查看评估':'去健康评估'} →</a></div>`;
  }
  renderWeek();
}
function renderWeek() {
  const today=localDay();
  const base=new Date(`${today}T12:00:00+08:00`);
  const weekDay=(base.getUTCDay()+6)%7;
  const labels=['一','二','三','四','五','六','日'];
  const monday=new Date(base.getTime()-weekDay*86400000);
  let total=0;
  $('#week-tracker').innerHTML=labels.map((label,i)=>{
    const d=new Date(monday.getTime()+i*86400000);const key=localDay(d);const count=state.records.filter(r=>localDay(new Date(r.finishedAt))===key).length;total+=count;
    return `<div class="week-day ${key===today?'today':''} ${count?'complete':''}"><span>周${label}</span><div class="week-circle" aria-label="${escape(key)}${count?`，完成 ${count} 次练习`:'，没有练习记录'}">${count?'✓':Number(key.slice(-2))}</div></div>`;
  }).join('');
  $('#week-count').textContent=`${total} 次练习`;
}
function updateDiseaseFields() {
  const disease=$('input[name="disease"]:checked')?.value;
  $('#act-field').hidden=disease!=='asthma'; $('#cat-field').hidden=disease!=='copd';
  $('#dyspnea-required').hidden=disease==='asthma'||disease==='other';
}
function updateScale(keepValue=false) {
  const select=$('#dyspneaScore'); const previous=select.value;const mrc=$('#dyspneaScale').value==='mrc';
  select.innerHTML='<option value="">请选择现有评分</option>'+Array.from({length:5},(_,i)=>i+(mrc?1:0)).map(v=>`<option value="${v}">${v} 分</option>`).join('');
  if(keepValue)select.value=previous;
}
function fillForm(profile=state.profile) {
  if(!profile) {$('#assessmentDate').value=localDay();return;}
  const form=$('#assessment-form');
  Object.entries(profile).forEach(([key,value])=>{
    if(key==='redFlags') {Object.entries(value).forEach(([flag,on])=>{if(form.elements[flag])form.elements[flag].checked=on;});return;}
    if(key==='disease') {const radio=form.querySelector(`input[name="disease"][value="${value}"]`);if(radio)radio.checked=true;return;}
    const el=form.elements[key];if(!el)return;
    if(el.type==='checkbox')el.checked=!!value;else el.value=value??'';
  });
  updateScale();$('#dyspneaScore').value=profile.dyspneaScore??'';updateDiseaseFields();$('#valuesVerified').checked=false;
}
function profileFromForm() {
  const form=$('#assessment-form');const num=key=>form.elements[key].value.trim()===''?null:Number(form.elements[key].value);
  const disease=$('input[name="disease"]:checked')?.value;
  return {disease,age:num('age'),fev1Percent:num('fev1Percent'),fev1Fvc:num('fev1Fvc'),spo2:num('spo2'),dyspneaScale:$('#dyspneaScale').value,dyspneaScore:num('dyspneaScore'),act:disease==='asthma'?num('act'):null,cat:disease==='copd'?num('cat'):null,stability:$('#stability').value,redFlags:Object.fromEntries(['chestPain','severeBreathlessness','fainting','hemoptysis'].map(k=>[k,form.elements[k].checked])),clinicianCleared:$('#clinicianCleared').checked,assessmentDate:$('#assessmentDate').value,goal:$('#goal').value};
}
function clearErrors() {$$('[aria-invalid="true"]').forEach(e=>e.removeAttribute('aria-invalid'));$$('.field-error').forEach(e=>e.remove());$('#form-errors').hidden=true;}
$('#assessment-form').addEventListener('submit',event=>{
  event.preventDefault();clearErrors();const profile=profileFromForm();const plan=createPlan(profile,new Date());
  if(plan.status==='urgent') {state.profile=profile;state.plan=plan;state.assessmentDirty=false;saveState();location.hash='home';renderHome();toast('请立即停止训练并寻求医疗帮助。');return;}
  const validation=validateProfile(profile);const errors=[...validation.errors];
  if(!$('#valuesVerified').checked)errors.push({field:'valuesVerified',message:'请先核对数值、量表类型和日期，然后勾选确认。'});
  if(profile.assessmentDate>localDay())errors.push({field:'assessmentDate',message:'评估日期不能晚于今天。'});
  if(importInProgress)errors.push({field:'report-file',message:'请等待识别结束并核对候选数值，或取消识别后手动录入。'});
  if(errors.length) {
    $('#form-errors').innerHTML=`<strong>还有这些信息需要核对</strong><ul>${errors.map(e=>`<li>${escape(e.message)}</li>`).join('')}</ul>`;$('#form-errors').hidden=false;
    errors.forEach(({field,message})=>{const el=document.getElementById(field);if(el){el.setAttribute('aria-invalid','true');if(el.closest('.field')){const label=document.createElement('span');label.className='field-error';label.textContent=message;el.parentElement.append(label);}}});
    $('#form-errors').scrollIntoView({behavior:'smooth',block:'center'});return;
  }
  state.profile=profile;state.assessmentDirty=false;makePlan();saveState();location.hash='home';renderHome();toast(plan.status==='ready'?'已生成起步建议，请与医护确认后练习。':'已生成评估提示，请先联系医护复核。');
});
$$('input[name="disease"]').forEach(el=>el.addEventListener('change',updateDiseaseFields));
$('#dyspneaScale').addEventListener('change',()=>updateScale());
$('#assessment-form').addEventListener('input',event=>{if(event.target.id!=='valuesVerified'&&!['report-text','report-file'].includes(event.target.id)&&!event.target.hasAttribute('data-candidate')){$('#valuesVerified').checked=false;state.assessmentDirty=true;}});

function showCandidates(result) {
  reportResult=result;const target=$('#report-candidates');target.hidden=false;
  const warnings=(result.warnings||[]).map(w=>`<li>${escape(w)}</li>`).join('');
  target.innerHTML=`<div class="candidate-panel"><h3>识别结果 · 请对照原报告核对</h3><p>勾选准确的数值，再填入评估表。识别可能有误，未确认的值不会用于方案。</p>${(result.candidates||[]).map((c,i)=>`<label class="candidate-row"><input type="checkbox" data-candidate="${i}"><span><strong>${escape(fieldNames[c.field] || c.field)}：${escape(c.value==='mmrc'?'mMRC（0–4）':c.value==='mrc'?'MRC（1–5）':c.value)}</strong><small>原文依据：${escape(c.evidence)}</small></span></label>`).join('')}${result.candidates?.length?'<button class="btn-secondary" type="button" id="apply-candidates">将核对的值填入表单</button>':'<p>没有可靠提取到数值，请在下方根据报告手动填写。</p>'}${warnings?`<ul class="field-help">${warnings}</ul>`:''}</div>`;
  $('#apply-candidates')?.addEventListener('click',()=>{
    const selected=[...target.querySelectorAll('input[data-candidate]:checked')].map(el=>result.candidates[Number(el.dataset.candidate)]);
    if(!selected.length){toast('请先对照报告，勾选准确的候选值。');return;}
    const byField=new Map();for(const c of selected){if(byField.has(c.field)&&byField.get(c.field)!==c.value){toast('同一个指标有不同候选值，请只选择准确的一项。');return;}byField.set(c.field,c.value);}
    if(byField.has('dyspneaScore')&&!byField.has('dyspneaScale')){toast('请同时核对 MRC / mMRC 量表类型，再填入评分。');return;}
    if(byField.has('dyspneaScale')){$('#dyspneaScale').value=byField.get('dyspneaScale');updateScale();}
    for(const [field,value] of byField){const el=document.getElementById(field);if(el)el.value=value;}
    $('#valuesVerified').checked=false;state.assessmentDirty=true;toast(`已填入 ${byField.size} 项核对结果，请补全当前症状与日期。`);
  });
}
async function importFile(file) {
  if(!file)return;if(importInProgress){toast('正在识别上一份报告，请等候或取消。');return;}
  importInProgress=true;const generation=++importGeneration;$('#report-candidates').hidden=true;const status=$('#report-status');status.hidden=false;status.className='import-status';
  status.innerHTML='<span id="report-progress-label"></span><progress class="import-progress" id="report-progress" value="0" max="1"></progress><button type="button" class="btn-quiet" id="cancel-import">取消识别</button>';
  $('#report-progress-label').textContent=`正在本机读取：${file.name}`;
  $('#cancel-import').addEventListener('click',async()=>{++importGeneration;await disposeReportWorker();importInProgress=false;status.textContent='识别已取消，可以选择新文件或手动填写。';});
  try {
    const result=await readReport(file,{onProgress:p=>{
      if(generation!==importGeneration)return;
      const labels={'loading tesseract core':'加载本机识别引擎','initializing tesseract':'初始化识别','loading language traineddata':'加载本机中英文模型','initializing api':'准备报告识别','recognizing text':'正在识别报告文字'};
      const progress=Number.isFinite(p.progress)?Math.round(p.progress*100):0;
      $('#report-progress-label').textContent=`${labels[p.status] || p.status || '本机读取中'}${p.page?` · 第 ${p.page} 页`:''} · ${progress}%`;
      $('#report-progress').value=p.progress||0;
    }});
    if(generation!==importGeneration)return;
    status.textContent=`本机处理完成 · ${result.method} · 请核对下方候选值`;
    showCandidates(result);
  } catch(error) {
    if(generation!==importGeneration)return;
    status.className='import-status error';status.textContent=`${error.message || '无法识别此文件'}。你仍可根据报告手动录入。`;
  } finally {if(generation===importGeneration)importInProgress=false;$('#report-file').value='';}
}
$('#report-file').addEventListener('change',event=>importFile(event.target.files[0]));
const upload=$('#upload-zone');
['dragenter','dragover'].forEach(name=>upload.addEventListener(name,event=>{event.preventDefault();upload.classList.add('dragover');}));
['dragleave','drop'].forEach(name=>upload.addEventListener(name,event=>{event.preventDefault();upload.classList.remove('dragover');}));
upload.addEventListener('drop',event=>importFile(event.dataTransfer.files[0]));
$('#parse-text').addEventListener('click',()=>{if(importInProgress){toast('请先取消或等待文件识别。');return;}const text=$('#report-text').value.trim();if(!text){toast('请先粘贴报告中的指标文字。');return;}showCandidates({...parseReportText(text),method:'文字指标提取'});});

function stopGame() {game?.dispose();game=null;}
function renderGarden() {
  stopGame();$('#game-container').innerHTML='';const plan=makePlan();const gate=$('#garden-gate');gate.hidden=false;
  if(!plan||plan.status!=='ready') {
    gate.innerHTML=`<article class="card gate-card"><span class="icon-chip">${icon('shield')}</span><h2>${escape(plan?.title || '花园已经准备好，先了解你的状态')}</h2><p>${escape(plan?.subtitle || '完成健康评估、确认适合居家练习后，就能让小芽随一呼一吸慢慢生长。')}</p>${plan?`<div class="notice ${plan.status==='urgent'?'notice-danger':''}"><ul>${plan.reasons.map(r=>`<li>${escape(r)}</li>`).join('')}</ul></div>`:''}<div class="gate-actions"><a class="btn-primary" href="#assessment">${plan?'更新健康评估':'开始健康评估'} →</a><button class="btn-secondary" id="garden-demo">体验模拟示例</button></div></article>`;
    $('#garden-demo').addEventListener('click',()=>enterDemo('garden'));return;
  }
  gate.innerHTML=`<article class="card gate-card"><span class="icon-chip">${icon('shield')}</span><h2>开始前，再问问身体的感受</h2><p>本次是 ${plan.breathing.cycles} 轮轻柔呼吸；每轮约 6 秒，轮间按需要休息。游戏记录你的自主确认，不检测真实呼吸。</p><form id="readiness-form"><label class="check-row"><input type="checkbox" name="noChestPain" required>现在没有胸痛或胸部明显不适</label><label class="check-row"><input type="checkbox" name="noSevereBreathlessness" required>现在没有严重气促或说话困难</label><label class="check-row"><input type="checkbox" name="noDizziness" required>现在没有头晕、晕厥或意识不清</label><label class="check-row"><input type="checkbox" name="noWorse" required>今天症状没有加重，也没有咯血</label><label class="check-row"><input type="checkbox" name="clinicianCleared" required>这项居家练习已获医护允许，我愿意开始</label><div class="field"><label for="training-spo2">此刻静息 SpO₂（可选）</label><input type="number" id="training-spo2" min="1" max="100" step="1" inputmode="numeric" placeholder="没有新测量可留空"><small>现有评估值：${state.profile.spo2==null?'未提供':`${escape(state.profile.spo2)}%`}。不要自行调整吸氧流量。</small></div><div id="readiness-notice" class="notice" role="alert" hidden></div><div class="gate-actions"><button class="btn-primary" type="submit">准备好了，进入花园 →</button><a class="btn-secondary" href="#assessment">今天不适，更新评估</a></div></form></article>`;
  $('#readiness-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.target;const oxygen=$('#training-spo2').value;const check={chestPain:!form.noChestPain.checked,severeBreathlessness:!form.noSevereBreathlessness.checked,dizziness:!form.noDizziness.checked,worseSymptoms:!form.noWorse.checked,clinicianCleared:form.clinicianCleared.checked,spo2:oxygen===''?state.profile.spo2:Number(oxygen)};
    const result=assessTrainingReadiness(check);const currentPlan=makePlan();
    if(!result.allowed||currentPlan.status!=='ready') {const message=$('#readiness-notice');message.hidden=false;message.className=`notice ${result.status==='urgent'?'notice-danger':''}`;message.textContent=result.allowed?currentPlan.subtitle:result.message;return;}
    gate.hidden=true;stopGame();
    game=mountGame($('#game-container'),{breathing:currentPlan.breathing,onComplete:record=>completeTraining(record),onStop:()=>{renderGarden();toast('已经停止。先休息，感到不适请联系医护。');}});
  });
}
function completeTraining(raw) {
  const record={id:crypto.randomUUID(),finishedAt:new Date().toISOString(),completedCycles:Number(raw.completedCycles ?? raw.cycles ?? 0),activeDurationMs:Number(raw.activeDurationMs ?? raw.durationMs ?? 0),selfReported:true,feeling:null,isDemo:state.isDemo};
  if(!record.completedCycles || !Number.isFinite(record.activeDurationMs))return;
  stopGame();state.records.push(record);if(state.records.length>500)state.records.shift();saveState();renderHome();
  $('#garden-gate').hidden=true;$('#game-container').innerHTML=`<article class="card completion-card"><span class="completion-mark">${icon('leaf')}</span><span class="eyebrow">小芽长出了新叶</span><h2>太棒了，今天的认真值得被看见。</h2><p>跟着自己的节奏，完成了一次轻柔练习。<br>现在放松肩颈，休息一会儿。</p><div class="completion-stats"><div><strong>${record.completedCycles}</strong><span>自主确认的呼吸轮次</span></div><div><strong>${Math.round(record.activeDurationMs/1000)}</strong><span>秒 · 练习阶段用时</span></div></div><fieldset class="feelings"><legend>练完后，你现在感觉怎么样？</legend><button type="button" data-feeling="comfortable">舒适放松</button><button type="button" data-feeling="neutral">和平常差不多</button><button type="button" data-feeling="uncomfortable">有些不适</button></fieldset><div id="feeling-warning" class="notice notice-danger" hidden>请停止后续训练，休息并联系医护评估。如果有胸痛、严重气促或晕厥，请立即寻求急救。</div><div class="completion-actions"><a class="btn-primary" href="#history">查看练习记录 →</a><a class="btn-secondary" href="#home">回到今日康复</a></div><p class="dialog-help">完成记录来自你的自主确认，不能用来判断呼吸质量或治疗效果。</p></article>`;
  $$('[data-feeling]').forEach(btn=>btn.addEventListener('click',()=>{record.feeling=btn.dataset.feeling;$$('[data-feeling]').forEach(b=>{b.classList.toggle('selected',b===btn);b.setAttribute('aria-pressed',String(b===btn));});$('#feeling-warning').hidden=record.feeling!=='uncomfortable';if(record.feeling==='uncomfortable'){state.profile={...state.profile,stability:'worse'};fillForm();makePlan();renderHome();}saveState();}));
}
function renderHistory() {
  const records=state.records;const totalMs=records.reduce((sum,r)=>sum+r.activeDurationMs,0);const days=new Set(records.map(r=>localDay(new Date(r.finishedAt)))).size;
  $('#export-records').disabled=!records.length;
  const stats=`<div class="history-stats"><article class="card history-stat"><span>完成的练习</span><strong>${records.length}<small>次</small></strong></article><article class="card history-stat"><span>练习阶段用时</span><strong>${Math.round(totalMs/60000)}<small>分钟</small></strong></article><article class="card history-stat"><span>留下记录的日子</span><strong>${days}<small>天</small></strong></article></div>`;
  if(!records.length){$('#history-content').innerHTML=stats+`<article class="card history-empty"><span class="icon-chip">${icon('leaf')}</span><h2>第一片新叶，等你慢慢种下</h2><p>完成一次花园练习后，这里会留下你的进度。休息不会扣分，也没有连续打卡压力。</p><a class="btn-primary" href="#garden">去训练花园 →</a></article>`;return;}
  const feelings={comfortable:'舒适放松',neutral:'和平常差不多',uncomfortable:'有些不适'};
  $('#history-content').innerHTML=stats+`<div class="history-list">${[...records].reverse().map(r=>`<article class="card history-row"><div><h3>呼吸花园 · 轻柔呼吸</h3><p>${escape(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(r.finishedAt)))}</p><span class="history-type">${r.isDemo?'模拟示例 · ':''}自主确认记录</span></div><div class="history-result"><span><strong>${r.completedCycles}</strong> 轮</span><span><strong>${Math.round(r.activeDurationMs/1000)}</strong> 秒练习</span><span>${feelings[r.feeling] || '未记录感受'}</span></div></article>`).join('')}</div><p class="history-privacy">${state.persist&&!state.isDemo?'评估数值和训练记录已在本浏览器保存。':'记录仅留在当前页面，刷新或关闭后清除。'} 原始报告不保存；这些记录不代表肺功能或治疗效果。</p>`;
}
function download(name,text,type='text/plain;charset=utf-8') {const blob=new Blob([text],{type});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
$('#export-plan').addEventListener('click',()=>{
  const plan=makePlan();if(!plan)return;
  const lines=['壶兰呼吸 · 康复教育建议',state.isDemo?'模拟患者示例，不能用于实际训练':'适用范围：经医护评估的成人患者；本建议需医护复核',`生成日期：${localDay()}`,`评估日期：${state.profile.assessmentDate}`,`规则版本：${plan.ruleVersion}`,`${plan.title}`,plan.subtitle,'','评估指标',...plan.metrics.map(m=>`${m.label}：${m.value}（${m.detail}）`),'','分流依据',...plan.reasons,'','起步建议',...plan.sessions.map(s=>`${s.title}：${s.minutes} 分钟起步；${s.frequency}\n${s.instruction}\n强度：${s.intensity}`),'','注意事项',...plan.warnings,'','依据',...plan.sourceLinks.map(s=>`${s.label}：${s.url}`),'','本建议为规则化教育建议，尚未经临床验证。不代替面诊、诊断或处方；不调整药物与吸氧流量。'];
  download(`康复教育建议-${localDay()}${state.isDemo?'-模拟示例':''}.txt`,lines.join('\n'));
});
$('#export-records').addEventListener('click',()=>{if(!state.records.length)return;download(`呼吸练习记录-${localDay()}${state.isDemo?'-模拟示例':''}.json`,JSON.stringify({format:'hulan-rehab-records',version:1,simulated:state.isDemo,selfReported:true,description:'自主确认的练习记录，不代表呼吸质量或治疗效果',records:state.records},null,2),'application/json');});

function enterDemo(destination='home') {
  if(!state.isDemo)savedState={profile:state.profile,records:state.records,persist:state.persist};
  state.isDemo=true;state.persist=false;state.records=[];state.assessmentDirty=false;state.profile={disease:'copd',age:62,fev1Percent:65,fev1Fvc:66,spo2:96,dyspneaScale:'mmrc',dyspneaScore:2,act:null,cat:16,stability:'stable',redFlags:{chestPain:false,severeBreathlessness:false,fainting:false,hemoptysis:false},clinicianCleared:true,assessmentDate:localDay(),goal:'daily'};
  fillForm();renderHome();location.hash=destination;if(destination==='garden')renderGarden();toast('当前是模拟患者示例，实际使用请退出并填写自己的评估。');
}
$('#demo-button').addEventListener('click',()=>enterDemo());
$('#exit-demo').addEventListener('click',()=>{
  stopGame();Object.assign(state,savedState || {profile:null,records:[],persist:false});state.isDemo=false;state.assessmentDirty=false;savedState=null;$('#assessment-form').reset();fillForm();$('#report-candidates').hidden=true;$('#report-status').hidden=true;$('#report-text').value='';reportResult=null;location.hash='home';renderHome();toast('已退出示例，恢复你原来的资料。');
});
$('#privacy-open').addEventListener('click',()=>{$('#save-local').checked=state.persist;$('#save-local').disabled=state.isDemo;$('#storage-status').textContent=state.isDemo?'示例数据不会保存到本机。':state.persist?'已开启本机保存。':'默认仅保留当前页面资料。';$('#privacy-dialog').showModal();});
$('#privacy-footer').addEventListener('click',()=>$('#privacy-open').click());
$('#sources-open').addEventListener('click',()=>$('#sources-dialog').showModal());
$('#save-local').addEventListener('change',event=>{state.persist=event.target.checked;saveState();});
$('#clear-data').addEventListener('click',async()=>{
  if(!confirm('清除本浏览器的评估数值与全部练习记录？此操作不可恢复。'))return;
  stopGame();++importGeneration;await disposeReportWorker();importInProgress=false;
  try{localStorage.removeItem(storageKey);}catch{}
  Object.assign(state,{profile:null,records:[],persist:false,isDemo:false,plan:null,assessmentDirty:false});savedState=null;reportResult=null;
  $('#assessment-form').reset();updateScale();fillForm();updateDiseaseFields();$('#report-candidates').innerHTML='';$('#report-candidates').hidden=true;$('#report-status').hidden=true;$('#report-text').value='';$('#save-local').checked=false;$('#save-local').disabled=false;$('#storage-status').textContent='已清除本机评估与记录。';clearErrors();location.hash='home';renderHome();
});
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));

const pageTitles={home:'今日康复',assessment:'健康评估',garden:'训练花园',history:'康复记录'};
function navigate() {
  const page=location.hash.slice(1) in pageTitles ? location.hash.slice(1):'home';
  if(page!=='garden')stopGame();
  $$('.view').forEach(el=>el.hidden=el.id!==`view-${page}`);
  $$('[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('#page-title').textContent=pageTitles[page];document.title=`壶兰呼吸 · ${pageTitles[page]}`;
  if(page==='home')renderHome();if(page==='garden')renderGarden();if(page==='history')renderHistory();
  $('#demo-banner').hidden=!state.isDemo;
  window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',navigate);
window.addEventListener('pagehide',()=>{stopGame();disposeReportWorker();});
fillIcons();readStorage();fillForm();updateDiseaseFields();$('#assessmentDate').max=localDay();
$('#today-date').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(new Date());
renderHome();navigate();
