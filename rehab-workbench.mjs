import {validateBaseline,validateProgramme,confirmProgramme,assessSession,compareAssessments,summarizeSessions,baselineSignature} from './rehab-program.mjs';

const KEY='hulan.rehab-workbench.v1';
const names={mip:'最大吸气压 MIP',mep:'最大呼气压 MEP',snip:'鼻吸气压 SNIP','diaphragm-excursion':'膈肌移动度','diaphragm-thickness':'膈肌厚度','six-minute-walk':'6 分钟步行距离','sit-to-stand':'坐站测试'};
const units={cmH2O:'cmH₂O',kPa:'kPa',mm:'mm',cm:'cm',m:'m',repetitions:'次',seconds:'秒','device-level':'设备档位'};
const positions={sitting:'坐位',supine:'仰卧位',semirecumbent:'半卧位',standing:'站位'};
const maneuvers={quiet:'平静呼吸',deep:'深呼吸',sniff:'嗅吸','end-expiration':'呼气末','end-inspiration':'吸气末'};
const phases={pre:'训练前',during:'训练中',post:'训练后'};
const symptomLabels={chestPain:'胸痛',severeBreathlessness:'严重气促或说话困难',fainting:'晕厥或意识异常',hemoptysis:'咯血',dizziness:'头晕',worseSymptoms:'症状比平时加重'};
const e=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid=()=>crypto.randomUUID();
const clone=value=>JSON.parse(JSON.stringify(value));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const plusDays=n=>{const d=new Date(today()+'T12:00:00+08:00');d.setDate(d.getDate()+n);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
const localTime=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
const number=(form,name)=>{const value=form.elements.namedItem(name)?.value?.trim();return value==null||value===''?null:Number(value);};
const value=(form,name)=>form.elements.namedItem(name)?.value?.trim()||'';
function options(items,selected){return Object.entries(items).map(([key,label])=>'<option value="'+e(key)+'"'+(String(selected)===key?' selected':'')+'>'+e(label)+'</option>').join('');}
function field(name,label,current='',{type='number',min='',max='',step='any',hint='',required=false}={}){
  return '<label class="clinical-field"><span>'+e(label)+'</span><input name="'+e(name)+'" type="'+type+'" value="'+e(current)+'"'+(min!==''?' min="'+min+'"':'')+(max!==''?' max="'+max+'"':'')+(type==='number'?' step="'+step+'" inputmode="decimal"':'')+(required?' required':'')+'>'+(hint?'<small>'+e(hint)+'</small>':'')+'</label>';
}
function select(name,label,items,current){return '<label class="clinical-field"><span>'+e(label)+'</span><select name="'+e(name)+'">'+options(items,current)+'</select></label>';}
function check(name,label,checked=false){return '<label class="check-row"><input type="checkbox" name="'+name+'"'+(checked?' checked':'')+'>'+e(label)+'</label>';}
function blankCase(){return {id:uid(),simulated:false,baseline:{assessedAt:today(),measurements:[]},assessments:[],programme:null,sessions:[]};}
function demoCase(){
  const data=blankCase();data.simulated=true;
  data.baseline.measurements=[
    {id:uid(),kind:'mip',value:60,unit:'cmH2O',quality:'acceptable',method:'静态口压测量',posture:'sitting',protocol:'示例：同一仪器、标准口器、重复动作已核对'},
    {id:uid(),kind:'diaphragm-excursion',value:18,unit:'mm',quality:'acceptable',method:'超声 M 型',posture:'supine',side:'right',maneuver:'quiet',protocol:'示例：同一操作者与声窗'},
    {id:uid(),kind:'six-minute-walk',value:320,unit:'m',quality:'acceptable',method:'6 分钟步行试验',posture:'standing',protocol:'示例：同一平直走道与辅助条件'}];
  return data;
}
function cleanProgramme(raw){
  if(raw==null)return null;
  if(typeof raw!=='object'||Array.isArray(raw)||typeof raw.id!=='string'||!['draft','confirmed'].includes(raw.status)||!raw.aerobic||!['continuous','interval'].includes(raw.aerobic.mode)||typeof raw.imt?.enabled!=='boolean'||!raw.monitoring||typeof raw.monitoring!=='object')throw new Error('方案结构不完整。');
  const numeric=(object,keys)=>{for(const key of keys)if(object[key]!=null&&(typeof object[key]!=='number'||!Number.isFinite(object[key])))throw new Error('方案中的数值类型不正确。');};
  numeric(raw,['durationWeeks','frequencyPerWeek']);numeric(raw.aerobic,['minutes','workMinutes','restMinutes']);
  numeric(raw.imt,['load','minLoad','maxLoad','breaths','sets','daysPerWeek']);
  numeric(raw.monitoring,['spo2Min','hrMin','hrMax','borgMax','dyspneaMax','fatigueMax']);
  if(raw.resistance!=null){if(typeof raw.resistance!=='object'||!((typeof raw.resistance.exercises==='string')||(Array.isArray(raw.resistance.exercises)&&raw.resistance.exercises.every(x=>typeof x==='string'))))throw new Error('力量方案格式无效。');numeric(raw.resistance,['reps','sets','load','daysPerWeek']);}
  const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>object[key]!==undefined).map(key=>[key,object[key]]));
  return {...pick(raw,['id','status','durationWeeks','frequencyPerWeek','reviewAt','confirmedAt','baselineSignature','programmeSignature','contextSignature']),aerobic:pick(raw.aerobic,['mode','activity','intensity','minutes','workMinutes','restMinutes','supervision']),resistance:raw.resistance?pick(raw.resistance,['exercises','reps','sets','load','unit','daysPerWeek']):null,imt:pick(raw.imt,['enabled','mipMeasurementId','deviceName','load','unit','minLoad','maxLoad','breaths','sets','daysPerWeek','deviceCompatible']),monitoring:pick(raw.monitoring,['spo2Min','hrMin','hrMax','borgMax','dyspneaMax','fatigueMax'])};
}
function importCase(raw,simulated){
  if(!raw||raw.version!==1||raw.simulated!==simulated||typeof raw.id!=='string'||!validateBaseline(raw.baseline).valid)throw new Error('资料格式或真实 / 示例状态不匹配。请使用此工作台导出的同类记录。');
  if(!Array.isArray(raw.assessments)||!Array.isArray(raw.sessions)||raw.sessions.length>500||raw.assessments.length>100)throw new Error('记录数量或格式不正确。');
  const cleanMeasurement=item=>Object.fromEntries(['id','kind','value','unit','quality','method','posture','side','maneuver','protocol'].filter(key=>item[key]!==undefined).map(key=>[key,item[key]]));
  const cleanBaseline=b=>({assessedAt:b.assessedAt,measurements:b.measurements.map(cleanMeasurement)});
  if(raw.assessments.some(b=>!validateBaseline(b).valid))throw new Error('历史评估中有无效测量。');
  const sessions=raw.sessions.map(s=>{
    if(!s||typeof s.id!=='string'||typeof s.programmeId!=='string'||!Number.isFinite(s.actualMinutes)||s.actualMinutes<0||s.actualMinutes>240||!Number.isFinite(Date.parse(s.observedAt))||!['pre','during','post'].includes(s.phase))throw new Error('训练记录中的时间或数值无效。');
    for(const [key,min,max] of [['spo2',1,100],['hr',1,300],['borg',0,10],['dyspnea',0,10],['fatigue',0,10],['reps',0,10000],['load',0,10000]])if(s[key]!=null&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))throw new Error('监测记录读数无效。');
    if(!s.symptoms||Object.keys(symptomLabels).some(key=>s.symptoms[key]!==null&&typeof s.symptoms[key]!=='boolean')||s.selfReported!==true)throw new Error('身体状况或记录来源格式无效。');
    if(s.supervised!==undefined&&typeof s.supervised!=='boolean')throw new Error('现场监督记录格式无效。');
    const item=Object.fromEntries(['id','programmeId','observedAt','actualMinutes','reps','load','spo2','hr','borg','dyspnea','fatigue','phase','activity','selfReported','supervised'].filter(key=>s[key]!==undefined).map(key=>[key,s[key]]));
    item.symptoms=Object.fromEntries(Object.keys(symptomLabels).map(key=>[key,s.symptoms[key]]));
    const urgent=['chestPain','severeBreathlessness','fainting','hemoptysis'].some(key=>item.symptoms[key]===true);
    item.assessment={status:urgent?'urgent':item.symptoms.dizziness||item.symptoms.worseSymptoms?'stop':'review',reasons:['从备份导入的历史记录；原临床判断需重新核对。']};
    item.programmeSnapshot=s.programmeSnapshot?cleanProgramme(s.programmeSnapshot):null;
    return item;
  });
  return {id:raw.id,simulated,baseline:cleanBaseline(raw.baseline),assessments:raw.assessments.map(cleanBaseline),programme:cleanProgramme(raw.programme),sessions};
}

export function mountRehabWorkbench(container,{getContext=()=>({}),onChange=()=>{},onMessage=()=>{}}={}){
  const doc=container.ownerDocument,win=doc.defaultView;
  let real=blankCase(),demo=null,step='assess',audience='clinical',message='',messageType='review',disposed=false;
  let timer=null,frameId=0,startedAt=0,elapsed=0,timerRunning=false,timerActivity='aerobic';
  const drafts=new Map();
  try{const cached=JSON.parse(win.localStorage.getItem(KEY)||'null');if(cached?.consent===true&&getContext().persist===true)real=importCase(cached.data,false);}catch{message='本机康复记录未能恢复，请核对导出备份。';}
  const data=()=>getContext().isDemo?(demo??=demoCase()):real;
  const context=()=>({...getContext(),subjectId:data().id,baseline:data().baseline,now:new Date()});
  function save(){if(getContext().isDemo)return;try{if(getContext().persist)win.localStorage.setItem(KEY,JSON.stringify({consent:true,data:{version:1,...real}}));else win.localStorage.removeItem(KEY);}catch{onMessage('本机保存失败，请导出结构化记录备份。');}}
  function feedback(text,type='review'){
    message=text;messageType=type;
    const nav=container.querySelector('.clinical-workflow');
    if(nav){let node=container.querySelector('.clinical-message');if(!node){node=doc.createElement('div');nav.after(node);}node.className='clinical-message '+type;node.setAttribute('role',['urgent','stop'].includes(type)?'alert':'status');node.textContent=text;}
  }
  function changed(){save();onChange();}
  function programmeState(){const p=data().programme;return p?validateProgramme(p,data().baseline,context()):{valid:false,errors:[{message:'医护尚未填写并确认康复方案。'}]};}
  function stopTimer(reason=''){if(timerRunning)elapsed+=performance.now()-startedAt;timerRunning=false;win.cancelAnimationFrame(frameId);frameId=0;if(reason)feedback(reason);updateTimer();}
  function invalidate(){if(data().programme)data().programme={...data().programme,status:'draft'};stopTimer();}
  function notifyErrors(result){feedback(result.errors.map(item=>item.message).join(' '));}
  function deviceRows(){return '<div class="device-row"><span>呼吸训练器</span><strong>型号与负荷单位需核对</strong><small>可记录小鲲等设备结果；未直连</small></div><div class="device-row"><span>呼吸肌肌力仪</span><strong>MIP / MEP / SNIP</strong><small>保留单位、方法与测量质量</small></div><div class="device-row"><span>膈肌功能测定</span><strong>分侧、体位、呼吸动作</strong><small>超声与其他方法分别记录</small></div>';}
  function shell(main,aside=''){
    return '<div class="rehab-workbench"><div class="workbench-heading"><p class="clinical-overline">'+(audience==='patient'?'按方案训练 · 如实记录':'评估 → 方案 → 监测 → 复评')+'</p><span class="clinical-status '+(programmeState().valid&&data().programme?.status==='confirmed'?'ready':'review')+'">'+(getContext().isDemo?'模拟病例':data().programme?.status==='confirmed'&&programmeState().valid?'方案已确认':'待医护复核')+'</span></div>'+
      (getContext().isDemo?'<p class="clinical-note">所有数值及负荷仅为模拟示例，不是患者默认处方。</p>':'')+
      (getContext().profile&&getContext().supervisedOnly?'<p class="clinical-note">当前评估需采用院内监督方案，由医护现场确认后训练。'+e((getContext().reviewReasons||[]).join(' '))+'</p>':'')+
      '<nav class="clinical-workflow" aria-label="康复路径">'+(audience==='patient'?[['plan','查看方案'],['monitor','训练与记录'],['review','查看复评']]:[['assess','专业评估'],['plan','方案确认'],['monitor','训练监测'],['review','复评调整']]).map(([id,label],i)=>'<button type="button" data-clinic-step="'+id+'"'+(step===id?' aria-current="step"':'')+'><span>'+(i+1)+'</span>'+label+'</button>').join('')+'</nav>'+
      (message?'<div class="clinical-message '+messageType+'" role="status">'+e(message)+'</div>':'')+
      '<div class="workbench-grid"><section class="clinical-panel">'+main+'</section><aside class="clinical-aside">'+aside+'</aside></div>'+
      '<div class="evidence-strip"><strong>依据可追溯，调整有记录</strong><a href="https://goldcopd.org/2026-gold-report-and-pocket-guide/" target="_blank" rel="noopener">GOLD 2026</a><a href="https://doi.org/10.1164/rccm.202306-1066ST" target="_blank" rel="noopener">ATS 肺康复指南</a><a href="https://doi.org/10.1183/13993003.01214-2018" target="_blank" rel="noopener">ERS 呼吸肌测试</a></div><p class="clinical-footnote">本机确认记录医护声明，不提供身份认证或远程监护。记录默认随页面关闭清除；本机保存沿用“数据与隐私”中的主动选择。设备直连与临床有效性尚未验证。</p></div>';
  }
  function assessmentPanel(){
    const b=data().baseline;
    return '<div class="panel-heading"><div><h3>记录专业测量</h3><p>未测留空，不填零。</p></div><span class="clinical-count">'+b.measurements.length+' 项测量</span></div><form data-clinic-form="measurement"><div class="measurement-grid">'+
      select('kind','测量项目',names,'mip')+field('value','实际测量值','',{min:0,required:true})+select('unit','报告原单位',units,'cmH2O')+
      select('quality','测量质量',{'uncertain':'尚未核对','acceptable':'质量与重复性已核对'},'uncertain')+
      field('method','测量方法','',{type:'text',hint:'如静态口压测量、超声 M 型',required:true})+
      select('posture','检查体位',positions,'sitting')+select('side','膈肌侧别',{'':'非膈肌项目',right:'右侧',left:'左侧'},'')+
      select('maneuver','膈肌呼吸动作',{'':'非膈肌项目',...maneuvers},'')+
      field('protocol','具体测量协议','',{type:'text',hint:'仪器/口器、动作、重复条件；复评需保持一致',required:true})+
      '</div><p class="clinical-note">压力记录正的压力幅值。MIP、SNIP 和设备动态读数不互相替代；不要把设备档位填成压力。</p><div class="clinical-actions"><button type="submit" class="btn-primary">添加测量</button></div></form>'+
      '<div class="measurement-list">'+(b.measurements.length?b.measurements.map(m=>'<article class="measurement-row"><div><strong>'+e(names[m.kind])+'</strong><p>'+e(m.method)+' / '+e(positions[m.posture]||m.posture)+(m.side?' / '+(m.side==='right'?'右侧':'左侧'):'')+(m.maneuver?' / '+e(maneuvers[m.maneuver]):'')+'</p><small>'+e(m.protocol)+' · '+(m.quality==='acceptable'?'质量已核对':'待核对')+'</small></div><strong>'+e(m.value)+' <small>'+e(units[m.unit])+'</small></strong><button type="button" class="btn-quiet" data-remove-measurement="'+e(m.id)+'" aria-label="删除'+e(names[m.kind])+'">移除</button></article>').join(''):'<div class="clinical-empty"><strong>还没有专业测量记录</strong><p>先从已有的肌力、膈肌或运动能力报告中选择一项。</p></div>')+'</div>'+
      '<form data-clinic-form="baseline"><div class="measurement-grid">'+field('assessedAt','本次评估日期',b.assessedAt,{type:'date',required:true})+'</div><div class="clinical-actions"><button class="btn-primary" type="submit">保存本次评估</button><button class="btn-secondary" type="button" data-clinic-step="plan">继续制定方案</button></div></form>';
  }
  function newProgramme(){return {id:uid(),status:'draft',durationWeeks:8,frequencyPerWeek:null,aerobic:{mode:'interval',activity:'',intensity:'',minutes:null,workMinutes:null,restMinutes:null,supervision:'hybrid'},resistance:null,imt:{enabled:false},monitoring:{},reviewAt:''};}
  function planDisplay(){
    const p=data().programme,valid=programmeState();
    if(!p)return '<div class="clinical-empty"><h3>医护尚未确认康复方案</h3><p>先完成健康评估，再由医护结合专业测量制定训练。</p><a class="btn-primary" href="#assessment">完成健康评估</a><a class="text-link" href="#clinic">打开医护工作台</a></div>';
    return '<div class="panel-heading"><div><h3>你的训练安排</h3><p>'+e(p.durationWeeks)+' 周 / 每周 '+e(p.frequencyPerWeek)+' 次 / 复评 '+e(p.reviewAt)+'</p></div></div>'+
      (!valid.valid||p.status!=='confirmed'?'<div class="clinical-message review">此方案尚不能用于训练。'+e(valid.errors.map(x=>x.message).join(' '))+'</div>':'')+
      '<div class="programme-prescription"><article><span>全身耐力 · '+e(p.aerobic?.activity)+'</span><h4>'+e(p.aerobic?.minutes)+' 分钟</h4><p>'+(p.aerobic?.mode==='interval'?'活动 '+e(p.aerobic.workMinutes)+' 分钟 / 恢复 '+e(p.aerobic.restMinutes)+' 分钟':'连续训练，按方案随时休息')+'</p><small>强度目标：'+e(p.aerobic?.intensity)+'</small></article>'+
      '<article><span>力量训练</span><h4>'+(p.resistance?e(p.resistance.sets)+' 组 × '+e(p.resistance.reps)+' 次':'按医护评估安排')+'</h4><p>'+e(Array.isArray(p.resistance?.exercises)?p.resistance.exercises.join('、'):p.resistance?.exercises||'尚未加入')+'</p>'+(p.resistance?'<small>负荷 '+e(p.resistance.load)+' '+e(p.resistance.unit)+' / 每周 '+e(p.resistance.daysPerWeek)+' 天</small>':'')+'</article>'+
      '<article><span>吸气肌训练</span><h4>'+(p.imt?.enabled?e(p.imt.load)+' '+e(units[p.imt.unit]):'未启用 IMT')+'</h4><p>'+(p.imt?.enabled?e(p.imt.sets)+' 组 × '+e(p.imt.breaths)+' 次 / 每周 '+e(p.imt.daysPerWeek)+' 天':'综合肺康复不依赖 IMT；由医护决定是否加入。')+'</p></article></div>'+
      '<div class="clinical-note"><strong>监测界限</strong><p>'+monitoringText(p.monitoring)+'</p><small>这些界限由医护填写，空白指标不解释为正常。读数越界或出现不适时停止、复核，不自行加量或调氧。</small></div>'+
      '<div class="clinical-note"><strong>教育与支持</strong><p>每周安排用药技术复核、症状行动计划与训练回顾；音乐和冥想用于放松支持。</p><div class="clinical-links"><a href="#inhaler">吸入剂教学</a><a href="#education">疾病宣教</a><a href="#daily">每日评估</a><a href="#music">音乐与冥想</a></div></div>'+
      '<div class="clinical-actions"><button type="button" class="btn-primary" data-clinic-step="monitor">训练前检查与记录</button><a class="btn-secondary" href="#garden">呼吸动作示范</a></div>';
  }
  function monitoringText(m={}){const labels={spo2Min:'SpO₂ 下限',hrMin:'心率下限',hrMax:'心率上限',borgMax:'用力感 Borg 上限',dyspneaMax:'气促上限',fatigueMax:'疲劳上限'};return Object.entries(labels).filter(([key])=>m[key]!=null).map(([key,label])=>e(label)+' '+e(m[key])+(key==='spo2Min'?'%':key.startsWith('hr')?' 次/分':' / 10')).join('；')||'尚未设置';}
  function planPanel(){
    if(audience==='patient')return planDisplay();
    const p=data().programme||newProgramme(),m=p.monitoring||{},r=p.resistance||{},imt=p.imt||{};
    return '<div class="panel-heading"><div><h3>从患者目标，落实到训练剂量</h3><p>8 周仅为可修改的周期草稿；实际频次、负荷和监测界限均由医护填写。</p></div></div><form data-clinic-form="programme"><fieldset><legend>全身运动是核心</legend><div class="measurement-grid">'+
      field('durationWeeks','方案周期 / 周',p.durationWeeks,{min:1,max:52,step:1,required:true})+
      field('frequencyPerWeek','每周训练 / 次',p.frequencyPerWeek,{min:1,max:14,step:1,required:true})+
      field('aerobicActivity','实际耐力活动',p.aerobic.activity||'',{type:'text',hint:'医护确定，如平地步行、功率车',required:true})+
      field('aerobicIntensity','强度目标与方法',p.aerobic.intensity||'',{type:'text',hint:'填写实际速度、功率或症状目标；不要只写适量',required:true})+
      select('aerobicMode','耐力模式',{interval:'间歇活动',continuous:'连续活动'},p.aerobic.mode)+
      field('aerobicMinutes','每次总时长 / 分钟',p.aerobic.minutes,{min:1,max:180,required:true})+
      field('workMinutes','间歇：活动 / 分钟',p.aerobic.workMinutes,{min:0.1})+
      field('restMinutes','间歇：恢复 / 分钟',p.aerobic.restMinutes,{min:0.1})+
      select('supervision','督导安排',{clinic:'院内监督',hybrid:'院内与居家结合',telerehab:'有专业支持的远程康复'},p.aerobic.supervision||'hybrid')+'</div></fieldset>'+
      '<fieldset class="clinical-optional clinical-strength"><legend>力量训练</legend>'+check('resistanceEnabled','加入力量训练',!!p.resistance)+'<div class="measurement-grid">'+field('exercises','动作',Array.isArray(r.exercises)?r.exercises.join('、'):r.exercises||'',{type:'text',hint:'如坐站、坐姿伸膝；按能力选择'})+field('reps','每组 / 次',r.reps,{min:1,max:100,step:1})+field('sets','每次 / 组',r.sets,{min:1,max:20,step:1})+field('resistanceLoad','实际负荷',r.load,{min:0,hint:'徒手记 0，单位注明徒手'})+field('resistanceUnit','负荷单位',r.unit||'',{type:'text'})+field('resistanceDays','每周 / 天',r.daysPerWeek,{min:1,max:7,step:1})+'</div></fieldset>'+
      '<fieldset class="clinical-optional clinical-imt"><legend>吸气肌训练 · 按需加入</legend>'+check('imtEnabled','医护评估后加入 IMT',imt.enabled)+'<p class="clinical-note">需要已核对质量的 MIP 和实际设备适配。输入的是医护确定的负荷，不自动套用 MIP 百分比；档位不换算成压力。</p><div class="measurement-grid">'+
      select('mipMeasurementId','用于评估的 MIP',{'':'请选择已核对的 MIP',...Object.fromEntries(data().baseline.measurements.filter(x=>x.kind==='mip').map(x=>[x.id,x.value+' '+units[x.unit]+' / '+(x.quality==='acceptable'?'已核对':'未核对')]))},imt.mipMeasurementId||'')+
      field('deviceName','实际器械与型号',imt.deviceName||'',{type:'text'})+field('imtLoad','本次负荷',imt.load,{min:0})+select('imtUnit','原负荷单位',{cmH2O:'cmH₂O',kPa:'kPa','device-level':'设备原档位'},imt.unit||'cmH2O')+
      field('imtMin','医护规定负荷下限',imt.minLoad,{min:0})+field('imtMax','医护规定负荷上限',imt.maxLoad,{min:0})+field('imtBreaths','每组 / 次',imt.breaths,{min:1,max:200,step:1})+field('imtSets','每日 / 组',imt.sets,{min:1,max:20,step:1})+field('imtDays','每周 / 天',imt.daysPerWeek,{min:1,max:7,step:1})+'</div>'+check('deviceCompatible','已核对型号、说明书、负荷单位与设备适配性',imt.deviceCompatible)+'</fieldset>'+
      '<fieldset><legend>个体监测界限与复评</legend><p>留空表示未设定，不代表正常。至少设定一项，并结合病情完成实际医护审核。</p><div class="measurement-grid">'+
      field('spo2Min','SpO₂ 下限 / %',m.spo2Min,{min:1,max:100})+field('hrMin','心率下限 / 次/分',m.hrMin,{min:1,max:300})+field('hrMax','心率上限 / 次/分',m.hrMax,{min:1,max:300})+
      field('borgMax','用力感 Borg 上限 / 0–10',m.borgMax,{min:0,max:10})+field('dyspneaMax','气促上限 / 0–10',m.dyspneaMax,{min:0,max:10})+field('fatigueMax','疲劳上限 / 0–10',m.fatigueMax,{min:0,max:10})+
      field('reviewAt','计划复评日期',p.reviewAt,{type:'date',required:true})+'</div></fieldset>'+
      check('attested','医护已核对评估、训练剂量、监测界限及复评安排；确认记录为本机声明')+
      '<div class="clinical-actions"><button type="submit" class="btn-secondary" name="intent" value="draft" formnovalidate>保存草稿</button><button type="submit" class="btn-primary" name="intent" value="confirm">医护确认方案</button></div></form>';
  }
  function sessionPanel(){
    const p=data().programme,valid=programmeState();
    const stats=summarizeSessions(data().sessions.filter(s=>s.phase==='post'),p);
    return '<div class="panel-heading"><div><h3>训练前检查，过程中记录，结束后回顾</h3><p>读数来自你手工录入的设备或自评，不是连续传感器监测。</p></div></div>'+
      '<div class="metric-strip"><div><strong>'+stats.activeSessions+'</strong><span>有时长的结束记录</span></div><div><strong>'+Math.round(stats.actualMinutes)+'</strong><span>实际记录分钟</span></div><div><strong>'+data().sessions.length+'</strong><span>前 / 中 / 后监测点</span></div></div>'+
      ((!valid.valid||p?.status!=='confirmed')?'<div class="clinical-message review">先完成并确认有效方案，再开始训练。<button type="button" class="text-link" data-clinic-step="plan">查看方案</button></div>':'')+
      '<form data-clinic-form="session"><div class="measurement-grid">'+select('phase','记录阶段',phases,'pre')+select('activity','训练项目',{aerobic:'全身耐力训练',resistance:'方案中的力量训练',imt:'方案中的吸气肌训练'},'aerobic')+
      field('observedAt','实际读数时间',localTime(),{type:'datetime-local',required:true,hint:'开始引导时须为今天本次读数；历史记录仍可保存'})+
      field('spo2','SpO₂ / %','',{min:1,max:100})+field('hr','心率 / 次/分','',{min:1,max:300})+field('borg','用力感 Borg / 0–10','',{min:0,max:10})+
      field('dyspnea','气促 / 0–10','',{min:0,max:10})+field('fatigue','疲劳 / 0–10','',{min:0,max:10})+field('actualMinutes','实际训练 / 分钟',0,{min:0,max:240,hint:'训练前填 0；结束后填实际用时'})+
      field('reps','实际完成 / 次','',{min:0,step:1})+field('load','实际负荷（方案原单位）','',{min:0})+'</div>'+
      '<fieldset><legend>本次身体状况</legend><p>有以下情况请勾选；若有胸痛、严重气促、晕厥或咯血，请立即停止并寻求急救。</p>'+Object.entries(symptomLabels).map(([key,label])=>check(key,label)).join('')+check('symptomsChecked','已核对以上身体状况；未勾选项目表示本次没有该情况')+'</fieldset>'+
      (p?.aerobic?.supervision==='clinic'?check('supervised','本次确有医护现场监督，已核对本次训练条件'):'')+
      '<div class="clinical-actions"><button type="submit" class="btn-primary">保存本次监测</button><button type="button" class="btn-secondary" data-start-timer>核对并开始引导</button></div></form>'+
      '<section class="clinical-timer" aria-label="训练计时"><p data-timer-phase>准备好，再开始</p><strong data-timer-clock>00:00</strong><p data-timer-guide>耐力训练按方案活动与恢复；力量和器械训练仅记录经过时间，按医护动作与装置说明进行。</p><div class="clinical-actions"><button type="button" class="btn-secondary" data-pause-timer>暂停</button><button type="button" class="btn-secondary" data-stop-timer>结束引导</button></div><p class="clinical-footnote">网页不测量动作、吸气压力或真实呼吸；离开页面自动暂停，不自动续练。</p></section>'+
      '<div class="clinical-session-list">'+data().sessions.slice(-8).reverse().map(s=>'<article class="measurement-row"><div><strong>'+e(phases[s.phase])+' / '+e(s.activity==='imt'?'吸气肌':s.activity==='resistance'?'力量':'耐力')+'</strong><p>'+e(new Date(s.observedAt).toLocaleString('zh-CN'))+'</p><small>'+e((s.assessment?.reasons||[]).join(' '))+'</small></div><span class="clinical-status '+e(s.assessment?.status||'review')+'">'+e(({ready:'已记录',stop:'停止并复核',urgent:'立即求助',review:'待复核'})[s.assessment?.status]||'待复核')+'</span></article>').join('')+'</div>';
  }
  function reviewPanel(){
    const records=data().assessments,previous=records.length>1?records.at(-2):null,latest=records.at(-1);
    const comparisons=previous&&latest?compareAssessments(previous,latest):[];
    const measured=data().sessions.filter(s=>s.phase==='post'&&typeof s.spo2==='number').slice(-12);
    const lower=measured.length?Math.max(0,Math.floor(Math.min(...measured.map(s=>s.spo2))-2)):0;
    const upper=measured.length?Math.min(100,Math.ceil(Math.max(...measured.map(s=>s.spo2))+2)):100;
    const y=n=>120-(n-lower)/(upper-lower||1)*100;
    const chart=measured.length?'<svg viewBox="0 0 620 150" role="img" aria-label="最近结束记录的实际血氧点图，纵轴百分比，横轴按记录顺序"><path d="M42 12V120H600" stroke="currentColor" fill="none"/>'+[lower,(lower+upper)/2,upper].map(n=>'<text x="3" y="'+y(n)+'" font-size="12">'+n+'%</text>').join('')+measured.map((s,i)=>'<circle cx="'+(65+i*48)+'" cy="'+y(s.spo2)+'" r="5" fill="#12574e"><title>'+e(s.observedAt)+' / '+s.spo2+'%</title></circle>').join('')+'</svg><ul class="clinical-reading-list">'+measured.map(s=>'<li>'+e(new Date(s.observedAt).toLocaleString('zh-CN'))+'：'+s.spo2+'%</li>').join('')+'</ul><p class="clinical-footnote">仅显示实际录入读数；纵轴随数值范围变化，点间不补造数据。</p>':'<div class="clinical-empty"><strong>还没有可绘制的结束监测读数</strong><p>真实记录之后才显示点位；不填充示例趋势。</p></div>';
    return '<div class="panel-heading"><div><h3>看参与，也看同条件下的变化</h3><p>完成训练不等于疗效；增量或减量由医护复评决定。</p></div></div><h4>训练后血氧记录</h4>'+chart+
      '<div class="measurement-list">'+(comparisons.length?comparisons.map(c=>'<article class="measurement-row"><div><strong>'+e(names[c.kind])+(c.side?' / '+(c.side==='right'?'右侧':'左侧'):'')+'</strong><p>'+e(c.reason)+'</p><small>'+e(c.method)+' / '+e(positions[c.posture]||c.posture)+' / '+e(c.protocol)+'</small></div><strong>'+(c.comparable?e(c.before)+' → '+e(c.after)+' '+e(units[c.unit])+'<small>变化 '+(c.delta>0?'+':'')+e(Number(c.delta.toFixed(3)))+'</small>':'不作比较')+'</strong></article>').join(''):'<div class="clinical-empty"><strong>需要两次保存的专业评估</strong><p>在专业评估中录入新测量并保存，保持同方法、体位、侧别、动作和单位，才能比较。</p></div>')+'</div>'+
      '<div class="clinical-actions"><button type="button" class="btn-primary" data-new-assessment>新建复评，保留既往评估</button><button type="button" class="btn-secondary" data-clinic-step="plan">由医护调整方案</button><button type="button" class="btn-secondary" data-export-clinic>导出结构化记录</button></div><label class="clinical-field"><span>导入本工作台的记录备份</span><input type="file" accept=".json,application/json" data-import-clinic><small>不导入原始患者附件；导入会替换当前工作台病例，模拟与真实记录不可混入。</small></label><button type="button" class="btn-quiet" data-clear-clinic>清除当前工作台病例</button>';
  }
  function render(){
    if(disposed)return;
    const map={assess:assessmentPanel,plan:planPanel,monitor:sessionPanel,review:reviewPanel};
    if(audience==='patient'&&step==='assess')step='plan';
    const aside='<div class="panel-heading"><h3>'+(step==='assess'?'你的设备条件':'本次判断依据')+'</h3></div>'+(step==='assess'?deviceRows():'<div class="clinical-note"><strong>当前健康画像</strong><p>'+(getContext().profile?e(({copd:'慢阻肺',asthma:'哮喘',bronchiectasis:'支气管扩张',other:'其他气道疾病'})[getContext().profile.disease])+' / '+e(getContext().profile.age)+' 岁':'尚未完成')+'</p><a href="#assessment">查看与更新评估</a></div><div class="clinical-note"><strong>复评前，不自动加量</strong><p>方案、基线或健康画像改变后，需要重新确认。训练前中后读数与个体界限分别比较。</p></div>')+'<div class="clinical-note"><strong>综合肺康复</strong><p>全身运动、教育与行为支持是核心。吸气肌训练是可选择的补充；音乐和冥想用于放松。</p></div>';
    container.innerHTML=shell(map[step](),aside);
    for(const form of container.querySelectorAll('[data-clinic-form]')){
      const saved=drafts.get(data().id+':'+form.dataset.clinicForm);
    if(saved)for(const input of form.elements){if(input.matches('input:not([type=file]):not([type=submit]):not([type=reset]):not([type=image]),select,textarea')&&input.name&&saved[input.name]!==undefined){if(input.type==='checkbox')input.checked=saved[input.name];else input.value=saved[input.name];}}
    }
    updateTimer();
  }
  function readSession(form){
    const time=new Date(value(form,'observedAt'));
    return {id:uid(),programmeId:data().programme?.id||'',observedAt:Number.isFinite(time.getTime())?time.toISOString():'',phase:value(form,'phase'),activity:value(form,'activity'),actualMinutes:number(form,'actualMinutes'),reps:number(form,'reps'),load:number(form,'load'),spo2:number(form,'spo2'),hr:number(form,'hr'),borg:number(form,'borg'),dyspnea:number(form,'dyspnea'),fatigue:number(form,'fatigue'),selfReported:true,supervised:form.elements.namedItem('supervised')?.checked===true,symptoms:Object.fromEntries(Object.keys(symptomLabels).map(key=>[key,form.elements.namedItem(key).checked?true:form.symptomsChecked.checked?false:null]))};
  }
  function updateTimer(){
    win.cancelAnimationFrame(frameId);frameId=0;
    const clock=container.querySelector('[data-timer-clock]'),phase=container.querySelector('[data-timer-phase]');
    if(!clock)return;
    const ms=elapsed+(timerRunning?performance.now()-startedAt:0),seconds=Math.floor(ms/1000);
    const formatted=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    if(clock.textContent!==formatted)clock.textContent=formatted;
    const region=container.querySelector('.clinical-timer');if(region)region.dataset.status=timerRunning?'running':timer?'paused':'idle';
    const start=container.querySelector('[data-start-timer]'),pause=container.querySelector('[data-pause-timer]');
    if(start){start.disabled=timerRunning;start.textContent=timerRunning?'引导进行中':timer?'核对并继续引导':'核对并开始引导';}if(pause)pause.disabled=!timerRunning;
    if(!timer){phase.textContent='准备好，再开始';return;}
    const p=data().programme;
    let text=timerRunning?'按自己的节奏活动':'已暂停';
    if(timerRunning&&timerActivity==='aerobic'&&p?.aerobic?.mode==='interval'){
      const work=p.aerobic.workMinutes*60,rest=p.aerobic.restMinutes*60,position=seconds%(work+rest);
      text=position<work?'活动阶段 · '+p.aerobic.activity+' · '+p.aerobic.intensity:'恢复阶段 · 放慢并休息';
    }
    if(phase.textContent!==text)phase.textContent=text;
    if(timerRunning&&timerActivity==='aerobic'&&ms>=p.aerobic.minutes*60000){stopTimer('已到方案安排的总时长。请结束、记录实际感受与读数。');phase.textContent='引导结束，请记录';return;}
    if(timerRunning)frameId=win.requestAnimationFrame(updateTimer);
  }
  function startTimer(form){
    if(timerRunning)return;
    const session=readSession(form);session.actualMinutes=0;session.phase='pre';
    const assessment=assessSession(session,data().programme,context());
    if(assessment.status!=='ready'){feedback(assessment.reasons.join(' '),assessment.status);render();return;}
    if(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(session.observedAt))!==today()||Date.parse(session.observedAt)>Date.now()){feedback('开始前请核对并更新今天本次测量的时间和读数；历史读数可以保存，但不能用于本次开始检查。');return;}
    if(session.activity==='imt'&&!data().programme.imt?.enabled){feedback('方案未启用吸气肌训练。');render();return;}
    if(session.activity==='resistance'&&!data().programme.resistance){feedback('方案未加入力量训练。');render();return;}
    if(!timer||timerActivity!==session.activity)elapsed=0;
    timerActivity=session.activity;timer=timer||{programmeId:data().programme.id};startedAt=performance.now();timerRunning=true;updateTimer();
  }
  function remember(form){if(!form)return;drafts.set(data().id+':'+form.dataset.clinicForm,Object.fromEntries([...form.elements].filter(input=>input.name&&input.matches('input:not([type=file]):not([type=submit]):not([type=reset]):not([type=image]),select,textarea')).map(input=>[input.name,input.type==='checkbox'?input.checked:input.value])));}
  function forget(form){drafts.delete(data().id+':'+form.dataset.clinicForm);}
  function input(event){
    const form=event.target.closest('[data-clinic-form]');remember(form);
    if(form&&['programme','baseline','measurement'].includes(form.dataset.clinicForm)&&data().programme?.status==='confirmed'){
      invalidate();changed();const status=container.querySelector('.workbench-heading .clinical-status');if(status){status.className='clinical-status review';status.textContent='内容已修改，待重新确认';}
    }
  }
  async function submit(event){
    const form=event.target.closest('[data-clinic-form]');if(!form)return;event.preventDefault();
    try{
      if(form.dataset.clinicForm==='measurement'){
        const item={id:uid(),kind:value(form,'kind'),value:number(form,'value'),unit:value(form,'unit'),quality:value(form,'quality'),method:value(form,'method'),posture:value(form,'posture'),protocol:value(form,'protocol')};
        if(item.kind.startsWith('diaphragm-')){item.side=value(form,'side');item.maneuver=value(form,'maneuver');}
        const baseline={...data().baseline,measurements:[...data().baseline.measurements,item]};
        const validation=validateBaseline(baseline);if(!validation.valid){notifyErrors(validation);render();return;}
        data().baseline=baseline;invalidate();forget(form);feedback('测量已添加。完成本次录入后保存评估；更改基线需重新确认方案。','ready');changed();render();
      }else if(form.dataset.clinicForm==='baseline'){
        const baseline={...data().baseline,assessedAt:value(form,'assessedAt')};const validation=validateBaseline(baseline);
        if(!validation.valid){notifyErrors(validation);render();return;}
        if(baseline.assessedAt>today()){feedback('评估日期不能晚于今天。');render();return;}
        if(data().assessments.length&&baselineSignature(data().assessments.at(-1))===baselineSignature(baseline)){feedback('本次评估未变化，不重复保存。复评请新建一次评估。');render();return;}
        data().baseline=baseline;data().assessments.push(clone(baseline));data().assessments=data().assessments.slice(-100);invalidate();forget(form);feedback('本次评估已保存。下一步由医护核对方案。','ready');changed();render();
      }else if(form.dataset.clinicForm==='programme'){
        const previous=data().programme;
        const p={id:previous?.status==='draft'?previous.id:uid(),status:'draft',durationWeeks:number(form,'durationWeeks'),frequencyPerWeek:number(form,'frequencyPerWeek'),aerobic:{mode:value(form,'aerobicMode'),activity:value(form,'aerobicActivity'),intensity:value(form,'aerobicIntensity'),minutes:number(form,'aerobicMinutes'),workMinutes:number(form,'workMinutes'),restMinutes:number(form,'restMinutes'),supervision:value(form,'supervision')},resistance:form.resistanceEnabled.checked?{exercises:value(form,'exercises'),reps:number(form,'reps'),sets:number(form,'sets'),load:number(form,'resistanceLoad'),unit:value(form,'resistanceUnit'),daysPerWeek:number(form,'resistanceDays')}:null,imt:{enabled:form.imtEnabled.checked,mipMeasurementId:value(form,'mipMeasurementId'),deviceName:value(form,'deviceName'),load:number(form,'imtLoad'),unit:value(form,'imtUnit'),minLoad:number(form,'imtMin'),maxLoad:number(form,'imtMax'),breaths:number(form,'imtBreaths'),sets:number(form,'imtSets'),daysPerWeek:number(form,'imtDays'),deviceCompatible:form.deviceCompatible.checked},monitoring:Object.fromEntries(['spo2Min','hrMin','hrMax','borgMax','dyspneaMax','fatigueMax'].map(key=>[key,number(form,key)])),reviewAt:value(form,'reviewAt')};
        stopTimer();timer=null;elapsed=0;data().programme=p;
        if(event.submitter?.value==='confirm'){
          if(!form.attested.checked){feedback('请由医护完成核对并勾选确认声明。');changed();render();return;}
          if(p.imt.enabled&&!p.imt.deviceName){feedback('启用 IMT 前请记录实际器械型号。');changed();render();return;}
          const result=confirmProgramme(p,data().baseline,context());
          if(!result.valid){notifyErrors(result);changed();render();return;}
          data().programme=result.programme;feedback('方案已记录本机医护确认。更改基线或剂量后必须重新核对。','ready');
        }else feedback('草稿已保存，尚不能作为训练依据。','ready');
        forget(form);changed();render();
      }else if(form.dataset.clinicForm==='session'){
        const session=readSession(form);session.assessment=assessSession(session,data().programme,context());
        if(session.assessment.status!=='ready')stopTimer();
        session.programmeSnapshot=data().programme?clone(data().programme):null;
        data().sessions.push(session);data().sessions=data().sessions.slice(-500);
        forget(form);feedback(session.assessment.reasons.join(' '),session.assessment.status);changed();render();
      }
    }catch{feedback('未能保存，请核对时间、数字和必填内容。');render();}
  }
  function click(event){
    const target=event.target.closest('button');if(!target||!container.contains(target))return;
    if(target.dataset.clinicStep){stopTimer();step=target.dataset.clinicStep;if(audience==='patient'&&step==='assess')audience='clinical';message='';render();}
    if(target.dataset.removeMeasurement){data().baseline.measurements=data().baseline.measurements.filter(m=>m.id!==target.dataset.removeMeasurement);invalidate();changed();render();}
    if(target.hasAttribute('data-new-assessment')){
      stopTimer();const b=data().baseline;
      if(b.measurements.length&&validateBaseline(b).valid&&(!data().assessments.length||baselineSignature(data().assessments.at(-1))!==baselineSignature(b)))data().assessments.push(clone(b));
      data().baseline={assessedAt:today(),measurements:[]};invalidate();step='assess';audience='clinical';drafts.delete(data().id+':measurement');drafts.delete(data().id+':baseline');feedback('既往评估已保留，请在本次复评中重新录入实际测量值。');changed();render();
    }
    if(target.hasAttribute('data-start-timer'))startTimer(container.querySelector('[data-clinic-form="session"]'));
    if(target.hasAttribute('data-pause-timer')){if(timerRunning)stopTimer('已暂停，准备好后重新核对并开始。');else feedback('请先核对训练前读数，再开始或继续。');}
    if(target.hasAttribute('data-stop-timer')){stopTimer('引导已结束，请记录实际用时与训练后读数。');const form=container.querySelector('[data-clinic-form="session"]');if(form){form.phase.value='post';form.actualMinutes.value=(elapsed/60000).toFixed(2);remember(form);}timer=null;}
    if(target.hasAttribute('data-export-clinic')){
      const blob=new Blob([JSON.stringify({version:1,...data()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download='呼吸康复结构化记录.json';link.click();win.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    if(target.hasAttribute('data-clear-clinic')&&win.confirm('清除当前工作台病例、专业评估和训练记录？建议先导出备份。')){
      stopTimer();timer=null;elapsed=0;if(getContext().isDemo)demo=demoCase();else real=blankCase();feedback('当前工作台病例已清除。','ready');changed();render();
    }
  }
  async function change(event){
    const changedForm=event.target.closest('[data-clinic-form]');remember(changedForm);
    if(timerRunning&&changedForm?.dataset.clinicForm==='session'){
      if(event.target.name==='activity'){stopTimer('训练项目已切换，请重新核对并开始。');timer=null;elapsed=0;}
      else {const assessment=assessSession(readSession(changedForm),data().programme,context());if(assessment.status!=='ready'){stopTimer();feedback(assessment.reasons.join(' '),assessment.status);}}
    }
    if(event.target.matches('[name="kind"]')){
      const form=event.target.form,kind=event.target.value;form.unit.value=['mip','mep','snip'].includes(kind)?'cmH2O':kind==='six-minute-walk'?'m':kind==='sit-to-stand'?'repetitions':'mm';
      form.side.value=kind.startsWith('diaphragm-')?'right':'';form.maneuver.value=kind==='diaphragm-thickness'?'end-expiration':kind==='diaphragm-excursion'?'quiet':'';
      remember(form);
    }
    if(event.target.matches('[data-import-clinic]')){
      const file=event.target.files?.[0];if(!file)return;
      try{if(file.size>3000000)throw new Error('记录备份超过 3 MB，请核对文件。');const imported=importCase(JSON.parse(await file.text()),!!getContext().isDemo);if(!win.confirm('导入将替换当前工作台病例，是否继续？'))return;stopTimer();timer=null;elapsed=0;if(getContext().isDemo)demo=imported;else real=imported;feedback('记录已导入。使用前重新核对当前健康画像和方案状态。','ready');changed();render();}catch(error){feedback(error.message||'记录导入失败。');render();}
    }
  }
  const hidden=()=>{if(doc.hidden)stopTimer('页面隐藏，训练引导已暂停。');};
  container.addEventListener('submit',submit);container.addEventListener('click',click);container.addEventListener('change',change);container.addEventListener('input',input);doc.addEventListener('visibilitychange',hidden);
  render();
  return {
    refresh(mode='clinical'){stopTimer();audience=mode;step=mode==='patient'?'plan':step;render();},
    pause(){stopTimer();},
    syncPersistence(){save();},
    clear(){stopTimer();timer=null;elapsed=0;drafts.clear();message='';step='assess';real=blankCase();demo=null;save();render();},
    getSummary(){const p=data().programme;return {confirmed:p?.status==='confirmed'&&programmeState().valid,programme:p?clone(p):null,measurementCount:data().baseline.measurements.length,sessionCount:data().sessions.filter(s=>s.phase==='post').length};},
    seedDemo(){if(!getContext().isDemo)return;demo=demoCase();demo.programme={id:uid(),status:'draft',durationWeeks:8,frequencyPerWeek:3,aerobic:{mode:'interval',activity:'示例平地步行',intensity:'示例用力感 3/10；非患者默认剂量',minutes:15,workMinutes:1,restMinutes:1,supervision:'hybrid'},resistance:{exercises:'坐站、坐姿伸膝',reps:8,sets:2,load:0,unit:'徒手',daysPerWeek:2},imt:{enabled:true,deviceName:'模拟已核对训练器',load:18,unit:'cmH2O',minLoad:15,maxLoad:25,breaths:20,sets:2,daysPerWeek:5,deviceCompatible:true,mipMeasurementId:demo.baseline.measurements[0].id},monitoring:{spo2Min:90,hrMin:50,hrMax:130,borgMax:6},reviewAt:plusDays(14)};const approved=confirmProgramme(demo.programme,demo.baseline,context());if(approved.valid)demo.programme=approved.programme;render();onChange();},
    dispose(){disposed=true;stopTimer();container.removeEventListener('submit',submit);container.removeEventListener('click',click);container.removeEventListener('change',change);container.removeEventListener('input',input);doc.removeEventListener('visibilitychange',hidden);container.replaceChildren();}
  };
}
