// Generated from the corresponding project module by scripts/build-miniprogram.mjs.
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const MODES = new Set(['demonstration', 'stairs', 'meadow']);

function normalizeActivityMode(mode) {
  return MODES.has(mode) ? mode : 'demonstration';
}

/** Imagined travel follows the guide's clock; it is not a movement measurement. */
function getMeditationFrame(state, mode, { reducedMotion = false } = {}) {
  const stepsPerRound = mode === 'stairs' ? 3 : 6;
  const inhaleSteps = mode === 'stairs' ? 1 : 2;
  const exhaleSteps = mode === 'stairs' ? 2 : 4;
  const progress = Number.isFinite(state.phaseProgress) ? Math.min(1, Math.max(0, state.phaseProgress)) : 0;
  const phase = state.status === 'stopped' ? state.roundProgress >= 1 ? 'confirm' : state.roundElapsedMs > state.phaseElapsedMs ? 'exhale' : 'inhale' : state.phase;
  let roundSteps = 0;
  if (phase === 'inhale') roundSteps = inhaleSteps * progress;
  else if (phase === 'exhale') roundSteps = inhaleSteps + exhaleSteps * progress;
  else if (phase === 'confirm' || state.status === 'awaiting-confirmation') roundSteps = stepsPerRound;
  // A static scene is kept throughout a phase; text and the remaining seconds still update.
  if (reducedMotion) roundSteps = 0;
  const position = (state.completedCycles || 0) * stepsPerRound + roundSteps;
  const stride = position - Math.floor(position);
  return {
    position,
    roundSteps,
    stepsPerRound,
    inhaleSteps,
    exhaleSteps,
    stride,
    lift: reducedMotion ? 0 : Math.sin(stride * Math.PI) * (mode === 'stairs' ? 11 : 5),
    motion: reducedMotion ? 'reduced' : state.status === 'running' ? 'active' : state.status === 'paused' ? 'paused' : 'rest',
  };
}

module.exports={normalizeActivityMode,getMeditationFrame};
