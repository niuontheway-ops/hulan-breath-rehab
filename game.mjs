export const DEFAULT_BREATHING = Object.freeze({
  inhaleSeconds: 2,
  exhaleSeconds: 4,
  cycles: 10,
});

function breathingConfig(config = {}) {
  const value = { ...DEFAULT_BREATHING, ...config };
  for (const key of ['inhaleSeconds', 'exhaleSeconds']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] <= 0) {
      throw new RangeError(`${key} must be a positive, finite number.`);
    }
  }
  if (!Number.isInteger(value.cycles) || value.cycles < 1) {
    throw new RangeError('cycles must be a positive integer.');
  }
  if (!Number.isFinite((value.inhaleSeconds + value.exhaleSeconds) * 1000)) {
    throw new RangeError('The breathing round is too long.');
  }
  return Object.freeze(value);
}

/** A single guided round; elapsed time never advances into an unconfirmed round. */
export function getBreathingFrame(elapsedMs, config = {}) {
  const settings = breathingConfig(config);
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) {
    throw new TypeError('elapsedMs must be a finite number.');
  }
  const inhaleMs = settings.inhaleSeconds * 1000;
  const exhaleMs = settings.exhaleSeconds * 1000;
  const roundDurationMs = inhaleMs + exhaleMs;
  const elapsed = Math.min(roundDurationMs, Math.max(0, elapsedMs));
  const phase = elapsed >= roundDurationMs ? 'confirm' : elapsed < inhaleMs ? 'inhale' : 'exhale';
  const phaseDurationMs = phase === 'inhale' ? inhaleMs : phase === 'exhale' ? exhaleMs : 0;
  const phaseElapsedMs = phase === 'inhale' ? elapsed : phase === 'exhale' ? elapsed - inhaleMs : 0;
  return {
    phase,
    roundElapsedMs: elapsed,
    roundDurationMs,
    phaseDurationMs,
    phaseElapsedMs,
    remainingMs: phaseDurationMs - phaseElapsedMs,
    phaseProgress: phaseDurationMs ? phaseElapsedMs / phaseDurationMs : 1,
    roundProgress: elapsed / roundDurationMs,
  };
}

/** Monotonic guidance clock. Confirmations are self reports, without sensor measurements. */
export function createBreathingSession(config = {}, { now = () => performance.now() } = {}) {
  const settings = breathingConfig(config);
  const durationMs = (settings.inhaleSeconds + settings.exhaleSeconds) * 1000;
  let status = 'idle';
  let completedCycles = 0;
  let accumulatedMs = 0;
  let startedAt = null;
  let lastClock = -Infinity;
  let pauseReason = null;
  let stopReason = null;

  function clock() {
    const current = now();
    if (typeof current !== 'number' || !Number.isFinite(current)) {
      throw new TypeError('The monotonic clock must return a finite number.');
    }
    lastClock = Math.max(lastClock, current);
    return lastClock;
  }

  function sync() {
    if (status !== 'running') return accumulatedMs;
    const elapsed = Math.min(durationMs, accumulatedMs + Math.max(0, clock() - startedAt));
    if (elapsed >= durationMs) {
      accumulatedMs = durationMs;
      startedAt = null;
      status = 'awaiting-confirmation';
    }
    return elapsed;
  }

  function getState() {
    const elapsed = sync();
    const frame = getBreathingFrame(elapsed, settings);
    return {
      ...frame,
      phase: status === 'idle' ? 'ready' : status === 'completed' ? 'complete' : status === 'stopped' ? 'stopped' : frame.phase,
      status,
      completedCycles,
      totalCycles: settings.cycles,
      currentCycle: Math.min(completedCycles + 1, settings.cycles),
      activeDurationMs: completedCycles * durationMs + (status === 'completed' ? 0 : elapsed),
      activeGuidanceSeconds: (completedCycles * durationMs + (status === 'completed' ? 0 : elapsed)) / 1000,
      pauseReason,
      stopReason,
      selfReported: true,
    };
  }

  return {
    getState,
    start() {
      if (status !== 'idle') return false;
      startedAt = clock();
      status = 'running';
      return true;
    },
    pause(reason = 'manual') {
      const elapsed = sync();
      if (status !== 'running') return false;
      accumulatedMs = elapsed;
      startedAt = null;
      pauseReason = reason;
      status = 'paused';
      return true;
    },
    resume() {
      if (status !== 'paused') return false;
      startedAt = clock();
      pauseReason = null;
      status = 'running';
      return true;
    },
    confirm() {
      sync();
      if (status !== 'awaiting-confirmation') return false;
      completedCycles += 1;
      if (completedCycles >= settings.cycles) {
        status = 'completed';
      } else {
        accumulatedMs = 0;
        startedAt = clock();
        status = 'running';
      }
      return true;
    },
    stop(reason = 'manual') {
      const elapsed = sync();
      if (status === 'completed' || status === 'stopped') return false;
      accumulatedMs = elapsed;
      startedAt = null;
      pauseReason = null;
      stopReason = reason;
      status = 'stopped';
      return true;
    },
  };
}

const encouragements = [
  '太棒了，按自己的节奏来。',
  '每一次练习，都是进步。',
  '慢慢来，小苗和你一起成长。',
  '今天的坚持，值得给自己一点鼓励。',
];
let instanceCount = 0;

const gameStyles = `
.game-shell{--game-green:#216858;--game-ink:#233c36;--game-light:#f3f7f0;--game-accent:#cde6a3;color:var(--game-ink);font-family:inherit;line-height:1.6;background:var(--game-light);border:1px solid #dbe6d8;border-radius:28px;overflow:hidden}
.game-shell *{box-sizing:border-box}.game-shell button,.game-shell input{font:inherit}
.game-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:24px 28px 0}.game-heading h3{margin:0;font-size:clamp(22px,3vw,30px);font-weight:700;letter-spacing:-.04em}.game-heading p{margin:6px 0 0;font-size:14px;color:#53685f;max-width:40em}
.game-chip{flex-shrink:0;padding:5px 12px;border-radius:30px;background:#e1eed8;color:var(--game-green);font-size:12px;font-weight:650;white-space:nowrap}
.game-landscape{position:relative;margin-top:4px}.game-scene{display:block;width:100%;height:auto;max-height:390px}.game-plant-leaf,.game-flower{transition:opacity 1s ease}.game-current{stroke-dasharray:9 19;animation:game-flow 7s linear infinite}.game-shell:not([data-phase="exhale"]) .game-current,.game-shell[data-status="paused"] .game-current,.game-shell[data-status="idle"] .game-current,.game-shell[data-status="awaiting-confirmation"] .game-current,.game-shell[data-status="completed"] .game-current,.game-shell[data-status="stopped"] .game-current{animation-play-state:paused}
.game-garden-note{position:absolute;left:28px;bottom:18px;color:#416654;font-size:13px;background:#f8fbf1d9;padding:7px 12px;border-radius:30px}
.game-console{padding:0 28px 26px}.game-guide{display:grid;grid-template-columns:88px 1fr;gap:20px;align-items:center;background:#fff;border:1px solid #e1e8dd;border-radius:20px;padding:18px 22px}.game-orbit{width:82px;height:82px;display:grid;place-items:center;border:1px solid #c9ddcc;border-radius:50%;background:#f1f6eb;position:relative}.game-breath-disc{position:absolute;width:48px;height:48px;border-radius:50%;background:var(--game-accent);transform:scale(var(--game-breath-scale,1));opacity:.78}.game-count{position:relative;z-index:1;font-size:28px;font-weight:650;line-height:1;color:var(--game-green);font-variant-numeric:tabular-nums}.game-count small{display:block;text-align:center;font-size:11px;font-weight:500;margin-top:5px}.game-phase{font-weight:700;font-size:22px;margin:0;color:var(--game-green)}.game-instruction{font-size:14px;margin:3px 0 0;color:#53685f}.game-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.game-progress-label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;margin:18px 0 7px}.game-progress-label strong{font-size:15px;color:var(--game-green)}.game-progress{height:7px;border-radius:8px;background:#dae6d3;overflow:hidden}.game-progress-fill{height:100%;width:0;background:var(--game-green);border-radius:8px;transition:width .5s ease}.game-encouragement{font-size:16px;font-weight:600;margin:17px 0 3px;min-height:26px}.game-status-note{color:#647268;font-size:13px;margin:0;min-height:24px}.game-controls{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.game-shell button{min-height:46px;min-width:44px;border-radius:12px;padding:10px 19px;border:1px solid #b9cdbf;cursor:pointer;font-weight:650;transition:background .15s ease,box-shadow .15s ease;background:#fff;color:var(--game-green)}.game-shell button:hover:not(:disabled){background:#eaf2e4}.game-shell button:focus-visible,.game-shell input:focus-visible{outline:3px solid #79aa5a;outline-offset:4px}.game-shell .game-primary{background:var(--game-green);color:#fff;border-color:var(--game-green);flex:1;min-width:170px}.game-shell .game-primary:hover:not(:disabled){background:#174b40}.game-shell .game-stop{color:#814834;border-color:#d7bdae;background:#fffaf6}.game-shell button:disabled{cursor:default;opacity:.55}.game-options{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;margin-top:17px;font-size:12px;color:#647268}.game-voice-toggle{display:flex;gap:8px;align-items:center;min-height:44px;cursor:pointer}.game-voice-toggle input{accent-color:var(--game-green);width:18px;height:18px}.game-privacy{border-top:1px solid #dce6d7;margin:12px 0 0;padding-top:12px;font-size:12px;color:#647268}
@keyframes game-flow{to{stroke-dashoffset:-140}}
@media(max-width:540px){.game-heading{padding:20px 18px 0;gap:10px}.game-heading p{font-size:13px}.game-chip{font-size:11px;padding:4px 8px}.game-console{padding:0 18px 21px}.game-guide{gap:13px;padding:16px 14px;grid-template-columns:70px 1fr}.game-orbit{width:67px;height:67px}.game-phase{font-size:20px}.game-instruction{font-size:13px}.game-garden-note{left:18px;bottom:10px;font-size:12px}.game-controls{gap:8px}.game-shell button{padding:10px 14px}.game-shell .game-primary{flex-basis:100%}.game-controls .game-secondary,.game-controls .game-stop{flex:1}.game-scene{min-height:195px;object-fit:cover}}
@media(prefers-reduced-motion:reduce){.game-current{animation:none}.game-plant-leaf,.game-flower,.game-progress-fill,.game-shell button{transition:none}}
`;

function sceneMarkup(id) {
  return `<svg class="game-scene" viewBox="0 0 900 410" role="img" aria-label="绿山和小溪环绕的小花园，小苗随着已确认的练习轮数长出新叶。">
    <defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#f3f7f0"/><stop offset="1" stop-color="#e5eedc"/></linearGradient><linearGradient id="${id}-water" x2="1" y2="1"><stop stop-color="#d6e9df"/><stop offset="1" stop-color="#b1d7c4"/></linearGradient></defs>
    <rect width="900" height="410" fill="url(#${id}-sky)"/>
    <circle cx="728" cy="75" r="35" fill="#e5eec7"/><circle cx="728" cy="75" r="48" fill="none" stroke="#e7eecd"/>
    <path d="M0 213Q70 139 154 178T303 139Q363 121 436 183T594 176Q690 91 769 149T900 163V410H0Z" fill="#d3e1cc"/>
    <path d="M0 244Q116 173 227 220T440 202Q570 162 671 214T900 197V410H0Z" fill="#b7cfb2"/>
    <path d="M0 288Q132 233 270 271T520 237Q703 257 900 237V410H0Z" fill="#8fb791"/>
    <path d="M533 238C468 268 637 281 570 305S292 342 416 410H726C512 362 739 332 675 300S552 274 574 238Z" fill="url(#${id}-water)"/>
    <path class="game-current" d="M554 252C496 276 652 282 613 306S407 349 537 397" fill="none" stroke="#f6fff7" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="M0 329Q133 299 259 325T466 361L463 410H0Z" fill="#78a781"/><path d="M681 328Q790 293 900 313V410H772Z" fill="#7ba687"/>
    <path d="M229 368Q328 310 440 338T606 377Q487 407 362 401T229 368Z" fill="#d4dfb7"/><ellipse cx="430" cy="369" rx="71" ry="16" fill="#b6c99e"/>
    <path d="M166 318q17-19 32-5l4 11h-42z" fill="#a0b393"/><path d="M748 332q18-20 39-5l6 12h-50z" fill="#adc2a3"/>
    <g data-game-plant transform="translate(430 365) scale(.46)">
      <path d="M0 0C-7-46 7-100-2-194" fill="none" stroke="#3d7951" stroke-width="7" stroke-linecap="round"/>
      <g class="game-plant-leaf" data-game-leaf="0"><path d="M-2-40C-29-43-49-62-51-86C-20-84-3-65-2-40Z" fill="#4a885b"/><path d="M0-62C25-65 44-84 47-107C17-107 1-89 0-62Z" fill="#76a76c"/></g>
      <g class="game-plant-leaf" data-game-leaf="0.2" opacity="0"><path d="M-1-99C-30-98-57-117-60-145C-30-146-7-126-1-99Z" fill="#619a62"/><path d="M0-115C29-113 53-128 59-155C31-159 8-142 0-115Z" fill="#82b472"/></g>
      <g class="game-plant-leaf" data-game-leaf="0.5" opacity="0"><path d="M-1-155C-26-155-43-170-44-192C-21-191-6-177-1-155Z" fill="#4d8b57"/><path d="M-2-171C19-169 37-183 40-205C16-204-1-190-2-171Z" fill="#83ad68"/></g>
      <g class="game-flower" data-game-flower opacity="0" transform="translate(-2 -206)"><ellipse cy="-15" rx="10" ry="16" fill="#f6e7ac"/><ellipse cx="14" cy="-5" rx="16" ry="10" transform="rotate(-20 14 -5)" fill="#f4e3a3"/><ellipse cx="9" cy="13" rx="10" ry="16" transform="rotate(-35 9 13)" fill="#f6e7ac"/><ellipse cx="-10" cy="12" rx="10" ry="16" transform="rotate(35 -10 12)" fill="#f4e3a3"/><ellipse cx="-14" cy="-6" rx="16" ry="10" transform="rotate(20 -14 -6)" fill="#f6e7ac"/><circle r="10" fill="#caad62"/></g>
    </g>
    <path d="M101 344v-15m-7 12 7-12 7 12M826 363v-17m-8 13 8-13 8 13" stroke="#588a60" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
}

export function mountGame(container, { breathing = {}, onComplete = () => {}, onStop = () => {} } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') {
    throw new TypeError('mountGame requires a DOM container.');
  }
  const settings = breathingConfig(breathing);
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const session = createBreathingSession(settings, { now: () => win.performance.now() });
  const id = `breathing-garden-${++instanceCount}`;
  const root = doc.createElement('section');
  root.className = 'game-shell';
  root.setAttribute('aria-label', '呼吸小花园互动训练');
  root.innerHTML = `<style>${gameStyles}</style>
    <div class="game-heading"><div><h3>呼吸小花园</h3><p>跟着小苗，轻轻吸气、缓慢呼气。每一轮都由你自己确认。</p></div><span class="game-chip">轻松练习</span></div>
    <div class="game-landscape">${sceneMarkup(id)}<span class="game-garden-note" data-game-garden-note>小苗在等你，一起慢慢来</span></div>
    <div class="game-console">
      <div class="game-guide"><div class="game-orbit" aria-hidden="true"><span class="game-breath-disc"></span><span class="game-count" data-game-count>—<small>准备</small></span></div><div><p class="game-phase" data-game-phase>准备好，再开始</p><p class="game-instruction" data-game-instruction>用鼻轻轻吸气 ${settings.inhaleSeconds} 秒，缩唇缓慢呼气 ${settings.exhaleSeconds} 秒。不屏息，不用力吹。</p></div></div>
      <p class="game-live" role="status" aria-live="polite" aria-atomic="true" data-game-live></p>
      <div class="game-progress-label"><strong data-game-progress-label>已确认 0 / ${settings.cycles} 轮</strong><span>可随时暂停</span></div>
      <div class="game-progress" role="progressbar" aria-label="自行确认完成的练习轮数" aria-valuemin="0" aria-valuemax="${settings.cycles}" aria-valuenow="0"><div class="game-progress-fill"></div></div>
      <p class="game-encouragement" data-game-encouragement>按自己的节奏来，准备好再开始。</p>
      <p class="game-status-note" data-game-note>如感到不适，请立即停止并休息。</p>
      <div class="game-controls"><button type="button" class="game-primary" data-game-action="primary">开始本轮</button><button type="button" class="game-secondary" data-game-action="pause" disabled>暂停</button><button type="button" class="game-stop" data-game-action="stop">停止并休息</button></div>
      <div class="game-options"><label class="game-voice-toggle"><input type="checkbox" data-game-voice/>朗读鼓励（默认关闭）</label><span data-game-voice-note>文字鼓励始终显示</span></div>
      <p class="game-privacy">记录来自你的自行确认，仅表示完成了引导练习。未检测实际呼吸质量，也不代表肺功能改善；不使用麦克风或摄像头。</p>
    </div>`;
  container.replaceChildren(root);

  const elements = {
    phase: root.querySelector('[data-game-phase]'),
    instruction: root.querySelector('[data-game-instruction]'),
    count: root.querySelector('[data-game-count]'),
    live: root.querySelector('[data-game-live]'),
    progressLabel: root.querySelector('[data-game-progress-label]'),
    progress: root.querySelector('[role="progressbar"]'),
    progressFill: root.querySelector('.game-progress-fill'),
    encouragement: root.querySelector('[data-game-encouragement]'),
    note: root.querySelector('[data-game-note]'),
    gardenNote: root.querySelector('[data-game-garden-note]'),
    plant: root.querySelector('[data-game-plant]'),
    leaves: [...root.querySelectorAll('[data-game-leaf]')],
    flower: root.querySelector('[data-game-flower]'),
    primary: root.querySelector('[data-game-action="primary"]'),
    pause: root.querySelector('[data-game-action="pause"]'),
    stop: root.querySelector('[data-game-action="stop"]'),
    voice: root.querySelector('[data-game-voice]'),
    voiceNote: root.querySelector('[data-game-voice-note]'),
  };
  const motionQuery = win.matchMedia('(prefers-reduced-motion: reduce)');
  const synth = win.speechSynthesis;
  let disposed = false;
  let frameId = null;
  let previousAnnouncement = '';
  let lastUtterance = null;
  let completedCallbackSent = false;

  function cancelSpeech() {
    if (lastUtterance && synth) synth.cancel();
    lastUtterance = null;
  }

  function localVoice() {
    return synth?.getVoices().find((voice) => voice.localService === true && /^zh(?:[-_]|$)/i.test(voice.lang));
  }

  function updateVoiceNote() {
    if (!elements.voice.checked) {
      elements.voiceNote.textContent = '文字鼓励始终显示';
    } else if (localVoice()) {
      elements.voiceNote.textContent = '使用设备本地中文声音';
    } else {
      elements.voiceNote.textContent = '暂无本地中文声音，继续使用文字鼓励';
    }
  }

  function speak(text) {
    if (!elements.voice.checked || disposed || doc.hidden) return;
    const voice = localVoice();
    if (!voice || !win.SpeechSynthesisUtterance) {
      updateVoiceNote();
      return;
    }
    cancelSpeech();
    const utterance = new win.SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.onend = () => { if (lastUtterance === utterance) lastUtterance = null; };
    utterance.onerror = () => {
      if (disposed) return;
      if (lastUtterance === utterance) lastUtterance = null;
      elements.voiceNote.textContent = '朗读暂不可用，继续使用文字鼓励';
    };
    lastUtterance = utterance;
    synth.speak(utterance);
  }

  function render() {
    const state = session.getState();
    root.dataset.status = state.status;
    root.dataset.phase = state.phase;
    let phaseText = '准备好，再开始';
    let instruction = `用鼻轻轻吸气 ${settings.inhaleSeconds} 秒，缩唇缓慢呼气 ${settings.exhaleSeconds} 秒。不屏息，不用力吹。`;
    let count = '—';
    let countLabel = '准备';
    let note = '如感到不适，请立即停止并休息。';
    if (state.status === 'running' || state.status === 'paused') {
      const inhale = state.phase === 'inhale';
      phaseText = inhale ? '轻轻鼻吸' : '缩唇，缓慢呼气';
      instruction = inhale ? '轻柔地吸气，让肩膀放松。' : '嘴唇微微收拢，慢慢呼出，不用力吹。';
      count = String(Math.ceil(state.remainingMs / 1000));
      countLabel = '秒';
      if (state.status === 'paused') {
        phaseText = '已经暂停，先休息';
        instruction = '阶段剩余时间已保留，准备好后再继续。';
        note = state.pauseReason === 'hidden' ? '离开页面时已自动暂停；请主动点击「继续本轮」。' : '休息一下也很好，准备好再继续。';
      }
    } else if (state.status === 'awaiting-confirmation') {
      phaseText = '这一轮引导结束';
      instruction = '如果你已经完成这一轮，请自行确认。准备好了再继续。';
      count = '✓';
      countLabel = '确认';
      note = '正在等待你的确认，计时已暂停。';
    } else if (state.status === 'completed') {
      phaseText = '小花园开花啦';
      instruction = '你已自行确认完成今天这次练习，可以休息一下。';
      count = '✓';
      countLabel = '完成';
      note = '本次为自我记录，未测量呼吸质量或身体改善。';
    } else if (state.status === 'stopped') {
      phaseText = '已经停止，安心休息';
      instruction = '本次引导已结束，不再累计时间。';
      count = '—';
      countLabel = '休息';
      note = '如感到不适，请根据页面的安全提示处理。';
    }
    elements.phase.textContent = phaseText;
    elements.instruction.textContent = instruction;
    const counterMarkup = `${count}<small>${countLabel}</small>`;
    if (elements.count.innerHTML !== counterMarkup) elements.count.innerHTML = counterMarkup;
    elements.note.textContent = note;
    elements.primary.textContent = ({ idle: '开始本轮', running: '跟随自己的节奏…', paused: '继续本轮', 'awaiting-confirmation': '完成这一轮', completed: '本次练习已完成', stopped: '本次练习已停止' })[state.status];
    elements.primary.disabled = ['running', 'completed', 'stopped'].includes(state.status);
    elements.pause.disabled = state.status !== 'running';
    elements.pause.textContent = state.status === 'paused' ? '已暂停' : '暂停';
    elements.stop.disabled = ['completed', 'stopped'].includes(state.status);
    const ratio = state.completedCycles / state.totalCycles;
    elements.progressLabel.textContent = `已确认 ${state.completedCycles} / ${state.totalCycles} 轮`;
    if (elements.progress.getAttribute('aria-valuenow') !== String(state.completedCycles)) {
      elements.progress.setAttribute('aria-valuenow', String(state.completedCycles));
    }
    elements.progressFill.style.width = `${ratio * 100}%`;
    elements.gardenNote.textContent = state.status === 'completed' ? '一朵小花，送给今天坚持的你' : state.completedCycles ? '每一次确认，小苗就长大一点' : '小苗在等你，一起慢慢来';
    const breath = state.phase === 'inhale' ? state.phaseProgress : state.phase === 'exhale' ? 1 - state.phaseProgress : 0;
    const motion = !motionQuery.matches && state.status === 'running';
    root.style.setProperty('--game-breath-scale', String(motion ? 0.84 + breath * 0.4 : 1));
    elements.plant.setAttribute('transform', `translate(430 365) scale(${(0.46 + ratio * 0.5) * (motion ? 1 + breath * 0.025 : 1)})`);
    for (const leaf of elements.leaves) leaf.setAttribute('opacity', ratio >= Number(leaf.dataset.gameLeaf) ? '1' : '0');
    elements.flower.setAttribute('opacity', state.status === 'completed' ? '1' : '0');
    const announcement = `${state.status}-${state.phase}-${state.completedCycles}`;
    if (announcement !== previousAnnouncement) {
      previousAnnouncement = announcement;
      elements.live.textContent = `${phaseText}。已确认 ${state.completedCycles} 轮，共 ${state.totalCycles} 轮。`;
    }
    return state;
  }

  function tick() {
    frameId = null;
    if (disposed) return;
    const state = render();
    if (state.status === 'running') frameId = win.requestAnimationFrame(tick);
  }

  function refresh() {
    if (disposed) return;
    if (frameId !== null) win.cancelAnimationFrame(frameId);
    frameId = null;
    const state = render();
    if (state.status === 'running') frameId = win.requestAnimationFrame(tick);
  }

  function pause(reason = 'manual') {
    if (disposed) return;
    session.pause(reason);
    cancelSpeech();
    refresh();
  }

  function onClick(event) {
    const button = event.target.closest?.('[data-game-action]');
    if (!button || !root.contains(button) || button.disabled || disposed) return;
    const action = button.dataset.gameAction;
    if (action === 'pause') return pause();
    if (action === 'stop') {
      if (session.stop('manual')) {
        cancelSpeech();
        elements.encouragement.textContent = '听从自己的感受，休息也是照顾自己。';
        refresh();
        onStop('manual');
      }
      return;
    }
    const before = session.getState();
    if (before.status === 'idle') {
      session.start();
    } else if (before.status === 'paused') {
      session.resume();
    } else if (before.status === 'awaiting-confirmation' && session.confirm()) {
      if (doc.hidden) session.pause('hidden');
      const state = session.getState();
      const text = state.status === 'completed' ? '太棒了，今天的练习已经完成。给自己一个微笑。' : encouragements[(state.completedCycles - 1) % encouragements.length];
      elements.encouragement.textContent = text;
      speak(text);
      refresh();
      if (state.status === 'completed' && !completedCallbackSent) {
        completedCallbackSent = true;
        onComplete({
          recordType: 'self-reported-training',
          completedAt: new Date().toISOString(),
          completedCycles: state.completedCycles,
          targetCycles: state.totalCycles,
          activeDurationMs: state.activeDurationMs,
          activeGuidanceSeconds: state.activeGuidanceSeconds,
          breathing: { ...settings },
          selfReported: true,
          breathingQualityMeasured: false,
        });
      }
      return;
    }
    if (doc.hidden) session.pause('hidden');
    refresh();
  }

  function onVoiceChange(event) {
    if (event.target !== elements.voice) return;
    updateVoiceNote();
    if (!elements.voice.checked) cancelSpeech();
    else speak(elements.encouragement.textContent);
  }

  function onVisibilityChange() {
    if (doc.hidden) pause('hidden');
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onVoiceChange);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  motionQuery.addEventListener('change', refresh);
  synth?.addEventListener('voiceschanged', updateVoiceNote);
  refresh();

  return {
    pause,
    getState: () => session.getState(),
    dispose() {
      if (disposed) return;
      disposed = true;
      session.pause('disposed');
      if (frameId !== null) win.cancelAnimationFrame(frameId);
      frameId = null;
      cancelSpeech();
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onVoiceChange);
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', refresh);
      synth?.removeEventListener('voiceschanged', updateVoiceNote);
      root.remove();
    },
  };
}
