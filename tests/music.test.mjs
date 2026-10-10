import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGINAL_TRACKS,originalMusicUrl,createMusicPlayer} from '../music.mjs';

class FakeAudio extends EventTarget {
  volume=1;duration=120;currentTime=0;attrs=new Map();playing=false;playCount=0;
  set src(value){this.attrs.set('src',value);} get src(){return this.attrs.get('src');}
  getAttribute(name){return this.attrs.get(name)??null;} removeAttribute(name){this.attrs.delete(name);}
  load(){} async play(){this.playCount++;this.playing=true;} pause(){this.playing=false;}
}
function setup() {const audio=new FakeAudio();const revoked=[];const changes=[];const player=createMusicPlayer({audio,url:{createObjectURL:()=>'blob:local-music',revokeObjectURL:url=>revoked.push(url)},onChange:s=>changes.push(s)});return {audio,revoked,changes,player};}

test('all seven original track names have encoded source URLs',()=>{assert.equal(ORIGINAL_TRACKS.length,7);for(const track of ORIGINAL_TRACKS){assert.ok(originalMusicUrl(track.id).startsWith('https://niuontheway-ops.github.io/human-breath/'));assert.ok(originalMusicUrl(track.id).endsWith('.mp3'));assert.ok(!originalMusicUrl(track.id).includes(' '));}assert.equal(originalMusicUrl('untrusted'),null);});
test('music does not preload or autoplay before explicit play',async()=>{const {audio,player}=setup();assert.equal(audio.preload,'none');assert.equal(audio.src,undefined);assert.equal(audio.playCount,0);assert.equal(player.getState().trainingMusic,false);await player.onTrainingState({status:'running'});assert.equal(audio.playCount,0);player.dispose();});
test('selection pauses old playback and only play loads the chosen source',async()=>{const {audio,player}=setup();await player.play();assert.equal(audio.playing,true);player.select('xuezhi');assert.equal(audio.playing,false);assert.equal(audio.src,undefined);await player.play();assert.equal(audio.src,originalMusicUrl('xuezhi'));assert.equal(player.getState().status,'playing');player.dispose();});
test('invalid track cannot change the selected source',()=>{const {player}=setup();assert.equal(player.select('../secret'),false);assert.equal(player.getState().track.id,'anni');player.dispose();});
test('local music releases object URLs on replacement and disposal',()=>{const {player,revoked}=setup();assert.equal(player.importLocal({name:'my.mp3',size:20}).ok,true);assert.equal(player.getState().track.local,true);player.select('anni');assert.deepEqual(revoked,['blob:local-music']);player.importLocal({name:'relax.wav',size:20});player.dispose();assert.equal(revoked.length,2);});
test('unsupported and oversized local files are rejected',()=>{const {player}=setup();assert.equal(player.importLocal({name:'not.html',size:20}).ok,false);assert.equal(player.importLocal({name:'large.mp3',size:101*1024*1024}).ok,false);assert.equal(player.importLocal({name:'empty.mp3',size:0}).ok,false);player.dispose();});
test('training music opt-in starts and pauses with training state',async()=>{const {audio,player}=setup();player.setTrainingMusic(true);await player.onTrainingState({status:'running'});assert.equal(audio.playing,true);for(const status of ['paused','awaiting-confirmation','stopped','completed']){await player.onTrainingState({status});assert.equal(audio.playing,false);}player.dispose();});
test('volume and seek respect media boundaries',()=>{const {audio,player}=setup();player.setVolume(2);assert.equal(audio.volume,1);player.setVolume(-1);assert.equal(audio.volume,0);assert.equal(player.seek(999),true);assert.equal(audio.currentTime,120);audio.duration=NaN;assert.equal(player.seek(5),false);player.dispose();});
test('play rejection becomes an actionable message',async()=>{const {audio,player}=setup();audio.play=()=>Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));assert.equal(await player.play(),false);assert.equal(player.getState().status,'error');assert.match(player.getState().message,/点击播放/);player.dispose();});
test('a paused pending play cannot report successful playback',async()=>{const {audio,player}=setup();let resolve;audio.play=()=>new Promise(r=>{resolve=r;});const pending=player.play();player.pause();resolve();assert.equal(await pending,false);assert.equal(player.getState().status,'paused');player.dispose();});
