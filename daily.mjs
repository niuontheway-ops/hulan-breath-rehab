export const DAILY_TOPICS = Object.freeze([
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

function shanghaiDay(date) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name) => parts.find((item) => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Validate and copy only fixed, non-identifying assessment fields. */
export function normalizeDailyRecord(raw, { today } = {}) {
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
export function evaluateDailyRecord(record) {
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
export function upsertDailyRecord(records, record) {
  return [...(Array.isArray(records) ? records : []).filter((item) => !(item.day === record.day && item.topic === record.topic)), record]
    .sort((left, right) => left.day.localeCompare(right.day) || left.topic.localeCompare(right.topic));
}

/** Restore only valid records; free text and unknown fields are never retained. */
export function validateDailyRecords(input, { today } = {}) {
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

function metricValue(record, metric) {
  if (metric === 'mmrc' || metric === 'mrc') return record.dyspneaScale === metric ? record.dyspneaScore : null;
  return Object.hasOwn(SCORE_RANGES, metric) ? record.scores[metric] : record[metric];
}

function chartMarkup(records, metricId) {
  const metric = METRICS.find((item) => item.id === metricId) || METRICS[0];
  const pointsByDay = new Map();
  [...records].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt)).forEach((record) => {
    const value = metricValue(record, metric.id);
    if (value !== null && Number.isFinite(value)) pointsByDay.set(Object.hasOwn(SCORE_RANGES, metric.id) ? record.scoreDate : record.day, value);
  });
  const points = [...pointsByDay].sort(([left], [right]) => left.localeCompare(right)).slice(-14);
  if (!points.length) return '<p class="daily-empty">还没有这项指标的记录；保存真实评估后会显示趋势。</p>';
  const width = 640, height = 210, left = 44, right = 20, top = 20, bottom = 40;
  const start = Date.parse(points[0][0]), end = Date.parse(points.at(-1)[0]);
  const x = (day) => start === end ? width / 2 : left + ((Date.parse(day) - start) / (end - start)) * (width - left - right);
  const y = (value) => top + ((metric.max - value) / (metric.max - metric.min)) * (height - top - bottom);
  const grids = [metric.min, (metric.min + metric.max) / 2, metric.max].map((value) => `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" class="daily-chart-grid"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${value}</text>`).join('');
  const coordinates = points.map(([day, value]) => `${x(day).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
  const circles = points.map(([day, value]) => `<circle cx="${x(day).toFixed(2)}" cy="${y(value).toFixed(2)}" r="4" class="daily-chart-dot"><title>${day}：${value}</title></circle>`).join('');
  const newest = points.at(-1);
  return `<svg class="daily-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(metric.label)}的实际记录趋势，共 ${points.length} 次，最新 ${newest[0]} ${newest[1]}"><title>${escape(metric.label)}记录趋势</title>${grids}${points.length > 1 ? `<polyline points="${coordinates}" class="daily-chart-line"/>` : ''}${circles}<text x="${x(points[0][0])}" y="${height - 10}" text-anchor="${points.length > 1 ? 'start' : 'middle'}">${points[0][0].slice(5)}</text>${points.length > 1 ? `<text x="${x(newest[0])}" y="${height - 10}" text-anchor="end">${newest[0].slice(5)}</text>` : ''}</svg><p class="daily-chart-caption">最近一次：<strong>${newest[1]}</strong>（${newest[0]}）。仅连接实际记录点，未记录的日期没有补值。量表总分按实际完成日期展示。</p>`;
}

/** Mount a transient assessment UI; persistence belongs to the caller's explicit opt-in flow. */
export function mountDailyAssessment(container, { today, initialTopic = 'copd', records = [], onSave } = {}) {
  if (!container?.querySelector || !isDay(today)) throw new Error('健康评估需要有效容器与今天的日期。');
  let history = validateDailyRecords(records, { today });
  let disposed = false;
  let saving = false;
  const topic = TOPIC_IDS.has(initialTopic) ? initialTopic : 'copd';
  container.innerHTML = `<div class="daily-intro"><p class="daily-eyebrow">DAILY CHECK-IN</p><h3>今天的身体状态，值得认真记录</h3><p>每天可记录一次气促、疲劳和症状变化；尽量在相似时段自评。已有量表按原表与医护安排复评，健康记录不会自动更改健康画像或处方。</p></div>
    <form class="daily-form" novalidate>
      <div class="daily-field-grid"><label class="daily-field">评估主题<select name="topic">${DAILY_TOPICS.map((item) => `<option value="${item.id}"${item.id === topic ? ' selected' : ''}>${item.name}</option>`).join('')}</select></label><label class="daily-field">记录日期<input name="day" type="date" value="${today}" max="${today}" required></label></div>
      <fieldset class="daily-fieldset"><legend>当日状态</legend><div class="daily-field-grid">
        <label class="daily-field">与平常相比<select name="statusComparedUsual" required><option value="">请选择</option><option value="usual">与平常相当</option><option value="worse">比平常更差</option><option value="unknown">暂不确定</option></select></label>
        <label class="daily-field">年龄适用范围<select name="ageGroup"><option value="unknown">尚未确认</option><option value="adult">成年人（18 岁及以上）</option><option value="minor">未成年人</option></select></label>
        <label class="daily-field">这个疾病类别已由医护确认？<select name="diagnosisConfirmed"><option value="unknown">尚未确认</option><option value="yes">是</option><option value="no">否</option></select></label>
        <label class="daily-field">当日气促（0–10）<input name="breathlessness" type="number" min="0" max="10" step="0.5" inputmode="decimal" placeholder="例如 2" required><span class="daily-hint">0 为没有，10 为您能想象的最重；可记录已有 Borg 0–10 分值。</span></label>
        <label class="daily-field">当日疲劳（0–10）<input name="fatigue" type="number" min="0" max="10" step="0.5" inputmode="decimal" placeholder="例如 3" required><span class="daily-hint">0 为没有，10 为您能想象的最重。</span></label>
        <label class="daily-field">静息 SpO₂（选填，%）<input name="spo2" type="number" min="1" max="100" step="1" inputmode="numeric" placeholder="未测量请留空"><span class="daily-hint">填写实际测量值。个人目标由医护确认，不自行调整氧流量。</span></label>
      </div></fieldset>
      <fieldset class="daily-fieldset"><legend>活动中的呼吸困难（选填）</legend><div class="daily-field-grid"><label class="daily-field">量表类型<select name="dyspneaScale"><option value="mmrc">mMRC（0–4）</option><option value="mrc">MRC（1–5）</option></select></label><label class="daily-field">实际等级<select name="dyspneaScore"><option value="">未评估</option></select></label></div><p class="daily-hint">反映气促对日常活动的影响，与当下的 0–10 气促自评不同；两种量表不要混用分数。</p><details class="daily-scale-guide"><summary>查看简明分级提示与来源</summary><ol class="daily-grade-list"><li>仅在较剧烈活动时感觉气促。</li><li>赶路或上缓坡时出现气促。</li><li>因气促走得比同龄人慢，或按自己的速度走也要停一下。</li><li>平地走约百米、或行走几分钟就需要停下缓气。</li><li>气促妨碍外出，或穿脱衣服也会气促。</li></ol><p>以上五级在 mMRC 中依次记作 0–4，在 MRC 中依次记作 1–5。中文提示作了简明改写，供对照原量表核对，未宣称官方验证。<a href="https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-dyspnoea-scale/" target="_blank" rel="noopener noreferrer">MRC 官方来源</a>：Used with the permission of the Medical Research Council.</p></details></fieldset>
      <fieldset class="daily-fieldset"><legend>痰液和危险症状</legend><div class="daily-field-grid"><label class="daily-field">痰量与平常相比<select name="sputumAmount"><option value="unknown">不确定 / 未观察</option><option value="none">没有痰</option><option value="usual">和平常差不多</option><option value="increased">比平常增多</option></select></label><label class="daily-field">痰液颜色<select name="sputumColor"><option value="unknown">不确定 / 未观察</option><option value="none">没有痰</option><option value="usual">和平常一样</option><option value="changed">变黄绿、变深或出现其他新变化</option><option value="blood">出现血丝或血液</option></select></label></div><p class="daily-hint">勾选现在出现的危险症状；没有这些症状时不勾选。出现危险症状请先就医，不等待保存。</p><div class="daily-check-grid">${Object.entries(RED_FLAGS).map(([key, label]) => `<label class="daily-check"><input name="red-${key}" type="checkbox">${label}</label>`).join('')}</div></fieldset>
      <fieldset class="daily-fieldset" data-tb-fields hidden><legend>结核相关症状</legend><div class="daily-check-grid">${Object.entries(TB_FIELDS).map(([key, label]) => `<label class="daily-check"><input name="tb-${key}" type="checkbox">${label}</label>`).join('')}</div><p class="daily-hint">记录便于复诊沟通，不能判断结核活动性或改变用药。</p></fieldset>
      <details class="daily-score-panel"><summary>录入已有量表总分（选填）</summary><p class="daily-hint">请按已有完整原表填写总分，不用这些输入框替代正式问卷。ACT 回顾过去 4 周；CAT 按原量表描述当前状态；ESS、FTND 按原表及医护安排复评，均不要求每日重做。</p><div class="daily-field-grid">${Object.entries(SCORE_RANGES).map(([key, [minimum, maximum]]) => `<label class="daily-field" data-score="${key}">${key.toUpperCase()} 总分（${minimum}–${maximum}）<input name="score-${key}" type="number" min="${minimum}" max="${maximum}" step="1" inputmode="numeric" placeholder="已有总分"></label>`).join('')}<label class="daily-field">以上量表实际完成日期<input name="scoreDate" type="date" max="${today}"><span class="daily-hint">填写总分时需要日期；同次录入的量表应来自这个日期。</span></label></div><p class="daily-hint"><a href="https://www.asthmacontroltest.com/en-gb/welcome" target="_blank" rel="noopener noreferrer">ACT 官方说明</a> · <a href="https://www.catestonline.org/patient-site-test-page-english.html" target="_blank" rel="noopener noreferrer">CAT 官方量表</a></p></details>
      <div class="daily-errors" role="alert" hidden></div><div class="daily-actions"><button class="daily-save" type="submit">保存今日健康评估</button><button class="daily-reset" type="button">清空填写</button></div><p class="daily-hint">同日同主题保存会更新该日记录；其他主题与其他日期的历史会保留。此评估支持健康记录，不开具新的训练或药物处方。</p>
    </form><div class="daily-result" aria-live="polite" hidden></div>
    <section class="daily-history"><div class="daily-history-heading"><h3>每日评分趋势</h3><label class="daily-field">查看指标<select data-daily-metric>${METRICS.map((metric) => `<option value="${metric.id}">${metric.label}</option>`).join('')}</select></label></div><div class="daily-chart-box"></div><div class="daily-history-table"></div></section>`;
  const form = container.querySelector('form');
  const field = (name) => form.elements.namedItem(name);
  const resultBox = container.querySelector('.daily-result');
  const errorBox = container.querySelector('.daily-errors');
  const metricControl = container.querySelector('[data-daily-metric]');
  const saveButton = container.querySelector('.daily-save');

  function setGrades(value = '') {
    const isMrc = field('dyspneaScale').value === 'mrc';
    field('dyspneaScore').innerHTML = '<option value="">未评估</option>' + Array.from({ length: 5 }, (_, index) => { const grade = index + (isMrc ? 1 : 0); return `<option value="${grade}">${grade} 级</option>`; }).join('');
    field('dyspneaScore').value = value === null ? '' : String(value);
  }
  function renderHistory() {
    const selected = history.filter((record) => record.topic === field('topic').value);
    container.querySelector('.daily-chart-box').innerHTML = chartMarkup(selected, metricControl.value);
    const latest = [...selected].sort((left, right) => right.day.localeCompare(left.day)).slice(0, 10);
    container.querySelector('.daily-history-table').innerHTML = latest.length ? `<p class="daily-hint">最近 ${latest.length} 条该主题记录（共 ${selected.length} 条）</p><div class="daily-table-scroll"><table class="daily-table"><thead><tr><th scope="col">日期</th><th scope="col">当日气促</th><th scope="col">疲劳</th><th scope="col">呼吸困难等级</th><th scope="col">状态提示</th></tr></thead><tbody>${latest.map((record) => { const evaluation = evaluateDailyRecord(record); return `<tr><td>${record.day}</td><td>${record.breathlessness}</td><td>${record.fatigue}</td><td>${record.dyspneaScore === null ? '未评估' : `${record.dyspneaScale === 'mrc' ? 'MRC' : 'mMRC'} ${record.dyspneaScore}`}</td><td><span class="daily-status daily-status-${evaluation.status}">${evaluation.status === 'urgent' ? '危险信号' : evaluation.status === 'review' ? '需复核' : '已记录'}</span></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="daily-empty">尚无该主题的健康记录。</p>';
  }
  function showEvaluation(record) {
    const evaluation = evaluateDailyRecord(record);
    resultBox.className = `daily-result daily-result-${evaluation.status}`;
    resultBox.innerHTML = `<h4>${evaluation.title}</h4><p>${evaluation.message}</p>${evaluation.reasons.length ? `<ul>${evaluation.reasons.map((reason) => `<li>${reason}</li>`).join('')}</ul>` : ''}`;
    resultBox.hidden = false;
  }
  function defaultMetric() {
    const selected = history.filter((record) => record.topic === field('topic').value);
    const preferred = DAILY_TOPICS.find((item) => item.id === field('topic').value)?.metric || 'breathlessness';
    if (preferred === 'mmrc' && !selected.some((record) => metricValue(record, 'mmrc') !== null) && selected.some((record) => metricValue(record, 'mrc') !== null)) return 'mrc';
    return preferred;
  }
  function populate() {
    const current = history.find((record) => record.day === field('day').value && record.topic === field('topic').value);
    for (const name of ['statusComparedUsual', 'breathlessness', 'fatigue', 'spo2', 'scoreDate']) field(name).value = current?.[name] ?? '';
    field('ageGroup').value = current?.ageGroup ?? 'unknown';
    field('diagnosisConfirmed').value = current?.diagnosisConfirmed === true ? 'yes' : current?.diagnosisConfirmed === false ? 'no' : 'unknown';
    field('sputumAmount').value = current?.sputumAmount ?? 'unknown';
    field('sputumColor').value = current?.sputumColor ?? 'unknown';
    field('dyspneaScale').value = current?.dyspneaScale ?? 'mmrc';
    setGrades(current?.dyspneaScore ?? '');
    Object.keys(RED_FLAGS).forEach((key) => { field(`red-${key}`).checked = current?.redFlags[key] === true; });
    Object.keys(TB_FIELDS).forEach((key) => { field(`tb-${key}`).checked = current?.tbSymptoms[key] === true; });
    Object.keys(SCORE_RANGES).forEach((key) => { field(`score-${key}`).value = current?.scores[key] ?? ''; });
    container.querySelector('[data-tb-fields]').hidden = field('topic').value !== 'tb';
    field('scoreDate').max = field('day').value || today;
    errorBox.hidden = true;
    resultBox.hidden = true;
    if (current) showEvaluation(current);
    renderHistory();
  }
  function changed(event) {
    if (event.target === field('topic')) {
      metricControl.value = defaultMetric();
      populate();
    } else if (event.target === field('day')) populate();
    else if (event.target === field('dyspneaScale')) setGrades();
  }
  async function save(event) {
    event.preventDefault();
    if (disposed || saving) return;
    const raw = {
      day: field('day').value, recordedAt: new Date().toISOString(), topic: field('topic').value,
      statusComparedUsual: field('statusComparedUsual').value, ageGroup: field('ageGroup').value,
      diagnosisConfirmed: field('diagnosisConfirmed').value === 'yes' ? true : field('diagnosisConfirmed').value === 'no' ? false : null,
      dyspneaScale: field('dyspneaScale').value, dyspneaScore: field('dyspneaScore').value,
      breathlessness: field('breathlessness').value, fatigue: field('fatigue').value, spo2: field('spo2').value,
      sputumAmount: field('sputumAmount').value, sputumColor: field('sputumColor').value, sputumChange: false,
      redFlags: Object.fromEntries(Object.keys(RED_FLAGS).map((key) => [key, field(`red-${key}`).checked])),
      tbSymptoms: Object.fromEntries(Object.keys(TB_FIELDS).map((key) => [key, field('topic').value === 'tb' && field(`tb-${key}`).checked])),
      scores: Object.fromEntries(Object.keys(SCORE_RANGES).map((key) => [key, field(`score-${key}`).value])), scoreDate: field('scoreDate').value,
    };
    const normalized = normalizeDailyRecord(raw, { today });
    if (!normalized.valid) {
      errorBox.innerHTML = `<ul>${normalized.errors.map((error) => `<li>${escape(error.message)}</li>`).join('')}</ul>`;
      errorBox.hidden = false;
      const first = normalized.errors[0].field.replace('scores.', 'score-');
      field(first)?.focus();
      return;
    }
    saving = true;
    saveButton.disabled = true;
    try {
      if (typeof onSave === 'function') await onSave(normalized.record);
      if (disposed) return;
      history = upsertDailyRecord(history, normalized.record);
      errorBox.hidden = true;
      showEvaluation(normalized.record);
      renderHistory();
    } catch {
      if (!disposed) { errorBox.textContent = '记录暂未保存成功，请重试。'; errorBox.hidden = false; }
    } finally {
      saving = false;
      if (!disposed) saveButton.disabled = false;
    }
  }
  function reset() {
    const selectedTopic = field('topic').value;
    const selectedDay = field('day').value;
    form.reset();
    field('topic').value = selectedTopic;
    field('day').value = selectedDay;
    setGrades();
    container.querySelector('[data-tb-fields]').hidden = selectedTopic !== 'tb';
    errorBox.hidden = resultBox.hidden = true;
  }
  const resetButton = container.querySelector('.daily-reset');
  form.addEventListener('change', changed);
  form.addEventListener('submit', save);
  resetButton.addEventListener('click', reset);
  metricControl.addEventListener('change', renderHistory);
  metricControl.value = defaultMetric();
  populate();
  return { dispose() { if (disposed) return; disposed = true; history = []; form.removeEventListener('change', changed); form.removeEventListener('submit', save); resetButton.removeEventListener('click', reset); metricControl.removeEventListener('change', renderHistory); container.replaceChildren(); } };
}
