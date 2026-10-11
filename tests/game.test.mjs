import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreathingSession, getBreathingFrame, getPatientAnimationFrame, getPatientPoseGeometry } from '../game.mjs';
import { getMeditationFrame, normalizeActivityMode } from '../meditation.mjs';

const config = { inhaleSeconds: 2, exhaleSeconds: 4, cycles: 2 };

test('a round changes phase at the exact inhale and exhale boundaries', () => {
  assert.equal(getBreathingFrame(-50, config).roundElapsedMs, 0);
  const inhale = getBreathingFrame(1999, config);
  assert.equal(inhale.phase, 'inhale');
  assert.equal(inhale.remainingMs, 1);
  const exhale = getBreathingFrame(2000, config);
  assert.equal(exhale.phase, 'exhale');
  assert.equal(exhale.remainingMs, 4000);
  assert.equal(getBreathingFrame(5999, config).remainingMs, 1);
  assert.equal(getBreathingFrame(6000, config).phase, 'confirm');
  assert.equal(getBreathingFrame(6000, config).remainingMs, 0);
});

test('long delays cannot complete or start additional unconfirmed rounds', () => {
  let time = 100;
  const session = createBreathingSession(config, { now: () => time });
  assert.equal(session.start(), true);
  time += 600_000;
  const state = session.getState();
  assert.equal(state.status, 'awaiting-confirmation');
  assert.equal(state.completedCycles, 0);
  assert.equal(state.roundElapsedMs, 6000);
  assert.equal(state.activeGuidanceSeconds, 6);
  time += 600_000;
  assert.deepEqual(session.getState(), state);
});

test('pausing preserves the phase and its remaining time, excluding the break', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start();
  time = 2500;
  assert.equal(session.pause('hidden'), true);
  const paused = session.getState();
  assert.equal(paused.status, 'paused');
  assert.equal(paused.phase, 'exhale');
  assert.equal(paused.remainingMs, 3500);
  assert.equal(paused.pauseReason, 'hidden');
  assert.equal(paused.activeDurationMs, 2500);
  time = 602_500;
  assert.deepEqual(session.getState(), paused);
  assert.equal(session.resume(), true);
  time += 1000;
  assert.equal(session.getState().remainingMs, 2500);
  assert.equal(session.getState().activeGuidanceSeconds, 3.5);
});

test('a confirmation is accepted only after a full guided round', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  assert.equal(session.confirm(), false);
  session.start();
  time = 5999;
  assert.equal(session.confirm(), false);
  assert.equal(session.getState().completedCycles, 0);
  time = 6000;
  assert.equal(session.confirm(), true);
  const next = session.getState();
  assert.equal(next.status, 'running');
  assert.equal(next.currentCycle, 2);
  assert.equal(next.completedCycles, 1);
  assert.equal(next.phase, 'inhale');
  assert.equal(next.roundElapsedMs, 0);
  assert.equal(next.activeGuidanceSeconds, 6);
  assert.equal(session.confirm(), false);
});

test('the final round also waits for confirmation and cannot be counted twice', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start();
  time = 6000;
  session.confirm();
  time = 12_000;
  assert.equal(session.getState().status, 'awaiting-confirmation');
  assert.equal(session.getState().completedCycles, 1);
  assert.equal(session.confirm(), true);
  const completed = session.getState();
  assert.equal(completed.status, 'completed');
  assert.equal(completed.phase, 'complete');
  assert.equal(completed.completedCycles, 2);
  assert.equal(completed.activeGuidanceSeconds, 12);
  assert.equal(completed.activeDurationMs, 12_000);
  assert.equal(completed.selfReported, true);
  assert.equal(session.confirm(), false);
  assert.equal(session.resume(), false);
  assert.equal(session.stop(), false);
  time += 100_000;
  assert.deepEqual(session.getState(), completed);
});

test('20 and 30 rounds count real guidance time while excluding confirmation waits', () => {
  for (const cycles of [20, 30]) {
    let time = 500;
    const session = createBreathingSession({ ...config, cycles }, { now: () => time });
    session.start();
    for (let round = 1; round <= cycles; round += 1) {
      time += 6000;
      assert.equal(session.getState().status, 'awaiting-confirmation');
      time += 15_000;
      assert.equal(session.getState().activeDurationMs, round * 6000);
      assert.equal(session.confirm(), true);
    }
    const result = session.getState();
    assert.equal(result.status, 'completed');
    assert.equal(result.completedCycles, cycles);
    assert.equal(result.activeDurationMs, cycles * 6000);
  }
});

test('stopping freezes the guidance and prevents later confirmations', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start();
  time = 1700;
  assert.equal(session.stop('manual'), true);
  const stopped = session.getState();
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.stopReason, 'manual');
  assert.equal(stopped.completedCycles, 0);
  assert.equal(stopped.activeGuidanceSeconds, 1.7);
  time += 60_000;
  assert.deepEqual(session.getState(), stopped);
  assert.equal(session.resume(), false);
  assert.equal(session.start(), false);
  assert.equal(session.confirm(), false);
  assert.equal(session.stop(), false);
});

test('a backwards clock sample cannot rewind the active phase', () => {
  let time = 1000;
  const session = createBreathingSession(config, { now: () => time });
  session.start();
  time = 3500;
  assert.equal(session.getState().roundElapsedMs, 2500);
  time = 3000;
  assert.equal(session.getState().roundElapsedMs, 2500);
  time = 4000;
  assert.equal(session.getState().roundElapsedMs, 3000);
});

test('invalid durations and counts fail before a session starts', () => {
  for (const invalid of [
    { inhaleSeconds: 0 },
    { inhaleSeconds: NaN },
    { exhaleSeconds: -1 },
    { exhaleSeconds: Infinity },
    { cycles: 0 },
    { cycles: 1.5 },
  ]) assert.throws(() => createBreathingSession(invalid), RangeError);
  assert.throws(() => getBreathingFrame(Infinity), TypeError);
});

test('the patient gently expands on inhale, returns on exhale, and shows the correct airflow', () => {
  const start = getPatientAnimationFrame(getBreathingFrame(0, config));
  const halfwayIn = getPatientAnimationFrame(getBreathingFrame(1000, config));
  const almostIn = getPatientAnimationFrame(getBreathingFrame(1999, config));
  const exhaleStart = getPatientAnimationFrame(getBreathingFrame(2000, config));
  const halfwayOut = getPatientAnimationFrame(getBreathingFrame(4000, config));
  const done = getPatientAnimationFrame(getBreathingFrame(6000, config));
  assert.equal(start.abdomenScaleX, 1);
  assert.ok(start.abdomenScaleX < halfwayIn.abdomenScaleX);
  assert.ok(halfwayIn.abdomenScaleX < almostIn.abdomenScaleX);
  assert.ok(Math.abs(almostIn.breathLevel - exhaleStart.breathLevel) < 0.001);
  assert.ok(exhaleStart.abdomenScaleX > halfwayOut.abdomenScaleX);
  assert.equal(halfwayIn.abdomenScaleX, halfwayOut.abdomenScaleX);
  assert.ok(halfwayIn.chestScaleX > 1);
  assert.ok(halfwayIn.handOffsetX > 0);
  assert.ok(halfwayIn.inhaleOpacity > 0);
  assert.equal(halfwayIn.exhaleOpacity, 0);
  assert.equal(halfwayOut.inhaleOpacity, 0);
  assert.ok(halfwayOut.exhaleOpacity > 0);
  assert.equal(done.abdomenScaleX, 1);
  assert.equal(done.inhaleOpacity, 0);
  assert.equal(done.exhaleOpacity, 0);
});

test('the paused patient pose does not change during a long break', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start();
  time = 2500;
  session.pause('hidden');
  const pose = getPatientAnimationFrame(session.getState());
  time += 60_000;
  assert.deepEqual(getPatientAnimationFrame(session.getState()), pose);
  session.resume();
  time += 500;
  const resumed = getPatientAnimationFrame(session.getState());
  assert.ok(resumed.abdomenScaleX < pose.abdomenScaleX);
  assert.ok(resumed.handOffsetX < pose.handOffsetX);
});

test('lips round gradually at the beginning of exhalation and relax for nasal inspiration', () => {
  const relaxed = getPatientAnimationFrame(getBreathingFrame(2000, config));
  const forming = getPatientAnimationFrame(getBreathingFrame(2150, config));
  const rounded = getPatientAnimationFrame(getBreathingFrame(2600, config));
  assert.equal(relaxed.lipRoundness, 0);
  assert.ok(forming.lipRoundness > 0 && forming.lipRoundness < 1);
  assert.equal(rounded.lipRoundness, 1);
  assert.ok(relaxed.lipOpening < forming.lipOpening);
  assert.ok(forming.lipOpening < rounded.lipOpening);
  assert.equal(getPatientAnimationFrame(getBreathingFrame(1000, config)).lipRoundness, 0);
});

test('connected forearms keep both elbow positions fixed while hand targets follow the body', () => {
  const rest = getPatientPoseGeometry(getPatientAnimationFrame(getBreathingFrame(0, config)));
  const filled = getPatientPoseGeometry(getPatientAnimationFrame(getBreathingFrame(2000, config)));
  assert.ok(rest.abdomenForearm.startsWith('M164 229Q180 269 '));
  assert.ok(filled.abdomenForearm.startsWith('M164 229Q180 269 '));
  assert.ok(rest.chestForearm.startsWith('M272 212Q282 195 '));
  assert.ok(filled.chestForearm.startsWith('M272 212Q282 195 '));
  assert.notEqual(rest.abdomenForearm, filled.abdomenForearm);
  assert.notEqual(rest.chestForearm, filled.chestForearm);
  assert.notEqual(rest.belly, filled.belly);
  assert.notEqual(rest.detailBelly, filled.detailBelly);
  assert.ok(filled.detailHandX > rest.detailHandX);
});

test('a paused pose preserves connected hand targets and continuous lip geometry', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start();time = 2300;session.pause();
  const paused = getPatientPoseGeometry(getPatientAnimationFrame(session.getState()));
  time += 8000;
  assert.deepEqual(getPatientPoseGeometry(getPatientAnimationFrame(session.getState())), paused);
});

test('reduced motion keeps a static pose and static arrows while retaining phase cues', () => {
  const first = getPatientAnimationFrame(getBreathingFrame(200, config), { reducedMotion: true });
  const later = getPatientAnimationFrame(getBreathingFrame(1700, config), { reducedMotion: true });
  assert.deepEqual(first, later);
  assert.equal(first.abdomenScaleX, 1);
  assert.equal(first.abdomenScaleY, 1);
  assert.equal(first.chestScaleX, 1);
  assert.equal(first.chestScaleY, 1);
  assert.equal(first.handOffsetX, 0);
  assert.equal(first.flowOffset, 0);
  assert.ok(first.inhaleOpacity > 0);
  assert.equal(first.exhaleOpacity, 0);
  const exhale = getPatientAnimationFrame(getBreathingFrame(3000, config), { reducedMotion: true });
  assert.equal(exhale.inhaleOpacity, 0);
  assert.ok(exhale.exhaleOpacity > 0);
});

test('state notifications report phases and pauses once, without notifying on every frame', () => {
  let time = 0;
  const states = [];
  const session = createBreathingSession(config, { now: () => time, onStateChange: (state) => states.push(state) });
  session.getState();
  session.getState();
  session.start();
  for (time = 100; time < 2000; time += 100) session.getState();
  assert.equal(states.length, 2);
  time = 2000;
  session.getState();
  session.pause('hidden');
  time = 50_000;
  session.getState();
  session.resume();
  time += 4000;
  session.getState();
  session.confirm();
  time += 6000;
  session.getState();
  session.confirm();
  session.getState();
  assert.equal(session.confirm(), false);
  assert.deepEqual(states.map((state) => `${state.status}:${state.phase}:${state.completedCycles}`), [
    'idle:ready:0',
    'running:inhale:0',
    'running:exhale:0',
    'paused:exhale:0',
    'running:exhale:0',
    'awaiting-confirmation:confirm:0',
    'running:inhale:1',
    'awaiting-confirmation:confirm:1',
    'completed:complete:2',
  ]);
  assert.equal(states[3].pauseReason, 'hidden');
  assert.equal(states.at(-1).activeDurationMs, 12_000);
  assert.equal(states.at(-1).selfReported, true);
});

test('stopping emits a terminal state immediately and observer copies cannot alter the session', () => {
  let time = 0;
  const statuses = [];
  const session = createBreathingSession(config, {
    now: () => time,
    onStateChange: (state) => {
      statuses.push(state.status);
      state.status = 'observer-edited';
      state.completedCycles = 100;
    },
  });
  session.getState();
  session.start();
  time = 500;
  session.stop('manual');
  const state = session.getState();
  assert.deepEqual(statuses, ['idle', 'running', 'stopped']);
  assert.equal(state.status, 'stopped');
  assert.equal(state.completedCycles, 0);
  assert.equal(state.activeDurationMs, 500);
  session.stop();
  session.resume();
  assert.deepEqual(statuses, ['idle', 'running', 'stopped']);
});

test('imagined stairs advance one step during inspiration and two during expiration', () => {
  const at = ms => getMeditationFrame({ ...getBreathingFrame(ms, config), completedCycles: 0 }, 'stairs').position;
  assert.equal(at(0), 0);
  assert.equal(at(1000), .5);
  assert.equal(at(2000), 1);
  assert.equal(at(4000), 2);
  assert.equal(at(6000), 3);
  assert.ok(Math.abs(at(1999) - at(2000)) < .001);
});

test('imagined meadow travel is two steps during inspiration and four during expiration', () => {
  const at = ms => getMeditationFrame({ ...getBreathingFrame(ms, config), completedCycles: 0 }, 'meadow').position;
  assert.equal(at(1000), 1);
  assert.equal(at(2000), 2);
  assert.equal(at(4000), 4);
  assert.equal(at(6000), 6);
});

test('confirmation preserves imagined travel across rounds without a reset or extra distance', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start();
  time = 6000;
  for (const mode of ['stairs', 'meadow']) {
    const before = getMeditationFrame(session.getState(), mode);
    assert.equal(before.position, mode === 'stairs' ? 3 : 6);
  }
  const before = getMeditationFrame(session.getState(), 'stairs');
  time = 70_000;
  assert.deepEqual(getMeditationFrame(session.getState(), 'stairs'), before);
  session.confirm();
  assert.equal(getMeditationFrame(session.getState(), 'stairs').position, before.position);
  time += 6000;
  const finished = getMeditationFrame(session.getState(), 'meadow');
  session.confirm();
  assert.equal(getMeditationFrame(session.getState(), 'meadow').position, finished.position);
});

test('paused and stopped imagined travel retains its real elapsed position', () => {
  let time = 0;
  const session = createBreathingSession(config, { now: () => time });
  session.start(); time = 3700; session.pause('mode-change');
  const paused = getMeditationFrame(session.getState(), 'stairs');
  time += 50_000;
  assert.deepEqual(getMeditationFrame(session.getState(), 'stairs'), paused);
  session.stop();
  assert.equal(getMeditationFrame(session.getState(), 'stairs').position, paused.position);
  const custom = createBreathingSession({ inhaleSeconds: 1, exhaleSeconds: 5, cycles: 2 }, { now: () => time });
  custom.start(); time += 1700; custom.pause();
  const inheritedTiming = getMeditationFrame(custom.getState(), 'stairs').position;
  custom.stop();
  assert.equal(getMeditationFrame(custom.getState(), 'stairs').position, inheritedTiming);
});

test('reduced-motion meditation is static throughout both breathing phases', () => {
  for (const mode of ['stairs', 'meadow']) {
    const a = getMeditationFrame({ ...getBreathingFrame(100, config), completedCycles: 1 }, mode, { reducedMotion: true });
    const b = getMeditationFrame({ ...getBreathingFrame(5000, config), completedCycles: 1 }, mode, { reducedMotion: true });
    assert.deepEqual(a, b);
    assert.equal(a.motion, 'reduced');
    assert.equal(a.lift, 0);
  }
  assert.equal(normalizeActivityMode('stairs'), 'stairs');
  assert.equal(normalizeActivityMode('unknown'), 'demonstration');
});
