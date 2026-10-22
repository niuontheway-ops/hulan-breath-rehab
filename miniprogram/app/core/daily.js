// Generated from the corresponding project module by scripts/build-miniprogram.mjs.
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const DAILY_TOPICS = Object.freeze([
  { id: 'copd', name: '慢性阻塞性肺疾病（慢阻肺）', metric: 'mmrc' },
  { id: 'asthma', name: '支气管哮喘', metric: 'act' },
  { id: 'bronchiectasis', name: '支气管扩张', metric: 'breathlessness' },
  { id: 'lungcancer', name: '肺癌（围手术期 / 康复）', metric: 'fatigue' },
  { id: 'pneumoconiosis', name: '尘肺病', metric: 'mmrc' },
  { id: 'ild', name: '间质性肺疾病', metric: 'breathlessness' },
  { id: 'pneumothorax', name: '气胸（恢复期）', metric: 'breathlessness' },
  { id: 'effusion', name: '胸腔积液', metric: 'mmrc' },
  { id: 'tb', name: '肺结核', metric: 'breathlessness' },
  { id: 'corpulmonale', name: '慢性肺源性心脏病', metric: 'mmrc' },
  { id: 'osa', name: '睡眠呼吸暂停', metric: 'ess' },
  { id: 'quit', name: '戒烟支持', metric: 'ftnd' },
].map(Object.freeze));

const TOPIC_IDS = new Set(DAILY_TOPICS.map((topic) => topic.id));
const SCORE_RANGES = { act: [5, 25], cat: [0, 40], ess: [0, 24], ftnd: [0, 10] };
const RED_FLAGS = { chestPain: '新发、持续或明显胸痛', severeBreathlessness: '严重气促，难以说完整句子', fainting: '晕厥或接近晕倒', hemoptysis: '咯血或痰中带血' };
const TB_FIELDS = { persistentCough: '咳嗽持续两周以上或近期加重', feverNightSweats: '低热或夜间盗汗', weightLoss: '没有主动减重却体重下降' };
const METRICS = [
  { id: 'breathlessness', label: '当日气促（0–10）', min: 0, max: 10 },
  { id: 'fatigue', label: '当日疲劳（0–10）', min: 0, max: 10 },
  { id: 'mmrc', label: 'mMRC（0–4）', min: 0, max: 4 },
  { id: 'mrc', label: 'MRC（1–5）', min: 1, max: 5 },
  { id: 'spo2', label: 'SpO₂（%）', min: 0, max: 100 },
  { id: 'act', label: 'ACT 总分（5–25）', min: 5, max: 25 },
  { id: 'cat', label: 'CAT 总分（0–40）', min: 0, max: 40 },
  { id: 'ess', label: 'ESS 总分（0–24）', min: 0, max: 24 },
  { id: 'ftnd', label: 'FTND 总分（0–10）', min: 0, max: 10 },
];
const DAY_MS = 86400000;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBlank = (value) => value === undefined || value === null || value === '' || (typeof value === 'string' && !value.trim());

function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shanghaiDay(date) { return new Date(date.getTime()+8*3600000).toISOString().slice(0,10); }

/** Validate and copy only fixed, non-identifying assessment fields. */
function normalizeDailyRecord(raw, { today } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!isDay(today)) add('today', '无法确定今天的日期，请刷新页面后重试。');
  if (!isObject(raw)) return { valid: false, record: null, errors: [...errors, { field: 'record', message: '评估记录格式不正确。' }] };
  if (!isDay(raw.day) || raw.day > today) add('day', '请选择有效日期，不能保存未来的评估。');
  if (!TOPIC_IDS.has(raw.topic)) add('topic', '请选择健康评估的疾病或支持主题。');
  if (!['usual', 'worse', 'unknown'].includes(raw.statusComparedUsual)) add('statusComparedUsual', '请选择今天与平常相比的状态。');

  function number(field, input, minimum, maximum, { required = false, integer = false } = {}) {
    if (isBlank(input)) {
      if (required) add(field, '请填写这项当日自评。');
      return null;
    }
    if (!['number', 'string'].includes(typeof input) || (typeof input === 'string' && !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(input.trim()))) {
      add(field, '请填写有效数字。');
      return null;
    }
    const value = Number(input);
    if (!Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      add(field, `数值需在 ${minimum}–${maximum} 之间${integer ? '，并使用整数' : ''}。`);
      return null;
    }
    return value;
  }

  const breathlessness = number('breathlessness', raw.breathlessness, 0, 10, { required: true });
  const fatigue = number('fatigue', raw.fatigue, 0, 10, { required: true });
  const spo2 = number('spo2', raw.spo2, 1, 100);
  const scale = isBlank(raw.dyspneaScale) ? null : raw.dyspneaScale;
  if (scale !== null && !['mmrc', 'mrc'].includes(scale)) add('dyspneaScale', '量表只能选择 mMRC（0–4）或 MRC（1–5）。');
  const dyspneaScore = number('dyspneaScore', raw.dyspneaScore, scale === 'mrc' ? 1 : 0, scale === 'mrc' ? 5 : 4, { integer: true });
  if (dyspneaScore !== null && !['mmrc', 'mrc'].includes(scale)) add('dyspneaScale', '填写呼吸困难等级时，请明确量表类型。');

  const scores = {};
  if (raw.scores !== undefined && !isObject(raw.scores)) add('scores', '已有量表总分格式不正确。');
  Object.entries(SCORE_RANGES).forEach(([key, [minimum, maximum]]) => {
    scores[key] = number(`scores.${key}`, raw.scores?.[key], minimum, maximum, { integer: true });
  });
  const hasScores = Object.values(scores).some((value) => value !== null);
  const scoreDate = isBlank(raw.scoreDate) ? null : raw.scoreDate;
  if ((hasScores && !isDay(scoreDate)) || (scoreDate !== null && (!isDay(scoreDate) || scoreDate > raw.day || scoreDate > today))) add('scoreDate', '请填写已有量表实际完成的日期，且不能晚于本次记录日期。');

  const redFlags = {};
  if (!isObject(raw.redFlags)) add('redFlags', '请完成危险症状确认。');
  Object.keys(RED_FLAGS).forEach((key) => {
    if (typeof raw.redFlags?.[key] !== 'boolean') add(`redFlags.${key}`, '请确认危险症状是否存在。');
    redFlags[key] = raw.redFlags?.[key] === true;
  });
  if (typeof raw.sputumChange !== 'boolean') add('sputumChange', '请确认痰液是否发生变化。');
  const sputumAmount = raw.sputumAmount ?? 'unknown';
  const sputumColor = raw.sputumColor ?? 'unknown';
  if (!['none', 'usual', 'increased', 'unknown'].includes(sputumAmount)) add('sputumAmount', '痰量选项不正确。');
  if (!['none', 'usual', 'changed', 'blood', 'unknown'].includes(sputumColor)) add('sputumColor', '痰液颜色选项不正确。');
  const sputumChange = raw.sputumChange === true || sputumAmount === 'increased' || ['changed', 'blood'].includes(sputumColor);
  if (sputumColor === 'blood') redFlags.hemoptysis = true;

  const tbSymptoms = {};
  if (raw.tbSymptoms !== undefined && !isObject(raw.tbSymptoms)) add('tbSymptoms', '结核相关症状格式不正确。');
  Object.keys(TB_FIELDS).forEach((key) => {
    if (raw.tbSymptoms?.[key] !== undefined && typeof raw.tbSymptoms[key] !== 'boolean') add(`tbSymptoms.${key}`, '症状确认只能使用是或否。');
    tbSymptoms[key] = raw.tbSymptoms?.[key] === true;
  });
  const ageGroup = raw.ageGroup ?? 'unknown';
  if (!['adult', 'minor', 'unknown'].includes(ageGroup)) add('ageGroup', '请选择年龄适用范围。');
  const diagnosisConfirmed = raw.diagnosisConfirmed ?? null;
  if (diagnosisConfirmed !== null && typeof diagnosisConfirmed !== 'boolean') add('diagnosisConfirmed', '请选择是否已有医护确认。');

  let recordedAt;
  const timestamp = raw.recordedAt ?? new Date().toISOString();
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !isDay(timestamp.slice(0, 10)) || !Number.isFinite(Date.parse(timestamp))) {
    add('recordedAt', '记录时间格式不正确。');
  } else {
    const time = new Date(timestamp);
    recordedAt = time.toISOString();
    if (isDay(today) && shanghaiDay(time) > today) add('recordedAt', '记录时间不能在未来。');
  }
  const record = errors.length ? null : {
    id: `${raw.day}:${raw.topic}`, day: raw.day, recordedAt, topic: raw.topic,
    statusComparedUsual: raw.statusComparedUsual, dyspneaScale: dyspneaScore === null ? null : scale, dyspneaScore,
    breathlessness, fatigue, spo2, sputumChange, sputumAmount, sputumColor, redFlags, scores,
    scoreDate: hasScores ? scoreDate : null, tbSymptoms, ageGroup, diagnosisConfirmed,
  };
  return { valid: errors.length === 0, record, errors };
}

/** Conservative product safety checks; these results do not diagnose or prescribe treatment. */
function evaluateDailyRecord(record) {
  if (!isObject(record) || !TOPIC_IDS.has(record.topic) || !isObject(record.redFlags)) return { status: 'review', title: '请补充当日健康评估', message: '资料不完整，训练前请重新确认症状并咨询医护。', reasons: ['缺少有效的当日评估'] };
  const urgent = Object.entries(RED_FLAGS).filter(([key]) => record.redFlags[key] === true).map(([, label]) => label);
  if (record.sputumColor === 'blood' && !urgent.includes(RED_FLAGS.hemoptysis)) urgent.push(RED_FLAGS.hemoptysis);
  if (urgent.length) return {
    status: 'urgent', title: '出现危险信号，立即停止训练',
    message: '请立即获得医疗帮助。持续胸痛、严重气促、晕厥或明显咯血时拨打 120；不要依靠训练处理急性症状，也不要自行调整氧流量或药物。', reasons: urgent,
  };
  const incomplete = !isDay(record.day) || !['usual', 'worse', 'unknown'].includes(record.statusComparedUsual)
    || Object.keys(RED_FLAGS).some((key) => typeof record.redFlags[key] !== 'boolean')
    || ['breathlessness', 'fatigue'].some((key) => !Number.isFinite(record[key]) || record[key] < 0 || record[key] > 10)
    || (record.spo2 !== null && (!Number.isFinite(record.spo2) || record.spo2 < 1 || record.spo2 > 100))
    || (record.dyspneaScore !== null && (!['mmrc', 'mrc'].includes(record.dyspneaScale) || !Number.isInteger(record.dyspneaScore) || record.dyspneaScore < (record.dyspneaScale === 'mrc' ? 1 : 0) || record.dyspneaScore > (record.dyspneaScale === 'mrc' ? 5 : 4)))
    || typeof record.sputumChange !== 'boolean' || !isObject(record.scores)
    || Object.entries(SCORE_RANGES).some(([key, [minimum, maximum]]) => record.scores[key] !== null && (!Number.isInteger(record.scores[key]) || record.scores[key] < minimum || record.scores[key] > maximum))
    || (Object.values(record.scores).some((value) => value !== null) && (!isDay(record.scoreDate) || record.scoreDate > record.day));
  if (incomplete) return { status: 'review', title: '请补充当日健康评估', message: '资料不完整，不能用于开放训练，请重新填写并核对。', reasons: ['评估字段缺失或不在有效范围内'] };
  const reasons = [];
  if (record.statusComparedUsual === 'worse') reasons.push('今天比平常更差');
  if (record.statusComparedUsual === 'unknown') reasons.push('尚不能确认今天是否与平常相当');
  if (record.spo2 !== null && Number.isFinite(record.spo2) && record.spo2 <= 92) reasons.push('SpO₂ ≤92%，低于本应用的训练开放门槛；需要医护核对个人目标');
  if (record.sputumChange === true) reasons.push('痰量或颜色发生变化');
  if (Number.isFinite(record.breathlessness) && record.breathlessness >= 7) reasons.push('当日气促数字自评较高');
  if (Number.isFinite(record.fatigue) && record.fatigue >= 8) reasons.push('当日疲劳数字自评较高');
  const mmrc = record.dyspneaScale === 'mrc' ? record.dyspneaScore - 1 : record.dyspneaScale === 'mmrc' ? record.dyspneaScore : null;
  if (record.dyspneaScore !== null && Number.isFinite(mmrc) && mmrc >= 3) reasons.push('呼吸困难等级较高，需复核活动范围');
  if (record.topic === 'copd' && Number.isFinite(record.scores?.cat) && record.scores.cat >= 30) reasons.push('CAT ≥30，需复核症状影响及当前活动范围');
  if (record.topic === 'asthma' && record.scores?.act !== null && Number.isFinite(record.scores?.act) && record.scores.act <= 19) reasons.push('ACT ≤19，需与医护复核哮喘控制情况');
  if (record.topic === 'asthma' && Number.isFinite(record.scores?.act) && isDay(record.scoreDate) && (Date.parse(record.day) - Date.parse(record.scoreDate)) / DAY_MS > 28) reasons.push('ACT 实际填写日期已超过 4 周，不能代替当前状态确认');
  if (record.topic === 'pneumothorax') reasons.push('气胸恢复期的训练与活动必须由主管医护确认');
  if (record.topic === 'tb' && Object.values(record.tbSymptoms || {}).some((value) => value === true)) reasons.push('存在需医护复核的结核相关症状');
  if (record.ageGroup === 'minor') reasons.push('未成年人需监护人及医护评估，不由本应用安排训练');
  if (record.ageGroup !== 'adult' && record.ageGroup !== 'minor') reasons.push('年龄适用范围尚未确认');
  if (record.diagnosisConfirmed !== true && record.topic !== 'quit') reasons.push('疾病类别尚未由医护确认，记录不能替代诊断');
  if (reasons.length) return { status: 'review', title: '已记录，训练前请先复核', message: '先暂停互动训练，将这些变化告知医护，并按已有行动计划处理。此提示是本应用的保守安全门，不用于调整处方。', reasons };
  return { status: 'recorded', title: '今日健康评估已记录', message: '记录用于观察变化并与医护沟通。训练仍需符合已确认的康复方案和训练前检查；未填写的指标不能视为正常。', reasons: [] };
}

/** Replace only the same topic on the same day, preserving every other topic and day. */
function upsertDailyRecord(records, record) {
  return [...(Array.isArray(records) ? records : []).filter((item) => !(item.day === record.day && item.topic === record.topic)), record]
    .sort((left, right) => left.day.localeCompare(right.day) || left.topic.localeCompare(right.topic));
}

/** Restore only valid records; free text and unknown fields are never retained. */
function validateDailyRecords(input, { today } = {}) {
  if (!Array.isArray(input) || !isDay(today)) return [];
  const records = input.map((raw) => normalizeDailyRecord(raw, { today })).filter((result) => result.valid).map((result) => result.record)
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const latest = new Map();
  records.forEach((record) => latest.set(record.id, record));
  return [...latest.values()].sort((left, right) => left.day.localeCompare(right.day) || left.topic.localeCompare(right.topic));
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

module.exports={DAILY_TOPICS,normalizeDailyRecord,evaluateDailyRecord,upsertDailyRecord,validateDailyRecords};
