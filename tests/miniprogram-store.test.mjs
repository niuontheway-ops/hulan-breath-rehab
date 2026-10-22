import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore, store, STORAGE_KEY, MAX_BYTES, MAX_DAILY, MAX_SESSIONS } = require('../miniprogram/app/utils/store.js');
const { today, isDay } = require('../miniprogram/app/utils/calendar.js');
const { createPlan } = require('../miniprogram/app/core/clinical.js');

const NOW = new Date('2026-10-22T10:00:00.000Z');
const DAY = '2026-10-22';
const copy = value => JSON.parse(JSON.stringify(value));
const flags = () => ({ chestPain: false, severeBreathlessness: false, fainting: false, hemoptysis: false });
const profile = (patch = {}) => ({ disease: 'copd', age: 64, fev1Percent: null, fev1Fvc: null, spo2: null, act: null, cat: null, dyspneaScale: 'mmrc', dyspneaScore: 1, stability: 'stable', clinicianCleared: true, assessmentDate: DAY, goal: 'breathing', redFlags: flags(), ...patch });
const daily = (patch = {}) => ({ day: DAY, recordedAt: '2026-10-22T02:00:00.000Z', topic: 'copd', statusComparedUsual: 'usual', breathlessness: 2, fatigue: 2, spo2: null, dyspneaScale: null, dyspneaScore: null, scores: {}, scoreDate: null, redFlags: flags(), sputumChange: false, ageGroup: 'adult', diagnosisConfirmed: true, ...patch });
const session = (patch = {}) => ({ id: 'session-1', startedAt: '2026-10-22T09:59:54.000Z', endedAt: NOW.toISOString(), mode: 'demonstration', completedCycles: 1, elapsedMs: 6000, status: 'completed', ...patch });
const emptyState = () => ({ schemaVersion: 1, profile: null, daily: [], sessions: [], settings: { senior: false, reducedMotion: false } });

function fixture(initial) {
  const values = new Map(initial === undefined ? [] : [[STORAGE_KEY, copy(initial)]]);
  const calls = [];
  const fail = { read: false, write: false, remove: false };
  const api = {
    getStorageSync(key) { calls.push(['get', key]); if (fail.read) throw new Error('simulated storage read failure'); return values.has(key) ? copy(values.get(key)) : ''; },
    setStorageSync(key, value) { calls.push(['set', key]); if (fail.write) throw new Error('simulated storage quota failure'); values.set(key, copy(value)); },
    removeStorageSync(key) { calls.push(['remove', key]); if (fail.remove) throw new Error('simulated storage remove failure'); values.delete(key); },
  };
  return { values, calls, fail, api, storage: createStore(api, { now: () => NOW }) };
}

test('Shanghai calendar works across UTC midnight without Intl or invalid-date coercion', () => {
  assert.equal(today(new Date('2026-10-21T15:59:59Z')), '2026-10-21');
  assert.equal(today(new Date('2026-10-21T16:00:00Z')), DAY);
  assert.equal(today(new Date('2024-02-28T16:00:00Z')), '2024-02-29');
  assert.equal(isDay('2026-02-30'), false);
  assert.equal(isDay('2024-02-29'), true);
  assert.throws(() => today(new Date(NaN)), /日期/);
});

test('empty local storage needs no writes and lazy store works only when its API is available', () => {
  const f = fixture(), loaded = f.storage.load();
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, emptyState());
  assert.equal(f.calls.filter(([name]) => name === 'set').length, 0);
  assert.equal(store.load().ok, false);
});

test('explicit saves survive a new store instance with only whitelisted local fields', () => {
  const f = fixture();
  assert.equal(f.storage.saveProfile(profile({ name: 'SIMULATED_TEST_VALUE', phone: 'SIMULATED_TEST_VALUE' })).ok, true);
  assert.equal(f.storage.saveDaily(daily({ note: 'SIMULATED_TEST_VALUE', scores: { arbitrary: 9 } })).ok, true);
  assert.equal(f.storage.saveSession(session({ patientId: 'SIMULATED_TEST_VALUE' })).ok, true);
  assert.equal(f.storage.saveSettings({ senior: true, reducedMotion: true, token: 'SIMULATED_TEST_VALUE' }).ok, true);
  const restart = createStore(f.api, { now: () => NOW }).load();
  assert.equal(restart.ok, true);
  assert.equal(restart.state.profile.age, 64);
  assert.equal(restart.state.daily.length, 1);
  assert.equal(restart.state.sessions.length, 1);
  assert.deepEqual(restart.state.settings, { senior: true, reducedMotion: true });
  assert.equal(JSON.stringify(f.values.get(STORAGE_KEY)).includes('SIMULATED_TEST_VALUE'), false);
  restart.state.profile.redFlags.chestPain = true;
  assert.equal(f.storage.load().state.profile.redFlags.chestPain, false);
  assert.deepEqual([...f.values.keys()], [STORAGE_KEY]);
});

test('missing professional scores remain absent and do not create permission to train', () => {
  const f = fixture();
  const saved = f.storage.saveProfile(profile({ dyspneaScale: null, dyspneaScore: null }));
  assert.equal(saved.ok, true);
  assert.equal(saved.state.profile.fev1Percent, null);
  assert.equal(saved.state.profile.dyspneaScore, null);
  assert.equal(createPlan(saved.state.profile, NOW).status, 'review');
});

test('urgent symptoms can be recorded but never become a ready training profile', () => {
  const f = fixture();
  const saved = f.storage.saveProfile(profile({ redFlags: { ...flags(), hemoptysis: true } }));
  assert.equal(saved.ok, true);
  assert.equal(createPlan(saved.state.profile, NOW).status, 'urgent');
  assert.equal(f.storage.saveProfile(profile({ redFlags: { chestPain: false } })).ok, false);
  assert.equal(f.storage.load().state.profile.redFlags.hemoptysis, true);
});

test('future, impossible and malformed profile values never overwrite a valid profile', () => {
  const f = fixture();
  f.storage.saveProfile(profile());
  const previous = copy(f.values.get(STORAGE_KEY));
  for (const patch of [{ assessmentDate: '2026-10-23' }, { assessmentDate: '2026-02-30' }, { age: '64' }, { act: NaN }, { clinicianCleared: 'true' }]) {
    assert.equal(f.storage.saveProfile(profile(patch)).ok, false);
    assert.deepEqual(f.values.get(STORAGE_KEY), previous);
  }
});

test('same-day daily replacement preserves other topics and actual questionnaire dates', () => {
  const f = fixture();
  assert.equal(f.storage.saveDaily(daily()).ok, true);
  assert.equal(f.storage.saveDaily(daily({ topic: 'asthma', scores: { act: 22 }, scoreDate: '2026-10-20' })).ok, true);
  assert.equal(f.storage.saveDaily(daily({ fatigue: 5 })).ok, true);
  const records = f.storage.load().state.daily;
  assert.equal(records.length, 2);
  assert.equal(records.find(item => item.topic === 'copd').fatigue, 5);
  assert.equal(records.find(item => item.topic === 'asthma').scoreDate, '2026-10-20');
  const previous = copy(f.values.get(STORAGE_KEY));
  for (const raw of [daily({ day: '2026-10-23' }), daily({ scores: { act: 22 }, scoreDate: null }), daily({ redFlags: { chestPain: 'false' } })]) assert.equal(f.storage.saveDaily(raw).ok, false);
  assert.deepEqual(f.values.get(STORAGE_KEY), previous);
});

test('session records use explicit confirmed counts, bounded elapsed time and stable identifiers', () => {
  const f = fixture();
  assert.equal(f.storage.saveSession(session()).ok, true);
  assert.equal(f.storage.saveSession(session({ mode: 'stairs' })).ok, true);
  assert.equal(f.storage.load().state.sessions.length, 1);
  assert.equal(f.storage.load().state.sessions[0].mode, 'stairs');
  const previous = copy(f.values.get(STORAGE_KEY));
  for (const patch of [{ id: '<script>' }, { mode: 'real-stair-measurement' }, { completedCycles: 1.5 }, { elapsedMs: Infinity }, { elapsedMs: 8000 }, { elapsedMs: 0 }, { status: 'completed', completedCycles: 0 }, { endedAt: '2026-10-23T10:00:00Z' }, { startedAt: '2026-02-30T01:00:00Z' }, { endedAt: '2026-10-22T09:59:53Z' }]) {
    assert.equal(f.storage.saveSession(session(patch)).ok, false, JSON.stringify(patch));
    assert.deepEqual(f.values.get(STORAGE_KEY), previous);
  }
});

test('corrupt, unknown-schema and invalid nested records block all new writes', () => {
  for (const raw of ['not-a-state', null, { ...emptyState(), schemaVersion: 2 }, { ...emptyState(), daily: [daily({ redFlags: {} })] }, { ...emptyState(), sessions: [session({ completedCycles: -1 })] }, { ...emptyState(), settings: { senior: 'false', reducedMotion: false } }]) {
    const f = fixture(raw), previous = copy(f.values.get(STORAGE_KEY));
    assert.equal(f.storage.load().ok, false);
    for (const result of [f.storage.saveProfile(profile()), f.storage.saveDaily(daily()), f.storage.saveSession(session()), f.storage.saveSettings({ senior: true })]) assert.equal(result.ok, false);
    assert.deepEqual(f.values.get(STORAGE_KEY), previous);
    assert.equal(f.calls.filter(([name]) => name === 'set').length, 0);
  }
});

test('daily capacity rejects new records without evicting history but allows same-key correction', () => {
  const state = emptyState();
  state.daily = Array.from({ length: MAX_DAILY }, (_, index) => {
    const day = new Date(Date.parse(DAY + 'T00:00:00Z') - index * 86400000).toISOString().slice(0, 10);
    return daily({ day, recordedAt: day + 'T02:00:00Z' });
  });
  const f = fixture(state);
  assert.equal(f.storage.load().ok, true);
  assert.equal(f.storage.saveDaily(daily({ topic: 'asthma' })).ok, false);
  assert.equal(f.values.get(STORAGE_KEY).daily.length, MAX_DAILY);
  assert.equal(f.storage.saveDaily(daily({ fatigue: 4 })).ok, true);
  assert.equal(f.storage.load().state.daily.length, MAX_DAILY);
});

test('session capacity rejects a new identifier while preserving every stored record', () => {
  const state = emptyState();
  state.sessions = Array.from({ length: MAX_SESSIONS }, (_, index) => session({ id: 'session-' + index }));
  const f = fixture(state);
  assert.equal(f.storage.load().ok, true);
  assert.equal(f.storage.saveSession(session({ id: 'session-extra' })).ok, false);
  assert.equal(f.values.get(STORAGE_KEY).sessions.length, MAX_SESSIONS);
  assert.equal(f.storage.saveSession(session({ id: 'session-0', mode: 'meadow' })).ok, true);
  assert.equal(f.storage.load().state.sessions.length, MAX_SESSIONS);
});

test('single-key byte budget and platform quota errors preserve the previous snapshot', () => {
  const oversized = fixture({ ...emptyState(), unrecognizedText: '测'.repeat(MAX_BYTES) });
  assert.equal(oversized.storage.load().ok, false);
  assert.equal(oversized.storage.saveSettings({ senior: true }).ok, false);
  assert.equal(oversized.calls.filter(([name]) => name === 'set').length, 0);
  const f = fixture();
  assert.equal(f.storage.saveProfile(profile({ unrecognizedText: '测'.repeat(MAX_BYTES) })).ok, true);
  const previous = copy(f.values.get(STORAGE_KEY));
  f.fail.write = true;
  const failed = f.storage.saveDaily(daily());
  assert.equal(failed.ok, false);
  assert.match(failed.message, /失败|尚未保存/);
  assert.deepEqual(f.values.get(STORAGE_KEY), previous);
  assert.equal(failed.state.daily.length, 0);
});

test('read and settings validation failures cannot become false successful saves', () => {
  const f = fixture();
  assert.equal(f.storage.saveSettings({ senior: 'true' }).ok, false);
  assert.equal(f.storage.saveSettings({ arbitrary: true }).ok, false);
  f.fail.read = true;
  assert.equal(f.storage.load().ok, false);
  assert.equal(f.storage.saveProfile(profile()).ok, false);
  assert.equal(f.calls.filter(([name]) => name === 'set').length, 0);
});

test('explicit clearing works on corrupt state, removes only the application key and reports failure', () => {
  const f = fixture({ schemaVersion: 9 });
  f.values.set('unrelated.preference', { keep: true });
  assert.equal(f.storage.clearAll().ok, true);
  assert.equal(f.values.has(STORAGE_KEY), false);
  assert.deepEqual(f.values.get('unrelated.preference'), { keep: true });
  assert.equal(f.storage.load().ok, true);
  f.storage.saveProfile(profile());
  f.fail.remove = true;
  assert.equal(f.storage.clearAll().ok, false);
  assert.equal(f.values.has(STORAGE_KEY), true);
});

test('only successful explicit clearing advances the in-memory epoch without storing metadata', () => {
  const f = fixture();
  assert.equal(f.storage.getEpoch(), 0);
  assert.equal(f.storage.saveProfile(profile()).ok, true);
  assert.equal(f.storage.getEpoch(), 0);
  f.fail.remove = true;
  assert.equal(f.storage.clearAll().ok, false);
  assert.equal(f.storage.getEpoch(), 0);
  f.fail.remove = false;
  assert.equal(f.storage.clearAll().ok, true);
  assert.equal(f.storage.getEpoch(), 1);
  assert.equal(f.values.has(STORAGE_KEY), false);
  assert.equal(f.storage.saveSettings({ senior: true }).ok, true);
  assert.equal(Object.hasOwn(f.values.get(STORAGE_KEY), 'epoch'), false);
  assert.equal(f.storage.clearAll().ok, true);
  assert.equal(f.storage.getEpoch(), 2);
});
