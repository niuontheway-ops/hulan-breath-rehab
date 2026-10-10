import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_TOPICS, normalizeDailyRecord, evaluateDailyRecord, upsertDailyRecord, validateDailyRecords, mountDailyAssessment } from '../daily.mjs';

// These fixed records and numeric values are simulated test data, never patient records.
const TODAY = '2026-10-10';
const rawRecord = (changes = {}) => ({
  day: TODAY, recordedAt: `${TODAY}T02:00:00.000Z`, topic: 'copd', statusComparedUsual: 'usual',
  breathlessness: 2, fatigue: 3, dyspneaScale: 'mmrc', dyspneaScore: 1, spo2: null,
  sputumChange: false, sputumAmount: 'usual', sputumColor: 'usual',
  redFlags: { chestPain: false, severeBreathlessness: false, fainting: false, hemoptysis: false },
  scores: { act: null, cat: null, ess: null, ftnd: null }, scoreDate: null,
  ageGroup: 'adult', diagnosisConfirmed: true,
  ...changes,
});
const normalize = (raw) => normalizeDailyRecord(raw, { today: TODAY });
const record = (changes) => {
  const normalized = normalize(rawRecord(changes));
  assert.equal(normalized.valid, true, JSON.stringify(normalized.errors));
  return normalized.record;
};
const hasError = (result, field) => result.errors.some((error) => error.field === field);

test('a new high MRC or mMRC score pauses training with the same scale offset', () => {
  assert.equal(evaluateDailyRecord(record({dyspneaScale:'mmrc',dyspneaScore:2})).status,'recorded');
  assert.equal(evaluateDailyRecord(record({dyspneaScale:'mrc',dyspneaScore:3})).status,'recorded');
  assert.equal(evaluateDailyRecord(record({dyspneaScale:'mmrc',dyspneaScore:3})).status,'review');
  assert.equal(evaluateDailyRecord(record({dyspneaScale:'mrc',dyspneaScore:4})).status,'review');
});
test('new COPD CAT total uses the existing conservative review boundary', () => {
  assert.equal(evaluateDailyRecord(record({scores:{cat:29},scoreDate:TODAY})).status,'recorded');
  assert.equal(evaluateDailyRecord(record({scores:{cat:30},scoreDate:TODAY})).status,'review');
});

test('preserves every original disease/support topic with its exact id', () => {
  assert.deepEqual(DAILY_TOPICS.map((topic) => topic.id), ['copd', 'asthma', 'bronchiectasis', 'lungcancer', 'pneumoconiosis', 'ild', 'pneumothorax', 'effusion', 'tb', 'corpulmonale', 'osa', 'quit']);
  assert.ok(Object.isFrozen(DAILY_TOPICS));
  assert.ok(DAILY_TOPICS.every(Object.isFrozen));
});

test('normalizes numeric strings and deliberately keeps unmeasured oxygen absent', () => {
  const result = normalize(rawRecord({ breathlessness: '0.5', fatigue: '0', dyspneaScore: '2', spo2: '' }));
  assert.equal(result.valid, true);
  assert.equal(result.record.breathlessness, 0.5);
  assert.equal(result.record.fatigue, 0);
  assert.equal(result.record.spo2, null);
  assert.equal(result.record.id, `${TODAY}:copd`);
});

test('requires an explicitly supplied valid today boundary', () => {
  assert.equal(normalizeDailyRecord(rawRecord()).valid, false);
  assert.equal(normalizeDailyRecord(rawRecord(), { today: '2026-02-30' }).valid, false);
  assert.deepEqual(validateDailyRecords([rawRecord()]), []);
  assert.throws(() => mountDailyAssessment({}, { today: TODAY }), /有效容器/);
});

test('rejects missing, impossible and future dates but permits a real historical day', () => {
  for (const day of [undefined, '2026-02-30', '2026-13-01', '10/10/2026', '2026-10-11']) {
    assert.equal(normalize(rawRecord({ day })).valid, false);
    assert.ok(hasError(normalize(rawRecord({ day })), 'day'));
  }
  assert.equal(normalize(rawRecord({ day: '2024-02-29' })).valid, true);
});

test('validates record timestamps using the client Shanghai calendar day', () => {
  const allowed = normalize(rawRecord({ recordedAt: '2026-10-10T15:59:00Z' }));
  assert.equal(allowed.valid, true);
  assert.equal(allowed.record.recordedAt, '2026-10-10T15:59:00.000Z');
  assert.ok(hasError(normalize(rawRecord({ recordedAt: '2026-10-10T16:00:00Z' })), 'recordedAt'));
  for (const recordedAt of ['2026-02-30T01:00:00Z', '<script>simulated</script>', '2026-10-10T99:00:00Z', true]) {
    assert.ok(hasError(normalize(rawRecord({ recordedAt })), 'recordedAt'));
  }
});

test('rejects unsupported topics and incomplete daily status or red-flag checks', () => {
  assert.ok(hasError(normalize(rawRecord({ topic: 'other' })), 'topic'));
  assert.ok(hasError(normalize(rawRecord({ statusComparedUsual: '' })), 'statusComparedUsual'));
  assert.equal(normalize(rawRecord({ redFlags: undefined })).valid, false);
  assert.equal(normalize(rawRecord({ redFlags: { chestPain: false } })).valid, false);
  assert.equal(normalize(rawRecord({ redFlags: { chestPain: 'false', severeBreathlessness: false, fainting: false, hemoptysis: false } })).valid, false);
});

test('validates finite numeric daily scores without accepting booleans, exponents or objects', () => {
  for (const bad of [true, [], {}, NaN, Infinity, 'NaN', '1e1', '-0.5', '10.5']) {
    assert.ok(hasError(normalize(rawRecord({ breathlessness: bad })), 'breathlessness'));
    assert.ok(hasError(normalize(rawRecord({ fatigue: bad })), 'fatigue'));
  }
  assert.ok(hasError(normalize(rawRecord({ breathlessness: '' })), 'breathlessness'));
  assert.ok(hasError(normalize(rawRecord({ fatigue: null })), 'fatigue'));
  for (const spo2 of [0, 101, 'bad', true]) assert.ok(hasError(normalize(rawRecord({ spo2 })), 'spo2'));
});

test('keeps MRC 1–5 and mMRC 0–4 separate and never silently remaps scores', () => {
  const mrc = record({ dyspneaScale: 'mrc', dyspneaScore: 3 });
  assert.equal(mrc.dyspneaScale, 'mrc');
  assert.equal(mrc.dyspneaScore, 3);
  assert.equal(record({ dyspneaScale: 'mmrc', dyspneaScore: 0 }).dyspneaScore, 0);
  assert.ok(hasError(normalize(rawRecord({ dyspneaScale: 'mrc', dyspneaScore: 0 })), 'dyspneaScore'));
  assert.ok(hasError(normalize(rawRecord({ dyspneaScale: 'mmrc', dyspneaScore: 5 })), 'dyspneaScore'));
  assert.ok(hasError(normalize(rawRecord({ dyspneaScale: null, dyspneaScore: 2 })), 'dyspneaScale'));
  assert.ok(hasError(normalize(rawRecord({ dyspneaScore: 2.5 })), 'dyspneaScore'));
  const absent = record({ dyspneaScore: '' });
  assert.equal(absent.dyspneaScore, null);
  assert.equal(absent.dyspneaScale, null);
});

test('accepts only integer totals within each original questionnaire range', () => {
  for (const [key, minimum, maximum] of [['act', 5, 25], ['cat', 0, 40], ['ess', 0, 24], ['ftnd', 0, 10]]) {
    for (const value of [minimum, maximum]) {
      const result = normalize(rawRecord({ scores: { [key]: String(value) }, scoreDate: TODAY }));
      assert.equal(result.valid, true);
      assert.equal(result.record.scores[key], value);
    }
    for (const value of [minimum - 1, maximum + 1, minimum + 0.5, true]) {
      assert.ok(hasError(normalize(rawRecord({ scores: { [key]: value }, scoreDate: TODAY })), `scores.${key}`));
    }
  }
});

test('requires the actual completion date when an existing questionnaire total is entered', () => {
  assert.ok(hasError(normalize(rawRecord({ scores: { act: 20 } })), 'scoreDate'));
  assert.ok(hasError(normalize(rawRecord({ scores: { cat: 8 }, scoreDate: '2026-10-11' })), 'scoreDate'));
  assert.ok(hasError(normalize(rawRecord({ day: '2026-10-01', scores: { cat: 8 }, scoreDate: '2026-10-02' })), 'scoreDate'));
  assert.equal(record({ scores: { act: 20 }, scoreDate: '2026-10-01' }).scoreDate, '2026-10-01');
});

test('derives sputum changes and promotes blood to the hemoptysis safety flag', () => {
  assert.equal(record({ sputumChange: false, sputumAmount: 'increased' }).sputumChange, true);
  assert.equal(record({ sputumChange: false, sputumColor: 'changed' }).sputumChange, true);
  const blood = record({ sputumChange: false, sputumColor: 'blood' });
  assert.equal(blood.sputumChange, true);
  assert.equal(blood.redFlags.hemoptysis, true);
  assert.equal(evaluateDailyRecord(blood).status, 'urgent');
  assert.ok(hasError(normalize(rawRecord({ sputumChange: 'no' })), 'sputumChange'));
  assert.ok(hasError(normalize(rawRecord({ sputumAmount: 'free text' })), 'sputumAmount'));
});

test('strips unknown fields, free text, arbitrary ids and extra nested properties', () => {
  const source = rawRecord({ id: 'simulated arbitrary id', patientName: '模拟姓名', notes: '<script>simulated</script>', originalFile: 'simulated.pdf', diagnosis: 'simulated', redFlags: { ...rawRecord().redFlags, notes: 'simulated' }, scores: { ...rawRecord().scores, narrative: 'simulated' } });
  const result = normalize(source);
  assert.equal(result.valid, true);
  assert.equal(result.record.id, `${TODAY}:copd`);
  for (const key of ['patientName', 'notes', 'originalFile', 'diagnosis']) assert.equal(Object.hasOwn(result.record, key), false);
  assert.equal(Object.hasOwn(result.record.redFlags, 'notes'), false);
  assert.equal(Object.hasOwn(result.record.scores, 'narrative'), false);
  assert.equal(source.notes, '<script>simulated</script>');
});

test('a complete stable adult record is recorded without announcing clearance or diagnosis', () => {
  const evaluation = evaluateDailyRecord(record());
  assert.equal(evaluation.status, 'recorded');
  assert.equal(evaluation.reasons.length, 0);
  assert.match(evaluation.message, /训练仍需/);
  assert.match(evaluation.message, /未填写的指标不能视为正常/);
});

test('each red flag takes priority over all normal numeric readings', () => {
  for (const key of ['chestPain', 'severeBreathlessness', 'fainting', 'hemoptysis']) {
    const evaluation = evaluateDailyRecord(record({ breathlessness: 0, fatigue: 0, spo2: 99, redFlags: { ...rawRecord().redFlags, [key]: true } }));
    assert.equal(evaluation.status, 'urgent');
    assert.equal(evaluation.reasons.length, 1);
    assert.match(evaluation.message, /120/);
  }
});

test('worse or uncertain daily state pauses training pending review', () => {
  for (const statusComparedUsual of ['worse', 'unknown']) {
    const evaluation = evaluateDailyRecord(record({ statusComparedUsual }));
    assert.equal(evaluation.status, 'review');
    assert.match(evaluation.message, /暂停互动训练/);
  }
});

test('oxygen at or below 92 triggers the product safety gate without prescribing an oxygen change', () => {
  for (const spo2 of [92, 88]) assert.equal(evaluateDailyRecord(record({ spo2 })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ spo2: 93 })).status, 'recorded');
  assert.ok(evaluateDailyRecord(record({ spo2: 92 })).reasons.some((reason) => reason.includes('个人目标')));
});

test('ACT 19 and below prompts review for asthma, without using it as a daily or diagnostic score', () => {
  assert.equal(evaluateDailyRecord(record({ topic: 'asthma', scores: { act: 19 }, scoreDate: TODAY })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ topic: 'asthma', scores: { act: 20 }, scoreDate: TODAY })).status, 'recorded');
  assert.equal(evaluateDailyRecord(record({ topic: 'asthma', scores: { act: 25 }, scoreDate: '2026-08-01' })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ topic: 'copd', scores: { act: 19 }, scoreDate: TODAY })).status, 'recorded');
});

test('high daily numeric scores and changed sputum are conservative review triggers', () => {
  assert.equal(evaluateDailyRecord(record({ breathlessness: 7 })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ fatigue: 8 })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ sputumChange: true })).status, 'review');
});

test('pneumothorax and relevant tuberculosis symptoms never create autonomous training clearance', () => {
  assert.equal(evaluateDailyRecord(record({ topic: 'pneumothorax' })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ topic: 'tb', tbSymptoms: { persistentCough: true } })).status, 'review');
  assert.equal(evaluateDailyRecord(record({ topic: 'tb', tbSymptoms: { feverNightSweats: true } })).status, 'review');
});

test('minors, unknown age and unconfirmed diagnoses remain recording-only with review', () => {
  for (const changes of [{ ageGroup: 'minor' }, { ageGroup: 'unknown' }, { diagnosisConfirmed: false }, { diagnosisConfirmed: null }]) assert.equal(evaluateDailyRecord(record(changes)).status, 'review');
  assert.equal(evaluateDailyRecord(record({ topic: 'quit', diagnosisConfirmed: null })).status, 'recorded');
});

test('malformed or incomplete evaluation inputs never return recorded', () => {
  for (const source of [null, {}, { topic: 'copd', redFlags: {} }, { ...record(), breathlessness: undefined }, { ...record(), spo2: NaN }, { ...record(), scores: { act: 100 } }, { ...record(), dyspneaScore: 5 }, { ...record({ topic: 'asthma', scores: { act: 22 }, scoreDate: TODAY }), scoreDate: null }]) assert.equal(evaluateDailyRecord(source).status, 'review');
  assert.equal(evaluateDailyRecord({ ...record(), sputumColor: 'blood', redFlags: rawRecord().redFlags }).status, 'urgent');
});

test('upsert replaces only the same day and topic and never mutates the caller array', () => {
  const same = record({ fatigue: 2 });
  const otherTopic = record({ topic: 'asthma' });
  const previousDay = record({ day: '2026-10-09' });
  const input = [same, otherTopic, previousDay];
  const replacement = record({ fatigue: 4 });
  const updated = upsertDailyRecord(input, replacement);
  assert.equal(updated.length, 3);
  assert.equal(updated.find((item) => item.topic === 'copd' && item.day === TODAY).fatigue, 4);
  assert.ok(updated.includes(otherTopic));
  assert.ok(updated.includes(previousDay));
  assert.equal(input[0].fatigue, 2);
  assert.equal(input.length, 3);
});

test('restore rejects invalid and future records while retaining other diseases and real history', () => {
  const restored = validateDailyRecords([rawRecord(), rawRecord({ topic: 'asthma' }), rawRecord({ day: '2026-10-09' }), rawRecord({ day: '2026-10-11' }), rawRecord({ fatigue: 100 }), { topic: 'copd' }, null], { today: TODAY });
  assert.equal(restored.length, 3);
  assert.deepEqual(restored.map((item) => `${item.day}:${item.topic}`), ['2026-10-09:copd', '2026-10-10:asthma', '2026-10-10:copd']);
});

test('restore resolves same-day duplicates by actual recording time rather than input order', () => {
  const newer = rawRecord({ recordedAt: `${TODAY}T04:00:00Z`, fatigue: 4 });
  const older = rawRecord({ recordedAt: `${TODAY}T02:00:00Z`, fatigue: 2 });
  assert.equal(validateDailyRecords([newer, older], { today: TODAY })[0].fatigue, 4);
});

test('restore cannot reintroduce unknown text or code into records', () => {
  const restored = validateDailyRecords([rawRecord({ customText: 'simulated free text', scores: { act: null, cat: null, ess: null, ftnd: null, customText: 'simulated' } })], { today: TODAY });
  assert.equal(restored.length, 1);
  assert.equal(JSON.stringify(restored).includes('simulated'), false);
  assert.deepEqual(validateDailyRecords({ records: [rawRecord()] }, { today: TODAY }), []);
});
