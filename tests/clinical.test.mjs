import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, createPlan, assessTrainingReadiness } from '../clinical.mjs';

const now = new Date('2026-10-10T04:00:00Z');
const profile = overrides => ({
  disease: 'copd', age: 58, fev1Percent: 62, fev1Fvc: 58, spo2: 96,
  dyspneaScale: 'mmrc', dyspneaScore: 1, act: null, cat: 12,
  stability: 'stable',
  redFlags: { chestPain: false, severeBreathlessness: false, fainting: false, hemoptysis: false },
  clinicianCleared: true, assessmentDate: '2026-10-10', goal: 'daily', ...overrides,
});
const beforeTraining = overrides => ({
  chestPain: false, severeBreathlessness: false, dizziness: false,
  worseSymptoms: false, spo2: 96, clinicianCleared: true, ...overrides,
});
const walkingMinutes = value => createPlan(value, now).sessions.find(session => session.kind === 'walking')?.minutes;
test('assessment and interface use the same Shanghai day across UTC midnight', () => {
  assert.equal(createPlan(profile(),new Date('2026-10-09T16:00:00Z')).status,'ready');
  assert.equal(createPlan(profile(),new Date('2026-10-09T15:59:59Z')).status,'incomplete');
});
const assertClosed = plan => {
  assert.notEqual(plan.status, 'ready');
  assert.deepEqual(plan.sessions, []);
  assert.deepEqual(plan.weekly, []);
  assert.equal(plan.breathing.cycles, 0);
  assert.ok(plan.reasons.length > 0);
};

test('adult stable COPD: complete contract and serializable education plan', () => {
  assert.equal(validateProfile(profile()).valid, true);
  const plan = createPlan(profile(), now);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.breathing.inhaleSeconds, 2);
  assert.equal(plan.breathing.exhaleSeconds, 4);
  assert.ok(plan.breathing.cycles > 0);
  assert.equal(plan.weekly.length, 7);
  assert.equal(new Set(plan.sessions.map(session => session.id)).size, plan.sessions.length);
  assert.ok(plan.sessions.every(session => session.minutes > 0 && session.instruction && session.intensity && session.frequency));
  assert.ok(plan.sessions.every(session => ['breathing', 'walking', 'strength', 'education'].includes(session.kind)));
  assert.ok(plan.sourceLinks.every(source => source.label && source.url.startsWith('https://')));
  assert.ok(plan.warnings.some(warning => warning.includes('尚未经过临床验证')));
  assert.ok(plan.ruleVersion);
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
});

test('empty, non-object and incomplete inputs never permit training', async t => {
  for (const value of [null, undefined, [], 'profile', {}, 1]) {
    await t.test(String(value), () => {
      assert.equal(validateProfile(value).valid, false);
      assertClosed(createPlan(value, now));
    });
  }
});

test('invalid numeric fields fail without coercion', async t => {
  const invalid = {
    age: [0, -1, 121, 18.5, '58', NaN, Infinity],
    fev1Percent: [0, -1, 201, '62', NaN, Infinity],
    fev1Fvc: [0, -1, 101, '58', NaN, Infinity],
    spo2: [0, -1, 101, '96', NaN, Infinity],
    dyspneaScore: [-1, 5, 1.5, '1', NaN, Infinity],
    act: [4, 26, 20.5, '22', NaN, Infinity],
    cat: [-1, 41, 10.5, '12', NaN, Infinity],
  };
  for (const [field, values] of Object.entries(invalid)) {
    for (const value of values) {
      await t.test(`${field} = ${String(value)}`, () => {
        const input = profile({ [field]: value });
        const validation = validateProfile(input);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some(error => error.field === field));
        assert.equal(createPlan(input, now).status, 'incomplete');
        assertClosed(createPlan(input, now));
      });
    }
  }
});

test('measurement limits, integer scores, and optional measurements are distinct', () => {
  assert.equal(validateProfile(profile({ fev1Percent: 200, fev1Fvc: 100, spo2: 100, cat: 0, act: 25 })).valid, true);
  assert.equal(validateProfile(profile({ fev1Percent: 62.3, fev1Fvc: 58.2, spo2: 96.5 })).valid, true);
  const withoutTests = createPlan(profile({ fev1Percent: null, fev1Fvc: null, spo2: null, cat: null }), now);
  assert.equal(withoutTests.status, 'ready');
  assert.ok(withoutTests.warnings.some(warning => warning.includes('低氧风险')));
  assert.ok(withoutTests.warnings.some(warning => warning.includes('未提供肺功能')));
});

test('invalid enum values, missing safety checks and non-boolean consent fail closed', async t => {
  const inputs = [
    { disease: 'COPD' }, { dyspneaScale: 'mMRC' }, { stability: '' }, { goal: 'diagnose' },
    { clinicianCleared: 'true' }, { redFlags: null },
    { redFlags: { chestPain: false } },
    { redFlags: { ...profile().redFlags, chestPain: 'false' } },
  ];
  for (const input of inputs) {
    await t.test(JSON.stringify(input), () => assertClosed(createPlan(profile(input), now)));
  }
});

test('MRC 1–5 is explicitly offset to mMRC 0–4 without mutating input', async t => {
  for (let value = 1; value <= 5; value++) {
    await t.test(`MRC ${value}`, () => {
      const input = profile({ dyspneaScale: 'mrc', dyspneaScore: value });
      const mrc = createPlan(input, now);
      const mmrc = createPlan(profile({ dyspneaScore: value - 1 }), now);
      assert.equal(validateProfile(input).valid, true);
      assert.equal(mrc.status, mmrc.status);
      assert.deepEqual(mrc.sessions, mmrc.sessions);
      assert.ok(mrc.metrics.find(metric => metric.label === '呼吸困难').detail.includes(`MRC ${value} → mMRC ${value - 1}`));
      assert.equal(input.dyspneaScore, value);
    });
  }
  assert.equal(validateProfile(profile({ dyspneaScale: 'mrc', dyspneaScore: 0 })).valid, false);
  assert.equal(validateProfile(profile({ dyspneaScale: 'mrc', dyspneaScore: 6 })).valid, false);
});

test('skipped professional scores can be saved but require review before training', async t => {
  for (const missing of [null, undefined]) {
    for (const disease of ['asthma', 'copd', 'bronchiectasis']) {
      await t.test(`${disease}, missing = ${String(missing)}`, () => {
        const input = profile(disease === 'asthma'
          ? { disease, act: missing }
          : { disease, dyspneaScale: missing, dyspneaScore: missing });
        assert.equal(validateProfile(input).valid, true);
        const plan = createPlan(input, now);
        assert.equal(plan.status, 'review');
        assertClosed(plan);
        assert.ok(plan.reasons.some(reason => reason.includes('稍后补充') && reason.includes('联系医护')));
        assert.ok(!plan.reasons.some(reason => reason.startsWith('ACT 不超过 19')));
        const completed = disease === 'asthma'
          ? { ...input, act: 22 }
          : { ...input, dyspneaScale: 'mmrc', dyspneaScore: 1 };
        assert.equal(createPlan(completed, now).status, 'ready');
      });
    }
  }
  assert.equal(validateProfile(profile({ dyspneaScale: null, dyspneaScore: 1 })).valid, false);
  assert.equal(validateProfile(profile({ dyspneaScale: 'mMRC', dyspneaScore: null })).valid, false);
  assert.equal(createPlan(profile({ disease: 'asthma', act: 22, dyspneaScale: null, dyspneaScore: null }), now).status, 'ready');
});

test('each urgent symptom takes precedence over incomplete or stale data', async t => {
  for (const field of ['chestPain', 'severeBreathlessness', 'fainting', 'hemoptysis']) {
    await t.test(field, () => {
      const urgent = createPlan(profile({ age: 0, act: null, dyspneaScore: null, assessmentDate: '2026-01-01', redFlags: { ...profile().redFlags, [field]: true } }), now);
      assert.equal(urgent.status, 'urgent');
      assertClosed(urgent);
      assert.ok(urgent.subtitle.includes('120'));
    });
  }
});

test('conservative product safeguards return review with no autonomous sessions', async t => {
  const scenarios = [
    { age: 17 }, { stability: 'unknown' }, { stability: 'worse' },
    { clinicianCleared: false }, { spo2: 92 }, { spo2: 50 },
    { dyspneaScore: 3 }, { dyspneaScore: 4 },
    { fev1Percent: 29.9 }, { cat: 30 }, { cat: 40 },
    { assessmentDate: '2026-09-09' }, { disease: 'other' },
  ];
  for (const scenario of scenarios) {
    await t.test(JSON.stringify(scenario), () => {
      const plan = createPlan(profile(scenario), now);
      assert.equal(plan.status, 'review');
      assertClosed(plan);
    });
  }
});

test('safe-side boundary values are ready; FEV1 cannot diagnose or solely set duration', () => {
  assert.equal(createPlan(profile({ age: 18, spo2: 92.1, fev1Percent: 30, cat: 29, dyspneaScore: 2 }), now).status, 'ready');
  const low = createPlan(profile({ fev1Percent: 40, fev1Fvc: 30 }), now);
  const high = createPlan(profile({ fev1Percent: 110, fev1Fvc: 90 }), now);
  assert.deepEqual(low.sessions, high.sessions);
  assert.equal(low.title, high.title);
});

test('COPD and asthma scores are not interchangeable', () => {
  assert.equal(createPlan(profile({ act: 5 }), now).status, 'ready');
  assert.equal(createPlan(profile({ disease: 'asthma', act: 22, cat: 40 }), now).status, 'ready');
  const asthmaMissing = createPlan(profile({ disease: 'asthma', act: null }), now);
  assert.equal(asthmaMissing.status, 'review');
  assertClosed(asthmaMissing);
  assert.equal(createPlan(profile({ dyspneaScore: null }), now).status, 'review');
  assert.equal(createPlan(profile({ disease: 'asthma', act: 22, dyspneaScore: null }), now).status, 'ready');
});

test('ACT 19/20 boundary and disease-specific education do not replace treatment', () => {
  for (const act of [5, 15, 19]) assert.equal(createPlan(profile({ disease: 'asthma', act }), now).status, 'review');
  for (const act of [20, 25]) assert.equal(createPlan(profile({ disease: 'asthma', act }), now).status, 'ready');
  const asthma = createPlan(profile({ disease: 'asthma', act: 22 }), now);
  assert.ok(asthma.sessions.find(session => session.kind === 'education').instruction.includes('哮喘行动计划'));
  assert.ok(asthma.warnings.some(warning => warning.includes('不能排除急性发作')));
  assert.notEqual(asthma.sessions[0].title, createPlan(profile(), now).sessions[0].title);
  const bronchiectasis = createPlan(profile({ disease: 'bronchiectasis' }), now);
  assert.equal(bronchiectasis.status, 'ready');
  assert.ok(bronchiectasis.sessions.find(session => session.kind === 'education').instruction.includes('排痰手法须由医护示范'));
});

test('goals and symptom burden change conservative starter content', () => {
  assert.ok(walkingMinutes(profile({ dyspneaScore: 2 })) < walkingMinutes(profile({ dyspneaScore: 0 })));
  assert.ok(walkingMinutes(profile({ cat: 20 })) < walkingMinutes(profile({ cat: 19 })));
  assert.ok(walkingMinutes(profile({ goal: 'endurance' })) > walkingMinutes(profile({ goal: 'daily' })));
  assert.ok(walkingMinutes(profile({ goal: 'daily' })) > walkingMinutes(profile({ goal: 'breathing' })));
  assert.ok(createPlan(profile({ goal: 'breathing' }), now).breathing.cycles > createPlan(profile(), now).breathing.cycles);
});

test('assessment dates reject invalid calendars and future dates, including leap years', async t => {
  for (const assessmentDate of ['', '2026-2-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-11', '1900-02-29', 'not-a-date']) {
    await t.test(assessmentDate || 'empty', () => {
      const plan = createPlan(profile({ assessmentDate }), now);
      assert.equal(plan.status, 'incomplete');
      assertClosed(plan);
    });
  }
  assert.equal(validateProfile(profile({ assessmentDate: '2024-02-29' })).valid, true);
  assert.equal(validateProfile(profile({ assessmentDate: '2000-02-29' })).valid, true);
  assert.equal(createPlan(profile({ assessmentDate: '2026-09-10' }), now).status, 'ready');
  assert.equal(createPlan(profile({ assessmentDate: '2026-09-09' }), now).status, 'review');
  assert.equal(createPlan(profile(), new Date(2026, 9, 10, 0, 1)).status, 'ready');
  assertClosed(createPlan(profile(), new Date('invalid')));
  assertClosed(createPlan(profile(), '2026-10-10'));
});

test('plan generation is deterministic and does not modify the profile', () => {
  const input = profile({ dyspneaScale: 'mrc', dyspneaScore: 2 });
  const original = JSON.stringify(input);
  assert.deepEqual(createPlan(input, now), createPlan(input, now));
  assert.equal(JSON.stringify(input), original);
});

test('training check requires explicit status and does not imply profile clearance', async t => {
  assert.equal(assessTrainingReadiness(beforeTraining()).allowed, true);
  assert.equal(assessTrainingReadiness(beforeTraining({ spo2: null })).allowed, true);
  for (const value of [undefined, null, {}, [], 'check']) {
    await t.test(String(value), () => assert.equal(assessTrainingReadiness(value).allowed, false));
  }
  for (const field of ['chestPain', 'severeBreathlessness', 'dizziness', 'worseSymptoms', 'clinicianCleared']) {
    assert.equal(assessTrainingReadiness(beforeTraining({ [field]: undefined })).allowed, false);
    assert.equal(assessTrainingReadiness(beforeTraining({ [field]: 'false' })).allowed, false);
  }
});

test('training symptoms and oxygen checks fail closed at safety boundaries', async t => {
  for (const field of ['chestPain', 'severeBreathlessness']) {
    assert.equal(assessTrainingReadiness({ [field]: true }).status, 'urgent');
    assert.equal(assessTrainingReadiness(beforeTraining({ [field]: true })).allowed, false);
  }
  for (const field of ['dizziness', 'worseSymptoms']) assert.equal(assessTrainingReadiness(beforeTraining({ [field]: true })).status, 'review');
  assert.equal(assessTrainingReadiness(beforeTraining({ clinicianCleared: false })).status, 'review');
  assert.equal(assessTrainingReadiness(beforeTraining({ spo2: 92 })).status, 'review');
  assert.equal(assessTrainingReadiness(beforeTraining({ spo2: 92.1 })).allowed, true);
  for (const spo2 of [0, -1, 101, '96', NaN, Infinity]) {
    await t.test(`SpO2 = ${String(spo2)}`, () => {
      const result = assessTrainingReadiness(beforeTraining({ spo2 }));
      assert.equal(result.allowed, false);
      assert.equal(result.status, 'incomplete');
    });
  }
});

test('current training check cannot unlock a clinically withheld plan', () => {
  const freshCheck = assessTrainingReadiness(beforeTraining());
  assert.equal(freshCheck.allowed, true);
  for (const withheld of [profile({ clinicianCleared: false }), profile({ stability: 'unknown' }), profile({ age: 17 }), profile({ dyspneaScore: null }), profile({ disease: 'asthma', act: null })]) {
    const plan = createPlan(withheld, now);
    assert.equal(plan.status === 'ready' && freshCheck.allowed, false);
  }
});
