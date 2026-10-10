export const ORIGINAL_TRACKS = Object.freeze([
  {id:'anni',name:'安妮的仙境',description:'班得瑞 · 空灵轻盈',file:'安妮的仙境.mp3'},
  {id:'chuxue',name:'初雪',description:'班得瑞 · 静谧温柔',file:'初雪.mp3'},
  {id:'wuwu',name:'迷雾水珠',description:'班得瑞 · 清透水滴',file:'迷雾水珠.mp3'},
  {id:'qingchen',name:'清晨',description:'班得瑞 · 清新舒展',file:'清晨.mp3'},
  {id:'tongnian',name:'童年记忆',description:'班得瑞 · 温暖旋律',file:'童年记忆.mp3'},
  {id:'xuezhi',name:'雪之梦',description:'班得瑞 · 悠远梦幻',file:'雪之梦.mp3'},
  {id:'yueguang',name:'月光水岸',description:'班得瑞 · 宁静柔美',file:'月光水岸.mp3'},
]);

const musicOrigin = 'https://niuontheway-ops.github.io/human-breath/';
export function originalMusicUrl(id) {
  const track = ORIGINAL_TRACKS.find(t => t.id === id);
  return track ? musicOrigin + encodeURIComponent(track.file) : null;
}

export function createMusicPlayer({audio = new Audio(),url = URL,onChange = () => {}} = {}) {
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = 0.25;
  let selected = ORIGINAL_TRACKS[0];
  let localUrl = null;
  let status = 'idle';
  let message = '选择喜欢的音乐，轻声聆听。';
  let generation = 0;
  let disposed = false;
  let trainingMusic = false;
  const listeners = new Set([onChange]);
  const events = [];
  const getState = () => ({track:{id:selected.id,name:selected.name,description:selected.description,local:!!selected.local},status,message,volume:audio.volume,position:Number.isFinite(audio.currentTime)?audio.currentTime:0,duration:Number.isFinite(audio.duration)?audio.duration:0,trainingMusic});
  const emit = () => { if(!disposed) for(const fn of listeners) fn(getState()); };
  const on = (name,fn) => {audio.addEventListener(name,fn);events.push([name,fn]);};
  const releaseLocal = () => {if(localUrl){url.revokeObjectURL(localUrl);localUrl=null;}};
  function pause() {++generation;audio.pause();if(status !== 'error') {status='paused';message='已暂停，休息一会儿也很好。';}emit();}
  function select(id) {
    const next = ORIGINAL_TRACKS.find(t => t.id === id);
    if(!next) return false;
    pause();audio.removeAttribute('src');audio.load();releaseLocal();selected=next;status='idle';message='原版音乐需要联网；点击播放后加载。';emit();return true;
  }
  function importLocal(file) {
    if(!file || !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name) || !Number.isFinite(file.size) || file.size <= 0 || file.size > 100*1024*1024) return {ok:false,message:'请选择不超过 100 MB 的 MP3、WAV、OGG、M4A、AAC 或 FLAC 音频文件。'};
    pause();audio.removeAttribute('src');audio.load();releaseLocal();localUrl=url.createObjectURL(file);selected={id:'local',name:file.name,description:'你的设备文件 · 仅本页使用',local:true};status='idle';message='本地音乐已就绪，可离线播放。';emit();return {ok:true};
  }
  async function play() {
    if(disposed) return false;
    const token=++generation;
    if(!audio.getAttribute('src')) audio.src=selected.local?localUrl:originalMusicUrl(selected.id);
    status='loading';message='正在加载音乐…';emit();
    try {
      await audio.play();
      if(token !== generation || disposed) return false;
      status='playing';message='正在播放 · 保持舒适音量。';emit();return true;
    } catch(error) {
      if(token !== generation || disposed) return false;
      status='error';message=error?.name==='NotAllowedError'?'请点击播放，允许浏览器开始声音。':'音乐暂时无法播放。原版曲目需要联网，也可以选择设备里的音频。';emit();return false;
    }
  }
  function stop() {pause();try{audio.currentTime=0;}catch{}status='idle';message='音乐已停止。';emit();}
  function setVolume(value) {if(!Number.isFinite(Number(value)))return;audio.volume=Math.max(0,Math.min(1,Number(value)));emit();}
  function seek(seconds) {if(!Number.isFinite(audio.duration)||audio.duration<=0||!Number.isFinite(Number(seconds)))return false;audio.currentTime=Math.max(0,Math.min(audio.duration,Number(seconds)));emit();return true;}
  function setTrainingMusic(value) {trainingMusic=value===true;emit();}
  async function onTrainingState(frame) {
    if(!trainingMusic) return;
    if(frame.status==='running' && status!=='playing' && status!=='loading') await play();
    else if(['paused','awaiting-confirmation','stopped','completed'].includes(frame.status)) pause();
  }
  on('timeupdate',emit);on('durationchange',emit);on('loadedmetadata',emit);
  on('playing',()=>{status='playing';message='正在播放 · 保持舒适音量。';emit();});
  on('pause',()=>{if(status==='playing'){status='paused';message='已暂停，休息一会儿也很好。';emit();}});
  on('error',()=>{if(!audio.getAttribute('src'))return;status='error';message='音乐暂时无法播放。请检查网络，或选择设备里的音频。';emit();});
  return {
    getState,select,importLocal,play,pause,stop,setVolume,seek,setTrainingMusic,onTrainingState,
    subscribe(fn) {listeners.add(fn);fn(getState());return () => listeners.delete(fn);},
    dispose() {if(disposed)return;pause();disposed=true;events.forEach(([name,fn])=>audio.removeEventListener(name,fn));audio.removeAttribute('src');audio.load();releaseLocal();listeners.clear();},
  };
}

const time = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export function mountMusic(container,{player} = {}) {
  if(!player) throw new Error('A shared music player is required.');
  container.innerHTML = `<div class="music-layout"><article class="card music-player"><span class="eyebrow">音乐疗法 · 舒缓陪伴</span><div class="music-art" aria-hidden="true"><svg viewBox="0 0 240 160"><circle cx="120" cy="82" r="60" fill="#e4ecd7"/><path d="M48 119Q77 56 112 96Q149 42 196 119" fill="#b1c69a"/><path d="M38 129Q92 79 122 113Q153 78 209 129" fill="#83ac89"/><path d="M112 117V62l39-9v54" fill="none" stroke="#216858" stroke-width="6" stroke-linejoin="round"/><ellipse cx="101" cy="118" rx="15" ry="10" fill="#216858"/><ellipse cx="140" cy="108" rx="15" ry="10" fill="#216858"/></svg></div><h2 data-music-title></h2><p data-music-description class="music-description"></p><p data-music-status class="music-status" role="status"></p><div class="music-controls"><button type="button" class="btn-primary" data-music-play>播放音乐</button><button type="button" class="btn-secondary" data-music-stop>停止</button></div><label class="music-progress-label" for="music-position"><span data-music-position>0:00</span><span data-music-duration>0:00</span></label><input id="music-position" data-music-seek type="range" min="0" max="0" value="0" step="1" disabled aria-label="音乐播放进度"><div class="music-volume"><label for="music-volume">音量</label><input id="music-volume" type="range" min="0" max="1" value="0.25" step="0.05"><span data-music-volume-label>25%</span></div><label class="check-row music-training"><input type="checkbox" data-music-training>训练时播放当前配乐，暂停或结束时暂停音乐</label><p class="field-help">音乐可以陪伴放松，不能替代药物或康复治疗。不喜欢声音时，保持安静也很好。</p></article><div class="music-library"><article class="card"><div class="card-heading"><h2>原版放松曲目</h2><span class="source-pill">7 首 · 联网播放</span></div><p class="music-note">保留原网页曲目，点击播放后从原站加载。</p><div class="music-track-list">${ORIGINAL_TRACKS.map(t=>`<button type="button" class="music-track" data-music-track="${t.id}" aria-pressed="false"><span class="music-track-symbol" aria-hidden="true">♪</span><span><strong>${t.name}</strong><small>${t.description}</small></span><span class="music-track-check" aria-hidden="true">✓</span></button>`).join('')}</div></article><article class="card music-local"><h2>也可以听设备里的音乐</h2><p>选择你喜欢的音频，离线也能播放；文件仅在当前页面使用。</p><label for="local-music-file" class="btn-secondary">选择本地音乐</label><input id="local-music-file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"><p data-local-music-message class="field-help" role="status">文件不会上传，也不会记住文件名。</p></article></div></div>`;
  const $ = selector => container.querySelector(selector);
  const handlers=[];
  const bind=(el,name,fn)=>{el.addEventListener(name,fn);handlers.push([el,name,fn]);};
  bind($('[data-music-play]'),'click',()=>{const s=player.getState();s.status==='playing'||s.status==='loading'?player.pause():player.play();});
  bind($('[data-music-stop]'),'click',()=>player.stop());
  bind($('#music-volume'),'input',event=>player.setVolume(event.target.value));
  bind($('[data-music-seek]'),'input',event=>player.seek(event.target.value));
  bind($('[data-music-training]'),'change',event=>player.setTrainingMusic(event.target.checked));
  container.querySelectorAll('[data-music-track]').forEach(button=>bind(button,'click',()=>player.select(button.dataset.musicTrack)));
  bind($('#local-music-file'),'change',event=>{const result=player.importLocal(event.target.files[0]);$('[data-local-music-message]').textContent=result.ok?'已选择设备音频。点击播放即可聆听。':result.message;});
  const unsubscribe=player.subscribe(s=>{
    $('[data-music-title]').textContent=s.track.name;
    $('[data-music-description]').textContent=s.track.description;
    $('[data-music-status]').textContent=s.message;
    $('[data-music-play]').textContent=s.status==='playing'?'暂停音乐':s.status==='loading'?'取消加载':'播放音乐';
    $('[data-music-position]').textContent=time(s.position);$('[data-music-duration]').textContent=time(s.duration);
    const seek=$('[data-music-seek]');seek.max=String(s.duration);seek.value=String(Math.min(s.position,s.duration));seek.disabled=!s.duration;
    $('#music-volume').value=String(s.volume);$('[data-music-volume-label]').textContent=`${Math.round(s.volume*100)}%`;
    $('[data-music-training]').checked=s.trainingMusic;
    container.querySelectorAll('[data-music-track]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.musicTrack===s.track.id));});
    $('.music-art').classList.toggle('playing',s.status==='playing');
  });
  return {dispose(){unsubscribe();handlers.forEach(([el,name,fn])=>el.removeEventListener(name,fn));container.replaceChildren();}};
}
