import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as clinical from '../clinical.mjs';
import * as game from '../game.mjs';
import * as daily from '../daily.mjs';
import * as meditation from '../meditation.mjs';

const require = createRequire(import.meta.url);
const { createTrainingPage, deriveTrainingView } = require('../miniprogram/app/utils/training-view.js');
const DAY = '2026-10-22';
const profile = () => ({ disease: 'copd', age: 64, fev1Percent: 68, fev1Fvc: 62, spo2: 96, act: null, cat: 12, dyspneaScale: 'mmrc', dyspneaScore: 1, stability: 'stable', clinicianCleared: true, redFlags: { chestPain: false, severeBreathlessness: false, fainting: false, hemoptysis: false }, assessmentDate: DAY, goal: 'daily' });
function harness(overrides = {}) {
  let time = Date.parse(DAY + 'T02:00:00Z'), nextId = 0, saveFails = false, epoch = 0;
  const timers = new Map(), saved = [], modals = [], screen = [], navigation = [], dataPatches = [];
  const state = { schemaVersion: 1, profile: profile(), daily: [], sessions: [], settings: { senior: false, reducedMotion: false }, ...overrides };
  const store = { getEpoch: () => epoch, load: () => ({ ok: true, state: structuredClone(state) }), saveSession: record => { if (saveFails) return { ok: false, message: '手机空间不足，记录未保存。' }; saved.push(structuredClone(record)); return { ok: true, state }; } };
  const platform = { setKeepScreenOn: options => screen.push(options.keepScreenOn), showModal: options => modals.push(options), navigateTo: options => navigation.push(options.url), switchTab: options => navigation.push(options.url) };
  const page = createTrainingPage({ store, clinical, daily, game, meditation, platform, now: () => time, schedule: fn => { timers.set(++nextId, fn); return nextId; }, cancel: id => timers.delete(id) });
  page.data = structuredClone(page.data);
  page.setData = patch => { Object.assign(page.data, structuredClone(patch)); dataPatches.push(patch); };
  page.onLoad(); page.onShow();
  return { page, state, store, saved, modals, screen, timers, navigation, dataPatches,
    tick(ms) { time += ms; for (const callback of [...timers.values()]) callback(); },
    selectChecks(patch = {}) { for (const question of page.data.questions) page.onPrecheckChange({ currentTarget: { dataset: { key: question.key } }, detail: { value: (question.key === 'clinicianCleared' ? patch[question.key] !== false : patch[question.key] === true) ? 'yes' : 'no' } }); },
    failSave(value) { saveFails = value; },
    clearData(restoreProfile = false) { state.profile = restoreProfile ? profile() : null; state.daily = []; state.sessions = []; epoch++; },
  };
}

test('native training remains closed without a complete, current, permitted profile', () => {
  for (const invalidProfile of [null, { ...profile(), assessmentDate: '2026-09-01' }, { ...profile(), clinicianCleared: false }, { ...profile(), dyspneaScore: null }]) {
    const h = harness({ profile: invalidProfile }); h.selectChecks(); h.page.onStart();
    assert.equal(h.page.data.gateAllowed, false); assert.equal(h.page.data.running, false); assert.equal(h.timers.size, 0); assert.equal(h.saved.length, 0);
  }
});

test('a danger sign takes precedence over incomplete fresh prechecks', () => {
  const h = harness();
  h.page.onPrecheckChange({ currentTarget: { dataset: { key: 'chestPain' } }, detail: { value: 'yes' } });
  h.page.onStart();
  assert.equal(h.page.data.running, false); assert.match(h.page.data.urgentBanner, /120/); assert.equal(h.modals.at(-1).title, '立即停止训练');
});

test('today risk records close training even when an older profile is eligible', () => {
  const h = harness({ daily: [{ day: DAY, topic: 'copd', redFlags: { chestPain: true } }] });
  h.selectChecks(); h.page.onStart();
  assert.equal(h.page.data.gateAllowed, false); assert.equal(h.page.data.gateUrgent, true); assert.equal(h.timers.size, 0);
});

test('all fresh precheck answers are required and unknown event values cannot count as no', () => {
  const h = harness();
  h.page.onPrecheckChange({ currentTarget: { dataset: { key: 'chestPain' } }, detail: { value: 'not-a-radio-value' } });
  h.page.onStart(); assert.equal(h.page.data.running, false); assert.match(h.page.data.urgentBanner, /每项/);
  h.selectChecks(); h.page.onStart(); assert.equal(h.page.data.running, true); assert.equal(h.timers.size, 1);
});

test('prechecks present one question at a time, retain a previous answer and halt immediately for risk', () => {
  const h = harness(); assert.equal(h.page.data.precheckQuestion.key, 'chestPain');
  const answer = (key, value) => h.page.onPrecheckChange({ currentTarget: { dataset: { key } }, detail: { value } });
  answer('chestPain', 'no'); assert.equal(h.page.data.precheckQuestion.key, 'severeBreathlessness'); assert.equal(h.page.data.precheckCount, 1);
  h.page.onPrecheckBack(); assert.equal(h.page.data.precheckQuestion.key, 'chestPain'); assert.equal(h.page.data.precheckQuestion.value, false);
  answer('chestPain', 'yes'); assert.equal(h.page.data.precheckQuestion.key, 'chestPain'); assert.equal(h.page.data.running, false); assert.match(h.page.data.urgentBanner, /120/);
});

test('elapsed guidance never creates self-reported cycles or advances through the confirmation gate', () => {
  const h = harness(); h.selectChecks(); h.page.onStart();
  h.tick(6000); assert.equal(h.page.data.awaiting, true); assert.equal(h.page.data.completedCycles, 0); assert.equal(h.timers.size, 0);
  h.tick(600000); assert.equal(h.page.data.completedCycles, 0); assert.equal(h.page.data.guidanceSeconds, 6); assert.equal(h.saved.length, 0);
  h.page.onConfirm(); assert.equal(h.page.data.completedCycles, 1); assert.equal(h.page.data.running, true); assert.equal(h.timers.size, 1);
});

test('manually confirmed rounds complete exactly once and require new prechecks for a new session', () => {
  const h = harness(); h.selectChecks(); h.page.onStart();
  for (let i = 0; i < 20; i++) { h.tick(6000); h.page.onConfirm(); }
  assert.equal(h.page.data.complete, true); assert.equal(h.page.data.completedCycles, 20); assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].completedCycles, 20); assert.equal(h.saved[0].elapsedMs, 120000); assert.equal(h.saved[0].status, 'completed');
  assert.equal(h.timers.size, 0); assert.equal(h.page.data.saved, true); assert.equal(h.page.data.needsPrecheck, true);
  h.page.onConfirm(); assert.equal(h.saved.length, 1);
  h.page.onStart(); assert.equal(h.page.data.running, false);
});

test('manual pause freezes elapsed time and resuming requires a fresh safety check', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(1300); h.page.onPause();
  const seconds = h.page.data.guidanceSeconds, style = h.page.data.bellyStyle;
  h.tick(70000); assert.equal(h.page.data.paused, true); assert.equal(h.page.data.guidanceSeconds, seconds); assert.equal(h.page.data.bellyStyle, style); assert.equal(h.timers.size, 0);
  h.page.onStart(); assert.equal(h.page.data.running, false);
  h.selectChecks(); h.page.onStart(); assert.equal(h.page.data.running, true); h.tick(700); assert.equal(h.page.data.guidanceSeconds, 2);
});

test('hiding pauses real guidance, clears ticking and screen-on, and showing never auto resumes', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(1200); h.page.onHide();
  const patchCount = h.dataPatches.length;
  assert.equal(h.timers.size, 0); assert.equal(h.screen.at(-1), false); assert.equal(h.page.data.paused, true);
  h.tick(100000); assert.equal(h.dataPatches.length, patchCount); assert.equal(h.page.data.completedCycles, 0);
  h.page.onShow(); assert.equal(h.page.data.paused, true); assert.equal(h.page.data.needsPrecheck, true); assert.equal(h.timers.size, 0);
  h.page.onUnload(); assert.equal(h.timers.size, 0); assert.equal(h.saved.length, 0);
});

test('backgrounding at a confirmation boundary cannot confirm a round or resume it implicitly', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(6000); h.page.onHide(); h.tick(90000); h.page.onShow();
  h.page.onConfirm(); assert.equal(h.page.data.completedCycles, 0); assert.equal(h.page.data.awaiting, true);
  h.selectChecks(); h.page.onStart(); assert.equal(h.page.data.awaiting, true); assert.equal(h.timers.size, 0);
  h.page.onConfirm(); assert.equal(h.page.data.completedCycles, 1); assert.equal(h.page.data.running, true);
});

test('profile edits invalidate a running session before any next round confirmation', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(6000);
  h.state.profile.age = 65; h.page.onConfirm();
  assert.equal(h.page.data.completedCycles, 0); assert.equal(h.page.data.hasSession, false); assert.equal(h.timers.size, 0); assert.match(h.page.data.gateTitle, /改变/);
});

test('clearing local data while away destroys the old clock and cannot restore it on show or unload', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(1600); h.page.onHide(); h.clearData();
  h.page.onShow(); assert.equal(h.page._session, null); assert.equal(h.page.data.hasSession, false); assert.equal(h.page.data.gateAllowed, false);
  h.page.onUnload(); h.page.onRetrySave(); assert.equal(h.saved.length, 0); assert.equal(h.timers.size, 0); assert.equal(h.state.profile, null);
});

test('a failed old summary cannot resurrect cleared records even after identical profile data is re-entered', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(6000); h.page.onConfirm(); h.failSave(true); h.page.onStop();
  assert.equal(h.page.data.hasUnsaved, true);
  h.page.onHide(); h.clearData(true); h.failSave(false); h.page.onRetrySave();
  assert.equal(h.saved.length, 0); assert.equal(h.page._pendingSummary, null); assert.equal(h.page.data.hasUnsaved, false); assert.equal(h.page.data.hasSession, false); assert.match(h.page.data.saveMessage, /未重新写回/);
});

test('date expiry invalidates the old session before a confirmation can be recorded', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(6000); h.page.onHide(); h.tick(31 * 86400000); h.page.onShow();
  assert.equal(h.page._session, null); assert.equal(h.page.data.hasSession, false); assert.equal(h.page.data.gateAllowed, false); h.page.onRetrySave(); assert.equal(h.saved.length, 0);
});

test('the real local store persists a page summary and its successful clear invalidates stale page memory', () => {
  const { createStore, STORAGE_KEY } = require('../miniprogram/app/utils/store.js');
  let time = Date.parse(DAY + 'T02:00:00Z');
  const memory = new Map(), timers = new Map(); let timerId = 0;
  const wxApi = { getStorageSync: key => memory.has(key) ? structuredClone(memory.get(key)) : '', setStorageSync: (key, value) => memory.set(key, structuredClone(value)), removeStorageSync: key => memory.delete(key) };
  const realStore = createStore(wxApi, { now: () => new Date(time) });
  assert.equal(realStore.saveProfile(profile()).ok, true);
  const page = createTrainingPage({ store: realStore, clinical, daily, game, meditation, platform: { setKeepScreenOn() {}, showModal() {} }, now: () => time, schedule: fn => { timers.set(++timerId, fn); return timerId; }, cancel: id => timers.delete(id) });
  page.data = structuredClone(page.data); page.setData = patch => Object.assign(page.data, structuredClone(patch)); page.onLoad(); page.onShow();
  for (const item of page.data.questions) page.onPrecheckChange({ currentTarget: { dataset: { key: item.key } }, detail: { value: item.key === 'clinicianCleared' ? 'yes' : 'no' } });
  page.onStart(); time += 6000; for (const tick of [...timers.values()]) tick(); page.onConfirm(); time += 1500; for (const tick of [...timers.values()]) tick(); page.onStop();
  assert.equal(page.data.saved, true); assert.equal(realStore.load().state.sessions.length, 1); assert.equal(realStore.load().state.sessions[0].completedCycles, 1); assert.equal(realStore.load().state.sessions[0].elapsedMs, 7500); assert.deepEqual([...memory.keys()], [STORAGE_KEY]);
  page.onHide(); assert.equal(realStore.clearAll().ok, true); assert.equal(realStore.saveProfile(profile()).ok, true); page.onShow();
  assert.equal(page._session, null); page.onRetrySave(); page.onUnload(); assert.equal(realStore.load().state.sessions.length, 0);
});

test('storage failures remain unsaved and a deliberate retry saves the unchanged summary once', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(6000); h.page.onConfirm(); h.tick(1500); h.failSave(true); h.page.onStop();
  assert.equal(h.page.data.saved, false); assert.equal(h.page.data.hasUnsaved, true); assert.equal(h.saved.length, 0); assert.match(h.page.data.saveMessage, /未保存/);
  const pending = structuredClone(h.page._pendingSummary); h.page.onStart(); assert.equal(h.page.data.running, false);
  h.failSave(false); h.page.onRetrySave(); assert.equal(h.page.data.saved, true); assert.equal(h.page.data.hasUnsaved, false); assert.deepEqual(h.saved, [pending]);
  h.page.onRetrySave(); assert.equal(h.saved.length, 1); assert.equal(h.saved[0].completedCycles, 1); assert.equal(h.saved[0].elapsedMs, 7500);
});

test('discomfort immediately stops the clock and displays help without starting a phone call', () => {
  const h = harness(); h.selectChecks(); h.page.onStart(); h.tick(500); h.page.onEmergencyStop();
  assert.equal(h.page.data.running, false); assert.equal(h.page.data.stopped, true); assert.equal(h.timers.size, 0); assert.equal(h.screen.at(-1), false); assert.match(h.page.data.urgentBanner, /120/); assert.equal(h.saved[0].completedCycles, 0);
});

test('mouth, hand and abdomen change with the actual phase while reduced motion is static', () => {
  const frame = elapsed => ({ ...game.getBreathingFrame(elapsed), status: 'running', totalCycles: 20, completedCycles: 0, activeGuidanceSeconds: elapsed / 1000 });
  const inhale = deriveTrainingView(frame(1800), 'demonstration', false, game, meditation);
  const exhale = deriveTrainingView(frame(5200), 'demonstration', false, game, meditation);
  assert.notEqual(inhale.mouthStyle, exhale.mouthStyle); assert.notEqual(inhale.handStyle, exhale.handStyle); assert.notEqual(inhale.bellyStyle, exhale.bellyStyle);
  const stillIn = deriveTrainingView(frame(1800), 'demonstration', true, game, meditation);
  const stillOut = deriveTrainingView(frame(5200), 'demonstration', true, game, meditation);
  for (const field of ['mouthStyle', 'handStyle', 'bellyStyle', 'ringStyle', 'markerStyle', 'leftLegStyle', 'rightLegStyle']) assert.equal(stillIn[field], stillOut[field]);
});

test('imagined stairs and meadow follow their distinct one-two and two-four guidance without measured-step claims', () => {
  const base = { ...game.getBreathingFrame(6000), status: 'awaiting-confirmation', totalCycles: 20, completedCycles: 0, activeGuidanceSeconds: 6 };
  const stairs = deriveTrainingView(base, 'stairs', false, game, meditation), meadow = deriveTrainingView(base, 'meadow', false, game, meditation);
  assert.equal(stairs.imagineCount, 3); assert.equal(meadow.imagineCount, 6); assert.match(stairs.modeInstruction, /1 级.*2 级/); assert.match(meadow.modeInstruction, /2 步.*4 步/); assert.match(meadow.motionLabel, /不代表/);
});
