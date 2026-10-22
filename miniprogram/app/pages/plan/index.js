const {createPlan}=require('../../core/clinical');
const {refresh}=require('../../utils/presentation');
Page({
  data:{senior:false,reducedMotion:false,storageError:'',plan:null,details:false},
  onShow(){const result=refresh(this);this.setData({plan:result.state.profile?createPlan(result.state.profile):null});},
  edit(){wx.navigateTo({url:'/pages/assessment/index'});},
  train(){if(this.data.plan?.status==='ready'&&!this.data.storageError)wx.switchTab({url:'/pages/training/index'});},
  learn(){wx.switchTab({url:'/pages/learn/index'});},
  toggleDetails(){this.setData({details:!this.data.details});},
  copySource(event){const url=event.currentTarget.dataset.url;if(typeof url==='string'&&url.startsWith('https://'))wx.setClipboardData({data:url});}
});
