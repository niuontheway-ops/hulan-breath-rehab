import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBaseline,validateProgramme,confirmProgramme,assessSession,compareAssessments,summarizeSessions,baselineSignature} from '../rehab-program.mjs';

const copy = value => structuredClone(value);
const measurement = (overrides={}) => ({id:'mip-1',kind:'mip',value:60,unit:'cmH2O',quality:'acceptable',method:'mouth-pressure',posture:'seated',protocol:'repeatability reviewed',...overrides});
const baseline = () => ({assessedAt:'2026-10-18',measurements:[measurement()]});
const programme = () => ({id:'programme-1',status:'draft',durationWeeks:8,frequencyPerWeek:3,aerobic:{activity:'合成测试平地步行',intensity:'合成目标：Borg 2–3，按医护评估执行',mode:'interval',minutes:20,workMinutes:2,restMinutes:1},resistance:{exercises:'坐站',reps:8,sets:2,load:0,unit:'bodyweight'},imt:{enabled:false},monitoring:{spo2Min:90,hrMax:120,borgMax:4},reviewAt:'2026-11-15'});
const context = (b=baseline()) => ({baseline:b,subjectId:'case-1',profile:{age:65,disease:'copd',stability:'stable',clinicianCleared:true,redFlags:{chestPain:false,severeBreathlessness:false,fainting:false,hemoptysis:false}},assessmentCurrent:true,clinicianAllowed:true,noRedFlags:true,now:new Date('2026-10-18T09:00:00Z')});
const session = () => ({programmeId:'programme-1',observedAt:'2026-10-18T09:30:00Z',actualMinutes:18,spo2:95,hr:100,borg:3,symptoms:{chestPain:false,severeBreathlessness:false,fainting:false,hemoptysis:false,dizziness:false,worseSymptoms:false}});
const confirmed = (p=programme(),b=baseline()) => confirmProgramme(p,b,context(b)).programme;

test('unmeasured metrics remain absent; malformed units and impossible dates are rejected',()=>{
  assert.equal(validateBaseline({assessedAt:'2026-10-18',measurements:[]}).valid,true);
  assert.equal(validateBaseline({assessedAt:'2026-02-30',measurements:[]}).valid,false);
  assert.equal(validateBaseline({assessedAt:'2026-10-18',measurements:[measurement({unit:'device-level'})]}).valid,false);
  assert.equal(validateBaseline({assessedAt:'2026-10-18',measurements:[{id:'broken'}]}).valid,false);
  assert.doesNotThrow(()=>validateProgramme({...programme(),status:'confirmed'}, {assessedAt:'bad',measurements:null},context()));
});

test('confirmation requires current assessment, clinician permission and no red flags',()=>{
  for(const field of ['assessmentCurrent','clinicianAllowed','noRedFlags']){
    const input={...context(),[field]:false};
    const output=confirmProgramme(programme(),baseline(),input);
    assert.equal(output.valid,false,field);assert.equal(output.programme,undefined);
  }
  assert.equal(confirmProgramme(programme(),baseline(),{...context(),profile:{age:65,stability:'stable',redFlags:{chestPain:true}}}).valid,false);
  assert.equal(assessSession(session(),programme(),context()).status,'review');
});

test('confirmation records a local timestamp and preserves the manually entered dose',()=>{
  const p=programme();const output=confirmProgramme(p,baseline(),context());
  assert.equal(output.valid,true);assert.equal(output.programme.status,'confirmed');
  assert.equal(output.programme.confirmedAt,'2026-10-18T09:00:00.000Z');
  assert.deepEqual(output.programme.aerobic,p.aerobic);assert.equal(p.status,'draft');
  assert.equal(validateProgramme(output.programme,baseline(),context()).valid,true);
  const noMuscleTests={assessedAt:'2026-10-18',measurements:[]};
  assert.equal(confirmProgramme(p,noMuscleTests,context(noMuscleTests)).valid,true);
});

test('aerobic prescriptions require clinician-entered activity and intensity instead of inferring them from tests',()=>{
  for(const field of ['activity','intensity']){
    const p=programme();delete p.aerobic[field];
    assert.equal(confirmProgramme(p,baseline(),context()).valid,false,field);
  }
  const p=programme();p.aerobic.intensity='x'.repeat(301);
  assert.equal(confirmProgramme(p,baseline(),context()).valid,false);
});

test('baseline, profile, subject or programme edits invalidate an existing confirmation',()=>{
  const b=baseline();const p=confirmed(programme(),b);
  const changed=copy(b);changed.measurements[0].value=65;
  assert.notEqual(baselineSignature(changed),baselineSignature(b));
  assert.equal(validateProgramme(p,changed,context(changed)).valid,false);
  assert.equal(assessSession(session(),p,context(changed)).status,'review');
  const revised=copy(p);revised.aerobic.minutes=25;
  assert.equal(validateProgramme(revised,b,context(b)).valid,false);
  assert.equal(confirmProgramme(revised,b,context(b)).valid,true);
  const differentProfile=context(b);differentProfile.profile.age=66;
  assert.equal(validateProgramme(p,b,differentProfile).valid,false);
  assert.equal(validateProgramme(p,b,{...context(b),subjectId:'case-2'}).valid,false);
});

test('IMT requires a reliable MIP and device adaptation, never substituting SNIP or an automatic percentage',()=>{
  const p=programme();p.imt={enabled:true,mipMeasurementId:'mip-1',load:2,minLoad:1,maxLoad:3,unit:'device-level',deviceCompatible:true,breaths:12,sets:2,daysPerWeek:5};
  const output=confirmProgramme(p,baseline(),context());
  assert.equal(output.valid,true);assert.deepEqual(output.programme.imt,p.imt);
  for(const change of [{kind:'snip'},{quality:'uncertain'}]){
    const b={assessedAt:'2026-10-18',measurements:[measurement(change)]};
    assert.equal(confirmProgramme(p,b,context(b)).valid,false);
  }
  const incompatible=copy(p);incompatible.imt.deviceCompatible=false;
  assert.equal(confirmProgramme(incompatible,baseline(),context()).valid,false);
  const omitted=copy(p);delete omitted.imt.load;
  assert.equal(confirmProgramme(omitted,baseline(),context()).valid,false);
  for(const field of ['minLoad','maxLoad','breaths','sets','daysPerWeek']){
    const missing=copy(p);delete missing.imt[field];
    assert.equal(confirmProgramme(missing,baseline(),context()).valid,false,field);
  }
});

test('an adult profile and present-day baseline/review validity cannot be replaced by booleans',()=>{
  const c=context();delete c.profile;
  assert.equal(confirmProgramme(programme(),baseline(),c).valid,false);
  const future=baseline();future.assessedAt='2026-10-19';
  assert.equal(confirmProgramme(programme(),future,context(future)).valid,false);
  const old=programme();old.reviewAt='2026-10-17';
  assert.equal(confirmProgramme(old,baseline(),context()).valid,false);
  const p=confirmed();
  assert.equal(assessSession(session(),p,{...context(),now:new Date('2026-11-16T09:00:00Z')}).status,'review');
});

test('greater stable disease severity permits clinician-supervised PR without opening unsupervised training',()=>{
  const c=context();c.supervisedOnly=true;c.profile={...c.profile,fev1Percent:25,dyspneaScale:'mmrc',dyspneaScore:3};
  const home=programme();home.aerobic.supervision='hybrid';
  assert.equal(confirmProgramme(home,baseline(),c).valid,false);
  const clinic=copy(home);clinic.aerobic.supervision='clinic';
  const output=confirmProgramme(clinic,baseline(),c);assert.equal(output.valid,true);
  assert.equal(assessSession(session(),output.programme,c).status,'review');
  assert.equal(assessSession({...session(),supervised:true},output.programme,c).status,'ready');
  assert.equal(assessSession({...session(),supervised:true,symptoms:{...session().symptoms,chestPain:true}},output.programme,c).status,'urgent');
});

test('explicitly absent monitoring limits or missing configured readings cannot be labelled normal',()=>{
  const p=programme();p.monitoring={};
  assert.equal(confirmProgramme(p,baseline(),context()).valid,false);
  const s=session();delete s.spo2;
  assert.equal(assessSession(s,confirmed(),context()).status,'review');
  const noOxygen=programme();noOxygen.monitoring={borgMax:4};
  const q=confirmed(noOxygen);delete s.hr;
  assert.equal(assessSession(s,q,context()).status,'ready');
});

test('individual limits govern monitoring; no universal SpO2 threshold is inserted',()=>{
  const p=confirmed();const s=session();s.spo2=91;
  assert.equal(assessSession(s,p,context()).status,'ready');
  s.spo2=89;assert.equal(assessSession(s,p,context()).status,'stop');
  delete s.hr;assert.equal(assessSession(s,p,context()).status,'stop');
  s.spo2=90;s.hr=120;assert.equal(assessSession(s,p,context()).status,'ready');
});

test('red flags and new symptoms take precedence over incomplete records and stale plans',()=>{
  assert.equal(assessSession({symptoms:{chestPain:true}},null,{}).status,'urgent');
  assert.equal(assessSession({symptoms:{dizziness:true}},null,{}).status,'stop');
  assert.equal(assessSession(session(),confirmed(),{...context(),profile:{redFlags:{hemoptysis:true}}}).status,'urgent');
});

test('monitoring only accepts enabled activities and the original-unit IMT load range',()=>{
  const p=confirmed();
  assert.equal(assessSession({...session(),activity:'imt',load:2},p,context()).status,'review');
  assert.equal(assessSession({...session(),activity:'unsupported'},p,context()).status,'review');
  assert.equal(assessSession({...session(),phase:'unknown'},p,context()).status,'review');
  const noResistance=programme();noResistance.resistance=null;
  assert.equal(assessSession({...session(),activity:'resistance'},confirmed(noResistance),context()).status,'review');
  const q=programme();q.imt={enabled:true,mipMeasurementId:'mip-1',load:2,minLoad:1,maxLoad:3,unit:'device-level',deviceCompatible:true,breaths:12,sets:2,daysPerWeek:5};
  const approved=confirmed(q);
  assert.equal(assessSession({...session(),activity:'imt'},approved,context()).status,'review');
  assert.equal(assessSession({...session(),activity:'imt',load:2},approved,context()).status,'ready');
  const high={...session(),activity:'imt',load:4};delete high.hr;
  assert.equal(assessSession(high,approved,context()).status,'stop');
  assert.equal(assessSession({...session(),activity:'imt',load:0.5},approved,context()).status,'stop');
});

test('review comparisons require identical unit, side, posture, method, maneuver and protocol',()=>{
  const d=measurement({id:'right-diaphragm',kind:'diaphragm-excursion',value:20,unit:'mm',side:'right',maneuver:'quiet',method:'ultrasound',protocol:'quiet tidal M mode'});
  const b={assessedAt:'2026-10-18',measurements:[d]};
  const a={assessedAt:'2026-11-18',measurements:[{...d,id:'right-review',value:23}]};
  assert.equal(compareAssessments(b,a)[0].delta,3);
  for(const change of [{unit:'cm'},{side:'left'},{posture:'supine'},{method:'ultrasound-2'},{maneuver:'deep'},{protocol:'different'}]){
    const altered=copy(a);Object.assign(altered.measurements[0],change);
    const output=compareAssessments(b,altered)[0];assert.equal(output.comparable,false);assert.equal(output.delta,null);
  }
  const uncertain=copy(a);uncertain.measurements[0].quality='uncertain';
  assert.equal(compareAssessments(b,uncertain)[0].comparable,false);
});

test('ambiguous repeated protocols cannot be matched automatically',()=>{
  const b=baseline();b.measurements.push(measurement({id:'mip-repeat'}));
  assert.equal(compareAssessments(b,{...baseline(),assessedAt:'2026-11-18'})[0].comparable,false);
});

test('participation summary excludes unrelated records and does not generate an efficacy score or progression',()=>{
  const p=confirmed();const output=summarizeSessions([session(),{...session(),phase:'during'},{...session(),phase:'pre',actualMinutes:0},{...session(),programmeId:'other'},{...session(),actualMinutes:0}],p);
  assert.equal(output.recordedSessions,2);assert.equal(output.activeSessions,1);assert.equal(output.actualMinutes,18);
  assert.equal(output.plannedSessions,24);assert.equal(output.completionRatio,1/24);
  assert.equal(output.efficacyScore,undefined);assert.equal(output.nextLoad,undefined);
});
