const {inhalers,meta}=require('../../data/content');
const {refresh,notice}=require('../../utils/presentation');
const categories=[{id:'all',name:'全部装置'},{id:'pmdi',name:'定量气雾剂'},{id:'dpi',name:'干粉吸入器'},{id:'smi',name:'软雾吸入器'},{id:'spacer',name:'储雾罐'}];
const words=item=>[item.name,...(item.aliases||[]),...(item.brands||[])].join(' ').toLowerCase();
function viewDevice(item){
  if(!item)return null;const sourceMap={};[...(item.market?.sources||[]),...(item.sources||[])].forEach(source=>{if(source?.url)sourceMap[source.url]=source;});
  return {...item,sources:Object.keys(sourceMap).map(url=>sourceMap[url]),methodReady:item.teachingStatus==='reviewed-device-method',notes:[...(item.checkpoints||[]),...(item.warnings||[])]};
}
Page({
  data:{senior:false,reducedMotion:false,query:'',categories,categoryIndex:0,filterOpen:false,options:[{id:'',name:'请选择匹配的装置'}],selectedIndex:0,current:null,matchCount:inhalers.length,detailsOpen:false,meta},
  onLoad(){this._selectedId='';this.filterList();},
  onShow(){refresh(this);},
  filterList(){const query=this.data.query.trim().toLowerCase(),category=categories[this.data.categoryIndex]?.id||'all';const matches=inhalers.filter(item=>(category==='all'||item.category===category)&&(!query||words(item).includes(query)));const options=[{id:'',name:matches.length?'请选择匹配的装置':'未找到匹配装置'},...matches.map(item=>({id:item.id,name:item.name}))];const index=options.findIndex(item=>item.id===this._selectedId);const current=index>0?viewDevice(matches.find(item=>item.id===this._selectedId)):null;this.setData({options,matchCount:matches.length,selectedIndex:Math.max(0,index),current,detailsOpen:false});},
  search(event){this.setData({query:event.detail.value});this.filterList();},
  changeCategory(event){this.setData({categoryIndex:Number(event.detail.value)});this.filterList();},
  chooseDevice(event){const index=Number(event.detail.value),id=this.data.options[index]?.id||'';this._selectedId=id;this.filterList();},
  toggleFilter(){this.setData({filterOpen:!this.data.filterOpen});},
  toggleDetails(){this.setData({detailsOpen:!this.data.detailsOpen});},
  copyLink(event){const url=event.currentTarget.dataset.url;if(typeof url!=='string'||!/^https?:\/\//.test(url))return;const video=event.currentTarget.dataset.kind==='video';wx.setClipboardData({data:url,success:()=>notice(video?'视频原站链接已复制。请切换到手机浏览器打开；原站可能受网络或语言限制。':'资料链接已复制，可在手机浏览器打开。',video?'原视频链接':'资料来源'),fail:()=>notice('链接没有复制成功，请稍后重试。')});}
});
