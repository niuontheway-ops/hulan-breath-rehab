import {INHALER_CATALOG} from './inhaler-catalog.mjs';

const ORIGINAL_VIDEOS={
  breztri:{url:'https://www.bilibili.com/video/BV1TCqhYvEP9',title:'布地格福吸入气雾剂',provider:'不是超级大会员'},
  turbuhaler:{url:'https://www.bilibili.com/video/BV1DfrYBjEiA',title:'布地奈德福莫特罗',provider:'呼吸小酥'},
  ellipta:{url:'https://www.bilibili.com/video/BV1UAreBCE3t',title:'氟替美维吸入粉雾剂（全再乐）',provider:'呼吸小酥'},
  bevespi:{url:'https://www.bilibili.com/video/BV1WTraBAEfS',title:'格隆溴铵福莫特罗',provider:'呼吸小酥'},
  capsule:{url:'https://www.bilibili.com/video/BV1UAreBCEVS',title:'噻托溴铵吸入粉剂（天晴速乐）',provider:'呼吸小酥'},
  accuhaler:{url:'https://www.bilibili.com/video/BV1UjrhBTE9z',title:'沙美特罗氟替卡松',provider:'呼吸小酥'},
};
const TYPE_NAMES={pmdi:'定量气雾剂',dpi:'干粉吸入器',smi:'软雾吸入器',spacer:'储雾罐与辅助装置',nebulizer:'雾化装置'};
const text=value=>typeof value==='string'?value:'';
const brandText=brand=>typeof brand==='string'?brand:brand?.name||brand?.label||'';
const category=item=>text(item.type).toLowerCase()==='capsule'?'dpi':text(item.type).toLowerCase();
const searchable=item=>[item.name,...(item.aliases||[]),...(item.brands||[]).map(brandText)].join(' ').toLocaleLowerCase();
export const INHALER_DEVICES=Object.freeze(INHALER_CATALOG.map(item=>Object.freeze({id:item.id,name:item.name,device:item.device||TYPE_NAMES[category(item)]||item.type})));

/** Device teaching is independent of choosing a medication or prescribing a dose. */
export function getInhaler(id){
  const item=INHALER_CATALOG.find(device=>device.id===id)||INHALER_CATALOG.find(device=>device.id==='breztri')||INHALER_CATALOG[0];
  const data=structuredClone(item),video=data.video;
  return {...data,device:data.device||TYPE_NAMES[category(data)]||data.type,category:category(data),video:video?.url||'',videoDetails:video||null,legacyVideos:ORIGINAL_VIDEOS[data.id]?[{...ORIGINAL_VIDEOS[data.id],language:'中文',verified:false}]:[],source:data.sources?.[0]||null,checked:data.market?.checkedAt||'2026-10-19',note:[...(data.warnings||[]),...(data.checkpoints||[])].join(' '),image:{src:'assets/chapters/inhaler.svg',alt:'吸入操作通用示意；不是所选装置的实物照片'}};
}

/** All videos and reference pages remain unloaded until a deliberate external-link click. */
export function mountInhaler(container,{initialDevice='breztri'}={}){
  if(!container?.ownerDocument||typeof container.replaceChildren!=='function')throw new TypeError('mountInhaler requires a DOM container.');
  const document=container.ownerDocument;
  const element=(tag,content='',className='')=>{const node=document.createElement(tag);if(content)node.textContent=content;if(className)node.className=className;return node;};
  const link=(label,url,className='text-link')=>{const node=element('a',label,className);try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))return element('span',label);node.href=parsed.href;}catch{return element('span',label);}node.target='_blank';node.rel='noopener noreferrer';return node;};
  const wrapper=element('div','','inhaler-library');
  const finder=element('section','','inhaler-finder');finder.setAttribute('aria-label','查找吸入装置');
  const intro=element('div','','inhaler-library-intro');intro.append(element('h2','选择装置'),element('p','输入药名，或在下方选择。'));
  const controls=element('div','','inhaler-search-controls');
  const searchLabel=element('label','药名 / 装置名');const search=element('input');search.type='search';search.placeholder='如：能倍乐、思力华、万托林';search.autocomplete='off';search.setAttribute('aria-label','搜索药名或吸入装置');searchLabel.append(search);
  const typeLabel=element('label','装置类别');const filter=element('select');filter.setAttribute('aria-label','按装置类别筛选');for(const [key,label] of [['all','全部类别'],...Object.entries(TYPE_NAMES).filter(([key])=>INHALER_CATALOG.some(item=>category(item)===key))]){const option=element('option',label);option.value=key;filter.append(option);}typeLabel.append(filter);
  controls.append(searchLabel);
  const chooseLabel=element('label','选择手中的装置','inhaler-choose-label');const choose=element('select');choose.setAttribute('aria-label','选择手中的吸入装置');chooseLabel.append(choose);
  const results=element('p','','inhaler-result-status');results.setAttribute('role','status');
  const browse=element('details','','inhaler-browse');const summary=element('summary','浏览装置列表');const picker=element('div','','edu-topic-picker inhaler-picker');picker.setAttribute('role','group');picker.setAttribute('aria-label','吸入装置列表');browse.append(summary,typeLabel,picker);
  finder.append(intro,controls,chooseLabel,results,browse);
  const scope=element('p','收录已核实的大陆产品；供应因地区而异。同名药也要核对所配装置。','inhaler-scope');
  const panel=element('section','','inhaler-panel');panel.setAttribute('aria-label','所选装置的教学');
  wrapper.append(finder,panel,scope);container.replaceChildren(wrapper);
  let currentId=getInhaler(initialDevice).id,disposed=false;
  function listSection(title,items){if(!items?.length)return null;const section=element('section','','inhaler-instruction-section');section.append(element('h4',title));const list=element('ul');items.forEach(item=>list.append(element('li',typeof item==='string'?item:item.text||item.label||'')));section.append(list);return section;}
  function renderPanel(){
    const data=getInhaler(currentId),heading=element('div','','inhaler-teaching-heading');
    heading.append(element('span',data.device,'inhaler-type-label'),element('h3',data.name),element('p',(data.brands||[]).map(brandText).join(' / '),'inhaler-brand-list'));
    const cue=element('div','','inhaler-breath-cue');cue.append(element('strong','吸气要领'),element('p',data.breathCue||'以所持装置的说明与医护示范为准。'));
    const media=element('article','','inhaler-media-card');
    const mediaBody=element('div','','inhaler-media-body');mediaBody.append(element('h4','操作教学视频'));
    if(data.videoDetails){const v=data.videoDetails;mediaBody.append(element('p',v.title),link('▶ 打开操作视频',v.url,'btn-primary inhaler-video-link'),element('p',[v.provider,v.language,'需联网，在新页面观看'].filter(Boolean).join(' · '),'field-help'));if(v.scope)mediaBody.append(element('p',v.scope,'inhaler-video-scope'));if(v.availability||v.note)mediaBody.append(element('p',v.availability||v.note,'field-help'));}
    else mediaBody.append(element('p',data.videoMissingReason||data.missingReason||'尚未找到可核对的本型号公开视频。先使用下方说明，并请医护演示。','field-help'));
    const alternatives=(data.videoOptions||[]).filter(v=>v.url!==data.videoDetails?.url);if(alternatives.length){const extra=element('details','','inhaler-video-alternatives');extra.append(element('summary','备用视频来源（需联网）'));for(const v of alternatives){extra.append(link((v.title||'备用教学视频')+' · '+(v.provider||'来源')+' · '+(v.language||''),v.url,'text-link inhaler-backup-video'));if(v.availability)extra.append(element('p',v.availability,'field-help'));}mediaBody.append(extra);}
    media.append(mediaBody);
    const steps=element('ol','','inhaler-steps');(data.steps||[]).forEach(step=>steps.append(element('li',typeof step==='string'?step:step.text||'')));
    const preparation=listSection('用药前准备',data.preparation);const details=element('details','','edu-more inhaler-device-details');details.append(element('summary','首次使用与清洁'));
    for(const section of [listSection('首次使用 / 长时间停用后',data.firstUse),listSection('清洁与保存',data.cleaning)])if(section)details.append(section);
    const caution=element('aside','','edu-emergency inhaler-caution');caution.append(element('h4','容易弄错的地方'));const warnings=element('ul');[...(data.checkpoints||[]),...(data.warnings||[])].forEach(item=>warnings.append(element('li',item)));caution.append(warnings);
    if(data.mouthRinse==='required'&&![...(data.warnings||[]),...(data.checkpoints||[])].some(item=>item.includes('漱口')))caution.append(element('p','此条目所对应产品含吸入激素，使用后漱口并吐掉；具体执行以手中说明书和医嘱为准。'));
    if(data.mouthRinse==='conditional'&&![...(data.warnings||[]),...(data.checkpoints||[])].some(item=>item.includes('漱口')))caution.append(element('p','只有当所用药物含吸入激素、或说明书另有要求时，按要求漱口并吐掉；不要把装置类别当作药物成分。'));
    const sources=element('details','','edu-more');sources.append(element('summary','型号、视频与说明来源'));
    const marketLabel=data.market?.status==='confirmed'?'已核对中国大陆产品资料':data.market?.label||'中国大陆产品资料需逐项核对';sources.append(element('p',marketLabel+' · 核查日期 '+data.checked));
    if(data.market?.limitations)sources.append(element('p',data.market.limitations));
    if(data.videoDetails){sources.append(link(data.videoDetails.provider+' · 视频原页面',data.videoDetails.url));if(data.videoDetails.scope)sources.append(element('p',data.videoDetails.scope));}
    const seenSources=new Set();for(const source of [...(data.market?.sources||[]),...(data.sources||[])]){const url=typeof source==='string'?source:source.url;if(seenSources.has(url))continue;seenSources.add(url);const label=typeof source==='string'?'产品资料':source.label;sources.append(link(label,url));}
    if(data.legacyVideos.length){sources.append(element('p','保留原站中文视频入口；发布者不是已核实的医院官方账号，使用前核对具体装置。'));for(const original of data.legacyVideos)sources.append(link(original.title+' · 原站视频',original.url,'text-link inhaler-legacy-video'));}
    sources.append(element('p','仅教装置操作，不选择药物、不统一喷数或剂量。没有匹配项时请携带药盒与装置向医护核对。','edu-sources'));
    panel.replaceChildren(heading,cue,media);if(preparation)panel.append(preparation);if(data.teachingStatus==='needs-device-review'||!data.steps?.length){panel.append(element('h4','先核对专属说明'),element('p',data.teachingMissingReason||'已核对大陆产品资料，但尚未完成这个具体装置的操作核对。请勿套用其他品牌的装置步骤；先查看来源或由医护核对药盒配套说明。','inhaler-device-review'));}else panel.append(element('h4','按顺序练习'),steps);panel.append(details,caution,sources);
    for(const button of picker.querySelectorAll('[data-inhaler]')){const active=button.dataset.inhaler===currentId;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-active',active);}
  }
  function filtered(){const query=search.value.trim().toLocaleLowerCase();return INHALER_CATALOG.filter(item=>(filter.value==='all'||category(item)===filter.value)&&(!query||searchable(item).includes(query)));}
  function renderFinder(){
    const items=filtered(),placeholder=element('option',items.length?'请选择匹配的装置':'没有找到匹配装置');placeholder.value='';choose.replaceChildren(placeholder);picker.replaceChildren();
    items.forEach(item=>{const option=element('option',item.name);option.value=item.id;choose.append(option);const button=element('button',item.name);button.type='button';button.dataset.inhaler=item.id;button.title=(item.brands||[]).map(brandText).join(' / ');button.setAttribute('aria-pressed',String(item.id===currentId));button.classList.toggle('is-active',item.id===currentId);picker.append(button);});
    const currentVisible=items.some(item=>item.id===currentId);choose.value=currentVisible?currentId:'';panel.hidden=!currentVisible;results.textContent=!items.length?'未找到匹配项。已隐藏之前的教学，请核对包装全名，或携带装置请医护确认。':currentVisible?'找到 '+items.length+' 项。当前查看：'+getInhaler(currentId).name:'找到 '+items.length+' 项，请选择匹配的装置后查看教学。';summary.textContent='浏览匹配装置（'+items.length+'）';
  }
  const select=id=>{if(!INHALER_CATALOG.some(item=>item.id===id))return;currentId=id;renderFinder();renderPanel();};
  const onSearch=()=>{if(!disposed)renderFinder();};const onSelect=()=>{if(!disposed&&choose.value)select(choose.value);};
  const onClick=event=>{if(disposed)return;const button=event.target?.closest?.('button[data-inhaler]');if(button&&picker.contains(button))select(button.dataset.inhaler);};
  search.addEventListener('input',onSearch);filter.addEventListener('change',onSearch);choose.addEventListener('change',onSelect);picker.addEventListener('click',onClick);renderFinder();renderPanel();
  return {dispose(){if(disposed)return;disposed=true;search.removeEventListener('input',onSearch);filter.removeEventListener('change',onSearch);choose.removeEventListener('change',onSelect);picker.removeEventListener('click',onClick);wrapper.remove();}};
}
