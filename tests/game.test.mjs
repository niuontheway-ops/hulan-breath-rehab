import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreathingSession, getBreathingFrame } from '../game.mjs';

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
