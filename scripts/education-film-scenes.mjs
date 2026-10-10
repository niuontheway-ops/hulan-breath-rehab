import {readFileSync,existsSync} from 'node:fs';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageCache=new Map();
function sceneImage(name){
  if(imageCache.has(name))return imageCache.get(name);
  const file=new URL(`../assets/education-scenes/${name}.webp`,import.meta.url);
  if(!existsSync(file))throw new Error('Missing film artwork: '+name);
  const src='data:image/webp;base64,'+readFileSync(file).toString('base64');imageCache.set(name,src);return src;
}
function imageFor(spec,id,index){
  if(spec.kind==='help')return 'support-call';
  if(id==='tb'&&spec.kind==='clinic')return 'ventilation';
  if(spec.kind==='sleep')return 'sleep-pap';
  if(spec.kind==='meal')return 'nutrition';
  if(spec.kind==='vent')return 'ventilation';
  if(spec.kind==='walk')return 'garden';
  if(spec.kind==='meds'&&['copd','asthma'].includes(id))return 'medication';
  if(spec.kind==='clinic')return 'clinic';
  if(spec.kind==='work')return 'occupational-care';
  if(spec.kind==='oxygen')return 'oxygen-care';
  if(spec.kind==='breath'||spec.kind==='rest')return 'supported-rest';
  if(spec.kind==='travel')return 'travel-planning';
  return 'daily-record';
}

// Each shot has a separate setting and a small, content-specific visual action.
export const FILM_SCENE_SPEC = Object.freeze({
  copd: [
    {kind:'clinic',title:'把呼吸照护，融入每一天',tags:['长期管理','规律治疗','适合自己的康复'],prop:'inhaler'},
    {kind:'meds',title:'药用对，才能更安心',tags:['按医嘱吸入','复诊演示方法','含激素药后漱口'],prop:'inhaler'},
    {kind:'walk',title:'稳定后，从轻量活动开始',tags:['医护评估','循序渐进','分段休息'],prop:'bench'},
    {kind:'help',title:'和平时不一样，及时求助',tags:['气促加重','痰量或痰色改变','严重不适拨打120'],prop:'lungs'}
  ],
  asthma: [
    {kind:'clinic',title:'呼吸好时，也要规范治疗',tags:['症状会波动','规范抗炎','练习只作辅助'],prop:'inhaler'},
    {kind:'meds',title:'随身带好，自己的行动计划',tags:['个人处方','核对方法与余量','带好缓解药'],prop:'plan'},
    {kind:'journal',title:'记录变化，避开明确诱因',tags:['夜间症状','活动受限','尽早复诊'],prop:'smoke'},
    {kind:'help',title:'发作不缓解，别硬撑',tags:['遵循行动计划','紧急就医','危险信号拨打120'],prop:'lungs'}
  ],
  bronchiectasis: [
    {kind:'clinic',title:'学会排痰，照顾好气道',tags:['专业示范','个人方法','不靠猛咳'],prop:'tissue'},
    {kind:'breath',title:'轻柔练习，按计划排痰',tags:['适合自己的姿势','按指导练习','装置清洁晾干'],prop:'tissue'},
    {kind:'monitor',title:'发现变化，尽早联系医护',tags:['痰量与痰色','气促与体温','抗生素遵医嘱'],prop:'thermometer'},
    {kind:'help',title:'新咯血，先暂停训练',tags:['停止排痰和训练','及时就医','出血增多立即呼救'],prop:'tissue'}
  ],
  lungcancer: [
    {kind:'clinic',title:'让团队，陪伴你的恢复',tags:['按治疗阶段安排','营养与活动','共同制定计划'],prop:'plan'},
    {kind:'clinic',title:'复诊时，主动说出变化',tags:['按时治疗','报告新症状','告知所有用药'],prop:'calendar'},
    {kind:'meal',title:'吃得下，再慢慢活动',tags:['少量多餐','分段休息','及早营养支持'],prop:'meal'},
    {kind:'help',title:'警示症状，先联系团队',tags:['达到团队发热警戒值','胸痛或严重气促','危险信号立即呼救'],prop:'thermometer'}
  ],
  pneumoconiosis: [
    {kind:'work',title:'保护肺部，从减少暴露开始',tags:['减少职业粉尘','专科管理','康复不能逆转瘢痕'],prop:'dust'},
    {kind:'work',title:'把防护，落实到工作环境',tags:['按岗位要求防护','远离粉尘','戒烟及避开烟雾'],prop:'shield'},
    {kind:'walk',title:'规律随访，稳妥活动',tags:['保留暴露资料','按计划复诊','稳定后轻量活动'],prop:'folder'},
    {kind:'help',title:'新症状，不要忽视',tags:['咯血或发热','气促加重','突发胸痛喘憋求助'],prop:'lungs'}
  ],
  ild: [
    {kind:'clinic',title:'先明确诊断，再安排治疗',tags:['病因各不相同','专科方案','规律随访'],prop:'folder'},
    {kind:'journal',title:'说清接触史，规范用药',tags:['鸟类、霉菌、粉尘','按处方治疗','按计划复查'],prop:'leaf'},
    {kind:'walk',title:'适合自己的步伐，也很好',tags:['先经医护评估','分段休息','用氧需求另需评估'],prop:'bench'},
    {kind:'help',title:'呼吸明显变差，别等待',tags:['气促加重','活动能力骤降','严重不适立即呼救'],prop:'lungs'}
  ],
  pneumothorax: [
    {kind:'clinic',title:'确认恢复，才安心往前走',tags:['按计划复查','确认吸收','安排活动与旅行'],prop:'folder'},
    {kind:'rest',title:'开始训练前，先获得允许',tags:['胸管、胸痛或气促','不自行训练','询问主管团队'],prop:'plan'},
    {kind:'travel',title:'乘机和潜水，先问专科',tags:['未完全吸收不乘机','吸收后仍需等待与评估','潜水另需专科意见'],prop:'plane'},
    {kind:'help',title:'突发胸痛气促，立即就医',tags:['停止活动','警惕复发','严重喘憋立即呼救'],prop:'lungs'}
  ],
  effusion: [
    {kind:'clinic',title:'查清原因，是恢复的第一步',tags:['查清病因','按计划治疗','训练不能排走积液'],prop:'folder'},
    {kind:'clinic',title:'治疗和管路，交给医护指导',tags:['按安排复查','管路敷料妥善','不自行调节引流'],prop:'plan'},
    {kind:'monitor',title:'留意呼吸，也留意日常变化',tags:['记录气促胸痛与体温','获允许后慢慢走动','饮水按个人安排'],prop:'thermometer'},
    {kind:'help',title:'突然变差，及时报告',tags:['管路脱落','胸痛伴发热','严重喘憋立即呼救'],prop:'thermometer'}
  ],
  tb: [
    {kind:'clinic',title:'规律全程治疗，保护家人',tags:['遵循个人方案','完成疗程','落实感染防护'],prop:'mask'},
    {kind:'meds',title:'设好提醒，按计划服药',tags:['避免漏药','漏服先咨询','不双倍补服'],prop:'calendar'},
    {kind:'vent',title:'做好通风，按指导防护',tags:['正确佩戴口罩','妥善处理痰液','密切接触者筛查'],prop:'mask'},
    {kind:'help',title:'药物不适，尽早报告',tags:['黄疸、皮疹或视力变化','立即联系团队','咯血增多伴不适求救'],prop:'phone'}
  ],
  corpulmonale: [
    {kind:'clinic',title:'兼顾肺和心脏的日常照护',tags:['个人心肺方案','关注低氧','关注体液变化'],prop:'heart'},
    {kind:'oxygen',title:'用药用氧，遵循个人处方',tags:['氧气远离烟火','不自行加药','按要求复查'],prop:'oxygen'},
    {kind:'monitor',title:'记录变化，轻量活动',tags:['体重、尿量与水肿','状态稳定并获允许','分段休息'],prop:'scale'},
    {kind:'help',title:'这些变化，需要求助',tags:['水肿加重或尿少','不能平卧','意识异常立即呼救'],prop:'heart'}
  ],
  osa: [
    {kind:'sleep',title:'让治疗，陪伴每一次睡眠',tags:['先明确诊断','设备治疗','体重管理与随访'],prop:'cpap'},
    {kind:'sleep',title:'规范佩戴，安心入睡',tags:['按方案使用PAP/CPAP','做好清洁','漏气不适及时求助'],prop:'cpap'},
    {kind:'routine',title:'白天和夜间，都照顾好自己',tags:['规律作息','避免借酒助眠','犯困时不要驾驶'],prop:'clock'},
    {kind:'help',title:'危险信号，立即采取行动',tags:['难以唤醒','发紫或意识异常','立即呼救'],prop:'phone'}
  ],
  quit: [
    {kind:'home',title:'每一次尝试，都在向前走',tags:['任何时候都不晚','行为与药物支持','家人一起参与'],prop:'leaf'},
    {kind:'calendar',title:'选个日子，邀请支持',tags:['确定戒烟日','清理烟具','咨询戒烟门诊'],prop:'calendar'},
    {kind:'walk',title:'这一阵烟瘾，会慢慢过去',tags:['先延迟','短暂走动或联系支持者','复吸后回到计划'],prop:'leaf'},
    {kind:'help',title:'身体或情绪不适，主动求助',tags:['皮疹或面唇肿胀','呼吸困难立即呼救','情绪低落寻求支持'],prop:'phone'}
  ]
});

export function renderFilmHTML({topic,index=0,slide={},logo='',caption=''}={}){
 const id=typeof topic==='string'?topic:topic?.id;
 const name=typeof topic==='string'?topic:topic?.shortName||id;
 const spec=FILM_SCENE_SPEC[id]?.[index];
 if(!spec)throw new Error(`Unknown film scene ${id}/${index}`);
 const logoSrc=logo.startsWith('data:')?logo:`data:image/jpeg;base64,${logo}`;
 const photoName=imageFor(spec,id,index),photo=sceneImage(photoName);
 const scene=`<div class="photographic-scene" data-scene-asset="${escape(photoName)}"><img class="scene-photo" src="${photo}" alt="${escape(spec.title)}"><div class="photo-shade"></div><div class="scene-light"></div></div>`;
 return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
 *{box-sizing:border-box}html,body{width:960px;height:960px;margin:0;overflow:hidden}body{background:#faf5e8;color:#174e43;font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif;-webkit-font-smoothing:antialiased}header{position:absolute;left:52px;right:52px;top:31px;height:51px;display:flex;align-items:center;gap:13px;font-size:27px;letter-spacing:1px}header img{width:50px;height:50px;object-fit:cover;border-radius:50%;border:1px solid #d9decc}header small{font-size:22px;margin-left:auto;color:#66776a;letter-spacing:0}.section{position:absolute;left:54px;top:100px;display:flex;align-items:center;gap:11px;font-size:23px;color:#6e826e}.section b{display:inline-grid;place-items:center;width:40px;height:32px;border-radius:12px;background:#e8e7d3;color:#477463;font-size:20px}h1{position:absolute;left:54px;right:50px;top:140px;margin:0;font-size:48px;line-height:1.35;letter-spacing:-1px;font-weight:700}.visual{position:absolute;left:0;top:219px;width:960px;height:600px;transform-origin:50% 50%}.visual svg{display:block;width:960px;height:600px}.tips{position:absolute;left:62px;right:62px;top:746px;display:flex;justify-content:center;gap:10px;z-index:2}.tips span{padding:12px 17px;border-radius:18px;background:#fffaf0e8;color:#325f4d;font-size:24px;white-space:nowrap;box-shadow:0 4px 16px #254b3520;border:1px solid #fff9e8}#caption{position:absolute;left:60px;right:60px;top:828px;height:88px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:32px;line-height:1.4;color:#193f38;font-weight:500;letter-spacing:.4px}.timeline{position:absolute;left:60px;right:60px;bottom:22px;height:5px;display:flex;gap:9px}.timeline i{height:5px;flex:1;background:#d8dfcb;border-radius:5px;position:relative;overflow:hidden}.timeline i.past{background:#618973}.timeline i.now::before{content:'';position:absolute;inset:0 auto 0 0;width:var(--progress,0%);background:#3d745d;border-radius:5px}.credit{position:absolute;right:59px;top:795px;color:#71806c;font-size:17px;letter-spacing:1px}.vignette{position:absolute;left:28px;right:28px;top:219px;height:600px;border-radius:45px;pointer-events:none;box-shadow:inset 0 0 80px #31432c07}body[data-safety="true"] h1{color:#835943}body[data-safety="true"] .section b{background:#eddbc4;color:#805b42}
 .photographic-scene{position:relative;left:28px;width:904px;height:600px;border-radius:45px;overflow:hidden;background:#d9dbc8;box-shadow:0 14px 35px #1d3d2624}.scene-photo{position:absolute;width:100%;height:100%;object-fit:cover;display:block;transform-origin:48% 48%}.photo-shade{position:absolute;inset:0;background:linear-gradient(180deg,#ffffff00 55%,#123c3296 100%)}.scene-light{position:absolute;inset:0;mix-blend-mode:screen;background:radial-gradient(ellipse at 12% 15%,#f2ddaa28,transparent 65%)}body:has(.photographic-scene) .tips span{color:#f8f3e6;background:#174b3ccd;border-color:#dce3c626;font-size:22px;box-shadow:0 3px 16px #0a291930}body:has(.photographic-scene) .credit{color:#f0eddecc}.scene-photo,.scene-light{will-change:transform}
 </style></head><body data-safety="${index===3}"><header>${logo?`<img src="${escape(logoSrc)}" alt="壶兰呼吸">`:''}<strong>壶兰呼吸</strong><small>${escape(name)} · 呼吸医学科三区</small></header><div class="section"><b>0${index+1}</b><span>${escape(slide.title||['认识与照护','日常方法','生活与恢复','识别与求助'][index])}</span></div><h1>${escape(spec.title)}</h1><div class="visual">${scene}</div><div class="vignette"></div><div class="tips">${spec.tags.map(x=>`<span>${escape(x)}</span>`).join('')}</div><span class="credit">遵循个人医护指导</span><div id="caption" data-film-caption>${escape(caption)}</div><div class="timeline">${[0,1,2,3].map(x=>`<i class="${x<index?'past':x===index?'now':''}"></i>`).join('')}</div><script>
 window.setFrame=function(t=0,duration=15,caption){
   var p=Math.max(0,Math.min(1,t/Math.max(.001,duration)));
   document.documentElement.style.setProperty('--progress',(p*100).toFixed(3)+'%');
   var photo=document.querySelector('.scene-photo');if(photo)photo.style.transform='translate('+(Math.sin(p*Math.PI)*-6).toFixed(3)+'px,'+(p*-6).toFixed(3)+'px) scale('+(1.025+p*.044).toFixed(6)+')';
   var light=document.querySelector('.scene-light');if(light)light.style.transform='translateX('+(p*18).toFixed(3)+'px)';
   if(typeof caption==='string')document.querySelector('#caption').textContent=caption;
   window.__filmFrame={time:t,duration:duration,progress:p};return window.__filmFrame;
 };window.setFrame(0,15);
 </script></body></html>`;
}
