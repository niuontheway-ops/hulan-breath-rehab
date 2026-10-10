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

/** Demonstration geometry only; these values are not observations of the patient. */
export function getPatientAnimationFrame(frame, { reducedMotion = false } = {}) {
  const progress = Number.isFinite(frame.phaseProgress) ? Math.min(1, Math.max(0, frame.phaseProgress)) : 0;
  const inhale = frame.phase === 'inhale';
  const exhale = frame.phase === 'exhale';
  const eased = progress * progress * (3 - 2 * progress);
  const level = reducedMotion ? 0 : inhale ? eased : exhale ? 1 - eased : 0;
  const cueOpacity = reducedMotion ? 0.8 : 0.6 + Math.sin(progress * Math.PI) * 0.3;
  const lipProgress = Math.min(1, progress / 0.14);
  const lipRoundness = exhale ? reducedMotion ? 1 : lipProgress * lipProgress * (3 - 2 * lipProgress) : 0;
  return {
    breathLevel: level,
    abdomenScaleX: 1 + level * 0.12,
    abdomenScaleY: 1 + level * 0.035,
    chestScaleX: 1 + level * 0.025,
    chestScaleY: 1 + level * 0.015,
    handOffsetX: level * 18,
    handOffsetY: level * -3,
    chestHandOffsetX: level * 2,
    lipRoundness,
    lipOpening: 0.8 + lipRoundness * 3.8,
    flowOffset: reducedMotion ? 0 : progress * 12,
    inhaleOpacity: inhale ? cueOpacity : 0,
    exhaleOpacity: exhale ? cueOpacity : 0,
  };
}

/** Fixed elbows and moving hand targets keep the demonstration's arm joints connected. */
export function getPatientPoseGeometry(pose) {
  const x = pose.handOffsetX;
  const y = pose.handOffsetY;
  const c = pose.chestHandOffsetX;
  const r = pose.lipRoundness;
  const detail = pose.breathLevel * 26;
  return {
    belly: `M174 203Q226 190 280 204C${300 + x} 231 ${299 + x} 263 284 279Q238 304 172 288Q160 252 174 203Z`,
    bellySeam: `M279 211Q${300 + x} 248 284 276`,
    bellyFold: `M227 265Q${253 + x * 0.4} 272 ${278 + x * 0.3} 263M196 283Q237 293 275 277`,
    abdomenForearm: `M164 229Q180 269 ${267 + x} ${254 + y}`,
    forearmHighlight: `M168 236Q197 259 ${256 + x} ${250 + y}`,
    chestForearm: `M272 212Q282 195 ${258 + c} ${191 + y * 0.15}`,
    lips: `M${271 + 5 * r} ${113 - 2 * r}Q${278 + 6 * r} ${111 - 2 * r} ${283 + 6 * r} 114Q${285 + 4 * r} ${118 + 2 * r} ${274 + 4 * r} ${117 + 2 * r}Q${273 + 3 * r} 114 ${271 + 5 * r} ${113 - 2 * r}Z`,
    detailLips: `M${109 + 13 * r} ${105 - 3 * r}Q${121 + 14 * r} ${100 - 3 * r} ${130 + 11 * r} 105Q${133 + 12 * r} ${113 + 6 * r} ${109 + 15 * r} ${110 + 6 * r}Q${112 + 12 * r} 108 ${109 + 13 * r} ${105 - 3 * r}Z`,
    detailBelly: `M41 12Q104 8 119 22Q${158 + detail} 46 145 133H40Z`,
    detailBellyLine: `M124 25Q${159 + detail} 66 145 131`,
    detailArm: `M30 77Q58 114 ${130 + detail * 0.65} ${92 + y}`,
    detailHandX: detail * 0.65,
  };
}

/** Monotonic guidance clock. Confirmations are self reports, without sensor measurements. */
export function createBreathingSession(config = {}, { now = () => performance.now(), onStateChange = () => {} } = {}) {
  const settings = breathingConfig(config);
  const durationMs = (settings.inhaleSeconds + settings.exhaleSeconds) * 1000;
  let status = 'idle';
  let completedCycles = 0;
  let accumulatedMs = 0;
  let startedAt = null;
  let lastClock = -Infinity;
  let pauseReason = null;
  let stopReason = null;
  let lastStateKey = '';

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
    const state = {
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
    const stateKey = `${state.status}|${state.phase}|${state.completedCycles}|${pauseReason}|${stopReason}`;
    if (stateKey !== lastStateKey) {
      lastStateKey = stateKey;
      onStateChange({ ...state });
    }
    return state;
  }

  return {
    getState,
    start() {
      if (status !== 'idle') return false;
      startedAt = clock();
      status = 'running';
      getState();
      return true;
    },
    pause(reason = 'manual') {
      const elapsed = sync();
      if (status !== 'running') return false;
      accumulatedMs = elapsed;
      startedAt = null;
      pauseReason = reason;
      status = 'paused';
      getState();
      return true;
    },
    resume() {
      if (status !== 'paused') return false;
      startedAt = clock();
      pauseReason = null;
      status = 'running';
      getState();
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
      getState();
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
      getState();
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
.game-visuals{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px;margin:22px 28px 20px;align-items:stretch}.game-demonstration{min-width:0;background:#fff;border:1px solid #dce6d7;border-radius:20px;padding:18px}.game-demo-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.game-demo-heading h4,.game-garden-heading{font-size:17px;font-weight:700;margin:0;color:var(--game-green)}.game-demo-heading span{font-size:11px;color:#647268}.game-patient-stage{margin:12px 0;background:#f3f7f0;border-radius:15px;overflow:hidden}.game-patient{display:block;width:100%;height:auto;max-height:300px}.game-patient text{font-family:inherit}.game-demo-step{margin:0;color:var(--game-green);font-size:16px;font-weight:700;line-height:1.5}.game-demo-instruction{font-size:13px;color:#53685f;margin:5px 0 12px;line-height:1.7}.game-demo-controls{display:flex;flex-wrap:wrap;gap:7px}.game-shell .game-demo-button{flex:1 1 60px;min-width:0;padding:8px 6px;font-size:12px;border-radius:10px;font-weight:600}.game-shell .game-demo-button[aria-pressed="true"]{background:#e4efd9;border-color:#8bad74;color:#285c3b}.game-demo-explanation{font-size:13px;color:#53685f;line-height:1.7;min-height:66px;margin:10px 0 0}.game-reduced-note{font-size:12px;color:#647268;margin:9px 0 0}.game-reduced-note:empty{display:none}.game-visuals .game-landscape{min-width:0;margin:0;background:#eaf1e4;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:50px 0 48px}.game-garden-heading{position:absolute;top:18px;left:20px}.game-visuals .game-garden-note{left:18px;right:18px;bottom:16px;background:#f3f7f0;font-size:12px;text-align:center;white-space:normal}.game-patient [data-game-focus]{opacity:0}.game-patient[data-focus="inhale"] [data-game-focus="inhale"],.game-patient[data-focus="exhale"] [data-game-focus="exhale"],.game-patient[data-focus="abdomen"] [data-game-focus="abdomen"]{opacity:.75}
.game-landscape{position:relative;margin-top:4px}.game-scene{display:block;width:100%;height:auto;max-height:390px}.game-plant-leaf,.game-flower{transition:opacity 1s ease}.game-current{stroke-dasharray:9 19;animation:game-flow 7s linear infinite}.game-shell:not([data-phase="exhale"]) .game-current,.game-shell[data-status="paused"] .game-current,.game-shell[data-status="idle"] .game-current,.game-shell[data-status="awaiting-confirmation"] .game-current,.game-shell[data-status="completed"] .game-current,.game-shell[data-status="stopped"] .game-current{animation-play-state:paused}
.game-garden-note{position:absolute;left:28px;bottom:18px;color:#416654;font-size:13px;background:#f8fbf1d9;padding:7px 12px;border-radius:30px}
.game-console{padding:0 28px 26px}.game-guide{display:grid;grid-template-columns:88px 1fr;gap:20px;align-items:center;background:#fff;border:1px solid #e1e8dd;border-radius:20px;padding:18px 22px}.game-orbit{width:82px;height:82px;display:grid;place-items:center;border:1px solid #c9ddcc;border-radius:50%;background:#f1f6eb;position:relative}.game-breath-disc{position:absolute;width:48px;height:48px;border-radius:50%;background:var(--game-accent);transform:scale(var(--game-breath-scale,1));opacity:.78}.game-count{position:relative;z-index:1;font-size:28px;font-weight:650;line-height:1;color:var(--game-green);font-variant-numeric:tabular-nums}.game-count small{display:block;text-align:center;font-size:11px;font-weight:500;margin-top:5px}.game-phase{font-weight:700;font-size:22px;margin:0;color:var(--game-green)}.game-instruction{font-size:14px;margin:3px 0 0;color:#53685f}.game-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.game-progress-label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;margin:18px 0 7px}.game-progress-label strong{font-size:15px;color:var(--game-green)}.game-progress{height:7px;border-radius:8px;background:#dae6d3;overflow:hidden}.game-progress-fill{height:100%;width:0;background:var(--game-green);border-radius:8px;transition:width .5s ease}.game-encouragement{font-size:16px;font-weight:600;margin:17px 0 3px;min-height:26px}.game-status-note{color:#647268;font-size:13px;margin:0;min-height:24px}.game-controls{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.game-shell button{min-height:46px;min-width:44px;border-radius:12px;padding:10px 19px;border:1px solid #b9cdbf;cursor:pointer;font-weight:650;transition:background .15s ease,box-shadow .15s ease;background:#fff;color:var(--game-green)}.game-shell button:hover:not(:disabled){background:#eaf2e4}.game-shell button:focus-visible,.game-shell input:focus-visible{outline:3px solid #79aa5a;outline-offset:4px}.game-shell .game-primary{background:var(--game-green);color:#fff;border-color:var(--game-green);flex:1;min-width:170px}.game-shell .game-primary:hover:not(:disabled){background:#174b40}.game-shell .game-stop{color:#814834;border-color:#d7bdae;background:#fffaf6}.game-shell button:disabled{cursor:default;opacity:.55}.game-options{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;margin-top:17px;font-size:12px;color:#647268}.game-voice-toggle{display:flex;gap:8px;align-items:center;min-height:44px;cursor:pointer}.game-voice-toggle input{accent-color:var(--game-green);width:18px;height:18px}.game-privacy{border-top:1px solid #dce6d7;margin:12px 0 0;padding-top:12px;font-size:12px;color:#647268}
@keyframes game-flow{to{stroke-dashoffset:-140}}
@media(max-width:700px){.game-visuals{grid-template-columns:minmax(0,1fr);gap:13px;margin:18px 18px}.game-demonstration{padding:16px}.game-patient{max-height:285px}.game-demo-explanation{min-height:0}.game-visuals .game-landscape{padding-top:44px;padding-bottom:45px}.game-visuals .game-scene{max-height:220px;min-height:0}.game-garden-heading{font-size:16px;top:14px;left:18px}}
@media(max-width:540px){.game-heading{padding:20px 18px 0;gap:10px}.game-heading p{font-size:13px}.game-chip{font-size:11px;padding:4px 8px}.game-console{padding:0 18px 21px}.game-guide{gap:13px;padding:16px 14px;grid-template-columns:70px 1fr}.game-orbit{width:67px;height:67px}.game-phase{font-size:20px}.game-instruction{font-size:13px}.game-garden-note{left:18px;bottom:10px;font-size:12px}.game-controls{gap:8px}.game-shell button{padding:10px 14px}.game-shell .game-primary{flex-basis:100%}.game-controls .game-secondary,.game-controls .game-stop{flex:1}.game-scene{min-height:195px;object-fit:cover}}
@media(prefers-reduced-motion:reduce){.game-current{animation:none}.game-plant-leaf,.game-flower,.game-progress-fill,.game-shell button{transition:none}}
.game-visuals{grid-template-columns:minmax(0,1.85fr) minmax(230px,.9fr);gap:20px}.game-demonstration{padding:22px;background:linear-gradient(145deg,#fff,#f7f9f3);border-radius:24px;box-shadow:0 10px 28px #2a58450a}.game-demo-heading span{font-size:12px}.game-patient-stage{position:relative;background:radial-gradient(ellipse at 65% 20%,#fbf5e8,#edf4ea 70%);border:1px solid #e3eadd;border-radius:20px}.game-patient{max-height:355px}.game-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}.game-detail{min-width:0;margin:0;padding:11px 12px 8px;border:1px solid #dce7d6;background:#fff;border-radius:17px}.game-detail figcaption{display:flex;align-items:center;gap:7px;font-weight:700;color:#285749;font-size:14px}.game-detail figcaption span{width:23px;height:23px;display:inline-grid;place-items:center;background:#ebf3e3;color:#365f3f;border-radius:50%;font-size:11px}.game-detail svg{display:block;width:100%;height:auto;max-height:125px;overflow:visible}.game-detail-label{font-size:12px;margin:1px 0 0;color:#526959}.game-demo-controls{margin-top:14px}.game-demo-explanation{min-height:0;margin-top:9px}.game-pose-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:13px 0 0;padding-top:12px;border-top:1px solid #e1e9db}.game-pose-controls>span{font-size:12px;color:#59705e}.game-shell .game-pose-button{min-height:42px;padding:6px 10px;font-size:12px;border-radius:10px;font-weight:600}.game-shell .game-pose-button[aria-pressed="true"]{background:#e3eddb;border-color:#80a566;color:#315b3b}.game-patient [data-game-focus]{opacity:0}.game-patient[data-focus="inhale"] [data-game-focus="inhale"],.game-patient[data-focus="exhale"] [data-game-focus="exhale"],.game-patient[data-focus="abdomen"] [data-game-focus="abdomen"]{opacity:.8}.game-shell[data-inspection="true"] .game-demo-step{color:#76542f}.game-shell .game-detail svg text{font:inherit;font-size:13px}
@media(max-width:1020px){.game-visuals{grid-template-columns:minmax(0,1fr)}.game-visuals .game-landscape{padding-top:44px;padding-bottom:40px}.game-visuals .game-scene{max-height:185px;min-height:0}.game-patient{max-height:365px}}
@media(max-width:540px){.game-demonstration{padding:15px}.game-patient{max-height:315px}.game-detail-grid{gap:8px}.game-detail{padding:10px 9px 8px;border-radius:14px}.game-detail figcaption{font-size:12px;gap:5px}.game-detail figcaption span{width:20px;height:20px;font-size:10px;flex-shrink:0}.game-detail-label{font-size:12px}.game-demo-heading{flex-wrap:wrap}.game-pose-controls{gap:6px}.game-pose-controls>span{flex-basis:100%}.game-shell .game-pose-button{flex:1;min-width:0;padding:8px 5px;min-height:44px}}
body.senior-mode .game-detail-grid{grid-template-columns:minmax(0,1fr)}body.senior-mode .game-detail figcaption{font-size:20px}body.senior-mode .game-detail svg{max-height:170px}body.senior-mode .game-pose-controls>span{font-size:18px}body.senior-mode .game-pose-controls{gap:9px}
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

function patientMarkup(id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="game-patient" data-game-patient data-focus="abdomen" data-animation-phase="ready" data-expansion="0" data-motion="rest" viewBox="35 15 410 430" role="img" aria-labelledby="${id}-patient-title ${id}-patient-desc">
    <title id="${id}-patient-title">双手轻放胸腹的坐位呼吸动态示范</title>
    <desc id="${id}-patient-desc">成人侧坐于有靠背的椅子，双脚着地，肩颈放松。一手轻放胸部，一手轻放腹部。鼻吸时腹部轮廓和腹部手自然向外移动；缩唇呼气时回落。下方放大镜同步显示嘴唇收拢和腹部起伏。腹部示范须由医护确认适合，保持轻柔，不刻意深吸或用力鼓腹。画面动作适度放大以便看清，不表示实际应达到的幅度。</desc>
    <defs>
      <linearGradient id="${id}-skin" x1="0" x2="1" y1="0" y2=".5"><stop stop-color="#e6b79d"/><stop offset=".55" stop-color="#f6d6bd"/><stop offset="1" stop-color="#dba88f"/></linearGradient>
      <linearGradient id="${id}-shirt" x1="0" x2="1" y1="0" y2=".6"><stop stop-color="#427964"/><stop offset=".45" stop-color="#86b99a"/><stop offset="1" stop-color="#528c74"/></linearGradient>
      <linearGradient id="${id}-pants" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#546d62"/><stop offset="1" stop-color="#849b88"/></linearGradient>
      <linearGradient id="${id}-hair" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#c3c7bb"/><stop offset=".6" stop-color="#829082"/><stop offset="1" stop-color="#5e7466"/></linearGradient>
      <linearGradient id="${id}-chair" x1="0" x2="1"><stop stop-color="#ab9c7e"/><stop offset=".5" stop-color="#d8c9a7"/><stop offset="1" stop-color="#a9997d"/></linearGradient>
      <marker id="${id}-air-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L8 5L1 9" fill="none" stroke="#216858" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></marker>
    </defs>
    <circle cx="267" cy="162" r="121" fill="#dce9d1" opacity=".45"/>
    <path d="M80 406H400" stroke="#cbd9be" stroke-width="1.5"/><ellipse cx="241" cy="413" rx="135" ry="12" fill="#ccd7bf" opacity=".65"/>
    <path d="M126 190L127 316M133 310L116 410M248 310L269 410" stroke="url(#${id}-chair)" stroke-width="12" stroke-linecap="round" fill="none"/><rect x="109" y="163" width="52" height="124" rx="18" fill="#c1ccb6"/><path d="M115 176V265" stroke="#edf0df" stroke-width="3" stroke-linecap="round"/><rect x="119" y="295" width="161" height="19" rx="9" fill="url(#${id}-chair)"/>
    <path d="M165 277C195 269 236 277 263 302L300 327L315 394Q303 410 289 397L268 348L207 323L156 313Z" fill="url(#${id}-pants)"/><path d="M159 298Q186 282 211 305L239 329L229 395Q216 405 204 394L202 345L158 326Z" fill="#789081"/><path d="M169 304Q187 305 203 322M263 319L284 340L300 384M219 335L214 382" fill="none" stroke="#a2b3a0" stroke-width="2" stroke-linecap="round"/>
    <path d="M205 389Q217 386 231 393L249 406Q253 416 242 418H202Q194 407 205 389ZM290 390Q303 387 315 393L335 406Q339 415 326 418H287Q280 405 290 390Z" fill="#304f43"/><path d="M199 413H248M286 413H335" stroke="#789788" stroke-width="3" stroke-linecap="round"/>
    <path d="M213 120L210 151Q230 167 251 150L248 119" fill="url(#${id}-skin)"/><path d="M217 129L216 147Q233 155 248 141" fill="#c7987f" opacity=".38"/>
    <g data-game-chest><path d="M175 157Q191 140 212 144Q230 161 252 150C269 164 279 186 280 208L173 214Q157 183 175 157Z" fill="url(#${id}-shirt)"/><path d="M211 145Q229 170 252 151" fill="none" stroke="#c7dac5" stroke-width="5" stroke-linecap="round"/><path d="M204 176L203 201M211 181L211 197" stroke="#a9c8ad" stroke-width="2" opacity=".7" stroke-linecap="round"/></g>
    <g data-game-abdomen data-expansion="0"><path data-game-belly-shape d="M174 203Q226 190 280 204C300 231 299 263 284 279Q238 304 172 288Q160 252 174 203Z" fill="url(#${id}-shirt)"/><path data-game-belly-seam d="M279 211Q300 248 284 276" stroke="#3e715c" stroke-width="2" fill="none" stroke-linecap="round"/><path data-game-belly-fold d="M227 265Q253 272 278 263M196 283Q237 293 275 277" stroke="#bdd1b7" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/></g>
    <path d="M249 166Q280 181 272 214" stroke="#52886e" stroke-width="26" fill="none" stroke-linecap="round"/><path d="M257 171Q270 182 269 195" stroke="#a1c4a7" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g data-game-chest-arm><path data-game-chest-forearm d="M272 212Q282 195 258 191" fill="none" stroke="url(#${id}-skin)" stroke-width="17" stroke-linecap="round"/><g data-game-chest-hand><path d="M259 191L247 188Q239 186 234 189L239 193L234 195Q231 199 237 201L249 204Q258 205 264 199Z" fill="url(#${id}-skin)"/><path d="M239 193L252 196M238 198L252 201" stroke="#bd8e75" stroke-width="1.2" fill="none" stroke-linecap="round"/></g></g>
    <path d="M176 167Q148 194 163 232" fill="none" stroke="#4b7f69" stroke-width="31" stroke-linecap="round"/><path d="M165 177Q155 198 159 214" stroke="#9dc0a4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g data-game-hands><path data-game-abdomen-forearm d="M164 229Q180 269 267 254" fill="none" stroke="url(#${id}-skin)" stroke-width="20" stroke-linecap="round"/><path data-game-forearm-highlight d="M168 236Q197 259 256 250" fill="none" stroke="#ffe6cf" stroke-width="2.2" stroke-linecap="round" opacity=".7"/><g data-game-abdomen-hand><path d="M260 245Q269 238 276 241L284 245L294 247Q298 251 292 253L297 256Q300 260 293 260L281 259L270 266Q262 266 258 260Z" fill="url(#${id}-skin)"/><path d="M278 247L292 251M276 253L294 256M273 257L286 260" fill="none" stroke="#b98a74" stroke-width="1.2" stroke-linecap="round"/></g></g>
    <path d="M199 75C195 44 223 27 249 36Q274 42 277 75L287 92Q291 98 281 101Q283 114 273 125Q258 143 231 133Q205 123 201 99Z" fill="url(#${id}-skin)"/>
    <path d="M200 99C185 85 187 50 207 35Q235 16 263 33Q283 43 278 75Q256 69 248 48Q229 52 222 71L211 84L213 111L204 106Z" fill="url(#${id}-hair)"/><path d="M206 40Q233 25 257 38M199 55Q215 33 242 35M208 59Q223 40 246 42" stroke="#d7d9c9" stroke-width="3" fill="none" stroke-linecap="round" opacity=".75"/>
    <ellipse cx="212" cy="94" rx="9" ry="13" fill="#ddb198"/><path d="M211 87Q218 87 215 99" fill="none" stroke="#bd8a72" stroke-width="1.5" stroke-linecap="round"/><path d="M250 78Q262 74 272 80" fill="none" stroke="#687d6d" stroke-width="2.8" stroke-linecap="round"/><path d="M252 86Q261 91 270 86" fill="none" stroke="#5b705f" stroke-width="2" stroke-linecap="round"/><path d="M276 100L281 101M272 120Q264 126 254 125" fill="none" stroke="#bf8d74" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="260" cy="103" rx="12" ry="7" fill="#e9ac98" opacity=".32"/><path data-game-mouth d="M271 113Q278 115 283 113Q278 118 271 115Z" fill="#c18474" stroke="#945e50" stroke-width="1.4" stroke-linecap="round"/><ellipse data-game-mouth-opening cx="280" cy="115" rx=".7" ry=".6" fill="#754a41"/>
    <g data-game-inhale-flow opacity="0" data-active="false"><path d="M381 70Q337 65 300 91" fill="none" stroke="#216858" stroke-width="3.6" stroke-linecap="round" marker-end="url(#${id}-air-arrow)"/><path d="M367 50Q337 49 313 66" fill="none" stroke="#86b28a" stroke-width="2.3" stroke-linecap="round"/><text x="339" y="41" fill="#285f4d" font-size="17" font-weight="600">轻轻鼻吸</text></g>
    <g data-game-exhale-flow opacity="0" data-active="false"><path d="M297 117Q324 111 345 125L398 125" fill="none" stroke="#216858" stroke-width="3.6" stroke-linecap="round" marker-end="url(#${id}-air-arrow)"/><path d="M303 136Q326 146 354 142M302 99Q329 91 352 103" fill="none" stroke="#86b28a" stroke-width="2.2" stroke-linecap="round"/><text x="328" y="167" fill="#285f4d" font-size="17" font-weight="600">缓慢呼气</text></g>
    <ellipse data-game-focus="inhale" cx="281" cy="94" rx="18" ry="15" fill="none" stroke="#73a269" stroke-width="2" stroke-dasharray="3 5"/><ellipse data-game-focus="exhale" cx="281" cy="115" rx="20" ry="15" fill="none" stroke="#73a269" stroke-width="2" stroke-dasharray="3 5"/><ellipse data-game-focus="abdomen" cx="280" cy="251" rx="40" ry="35" fill="none" stroke="#73a269" stroke-width="2" stroke-dasharray="3 5"/>
    <g fill="#53695a" font-size="13"><path d="M301 198H337M318 252H347" stroke="#91ac7e" stroke-width="1.3"/><text x="339" y="199">一手轻放胸部</text><text x="349" y="254">一手轻放腹部</text></g>
  </svg>`;
}

function detailMarkup(id) {
  return `<div class="game-detail-grid" aria-label="同步动作放大示范">
    <figure class="game-detail"><figcaption><span>01</span>嘴唇与气流</figcaption><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 155" role="img" aria-label="嘴唇从自然轻闭到轻轻收拢，气流方向随吸呼阶段变化"><defs><linearGradient id="${id}-lip-skin" x1="0" x2="1"><stop stop-color="#f8dbc2"/><stop offset="1" stop-color="#e4b294"/></linearGradient><marker id="${id}-detail-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M2 2L8 5L2 8" stroke="#216858" fill="none" stroke-width="1.5" stroke-linecap="round"/></marker></defs><path d="M12 8H88Q119 17 123 43L141 68Q143 74 129 76L124 99Q135 113 121 123L113 144H12Z" fill="url(#${id}-lip-skin)"/><path d="M121 76L128 77M91 42Q105 39 112 44" stroke="#b98268" stroke-width="2" fill="none" stroke-linecap="round"/><path data-game-detail-lips d="M109 105Q122 101 130 105Q123 113 109 110Z" fill="#c78573" stroke="#935b4e" stroke-width="1.5"/><ellipse data-game-detail-opening cx="124" cy="107" rx="1" ry=".7" fill="#744a40"/><g data-game-detail-inhale opacity="0"><path d="M229 44Q181 39 151 69" fill="none" stroke="#2e765f" stroke-width="3" marker-end="url(#${id}-detail-arrow)"/><text x="172" y="30" fill="#2d5d4a">鼻吸</text></g><g data-game-detail-exhale opacity="0"><path d="M150 107H236" fill="none" stroke="#2e765f" stroke-width="3" marker-end="url(#${id}-detail-arrow)"/><path d="M161 89Q188 80 216 87M160 124Q188 135 217 126" stroke="#9abe91" stroke-width="2" fill="none"/><text x="164" y="148" fill="#2d5d4a">缓慢呼出</text></g></svg><p class="game-detail-label" data-game-lip-label>嘴唇自然放松</p></figure>
    <figure class="game-detail"><figcaption><span>02</span>腹部与手</figcaption><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 155" role="img" aria-label="腹部自然向外起伏，腹部上的手跟随轮廓移动"><defs><marker id="${id}-belly-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M2 2L8 5L2 8" stroke="#216858" fill="none" stroke-width="1.5" stroke-linecap="round"/></marker></defs><path d="M41 12Q104 8 119 22Q158 46 145 133H40Z" fill="#e4eddf" stroke="#b6c8ae" stroke-width="1.5" stroke-dasharray="4 5"/><path data-game-detail-belly d="M41 12Q104 8 119 22Q158 46 145 133H40Z" fill="#78a88b"/><path data-game-detail-belly-line d="M124 25Q159 66 145 131" stroke="#3f715c" stroke-width="2.5" fill="none"/><path data-game-detail-arm d="M30 77Q58 114 130 92" fill="none" stroke="#edc3a5" stroke-width="21" stroke-linecap="round"/><g data-game-detail-hand><path d="M126 84Q136 77 146 82L160 87Q166 92 158 94L165 99Q166 104 157 103L143 101Q128 112 122 100Z" fill="#f2ccb0"/><path d="M143 86L158 91M140 94L159 99" stroke="#ba8b73" stroke-width="1.4" fill="none" stroke-linecap="round"/></g><path data-game-detail-belly-arrow d="M192 78H236" stroke="#216858" stroke-width="3" fill="none" marker-end="url(#${id}-belly-arrow)"/><text x="189" y="123" fill="#2d5d4a" data-game-belly-text>自然起伏</text></svg><p class="game-detail-label" data-game-belly-label>手轻放，不用力鼓腹</p></figure>
  </div>`;
}

const demonstrationNotes = {
  inhale: '鼻吸：嘴唇自然放松，用鼻轻轻吸气。肩颈保持放松，不需要把肩膀抬起来。',
  exhale: '缩唇呼气：嘴唇轻轻收拢，像轻吹一杯温水，缓慢呼出，不用力吹。',
  abdomen: '腹部观察：先由医护示范并确认适合你。手轻放腹部，感受自然起伏；保持轻柔，不要刻意深吸或用力鼓腹。',
};

export function mountGame(container, { breathing = {}, onComplete = () => {}, onStop = () => {}, onStateChange = () => {} } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') {
    throw new TypeError('mountGame requires a DOM container.');
  }
  const settings = breathingConfig(breathing);
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const session = createBreathingSession(settings, { now: () => win.performance.now(), onStateChange });
  const id = `breathing-garden-${++instanceCount}`;
  const root = doc.createElement('section');
  root.className = 'game-shell';
  root.setAttribute('aria-label', '呼吸小花园互动训练');
  root.innerHTML = `<style>${gameStyles}</style>
    <div class="game-heading"><div><h3>呼吸小花园</h3><p>跟着人物示范，轻轻吸气、缓慢呼气。每一轮都由你自己确认。</p></div><span class="game-chip">轻松练习</span></div>
    <div class="game-visuals">
      <section class="game-demonstration" aria-labelledby="${id}-demo-heading"><div class="game-demo-heading"><h4 id="${id}-demo-heading">跟着人物练习</h4><span>动作与倒计时同步</span></div><div class="game-patient-stage">${patientMarkup(id)}</div>${detailMarkup(id)}<p class="game-demo-step" data-game-demo-step>坐稳，肩颈放松</p><p class="game-demo-instruction" data-game-demo-instruction>双脚着地，一手轻放胸部，一手轻放腹部。</p><div class="game-demo-controls" role="group" aria-label="查看呼吸动作解说"><button type="button" class="game-demo-button" data-game-demo="inhale" aria-pressed="false">鼻吸</button><button type="button" class="game-demo-button" data-game-demo="exhale" aria-pressed="false">缩唇呼气</button><button type="button" class="game-demo-button" data-game-demo="abdomen" aria-pressed="true">腹部观察</button></div><p class="game-demo-explanation" data-game-demo-explanation aria-live="polite">${demonstrationNotes.abdomen}</p><div class="game-pose-controls" role="group" aria-label="动作静帧查看"><span>看清动作</span><button class="game-pose-button" type="button" data-game-pose="inhale" aria-pressed="false">吸气静帧</button><button class="game-pose-button" type="button" data-game-pose="exhale" aria-pressed="false">呼气静帧</button><button class="game-pose-button" type="button" data-game-pose="follow" aria-pressed="true">跟随节奏</button></div><p class="game-reduced-note" data-game-reduced-note></p></section>
      <div class="game-landscape"><h4 class="game-garden-heading">成长小花园</h4>${sceneMarkup(id)}<span class="game-garden-note" data-game-garden-note>小苗在等你，一起慢慢来</span></div>
    </div>
    <div class="game-console">
      <div class="game-guide"><div class="game-orbit" aria-hidden="true"><span class="game-breath-disc"></span><span class="game-count" data-game-count>—<small>准备</small></span></div><div><p class="game-phase" data-game-phase>准备好，再开始</p><p class="game-instruction" data-game-instruction>用鼻轻轻吸气 ${settings.inhaleSeconds} 秒，缩唇缓慢呼气 ${settings.exhaleSeconds} 秒。不屏息，不用力吹。</p></div></div>
      <p class="game-live" role="status" aria-live="polite" aria-atomic="true" data-game-live></p>
      <div class="game-progress-label"><strong data-game-progress-label>已确认 0 / ${settings.cycles} 轮</strong><span>可随时暂停</span></div>
      <div class="game-progress" role="progressbar" aria-label="自行确认完成的练习轮数" aria-valuemin="0" aria-valuemax="${settings.cycles}" aria-valuenow="0"><div class="game-progress-fill"></div></div>
      <p class="game-encouragement" data-game-encouragement>按自己的节奏来，准备好再开始。</p>
      <p class="game-status-note" data-game-note>如感到不适，请立即停止并休息。</p>
      <div class="game-controls"><button type="button" class="game-primary" data-game-action="primary">开始本轮</button><button type="button" class="game-secondary" data-game-action="pause" disabled>暂停</button><button type="button" class="game-stop" data-game-action="stop">停止并休息</button></div>
      <div class="game-options"><label class="game-voice-toggle"><input type="checkbox" data-game-voice/>朗读鼓励（默认关闭）</label><span data-game-voice-note>文字鼓励始终显示</span></div>
      <p class="game-privacy">人物动画是动作示范。记录来自你的自行确认，仅表示完成了引导练习。未检测实际呼吸质量，也不代表肺功能改善；不使用麦克风或摄像头。</p>
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
    patient: root.querySelector('[data-game-patient]'),
    chest: root.querySelector('[data-game-chest]'),
    abdomen: root.querySelector('[data-game-abdomen]'),
    bellyShape: root.querySelector('[data-game-belly-shape]'),
    bellySeam: root.querySelector('[data-game-belly-seam]'),
    bellyFold: root.querySelector('[data-game-belly-fold]'),
    hands: root.querySelector('[data-game-hands]'),
    abdomenHand: root.querySelector('[data-game-abdomen-hand]'),
    abdomenForearm: root.querySelector('[data-game-abdomen-forearm]'),
    forearmHighlight: root.querySelector('[data-game-forearm-highlight]'),
    chestHand: root.querySelector('[data-game-chest-hand]'),
    chestForearm: root.querySelector('[data-game-chest-forearm]'),
    mouth: root.querySelector('[data-game-mouth]'),
    mouthOpening: root.querySelector('[data-game-mouth-opening]'),
    inhaleFlow: root.querySelector('[data-game-inhale-flow]'),
    exhaleFlow: root.querySelector('[data-game-exhale-flow]'),
    demoStep: root.querySelector('[data-game-demo-step]'),
    demoInstruction: root.querySelector('[data-game-demo-instruction]'),
    demoButtons: [...root.querySelectorAll('[data-game-demo]')],
    demoExplanation: root.querySelector('[data-game-demo-explanation]'),
    reducedNote: root.querySelector('[data-game-reduced-note]'),
    poseButtons: [...root.querySelectorAll('[data-game-pose]')],
    detailLips: root.querySelector('[data-game-detail-lips]'),
    detailOpening: root.querySelector('[data-game-detail-opening]'),
    detailInhale: root.querySelector('[data-game-detail-inhale]'),
    detailExhale: root.querySelector('[data-game-detail-exhale]'),
    detailBelly: root.querySelector('[data-game-detail-belly]'),
    detailBellyLine: root.querySelector('[data-game-detail-belly-line]'),
    detailArm: root.querySelector('[data-game-detail-arm]'),
    detailHand: root.querySelector('[data-game-detail-hand]'),
    detailBellyArrow: root.querySelector('[data-game-detail-belly-arrow]'),
    bellyText: root.querySelector('[data-game-belly-text]'),
    lipLabel: root.querySelector('[data-game-lip-label]'),
    bellyLabel: root.querySelector('[data-game-belly-label]'),
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
  let previousPatientFrame = null;
  let inspectionPhase = null;

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

  function renderPatient(state) {
    const demonstrationFrame = inspectionPhase ? { phase: inspectionPhase, phaseProgress: inspectionPhase === 'inhale' ? 1 : 0.98 } : state;
    let pose = getPatientAnimationFrame(demonstrationFrame, { reducedMotion: motionQuery.matches && !inspectionPhase });
    if (!inspectionPhase && state.status === 'stopped' && previousPatientFrame && !motionQuery.matches) {
      pose = { ...previousPatientFrame, inhaleOpacity: 0, exhaleOpacity: 0 };
    }
    previousPatientFrame = pose;
    const geometry = getPatientPoseGeometry(pose);
    root.dataset.inspection = String(Boolean(inspectionPhase));
    elements.patient.dataset.animationPhase = state.phase;
    elements.patient.dataset.phaseProgress = state.phaseProgress.toFixed(4);
    elements.patient.dataset.expansion = pose.breathLevel.toFixed(4);
    elements.patient.dataset.demonstrationPhase = demonstrationFrame.phase;
    elements.patient.dataset.motion = inspectionPhase ? 'inspection' : motionQuery.matches ? 'reduced' : state.status === 'running' ? 'active' : state.status === 'paused' ? 'paused' : 'rest';
    elements.chest.setAttribute('transform', `translate(228 189) scale(${pose.chestScaleX.toFixed(4)} ${pose.chestScaleY.toFixed(4)}) translate(-228 -189)`);
    elements.abdomen.setAttribute('transform', `translate(0 ${(pose.breathLevel * 0.25).toFixed(4)})`);
    elements.abdomen.dataset.expansion = pose.breathLevel.toFixed(4);
    elements.bellyShape.setAttribute('d', geometry.belly);
    elements.bellySeam.setAttribute('d', geometry.bellySeam);
    elements.bellyFold.setAttribute('d', geometry.bellyFold);
    elements.abdomenForearm.setAttribute('d', geometry.abdomenForearm);
    elements.forearmHighlight.setAttribute('d', geometry.forearmHighlight);
    elements.abdomenHand.setAttribute('transform', `translate(${pose.handOffsetX.toFixed(4)} ${pose.handOffsetY.toFixed(4)})`);
    elements.chestForearm.setAttribute('d', geometry.chestForearm);
    elements.chestHand.setAttribute('transform', `translate(${pose.chestHandOffsetX.toFixed(4)} ${(pose.handOffsetY * 0.15).toFixed(4)})`);
    elements.hands.dataset.travel = pose.handOffsetX.toFixed(4);
    elements.inhaleFlow.setAttribute('transform', `translate(${(-pose.flowOffset).toFixed(4)} 0)`);
    elements.exhaleFlow.setAttribute('transform', `translate(${pose.flowOffset.toFixed(4)} 0)`);
    elements.inhaleFlow.setAttribute('opacity', pose.inhaleOpacity.toFixed(4));
    elements.exhaleFlow.setAttribute('opacity', pose.exhaleOpacity.toFixed(4));
    elements.inhaleFlow.dataset.active = String(pose.inhaleOpacity > 0);
    elements.exhaleFlow.dataset.active = String(pose.exhaleOpacity > 0);
    elements.mouth.setAttribute('d', geometry.lips);
    elements.mouthOpening.setAttribute('cx', String(280 + pose.lipRoundness * 7));
    elements.mouthOpening.setAttribute('rx', String(0.7 + pose.lipRoundness));
    elements.mouthOpening.setAttribute('ry', String(0.6 + pose.lipRoundness * 1.6));
    elements.detailLips.setAttribute('d', geometry.detailLips);
    elements.detailOpening.setAttribute('cx', String(124 + pose.lipRoundness * 15));
    elements.detailOpening.setAttribute('cy', String(107 + pose.lipRoundness));
    elements.detailOpening.setAttribute('rx', String(1 + pose.lipRoundness * 1.4));
    elements.detailOpening.setAttribute('ry', String(0.7 + pose.lipRoundness * 4.5));
    elements.detailInhale.setAttribute('opacity', pose.inhaleOpacity.toFixed(4));
    elements.detailExhale.setAttribute('opacity', pose.exhaleOpacity.toFixed(4));
    elements.detailBelly.setAttribute('d', geometry.detailBelly);
    elements.detailBellyLine.setAttribute('d', geometry.detailBellyLine);
    elements.detailArm.setAttribute('d', geometry.detailArm);
    elements.detailHand.setAttribute('transform', `translate(${geometry.detailHandX.toFixed(4)} ${pose.handOffsetY.toFixed(4)})`);
    const showingInhale = demonstrationFrame.phase === 'inhale';
    const showingExhale = demonstrationFrame.phase === 'exhale';
    elements.detailBellyArrow.setAttribute('d', showingExhale ? 'M236 78H192' : 'M192 78H236');
    elements.detailBellyArrow.setAttribute('opacity', showingInhale || showingExhale ? '.85' : '0');
    elements.bellyText.textContent = showingInhale ? '自然向外' : showingExhale ? '缓慢回落' : '自然起伏';
    elements.lipLabel.textContent = showingExhale ? '轻轻缩唇，缓慢呼出' : '嘴唇放松，用鼻轻吸';
    elements.bellyLabel.textContent = showingInhale ? '腹部自然起伏，手随之移动' : showingExhale ? '腹部与手一起缓慢回落' : '手轻放，不用力鼓腹';
    let step = '坐稳，肩颈放松';
    let instruction = '双脚着地，一手轻放胸部、一手轻放腹部。腹部动作先由医护确认适合你。';
    if (state.status === 'running') {
      step = state.phase === 'inhale' ? '鼻吸：轻柔吸气，肩颈放松' : '缩唇呼气：慢慢呼出';
      instruction = state.phase === 'inhale' ? '跟着鼻吸箭头轻柔吸气，不刻意深吸或用力鼓腹。' : '嘴唇轻轻收拢，随着气流缓慢呼出，不用力吹。';
    } else if (state.status === 'paused') {
      step = '示范已暂停，先休息';
      instruction = '人物动作和计时都已停住，准备好后点击「继续本轮」。';
    } else if (state.status === 'awaiting-confirmation') {
      step = '本轮动作示范结束';
      instruction = '按自己的感受确认是否完成。下一轮会等你准备好。';
    } else if (state.status === 'completed') {
      step = '这次示范练习已完成';
      instruction = '给自己一点鼓励，放松下来休息一下。';
    } else if (state.status === 'stopped') {
      step = '示范已停止，先休息';
      instruction = '听从自己的感受，身体不适时请按页面安全提示处理。';
    }
    if (inspectionPhase) {
      step = inspectionPhase === 'inhale' ? '吸气静帧：嘴唇放松，腹部自然起伏' : '呼气静帧：轻轻缩唇，腹部回落';
      instruction = '现在只查看动作，计时没有继续。点击「跟随节奏」返回本轮示范。';
    }
    elements.demoStep.textContent = step;
    elements.demoInstruction.textContent = instruction;
    elements.reducedNote.textContent = motionQuery.matches ? '已减少动效。可用上方静帧按钮看清吸气、呼气姿势。' : '动作幅度为演示而放大；轻柔呼吸，不用力鼓腹。';
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
    renderPatient(state);
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
    const poseButton = event.target.closest?.('[data-game-pose]');
    if (poseButton && root.contains(poseButton) && !disposed) {
      const selected = poseButton.dataset.gamePose;
      if (selected !== 'follow') {
        session.pause('inspection');
        cancelSpeech();
      }
      inspectionPhase = selected === 'follow' ? null : selected;
      for (const button of elements.poseButtons) button.setAttribute('aria-pressed', String(button === poseButton));
      refresh();
      return;
    }
    const demoButton = event.target.closest?.('[data-game-demo]');
    if (demoButton && root.contains(demoButton) && !disposed) {
      const selected = demoButton.dataset.gameDemo;
      elements.patient.dataset.focus = selected;
      elements.demoExplanation.textContent = demonstrationNotes[selected];
      for (const button of elements.demoButtons) button.setAttribute('aria-pressed', String(button === demoButton));
      return;
    }
    const button = event.target.closest?.('[data-game-action]');
    if (!button || !root.contains(button) || button.disabled || disposed) return;
    const action = button.dataset.gameAction;
    if (action === 'pause') return pause();
    if (action === 'stop') {
      if (session.stop('manual')) {
        inspectionPhase = null;
        for (const poseButton of elements.poseButtons) poseButton.setAttribute('aria-pressed', String(poseButton.dataset.gamePose === 'follow'));
        cancelSpeech();
        elements.encouragement.textContent = '听从自己的感受，休息也是照顾自己。';
        refresh();
        onStop('manual');
      }
      return;
    }
    const before = session.getState();
    inspectionPhase = null;
    for (const poseButton of elements.poseButtons) poseButton.setAttribute('aria-pressed', String(poseButton.dataset.gamePose === 'follow'));
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
