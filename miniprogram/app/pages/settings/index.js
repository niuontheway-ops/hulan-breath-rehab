const {store}=require('../../utils/store');
const {reports}=require('../../utils/reports');
const {refresh,notice}=require('../../utils/presentation');
Page({
  data:{senior:false,reducedMotion:false,storageError:'',busy:false,privacyOpen:false,counts:{daily:0,sessions:0}},
  onShow(){const result=refresh(this);this.setData({counts:{daily:result.state.daily.length,sessions:result.state.sessions.length}});},
  change(event){const field=event.currentTarget.dataset.field;if(!['senior','reducedMotion'].includes(field))return;const result=store.saveSettings({[field]:event.detail.value===true});if(!result.ok)notice(result.message,'设置未保存');this.onShow();},
  togglePrivacy(){this.setData({privacyOpen:!this.data.privacyOpen});},
  reports(){wx.navigateTo({url:'/pages/reports/index'});},
  clear(){
    if(this.data.busy)return;
    wx.showModal({title:'清除这部手机的资料？',content:'将删除本小程序保存的健康评估、每日记录、训练记录、报告副本和显示设置。无法撤销，不会删除微信聊天中的原始文件。',confirmText:'清除资料',confirmColor:'#8d3428',success:async response=>{
      if(!response.confirm||this.data.busy)return;this.setData({busy:true});
      try{const files=await reports.clearAll();if(!files.ok){notice(files.message||'部分报告未删除，请重试。','尚未全部清除');return;}const result=store.clearAll();if(!result.ok){notice(result.message,'尚未全部清除');return;}if(typeof getCurrentPages==='function')for(const page of getCurrentPages())if(typeof page.onLocalDataCleared==='function')page.onLocalDataCleared();this.onShow();wx.showToast({title:'本机资料已清除',icon:'success'});}catch{notice('资料清除或界面刷新未完成，请重试；若仍异常，关闭小程序后重新打开。','尚未全部清除');}finally{this.setData({busy:false});}
    }});
  }
});
