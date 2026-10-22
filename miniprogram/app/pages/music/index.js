const {tracks}=require('../../data/content');
const {refresh}=require('../../utils/presentation');
Page({
  data:{senior:false,reducedMotion:false,tracks,selectedId:tracks[0].id,track:tracks[0],playing:false,loading:false,volume:25,error:'',status:'选一首喜欢的音乐，舒适聆听。'},
  onLoad(){this._audio=null;this._generation=0;this._visible=true;},
  onShow(){this._visible=true;refresh(this);},
  onHide(){this._visible=false;this.releaseAudio();},
  onUnload(){this._visible=false;this.releaseAudio();},
  releaseAudio(){++this._generation;if(this._audio){try{this._audio.stop();}catch{}try{this._audio.destroy();}catch{}this._audio=null;}this.setData({playing:false,loading:false});},
  selectTrack(event){const track=tracks.find(item=>item.id===event.currentTarget.dataset.id);if(!track)return;this.releaseAudio();this.setData({selectedId:track.id,track,error:'',status:'已选择 '+track.name+'；点击播放后联网加载。'});},
  play(){if(!this._visible||this.data.loading)return;if(this._audio&&this.data.playing)return;this.releaseAudio();const token=this._generation,track=this.data.track;let audio;try{audio=wx.createInnerAudioContext();}catch{this.setData({error:'当前微信无法创建音乐播放器，请更新微信后重试。'});return;}this._audio=audio;audio.autoplay=false;audio.loop=true;audio.obeyMuteSwitch=true;audio.volume=this.data.volume/100;const current=()=>this._visible&&this._audio===audio&&this._generation===token;audio.onPlay(()=>{if(current())this.setData({playing:true,loading:false,error:'',status:'正在播放 '+track.name+'。保持舒适音量。'});});audio.onPause(()=>{if(current())this.setData({playing:false,loading:false,status:'已暂停。'});});audio.onStop(()=>{if(current())this.setData({playing:false,loading:false,status:'已停止。'});});audio.onError(()=>{if(!current())return;this.releaseAudio();this.setData({error:'这首音乐暂时无法播放。请检查网络，或换一首后重试。',status:'未能播放。'});});this.setData({loading:true,error:'',status:'正在加载 '+track.name+'…'});try{audio.src=track.url;audio.play();}catch{this.releaseAudio();this.setData({error:'音乐未能播放，请稍后重试。'});}},
  pause(){this.releaseAudio();this.setData({status:'音乐已暂停，休息一会儿也很好。'});},
  changeVolume(event){const value=Number(event.detail.value);if(!Number.isFinite(value))return;const volume=Math.max(0,Math.min(100,value));this.setData({volume});if(this._audio)this._audio.volume=volume/100;},
  openTraining(){this.releaseAudio();wx.switchTab({url:'/pages/training/index'});}
});
