// Generated from the corresponding project module by scripts/build-miniprogram.mjs.
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const { normalizeActivityMode, meditationMarkup, updateMeditationScene }=require('./meditation');

const DEFAULT_BREATHING = Object.freeze({
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
function getBreathingFrame(elapsedMs, config = {}) {
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
function getPatientAnimationFrame(frame, { reducedMotion = false } = {}) {
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
function getPatientPoseGeometry(pose) {
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
function createBreathingSession(config = {}, { now = () => performance.now(), onStateChange = () => {} } = {}) {
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

module.exports={DEFAULT_BREATHING,getBreathingFrame,getPatientAnimationFrame,getPatientPoseGeometry,createBreathingSession};
