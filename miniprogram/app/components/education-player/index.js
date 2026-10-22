const {education}=require('../../data/content');
const {store}=require('../../utils/store');
Component({
  options:{styleIsolation:'apply-shared'},
  properties:{topicId:{type:String,value:''}},
  data:{topic:null,senior:false,reducedMotion:false,loading:false,videoSrc:'',playRequested:false,error:'',caption:'',playing:false},
  observers:{topicId(id){this.selectTopic(id);}},
  lifetimes:{attached(){this._active=true;this._generation=0;this.selectTopic(this.properties.topicId);this.refreshSettings();},detached(){this._active=false;this.pauseVideo();}},
  pageLifetimes:{show(){this._active=true;this.refreshSettings();},hide(){this._active=false;this.pauseVideo();}},
  methods:{
    refreshSettings(){const result=store.load();this.setData({senior:result.state.settings.senior,reducedMotion:result.state.settings.reducedMotion});},
    selectTopic(id){const topic=education.find(item=>item.id===id)||null;this.setData({topic,videoSrc:'',caption:'',error:topic?'':'未找到此照护短片。'});},
    pauseVideo(){++this._generation;try{wx.createVideoContext('lesson-video',this).pause();}catch{}this.setData({loading:false,playRequested:false,playing:false});},
    prepareVideo(){
      if(!this._active||this.data.loading||!this.data.topic)return;const topic=this.data.topic,fs=wx.getFileSystemManager(),base=wx.env?.USER_DATA_PATH;
      if(typeof base!=='string'||!base){this.setData({error:'当前微信没有提供本地文件目录，请更新微信后重试。'});return;}
      const target=base+'/hulan-lesson-'+topic.id+'-'+topic.video.sourceSha256.slice(0,12)+'.mp4',generation=++this._generation;
      const active=()=>this._active&&this._generation===generation;
      const ready=()=>{if(active())this.setData({videoSrc:target,loading:false,playRequested:true,error:'',caption:''});};
      const failed=()=>{if(active())this.setData({videoSrc:'',loading:false,playRequested:false,error:'本地短片未能准备好。请检查手机存储空间，或稍后重新打开本页。'});};
      const copy=()=>{if(!active())return;fs.copyFile({srcPath:topic.video.packagePath,destPath:target,success:ready,fail:failed});};
      const replace=()=>fs.unlink({filePath:target,success:copy,fail:copy});
      this.setData({loading:true,error:'',playRequested:false});
      fs.stat({path:target,success:result=>{if(!active())return;if(topic.video.bytes&&result.stats?.size===topic.video.bytes)ready();else replace();},fail:copy});
    },
    timeUpdate(event){const time=Number(event.detail.currentTime);const cue=this.data.topic?.video.captions.find(item=>time>=item.start&&time<item.end);const caption=cue?.text||'';if(caption!==this.data.caption)this.setData({caption});},
    videoPlayed(){if(!this._active){this.pauseVideo();return;}this.setData({playing:true,error:''});},
    videoPaused(){this.setData({playing:false});},
    videoEnded(){this.setData({playing:false,playRequested:false,caption:'短片结束。照护安排以个人医嘱为准。'});},
    videoError(){this.pauseVideo();this.setData({videoSrc:'',error:'这段短片暂时无法播放，可重新载入；文字要点仍可阅读。'});},
    back(){wx.navigateBack({delta:1});}
  }
});
