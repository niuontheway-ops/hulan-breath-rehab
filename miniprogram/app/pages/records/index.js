const {refresh,today}=require('../../utils/presentation');
const {DAILY_TOPICS,evaluateDailyRecord}=require('../../core/daily');
const MODE={demonstration:'呼吸示范',stairs:'想象楼梯',meadow:'草地慢走'};
Page({
  data:{senior:false,reducedMotion:false,storageError:'',daily:[],sessions:[],active:'daily'},
  onShow(){const result=refresh(this),state=result.state;this.setData({daily:state.daily.slice().reverse().map(item=>({...item,label:DAILY_TOPICS.find(topic=>topic.id===item.topic)?.name||'健康评估',outcome:evaluateDailyRecord(item)})),sessions:state.sessions.slice().reverse().map(item=>({...item,label:MODE[item.mode],day:today(item.startedAt),minutes:Math.round(item.elapsedMs/6000)/10,statusLabel:item.status==='completed'?'已完成确认':'已结束'}))});},
  select(event){const active=event.currentTarget.dataset.id;if(['daily','sessions'].includes(active))this.setData({active});},
  newDaily(){wx.navigateTo({url:'/pages/daily/index'});},
  start(){wx.switchTab({url:'/pages/training/index'});},
  settings(){wx.navigateTo({url:'/pages/settings/index'});},
  reports(){wx.navigateTo({url:'/pages/reports/index'});}
});
