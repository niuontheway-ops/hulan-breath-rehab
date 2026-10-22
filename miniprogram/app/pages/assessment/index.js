const {store}=require('../../utils/store');
const {validateProfile}=require('../../core/clinical');
const {refresh,notice,number,today}=require('../../utils/presentation');
const FLAGS=[{id:'chestPain',label:'胸痛'},{id:'severeBreathlessness',label:'严重气促，说不完整句子'},{id:'fainting',label:'晕厥或接近晕倒'},{id:'hemoptysis',label:'咯血或痰中带血'}];
const DISEASES=[{id:'copd',label:'慢阻肺'},{id:'asthma',label:'哮喘'},{id:'bronchiectasis',label:'支气管扩张'},{id:'other',label:'其他 / 尚未明确'}];
const STABILITY=[{id:'stable',label:'目前稳定',detail:'没有新发或明显加重的症状'},{id:'recovering',label:'急性加重后已稳定',detail:'例如慢阻肺加重后，已由医护判断稳定'},{id:'worse',label:'正在加重',detail:'先记录，暂不训练'},{id:'unknown',label:'还不确定',detail:'请医护帮忙确认'}];
const GOALS=[{id:'daily',label:'日常活动轻松些'},{id:'endurance',label:'改善活动耐力'},{id:'breathing',label:'熟悉舒适呼吸'}];
const TITLES=['你今年多大？','医护确认的疾病是？','现在的状态怎样？','医护允许当前训练吗？','有没有这些不适？','已有专业评分吗？','有肺功能和血氧结果吗？','这次更想做什么？','核对后保存到手机'];
const empty=()=>({age:'',disease:'',stability:'',clinicianCleared:null,redFlags:{chestPain:null,severeBreathlessness:null,fainting:null,hemoptysis:null},dyspneaScale:null,dyspneaScore:'',act:'',cat:'',fev1Percent:'',fev1Fvc:'',spo2:'',goal:''});
Page({
  data:{senior:false,reducedMotion:false,storageError:'',step:0,stepTitle:TITLES[0],progress:11,draft:empty(),diseases:DISEASES,stabilities:STABILITY,goals:GOALS,flags:FLAGS,flagRows:[],error:'',urgent:false,scaleIndex:0,scaleNames:['mMRC（0–4）','MRC（1–5）'],hasOld:false,summary:[]},
  onLoad(){
    this._epoch=store.getEpoch();
    const loaded=refresh(this),profile=loaded.state.profile;
    if(profile){const draft={...empty(),...profile};for(const field of ['age','dyspneaScore','act','cat','fev1Percent','fev1Fvc','spo2'])draft[field]=profile[field]===null||profile[field]===undefined?'':String(profile[field]);this.setData({draft,hasOld:true,scaleIndex:profile.dyspneaScale==='mrc'?1:0});}
    this.syncFlags();
  },
  onShow(){if(this._epoch!==undefined&&this._epoch!==store.getEpoch())this.onLocalDataCleared();refresh(this);},
  onLocalDataCleared(){this._epoch=store.getEpoch();this.setData({step:0,stepTitle:TITLES[0],progress:11,draft:empty(),scaleIndex:0,error:'本机资料已清除，请重新填写。',summary:[],hasOld:false});this.syncFlags();},
  checkEpoch(){if(this._epoch!==store.getEpoch()){this.onLocalDataCleared();return false;}return true;},
  syncFlags(){const flags=this.data.draft.redFlags;this.setData({flagRows:FLAGS.map(item=>({...item,value:flags[item.id]})),urgent:FLAGS.some(item=>flags[item.id]===true)});},
  setField(event){const field=event.currentTarget.dataset.field;if(!['age','act','cat','dyspneaScore','fev1Percent','fev1Fvc','spo2'].includes(field))return;this.setData({['draft.'+field]:event.detail.value,error:''});},
  choose(event){const {field,value}=event.currentTarget.dataset;if(!['disease','stability','goal'].includes(field))return;const changed=field==='disease'&&value!==this.data.draft.disease;this.setData({['draft.'+field]:value,...(changed?{'draft.act':'','draft.cat':''}:{}),error:''});},
  choosePermission(event){this.setData({'draft.clinicianCleared':event.currentTarget.dataset.value==='yes',error:''});},
  chooseFlag(event){const {id,value}=event.currentTarget.dataset;if(!FLAGS.some(item=>item.id===id))return;this.setData({['draft.redFlags.'+id]:value==='yes',error:''});this.syncFlags();},
  noFlags(){this.setData({'draft.redFlags':{chestPain:false,severeBreathlessness:false,fainting:false,hemoptysis:false},error:''});this.syncFlags();},
  chooseScale(event){const index=Number(event.detail.value);this.setData({scaleIndex:index,'draft.dyspneaScale':index===1?'mrc':'mmrc',error:''});},
  profile(){const d=this.data.draft;return{age:number(d.age),disease:d.disease,stability:d.stability,clinicianCleared:d.clinicianCleared,redFlags:{...d.redFlags},dyspneaScale:d.dyspneaScore===''?null:(this.data.scaleIndex===1?'mrc':'mmrc'),dyspneaScore:number(d.dyspneaScore),act:d.disease==='asthma'?number(d.act):null,cat:d.disease==='copd'?number(d.cat):null,fev1Percent:number(d.fev1Percent),fev1Fvc:number(d.fev1Fvc),spo2:number(d.spo2),assessmentDate:today(),goal:d.goal};},
  stepError(){
    const step=this.data.step,p=this.profile();
    if(step===0&&(!Number.isInteger(p.age)||p.age<1||p.age>120))return'请填写 1–120 的整数年龄。';
    if(step===1&&!DISEASES.some(item=>item.id===p.disease))return'请选择疾病类别。';
    if(step===2&&!STABILITY.some(item=>item.id===p.stability))return'请选择目前的状态。';
    if(step===3&&typeof p.clinicianCleared!=='boolean')return'请选择医护是否允许。';
    if(step===4&&FLAGS.some(item=>typeof p.redFlags[item.id]!=='boolean'))return'请逐项确认，或选择“以上都没有”。';
    if(step===7&&!GOALS.some(item=>item.id===p.goal))return'请选择当前目标。';
    const allowed=step===5?['dyspneaScore','dyspneaScale','act','cat']:step===6?['fev1Percent','fev1Fvc','spo2']:[];
    return validateProfile(p).errors.find(error=>allowed.includes(error.field))?.message||'';
  },
  showStep(step){
    const p=this.profile();const summary=[['年龄',p.age+' 岁'],['疾病',DISEASES.find(item=>item.id===p.disease)?.label||'未选择'],['目前状态',STABILITY.find(item=>item.id===p.stability)?.label||'未选择'],['医护允许',p.clinicianCleared?'已获允许':'尚未允许'],['专业评分',p.dyspneaScore===null&&p.act===null&&p.cat===null?'暂未提供':'已填写已有结果'],['危险症状',FLAGS.filter(item=>p.redFlags[item.id]).map(item=>item.label).join('、')||'已明确无上述症状']].map(([label,value])=>({label,value}));
    this.setData({step,stepTitle:TITLES[step],progress:Math.round((step+1)/TITLES.length*100),error:'',summary});wx.pageScrollTo({scrollTop:0,duration:0});
  },
  next(){if(!this.checkEpoch())return;const error=this.stepError();if(error){this.setData({error});return;}if(this.data.step<8)this.showStep(this.data.step+1);else this.save();},
  previous(){if(this.data.step>0)this.showStep(this.data.step-1);},
  skip(){if(this.data.step===5)this.setData({scaleIndex:0,'draft.dyspneaScale':null,'draft.dyspneaScore':'','draft.act':'','draft.cat':''});else if(this.data.step===6)this.setData({'draft.fev1Percent':'','draft.fev1Fvc':'','draft.spo2':''});else return;this.showStep(this.data.step+1);},
  reports(){wx.navigateTo({url:'/pages/reports/index'});},
  save(){
    if(!this.checkEpoch())return;
    const profile=this.profile(),validation=validateProfile(profile);if(!validation.valid){this.setData({error:validation.errors[0].message});return;}
    const result=store.saveProfile(profile);if(!result.ok){this.setData({error:result.message||'保存失败，资料仍在本页，请重试。'});return;}
    wx.showToast({title:'已保存在本机',icon:'success'});wx.redirectTo({url:'/pages/plan/index'});
  }
});
