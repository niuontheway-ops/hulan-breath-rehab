// Structured clinical records. No automatic exercise dose, device conversion or efficacy score.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const blank = value => value == null || value === '';
const text = value => typeof value === 'string' && value.trim().length > 0;
const kinds = ['mip','mep','snip','diaphragm-excursion','diaphragm-thickness','six-minute-walk','sit-to-stand'];
const pressure = ['mip','mep','snip'];
const urgentSymptoms = ['chestPain','severeBreathlessness','fainting','hemoptysis'];
const symptoms = [...urgentSymptoms,'dizziness','worseSymptoms'];
const measurementFields = ['id','kind','value','unit','quality','method','posture','side','maneuver','protocol'];
const limits = {spo2Min:[1,100],hrMin:[1,300],hrMax:[1,300],borgMax:[0,10],dyspneaMax:[0,10],fatigueMax:[0,10]};
const clone = value => JSON.parse(JSON.stringify(value));
const stamp = value => {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
  const calendar=new Date(value.slice(0,10)+'T00:00:00Z');
  return !Number.isNaN(calendar.getTime())&&calendar.toISOString().slice(0,10)===value.slice(0,10);
};
const result = errors => ({valid:errors.length===0,errors});
const day = value => typeof value === 'string' ? value.slice(0,10) : '';
const contextDate = context => {
  const value=context.now??new Date();
  return value instanceof Date?value:new Date(value);
};
const calendarDay = date => {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');
};

function inRange(value,min,max,integer=false) {
  return finite(value) && value>=min && value<=max && (!integer || Number.isInteger(value));
}

function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(!object(value))return value;
  return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
}

/** Exact record snapshots detect changes; they are not authenticated clinical signatures. */
export function baselineSignature(baseline) {
  if(!object(baseline))return '';
  return JSON.stringify(canonical({assessedAt:baseline.assessedAt,measurements:(Array.isArray(baseline.measurements)?baseline.measurements:[]).map(item=>object(item)?Object.fromEntries(measurementFields.filter(key=>item[key]!==undefined).map(key=>[key,item[key]])):null)}));
}

export function programmeSignature(programme) {
  if(!object(programme))return '';
  const fields = ['id','durationWeeks','frequencyPerWeek','aerobic','resistance','imt','monitoring','reviewAt'];
  return JSON.stringify(canonical(Object.fromEntries(fields.filter(key=>programme[key]!==undefined).map(key=>[key,programme[key]]))));
}

export function contextSignature(context={}) {
  context=object(context)?context:{};
  return JSON.stringify(canonical({profile:context.profile??null,subjectId:context.subjectId??null}));
}

export function validateBaseline(baseline) {
  const errors=[];
  const add=(field,message)=>errors.push({field,message});
  if(!object(baseline))return result([{field:'baseline',message:'请先录入本次专业评估。'}]);
  if(!stamp(baseline.assessedAt))add('assessedAt','请填写本次评估的有效日期。');
  if(!Array.isArray(baseline.measurements))return result([...errors,{field:'measurements',message:'测量资料须为数组；未测量项目可以不添加。'}]);
  const ids=new Set();
  baseline.measurements.forEach((item,index)=>{
    const key=`measurements.${index}`;
    if(!object(item)){add(key,'请核对测量记录。');return;}
    if(!text(item.id)||ids.has(item.id))add(`${key}.id`,'每条测量需要不同的记录编号。');
    ids.add(item.id);
    if(!kinds.includes(item.kind))add(`${key}.kind`,'请选择受支持的测量项目。');
    if(!finite(item.value)||item.value<0||(['mip','mep','snip','diaphragm-thickness'].includes(item.kind)&&item.value===0))add(`${key}.value`,'请填实际测量值；压力按正的压力幅值记录，未测量不要填零。');
    if(!['acceptable','uncertain'].includes(item.quality))add(`${key}.quality`,'请标明质量与重复性是否已核对。');
    for(const field of ['method','posture','protocol'])if(!text(item[field]))add(`${key}.${field}`,'请记录测量方法、体位和具体协议，便于复评。');
    if(pressure.includes(item.kind)&&!['cmH2O','kPa'].includes(item.unit))add(`${key}.unit`,'压力单位仅记录 cmH2O 或 kPa，不自动转换。');
    if(typeof item.kind==='string'&&item.kind.startsWith('diaphragm-')){
      if(!['left','right'].includes(item.side))add(`${key}.side`,'膈肌测量请分别记录左侧或右侧。');
      if(!['quiet','deep','sniff','end-expiration','end-inspiration'].includes(item.maneuver))add(`${key}.maneuver`,'请记录平静、深呼吸、嗅吸或吸/呼气末动作。');
      if(!['mm','cm'].includes(item.unit))add(`${key}.unit`,'膈肌位移或厚度请按报告的 mm 或 cm 记录。');
    }
    if(item.kind==='six-minute-walk'&&item.unit!=='m')add(`${key}.unit`,'6 分钟步行距离请以 m 记录。');
    if(item.kind==='sit-to-stand'&&!['repetitions','seconds'].includes(item.unit))add(`${key}.unit`,'坐站测试请按具体协议记录次数或秒。');
    if(item.unit==='repetitions'&&finite(item.value)&&!Number.isInteger(item.value))add(`${key}.value`,'坐站次数须为实际完成的整数次数。');
  });
  return result(errors);
}

function contextErrors(context={}) {
  const errors=[];
  const add=message=>errors.push({field:'context',message});
  if(context.assessmentCurrent!==true)add('需核对当前评估；未提交的修改不能沿用旧确认。');
  if(context.clinicianAllowed!==true)add('需医护评估并允许目前的训练。');
  if(context.noRedFlags!==true||!object(context.profile?.redFlags)||urgentSymptoms.some(key=>context.profile.redFlags[key]!==false))add('需确认当前没有危险症状。');
  if(!object(context.profile)||!inRange(context.profile.age,18,120,true)||!['stable','recovering'].includes(context.profile.stability)||context.profile.clinicianCleared!==true)add('需有成人健康画像，确认目前病情稳定或加重后已稳定，且医护已允许训练。');
  if(Number.isNaN(contextDate(context).getTime()))add('无法确定当前日期，请核对设备日期。');
  return errors;
}

export function validateProgramme(programme,baseline,context={}) {
  context=object(context)?context:{};
  const errors=validateBaseline(baseline).errors.map(error=>({...error,field:`baseline.${error.field}`}));
  const add=(field,message)=>errors.push({field,message});
  if(!object(programme))return result([...errors,{field:'programme',message:'请先填写医护康复方案。'}]);
  errors.push(...contextErrors(context));
  if(!text(programme.id))add('id','请填写方案编号。');
  if(!['draft','confirmed'].includes(programme.status))add('status','方案状态只能为草稿或已确认。');
  if(!inRange(programme.durationWeeks,1,52,true))add('durationWeeks','方案周期须为 1–52 周整数，由医护填写。');
  if(!inRange(programme.frequencyPerWeek,1,14,true))add('frequencyPerWeek','每周频次须为 1–14 次整数，由医护填写。');
  const aerobic=programme.aerobic;
  if(!object(aerobic)||!['continuous','interval'].includes(aerobic.mode)||!inRange(aerobic.minutes,1,180))add('aerobic','请填写连续或间歇全身运动及每次分钟数。');
  if(!text(aerobic?.activity)||aerobic.activity.trim().length>120)add('aerobic.activity','请填写医护选定的实际耐力活动类型，最多 120 字。');
  if(!text(aerobic?.intensity)||aerobic.intensity.trim().length>300)add('aerobic.intensity','请填写医护确定的耐力强度目标与方法，最多 300 字；不从测试值自动推算。');
  if(aerobic?.mode==='interval'&&(!inRange(aerobic.workMinutes,0.1,180)||!inRange(aerobic.restMinutes,0.1,180)))add('aerobic.interval','间歇方案需要医护填写活动和恢复分钟数。');
  if(aerobic?.supervision!=null&&!['clinic','hybrid','telerehab'].includes(aerobic.supervision))add('aerobic.supervision','监督方式须选择院内、混合或远程康复。');
  if(context.supervisedOnly===true&&aerobic?.supervision!=='clinic')add('aerobic.supervision','当前评估需先采用院内医护监督的方案，不能开放自主居家训练。');
  if(programme.resistance!=null){
    const r=programme.resistance;
    if(!object(r)||!(text(r.exercises)||(Array.isArray(r.exercises)&&r.exercises.length>0&&r.exercises.every(text)))||!inRange(r.reps,1,100,true)||!inRange(r.sets,1,20,true)||!inRange(r.load,0,1000)||!text(r.unit))add('resistance','请完整记录抗阻动作、次数、组数和负荷单位；徒手负荷可记 0。');
    if(r?.daysPerWeek!=null&&!inRange(r.daysPerWeek,1,7,true))add('resistance.daysPerWeek','抗阻每周训练日须为 1–7 天整数，由医护填写。');
  }
  if(programme.imt!=null&&(!object(programme.imt)||typeof programme.imt.enabled!=='boolean'))add('imt.enabled','请明确是否启用医护确认的 IMT 辅助训练。');
  if(programme.imt?.enabled===true){
    const imt=programme.imt;
    const mip=baseline?.measurements?.find(item=>item.id===imt.mipMeasurementId&&item.kind==='mip');
    if(!mip||mip.quality!=='acceptable'||!finite(mip.value)||mip.value<=0)add('imt.mipMeasurementId','IMT 需有已核对质量与重复性的 MIP；SNIP 不能替代 MIP 配置负荷。');
    if(!finite(imt.load)||imt.load<=0||!['cmH2O','kPa','device-level'].includes(imt.unit))add('imt.load','请填医护确认的实际 IMT 负荷及单位，不自动使用 MIP 百分比或换算设备档位。');
    if(imt.deviceCompatible!==true)add('imt.deviceCompatible','需核对实际设备型号、负荷单位和适配性。');
    if(!inRange(imt.breaths,1,200,true)||!inRange(imt.sets,1,20,true)||!inRange(imt.daysPerWeek,1,7,true))add('imt.dose','IMT 需要医护明确每组呼吸次数、组数和每周训练日。');
    if(!blank(imt.minutes)&&!inRange(imt.minutes,0.1,180))add('imt.minutes','请核对医护记录的 IMT 训练分钟数。');
    if(!finite(imt.minLoad)||imt.minLoad<0)add('imt.minLoad','请填写医护规定的负荷下限。');
    if(!finite(imt.maxLoad)||imt.maxLoad<=0)add('imt.maxLoad','请填写医护规定的负荷上限。');
    if(finite(imt.minLoad)&&finite(imt.maxLoad)&&imt.minLoad>imt.maxLoad)add('imt.range','负荷下限不能超过上限。');
    if((finite(imt.minLoad)&&imt.load<imt.minLoad)||(finite(imt.maxLoad)&&imt.load>imt.maxLoad))add('imt.load','实际负荷超出医护记录范围。');
  }
  const monitoring=programme.monitoring;
  if(!object(monitoring)||!Object.keys(limits).some(key=>!blank(monitoring[key])))add('monitoring','请由医护设置至少一项个体监测界限；空白不能解释为正常。');
  if(object(monitoring))for(const [key,[min,max]] of Object.entries(limits))if(!blank(monitoring[key])&&!inRange(monitoring[key],min,max))add(`monitoring.${key}`,'请核对个体监测界限的有效数值与量纲。');
  if(finite(monitoring?.hrMin)&&finite(monitoring?.hrMax)&&monitoring.hrMin>monitoring.hrMax)add('monitoring.hr','心率下限不能高于上限。');
  if(!stamp(programme.reviewAt)||day(programme.reviewAt)<day(baseline?.assessedAt))add('reviewAt','复评日期须有效，且不能早于本次基线评估。');
  const now=contextDate(context);
  if(!Number.isNaN(now.getTime())){
    const today=calendarDay(now);
    if(stamp(baseline?.assessedAt)&&day(baseline.assessedAt)>today)add('baseline.assessedAt','基线评估不能填写未来日期。');
    if(stamp(programme.reviewAt)&&day(programme.reviewAt)<today)add('reviewAt','方案已到复评日期之后，请先复核并更新方案。');
  }
  if(programme.status==='confirmed'){
    if(!stamp(programme.confirmedAt))add('confirmedAt','已确认方案需要本机确认时间。');
    if(programme.baselineSignature!==baselineSignature(baseline))add('baselineSignature','基线已更改，请重新复核并确认方案。');
    if(programme.programmeSignature!==programmeSignature(programme))add('programmeSignature','方案剂量或监测条件已更改，请重新确认。');
    if(programme.contextSignature!==contextSignature(context))add('contextSignature','病例或健康画像已更改，请重新复核并确认方案。');
  }
  return result(errors);
}

/** The confirmation records a local clinician declaration, not a verified professional account. */
export function confirmProgramme(programme,baseline,context={}) {
  context=object(context)?context:{};
  const draft=object(programme)?{...programme,status:'draft'}:programme;
  const validation=validateProgramme(draft,baseline,context);
  const now=context.now??new Date();
  const date=now instanceof Date?now:new Date(now);
  if(Number.isNaN(date.getTime()))return result([...validation.errors,{field:'confirmedAt',message:'无法确定确认时间。'}]);
  if(!validation.valid)return validation;
  const confirmed=clone(draft);
  confirmed.status='confirmed';confirmed.confirmedAt=date.toISOString();
  confirmed.baselineSignature=baselineSignature(baseline);confirmed.programmeSignature=programmeSignature(confirmed);
  confirmed.contextSignature=contextSignature(context);
  return {...validation,programme:confirmed};
}

export function assessSession(session,programme,context={}) {
  context=object(context)?context:{};
  const flags=urgentSymptoms.filter(key=>session?.symptoms?.[key]===true||context.profile?.redFlags?.[key]===true);
  if(flags.length)return {status:'urgent',reasons:['出现胸痛、严重呼吸困难、晕厥或咯血，应立即停止并寻求急救。']};
  if(session?.symptoms?.dizziness===true||session?.symptoms?.worseSymptoms===true)return {status:'stop',reasons:['本次有头晕或症状加重，请停止并联系医护复核。']};
  const validation=validateProgramme(programme,context.baseline,context);
  const reasons=validation.errors.map(error=>error.message);
  if(programme?.status!=='confirmed')reasons.push('需使用经本机医护声明确认的方案；草稿不能作为训练依据。');
  if(!object(session))return {status:'review',reasons:[...reasons,'请填写本次实际训练与监测记录。']};
  if(session.programmeId!==programme?.id)reasons.push('本次记录与当前方案编号不一致。');
  if(programme?.aerobic?.supervision==='clinic'&&session.supervised!==true)reasons.push('院内监督方案需明确本次有现场医护监督；不能仅凭网页自行开始。');
  if(session.activity!=null&&!['aerobic','resistance','imt'].includes(session.activity))reasons.push('训练项目须为已确认方案中的耐力、力量或吸气肌训练。');
  if(session.activity==='resistance'&&!object(programme?.resistance))reasons.push('方案未加入力量训练，需先由医护复核。');
  if(session.activity==='imt'&&programme?.imt?.enabled!==true)reasons.push('方案未启用吸气肌训练，需先由医护复核。');
  if(session.activity==='imt'&&(blank(session.load)||!finite(session.load)||session.load<=0))reasons.push('吸气肌训练需填写实际负荷，按本方案原单位记录，不换算设备档位。');
  if(!stamp(session.observedAt))reasons.push('请填写本次实际监测时间。');
  const now=contextDate(context);
  if(stamp(session.observedAt)&&!Number.isNaN(now.getTime())&&day(session.observedAt)>calendarDay(now))reasons.push('实际监测不能填写未来日期。');
  if(session.phase!=null&&!['pre','during','post'].includes(session.phase))reasons.push('监测阶段须为训练前、中或后。');
  if(!inRange(session.actualMinutes,0,240))reasons.push('请核对实际训练分钟数，未完成可填 0。');
  if(!object(session.symptoms)||symptoms.some(key=>typeof session.symptoms[key]!=='boolean'))reasons.push('请逐项确认本次危险症状、头晕和症状加重情况。');
  const ranges={spo2:[1,100],hr:[1,300],borg:[0,10],dyspnea:[0,10],fatigue:[0,10],reps:[0,10000],load:[0,10000]};
  for(const [key,[min,max]] of Object.entries(ranges))if(!blank(session[key])&&!inRange(session[key],min,max))reasons.push(`请核对 ${key} 的实际读数，未测量请留空。`);
  const monitoring=programme?.monitoring||{};
  const required={spo2Min:'spo2',hrMin:'hr',hrMax:'hr',borgMax:'borg',dyspneaMax:'dyspnea',fatigueMax:'fatigue'};
  for(const measurement of new Set(Object.entries(required).filter(([limit])=>!blank(monitoring[limit])).map(([,measurement])=>measurement)))if(blank(session[measurement]))reasons.push(`方案已设置 ${measurement} 界限，本次缺少对应读数，不能判断在范围内。`);
  const stopped=[];
  if(validation.valid&&programme?.status==='confirmed'&&session.activity==='imt'&&programme.imt?.enabled===true&&finite(session.load)&&((finite(programme.imt.minLoad)&&session.load<programme.imt.minLoad)||(finite(programme.imt.maxLoad)&&session.load>programme.imt.maxLoad)))stopped.push('实际吸气肌训练负荷超出本方案医护填写的范围，请停止并复核。');
  for(const [limit,measurement] of Object.entries(required)){
    if(!validation.valid||programme?.status!=='confirmed'||!finite(monitoring[limit])||!finite(session[measurement]))continue;
    const outside=limit.endsWith('Min')?session[measurement]<monitoring[limit]:session[measurement]>monitoring[limit];
    if(outside)stopped.push(`${measurement} 超出本方案医护填写的界限，请停止并复核；不要自行调氧或加量。`);
  }
  if(stopped.length)return {status:'stop',reasons:[...stopped,...new Set(reasons)]};
  if(reasons.length)return {status:'review',reasons:[...new Set(reasons)]};
  return stopped.length?{status:'stop',reasons:stopped}:{status:'ready',reasons:['已记录；现有读数未超出本方案已填写的界限。未设置或未测量的指标不作正常判断。']};
}

/** Match the entire measurement protocol; no cross-unit, cross-side or cross-method pooling. */
export function compareAssessments(before,after) {
  if(!validateBaseline(before).valid||!validateBaseline(after).valid)return [];
  const identity=item=>JSON.stringify([item.kind,item.unit,item.method,item.posture,item.side??null,item.maneuver??null,item.protocol]);
  return after.measurements.map(item=>{
    const candidates=before.measurements.filter(previous=>identity(previous)===identity(item));
    const previous=candidates.length===1?candidates[0]:null;
    const comparable=previous!==null&&after.measurements.filter(current=>identity(current)===identity(item)).length===1&&item.quality==='acceptable'&&previous.quality==='acceptable'&&day(after.assessedAt)>=day(before.assessedAt);
    return {kind:item.kind,before:previous?.value??null,after:item.value,delta:comparable?item.value-previous.value:null,unit:item.unit,side:item.side??null,method:item.method,posture:item.posture,maneuver:item.maneuver??null,protocol:item.protocol,comparable,reason:comparable?'同协议测量变化；不等同于临床疗效或自动进阶依据。':candidates.length>1?'有多个同协议基线，需先指定对应记录。':'测量协议、质量或日期不匹配，不比较改善程度。'};
  });
}

export function summarizeSessions(sessions,programme) {
  const records=Array.isArray(sessions)?sessions.filter(item=>object(item)&&item.programmeId===programme?.id&&(item.phase==null||item.phase==='post')&&inRange(item.actualMinutes,0,240)):[];
  const plannedSessions=finite(programme?.durationWeeks)&&finite(programme?.frequencyPerWeek)?programme.durationWeeks*programme.frequencyPerWeek:null;
  return {recordedSessions:records.length,activeSessions:records.filter(item=>item.actualMinutes>0).length,actualMinutes:records.reduce((total,item)=>total+item.actualMinutes,0),plannedSessions,completionRatio:plannedSessions?Math.min(1,records.filter(item=>item.actualMinutes>0).length/plannedSessions):null,interpretation:'完成记录仅表示手工记录的参与情况；效果需要同协议复评和医护判断，不自动加量。'};
}
