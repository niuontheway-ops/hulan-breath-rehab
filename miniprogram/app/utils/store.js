const { validateProfile } = require('../core/clinical');
const { normalizeDailyRecord, upsertDailyRecord } = require('../core/daily');
const { today, isDay, DAY_MS } = require('./calendar');

class RecordError extends Error {}

const STORAGE_KEY = 'hulan.rehab.wechat.v1';
const MAX_BYTES = 512 * 1024;
const MAX_DAILY = 365;
const MAX_SESSIONS = 500;
const PROFILE_FIELDS = ['disease', 'age', 'fev1Percent', 'fev1Fvc', 'spo2', 'act', 'cat', 'dyspneaScale', 'dyspneaScore', 'stability', 'clinicianCleared', 'assessmentDate', 'goal'];
const RED_FLAGS = ['chestPain', 'severeBreathlessness', 'fainting', 'hemoptysis'];
const MODES = ['demonstration', 'stairs', 'meadow'];
const OPTIONAL_PROFILE = ['fev1Percent', 'fev1Fvc', 'spo2', 'act', 'cat', 'dyspneaScale', 'dyspneaScore'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const absent = value => value === undefined || value === '';
const initialState = () => ({ schemaVersion: 1, profile: null, daily: [], sessions: [], settings: { senior: false, reducedMotion: false } });

function byteLength(text) {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
    else bytes += 3;
  }
  return bytes;
}

function normalizeProfile(raw, day) {
  if (!object(raw)) throw new RecordError('请先完成健康资料。');
  const profile = {};
  PROFILE_FIELDS.forEach(field => { profile[field] = own(raw, field) ? raw[field] : OPTIONAL_PROFILE.includes(field) ? null : undefined; });
  profile.redFlags = {};
  RED_FLAGS.forEach(field => { profile.redFlags[field] = object(raw.redFlags) && own(raw.redFlags, field) ? raw.redFlags[field] : undefined; });
  const result = validateProfile(profile);
  if (!result.valid) throw new RecordError(result.errors[0].message);
  if (!isDay(day) || profile.assessmentDate > day) throw new RecordError('评估日期不能晚于今天。');
  return profile;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !isDay(value.slice(0, 10))) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeSession(raw, now) {
  if (!object(raw) || typeof raw.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(raw.id)) throw new RecordError('训练记录标识不正确。');
  const start = timestamp(raw.startedAt), end = timestamp(raw.endedAt);
  if (!start || !end || end < start || end.getTime() > now.getTime() + 1000) throw new RecordError('训练记录时间不正确，请核对手机日期。');
  if (!MODES.includes(raw.mode) || !['completed', 'stopped'].includes(raw.status)) throw new RecordError('训练记录类型不正确。');
  if (!Number.isInteger(raw.completedCycles) || raw.completedCycles < 0 || raw.completedCycles > 1000 || raw.status === 'completed' && raw.completedCycles === 0) throw new RecordError('请核对实际确认的练习轮数。');
  if (typeof raw.elapsedMs !== 'number' || !Number.isFinite(raw.elapsedMs) || raw.elapsedMs < 0 || raw.elapsedMs > DAY_MS || raw.elapsedMs > end - start + 1000 || raw.completedCycles > 0 && raw.elapsedMs === 0) throw new RecordError('训练计时不正确，记录尚未保存。');
  return { id: raw.id, startedAt: start.toISOString(), endedAt: end.toISOString(), mode: raw.mode, completedCycles: raw.completedCycles, elapsedMs: raw.elapsedMs, status: raw.status };
}

function validateState(raw, now) {
  if (!object(raw) || raw.schemaVersion !== 1) throw new RecordError('本机记录版本无法识别，原记录未被覆盖。请在设置中明确清除后重新保存。');
  if (!own(raw, 'profile') || !Array.isArray(raw.daily) || !Array.isArray(raw.sessions) || !object(raw.settings) || typeof raw.settings.senior !== 'boolean' || typeof raw.settings.reducedMotion !== 'boolean') throw new RecordError('本机记录格式异常，原记录未被覆盖。请在设置中明确清除后重新保存。');
  if (raw.daily.length > MAX_DAILY || raw.sessions.length > MAX_SESSIONS || byteLength(JSON.stringify(raw)) > MAX_BYTES) throw new RecordError('本机记录超过容量限制，原记录未被覆盖。');
  const day = today(now), state = initialState();
  state.profile = raw.profile === null ? null : normalizeProfile(raw.profile, day);
  const days = new Set(), ids = new Set();
  state.daily = raw.daily.map(item => {
    const result = normalizeDailyRecord(item, { today: day });
    if (!result.valid || days.has(result.record.id)) throw new RecordError('本机健康记录格式异常，原记录未被覆盖。');
    days.add(result.record.id);
    return result.record;
  });
  state.sessions = raw.sessions.map(item => {
    const result = normalizeSession(item, now);
    if (ids.has(result.id)) throw new RecordError('本机训练记录重复，原记录未被覆盖。');
    ids.add(result.id);
    return result;
  });
  state.settings = { senior: raw.settings.senior, reducedMotion: raw.settings.reducedMotion };
  return state;
}

function createStore(wxApi, { now = () => new Date() } = {}) {
  let epoch = 0;
  const api = () => {
    const value = wxApi || (typeof wx !== 'undefined' ? wx : null);
    if (!value || typeof value.getStorageSync !== 'function' || typeof value.setStorageSync !== 'function' || typeof value.removeStorageSync !== 'function') throw new RecordError('无法使用手机本地存储，记录尚未保存。');
    return value;
  };
  const clock = () => {
    const value = now(), date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new RecordError('无法确定当前日期，请核对手机时间。');
    return date;
  };
  const failure = (message, state = initialState()) => ({ ok: false, state, message });
  function load() {
    try {
      const raw = api().getStorageSync(STORAGE_KEY);
      return { ok: true, state: absent(raw) ? initialState() : validateState(raw, clock()) };
    } catch (error) {
      return failure(error instanceof RecordError ? error.message : '读取本机记录失败。原记录未被覆盖，请重试或在设置中清除本机数据。');
    }
  }
  function update(change) {
    const loaded = load();
    if (!loaded.ok) return loaded;
    try {
      const state = change(loaded.state, clock());
      if (state.daily.length > MAX_DAILY) return failure('健康记录已达 365 条上限，本次尚未保存。请先在设置中处理本机记录。', loaded.state);
      if (state.sessions.length > MAX_SESSIONS) return failure('训练记录已达 500 条上限，本次尚未保存。请先在设置中处理本机记录。', loaded.state);
      if (byteLength(JSON.stringify(state)) > MAX_BYTES) return failure('本机记录空间不足，本次尚未保存。请先在设置中处理本机记录。', loaded.state);
      api().setStorageSync(STORAGE_KEY, state);
      return { ok: true, state };
    } catch (error) {
      return failure(error instanceof RecordError ? error.message : '保存到手机失败，本次记录尚未保存。请检查手机存储空间后重试。', loaded.state);
    }
  }
  return {
    load,
    getEpoch() { return epoch; },
    saveProfile(profile) { return update((state, date) => ({ ...state, profile: normalizeProfile(profile, today(date)) })); },
    saveDaily(raw) {
      return update((state, date) => {
        const result = normalizeDailyRecord(object(raw) ? { ...raw, recordedAt: raw.recordedAt === undefined ? date.toISOString() : raw.recordedAt } : raw, { today: today(date) });
        if (!result.valid) throw new RecordError(result.errors[0].message);
        return { ...state, daily: upsertDailyRecord(state.daily, result.record) };
      });
    },
    saveSession(session) {
      return update((state, date) => {
        const record = normalizeSession(session, date);
        return { ...state, sessions: [...state.sessions.filter(item => item.id !== record.id), record] };
      });
    },
    saveSettings(patch) {
      return update(state => {
        if (!object(patch) || !['senior', 'reducedMotion'].some(field => own(patch, field)) || ['senior', 'reducedMotion'].some(field => own(patch, field) && typeof patch[field] !== 'boolean')) throw new RecordError('请核对显示设置。');
        const settings = { ...state.settings };
        ['senior', 'reducedMotion'].forEach(field => { if (own(patch, field)) settings[field] = patch[field]; });
        return { ...state, settings };
      });
    },
    clearAll() {
      try {
        const storage = api();
        storage.removeStorageSync(STORAGE_KEY);
        if (!absent(storage.getStorageSync(STORAGE_KEY))) return failure('无法确认清除结果，请重试。');
        epoch++;
        return { ok: true, state: initialState() };
      } catch (_) { return failure('清除手机本机记录失败，请重试；未清除其他应用的数据。'); }
    },
  };
}

const store = createStore();
module.exports = { createStore, store, STORAGE_KEY, MAX_BYTES, MAX_DAILY, MAX_SESSIONS };
