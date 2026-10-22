const {store}=require('../../utils/store');
const {normalizeDailyRecord,evaluateDailyRecord,DAILY_TOPICS}=require('../../core/daily');
const {refresh,number,today}=require('../../utils/presentation');
const FLAG_ROWS=[{id:'chestPain',label:'胸痛'},{id:'severeBreathlessness',label:'严重气促，说不完整句子'},{id:'fainting',label:'晕厥或接近晕倒'},{id:'hemoptysis',label:'咯血或血痰'}];
const TB_ROWS=[{id:'persistentCough',label:'咳嗽持续两周以上或近期加重'},{id:'feverNightSweats',label:'低热或夜间盗汗'},{id:'weightLoss',label:'没有主动减重却体重下降'}];
Page({
  data:{senior:false,reducedMotion:false,storageError:'',step:0,day:'',topic:'copd',topicIndex:0,topics:DAILY_TOPICS.map(item=>item.name),statusComparedUsual:'',breathlessness:null,fatigue:null,ratingLabels:['请选择',...Array.from({length:11},(_,i)=>String(i))],redFlags:{chestPain:null,severeBreathlessness:null,fainting:null,hemoptysis:null},flagRows:[],sputumChange:null,tbSymptoms:{persistentCough:null,feverNightSweats:null,weightLoss:null},tbRows:[],ageGroup:'unknown',diagnosisConfirmed:null,extra:false,spo2:'',act:'',cat:'',ess:'',ftnd:'',scoreDate:'',error:'',outcome:null,saved:false,urgent:false},
  onLoad(){this._epoch=store.getEpoch();const result=refresh(this),profile=result.state.profile,day=today();let topic=DAILY_TOPICS.some(item=>item.id===profile?.disease)?profile.disease:'copd';this.setData({day,scoreDate:day,topic,topicIndex:DAILY_TOPICS.findIndex(item=>item.id===topic),ageGroup:profile?profile.age>=18?'adult':'minor':'unknown',diagnosisConfirmed:profile&&profile.disease===topic?true:null});this.sync();},
  onShow(){if(this._epoch!==undefined&&this._epoch!==store.getEpoch())this.onLocalDataCleared();refresh(this);},
  onLocalDataCleared(){this._epoch=store.getEpoch();this.setData({step:0,day:today(),topic:'copd',topicIndex:0,statusComparedUsual:'',breathlessness:null,fatigue:null,redFlags:{chestPain:null,severeBreathlessness:null,fainting:null,hemoptysis:null},sputumChange:null,tbSymptoms:{persistentCough:null,feverNightSweats:null,weightLoss:null},ageGroup:'unknown',diagnosisConfirmed:null,extra:false,spo2:'',act:'',cat:'',ess:'',ftnd:'',scoreDate:today(),error:'本机资料已清除，请重新填写。',outcome:null,saved:false,urgent:false});this.sync();},
  checkEpoch(){if(this._epoch!==store.getEpoch()){this.onLocalDataCleared();return false;}return true;},
  sync(){this.setData({flagRows:FLAG_ROWS.map(item=>({...item,value:this.data.redFlags[item.id]})),tbRows:TB_ROWS.map(item=>({...item,value:this.data.tbSymptoms[item.id]})),urgent:FLAG_ROWS.some(item=>this.data.redFlags[item.id]===true)});},
  topicChange(event){const index=Number(event.detail.value);if(DAILY_TOPICS[index])this.setData({topic:DAILY_TOPICS[index].id,topicIndex:index,diagnosisConfirmed:null,act:'',cat:'',ess:'',ftnd:'',error:''});},
  choice(event){const {field,value}=event.currentTarget.dataset;if(field==='statusComparedUsual')this.setData({statusComparedUsual:value,error:''});else if(field==='ageGroup')this.setData({ageGroup:value,error:''});else if(['diagnosisConfirmed','sputumChange'].includes(field))this.setData({[field]:value==='yes',error:''});},
  rating(event){const field=event.currentTarget.dataset.field,index=Number(event.detail.value);if(['breathlessness','fatigue'].includes(field)&&Number.isInteger(index)&&index>=0&&index<=11)this.setData({[field]:index===0?null:index-1,error:''});},
  setField(event){const field=event.currentTarget.dataset.field;if(['spo2','act','cat','ess','ftnd'].includes(field))this.setData({[field]:event.detail.value,error:''});},
  scoreDateChange(event){this.setData({scoreDate:event.detail.value,error:''});},
  flag(event){const {id,value,group}=event.currentTarget.dataset;const allowed=group==='tbSymptoms'?TB_ROWS:FLAG_ROWS;if(allowed.some(item=>item.id===id)){this.setData({[group+'.'+id]:value==='yes',error:''});this.sync();}},
  noFlags(){this.setData({redFlags:{chestPain:false,severeBreathlessness:false,fainting:false,hemoptysis:false},error:''});this.sync();},
  noTb(){this.setData({tbSymptoms:{persistentCough:false,feverNightSweats:false,weightLoss:false},error:''});this.sync();},
  toggleExtra(){this.setData({extra:!this.data.extra});},
  next(){
    if(!this.checkEpoch())return;
    let error='';if(this.data.step===0){if(!this.data.statusComparedUsual)error='请选择今天与平常相比的状态。';else if(this.data.ageGroup==='unknown')error='请确认年龄范围。';else if(this.data.topic!=='quit'&&typeof this.data.diagnosisConfirmed!=='boolean')error='请确认是否已有医护诊断。';}
    if(this.data.step===1&&(this.data.breathlessness===null||this.data.fatigue===null))error='请分别选择今天的气促和疲劳程度。';
    if(error){this.setData({error});return;}
    if(this.data.step<2){this.setData({step:this.data.step+1,error:''});wx.pageScrollTo({scrollTop:0,duration:0});}else this.save();
  },
  previous(){if(this.data.step>0)this.setData({step:this.data.step-1,error:''});},
  save(){
    if(!this.checkEpoch())return;
    if(this.data.saved)return;
    if(FLAG_ROWS.some(item=>typeof this.data.redFlags[item.id]!=='boolean')){this.setData({error:'请确认每项危险症状，或选择“以上都没有”。'});return;}
    if(typeof this.data.sputumChange!=='boolean'){this.setData({error:'请确认痰量或颜色是否有变化。'});return;}
    if(this.data.topic==='tb'&&TB_ROWS.some(item=>typeof this.data.tbSymptoms[item.id]!=='boolean')){this.setData({error:'请确认结核相关症状，或选择“这些症状都没有”。'});return;}
    const scores={act:number(this.data.act),cat:number(this.data.cat),ess:number(this.data.ess),ftnd:number(this.data.ftnd)};
    const raw={day:this.data.day,topic:this.data.topic,statusComparedUsual:this.data.statusComparedUsual,breathlessness:this.data.breathlessness,fatigue:this.data.fatigue,spo2:number(this.data.spo2),redFlags:this.data.redFlags,sputumChange:this.data.sputumChange,ageGroup:this.data.ageGroup,diagnosisConfirmed:this.data.diagnosisConfirmed,scores,scoreDate:this.data.scoreDate,tbSymptoms:this.data.topic==='tb'?this.data.tbSymptoms:{}};
    const normalized=normalizeDailyRecord(raw,{today:today()});if(!normalized.valid){this.setData({error:normalized.errors[0].message});return;}
    const result=store.saveDaily(raw);if(!result.ok){this.setData({error:result.message||'本机保存失败，请重试。'});return;}
    this.setData({saved:true,outcome:evaluateDailyRecord(normalized.record),error:''});wx.pageScrollTo({scrollTop:0,duration:0});
  },
  done(){wx.switchTab({url:'/pages/records/index'});}
});
