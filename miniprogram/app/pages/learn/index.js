const {education,meta}=require('../../data/content');
const {refresh,notice}=require('../../utils/presentation');
Page({
  data:{senior:false,reducedMotion:false,topics:education.map(item=>({id:item.id,title:item.title})),selectedIndex:0,topic:education[0],detailsOpen:false,meta},
  onLoad(options){const index=education.findIndex(item=>item.id===options?.topic);if(index>=0)this.choose(index);},
  onShow(){refresh(this);},
  choose(index){if(!education[index])return;this.setData({selectedIndex:index,topic:education[index],detailsOpen:false});},
  changeTopic(event){this.choose(Number(event.detail.value));},
  toggleDetails(){this.setData({detailsOpen:!this.data.detailsOpen});},
  watchLesson(){wx.navigateTo({url:this.data.topic.video.route,fail:()=>notice('短片分包暂时无法载入。首次观看需要网络，请稍后重试。','未能打开短片')});},
  openInhalers(){wx.navigateTo({url:'/pages/inhaler/index'});},
  copySource(event){const source=this.data.topic.sources[Number(event.currentTarget.dataset.index)];if(!source||!/^https?:\/\//.test(source.url))return;wx.setClipboardData({data:source.url,success:()=>notice('来源链接已复制，可在手机浏览器打开。','资料来源'),fail:()=>notice('没有复制成功，请稍后重试。')});}
});
