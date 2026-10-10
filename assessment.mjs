const labels={copd:'慢阻肺',asthma:'哮喘',bronchiectasis:'支气管扩张',other:'其他 / 不确定'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** A single-question flow; skipped professional measurements remain null. */
export function mountAssessmentWizard({getProfile,validateProfile,onSkip,beforeAdvance=()=>null}) {
  const form=document.querySelector('#assessment-form');
  const all=[...form.querySelectorAll('.wizard-step')];
  let current=all[0].dataset.step;
  const back=document.querySelector('#assessment-back'),next=document.querySelector('#assessment-next'),skip=document.querySelector('#assessment-skip'),finish=document.querySelector('#assessment-finish');
  const steps=()=>all.filter(step=>!step.dataset.diseases||step.dataset.diseases.split(',').includes(getProfile().disease));
  function review() {
    const p=getProfile(),score=value=>value==null?'暂未提供':`${value} 分`,percent=value=>value==null?'暂未提供':`${value}%`;
    const rows=[['年龄',p.age==null?'尚未填写':`${p.age} 岁`],['疾病',labels[p.disease]||'尚未选择'],['近期症状',{stable:'稳定',worse:'近期加重',unknown:'不确定'}[p.stability]||'尚未选择'],['医护允许',p.clinicianCleared?'已评估并允许':'尚未确认允许'],['呼吸困难评分',p.dyspneaScore==null?'暂未提供':`${p.dyspneaScale==='mrc'?'MRC':'mMRC'} ${p.dyspneaScore} 分`]];
    if(p.disease==='asthma')rows.push(['ACT 总分',score(p.act)]);
    if(p.disease==='copd')rows.push(['CAT 总分',score(p.cat)]);
    rows.push(['FEV₁ 预计值',percent(p.fev1Percent)],['FEV₁/FVC',percent(p.fev1Fvc)],['静息血氧',percent(p.spo2)]);
    document.querySelector('#assessment-review').innerHTML=rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
  }
  function show(id=current,{focus=false}={}) {
    const active=steps();let index=active.findIndex(s=>s.dataset.step===id);if(index<0)index=0;
    current=active[index].dataset.step;
    all.forEach(step=>{step.hidden=step!==active[index];});
    if(focus)active[index].dispatchEvent(new CustomEvent('rehab:step',{bubbles:true}));
    document.querySelector('#wizard-progress-label').textContent=`第 ${index+1} 步，共 ${active.length} 步`;
    document.querySelector('#wizard-progress-fill').style.width=`${(index+1)/active.length*100}%`;
    document.querySelector('#wizard-progress-bar').setAttribute('aria-valuenow',String(index+1));
    document.querySelector('#wizard-progress-bar').setAttribute('aria-valuemax',String(active.length));
    back.disabled=index===0;skip.hidden=active[index].dataset.optional!=='true';next.hidden=index===active.length-1;finish.hidden=index!==active.length-1;
    document.querySelector('#wizard-step-error').hidden=true;
    review();
    if(focus)active[index].querySelector('h2').focus({preventScroll:true});
    if(focus)document.querySelector('.assessment-wizard').scrollIntoView({block:'start',behavior:'instant'});
  }
  function stepErrors(step) {
    const fields=(step.dataset.fields||'').split(',');
    const errors=validateProfile(getProfile()).errors.filter(e=>fields.includes(e.field));
    if(step.dataset.step==='symptoms'&&!form.noRedFlags.checked&&!['chestPain','severeBreathlessness','fainting','hemoptysis'].some(k=>form.elements[k].checked))errors.push({field:'noRedFlags',message:'请选择现在的情况；没有这些症状时，选择“目前没有以上情况”。'});
    if(step.dataset.step==='permission'&&!form.querySelector('[name="clinicalPermission"]:checked'))errors.push({field:'clinicalPermission',message:'请选择医护是否已评估并允许居家练习；不清楚也可以如实选择。'});
    return errors;
  }
  function advance() {
    const active=steps(),index=active.findIndex(s=>s.dataset.step===current),step=active[index];
    const errors=stepErrors(step),waiting=beforeAdvance(current);
    if(waiting)errors.push({field:'report-file',message:waiting});
    if(errors.length){const error=document.querySelector('#wizard-step-error');error.textContent=errors.map(e=>e.message).join(' ');error.hidden=false;const field=document.getElementById(errors[0].field)||step.querySelector('input,select');field?.focus();return false;}
    if(index<active.length-1)show(active[index+1].dataset.step,{focus:true});
    return true;
  }
  back.addEventListener('click',()=>{const active=steps(),index=active.findIndex(s=>s.dataset.step===current);if(index>0)show(active[index-1].dataset.step,{focus:true});});
  next.addEventListener('click',advance);
  skip.addEventListener('click',()=>{
    const step=steps().find(s=>s.dataset.step===current);
    if(step.dataset.optional!=='true')return;
    for(const field of (step.dataset.clear||'').split(',').filter(Boolean)){const el=document.getElementById(field);if(el)el.value='';}
    onSkip();advance();
  });
  form.noRedFlags.addEventListener('change',()=>{if(form.noRedFlags.checked){for(const k of ['chestPain','severeBreathlessness','fainting','hemoptysis'])form.elements[k].checked=false;document.querySelector('#assessment-urgent').hidden=true;}});
  for(const k of ['chestPain','severeBreathlessness','fainting','hemoptysis'])form.elements[k].addEventListener('change',()=>{
    if(form.elements[k].checked)form.noRedFlags.checked=false;
    document.querySelector('#assessment-urgent').hidden=!['chestPain','severeBreathlessness','fainting','hemoptysis'].some(f=>form.elements[f].checked);
  });
  form.querySelectorAll('[name="clinicalPermission"]').forEach(el=>el.addEventListener('change',()=>{form.clinicianCleared.checked=el.value==='yes';}));
  show();
  return {advance,refresh:()=>show(),review,isFinal:()=>current==='review',reset:()=>show(all[0].dataset.step),focusField(field){const step=steps().find(s=>(s.dataset.fields||'').split(',').includes(field));if(step)show(step.dataset.step);(document.getElementById(field)||step?.querySelector('input,select'))?.focus();}};
}

export function mountSeniorMode() {
  const button=document.querySelector('#senior-toggle'),key='hulan_large_text';
  function set(enabled){document.body.classList.toggle('senior-mode',enabled);button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'大字模式：开':'大字模式：关';}
  let enabled=false;try{enabled=localStorage.getItem(key)==='true';}catch{}
  set(enabled);
  button.addEventListener('click',()=>{enabled=!enabled;set(enabled);try{localStorage.setItem(key,String(enabled));}catch{}});
}
