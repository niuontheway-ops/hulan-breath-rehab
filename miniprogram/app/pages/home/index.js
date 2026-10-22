const {store}=require('../../utils/store');
const {createPlan}=require('../../core/clinical');
const {refresh,notice,today}=require('../../utils/presentation');
Page({
  data:{senior:false,reducedMotion:false,storageError:'',hasProfile:false,planReady:false,today:'',completedToday:0,dailyDone:false,entries:[
    {id:'assessment',title:'健康评估',detail:'从年龄开始，一步一步填',image:'assessment'},
    {id:'daily',title:'每日评估',detail:'记下今天的气促和疲劳',image:'daily'},
    {id:'plan',title:'康复安排',detail:'查看适合当前状态的内容',image:'plan'},
    {id:'inhaler',title:'吸入器教学',detail:'找到你手中的装置',image:'inhaler'},
    {id:'music',title:'音乐放松',detail:'选择喜欢的旋律',image:'music'}
  ]},
  onShow(){
    const result=refresh(this),state=result.state,day=today();
    const plan=state.profile?createPlan(state.profile):null;
    this.setData({hasProfile:!!state.profile,planReady:!!result.ok&&plan?.status==='ready',today:day,dailyDone:state.daily.some(item=>item.day===day),completedToday:state.sessions.filter(item=>item.startedAt&&new Date(new Date(item.startedAt).getTime()+8*3600000).toISOString().slice(0,10)===day).reduce((total,item)=>total+item.completedCycles,0)});
  },
  start(){
    if(this.data.storageError){notice(this.data.storageError,'本机资料需要处理');return;}
    if(!this.data.hasProfile){wx.navigateTo({url:'/pages/assessment/index'});return;}
    if(!this.data.planReady){wx.navigateTo({url:'/pages/plan/index'});return;}
    wx.switchTab({url:'/pages/training/index'});
  },
  openEntry(event){const id=event.currentTarget.dataset.id;if(['assessment','daily','plan','inhaler','music'].includes(id))wx.navigateTo({url:'/pages/'+id+'/index'});},
  openSettings(){wx.navigateTo({url:'/pages/settings/index'});},
  openLearn(){wx.switchTab({url:'/pages/learn/index'});},
  toggleSenior(){const result=store.saveSettings({senior:!this.data.senior});if(!result.ok)notice(result.message,'设置未保存');this.onShow();}
});
