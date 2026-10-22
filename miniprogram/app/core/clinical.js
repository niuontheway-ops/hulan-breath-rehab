// Generated from the corresponding project module by scripts/build-miniprogram.mjs.
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const shanghaiDay=date=>new Date(date.getTime()+8*3600000).toISOString().slice(0,10);
// Local educational rules. Thresholds and starter durations are product safeguards,
// not a diagnostic algorithm or a clinically validated exercise prescription.
const RULE_VERSION = '2026-10-11.1';
const DAY_MS = 86400000;
const DISEASES = { copd: '慢阻肺', asthma: '哮喘', bronchiectasis: '支气管扩张', other: '其他气道疾病' };
const SOURCES = [
  { label: 'ATS 2023 肺康复指南', url: 'https://doi.org/10.1164/rccm.202306-1066ST' },
  { label: 'GOLD 2026 慢阻肺报告', url: 'https://goldcopd.org/2026-gold-report-and-pocket-guide/' },
  { label: 'GINA 2026 哮喘策略报告', url: 'https://ginasthma.org/2026-gina-strategy-report/' },
  { label: 'UKRI · MRC 呼吸困难量表', url: 'https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-dyspnoea-scale/' },
  { label: 'COPD Foundation · 呼吸技巧', url: 'https://www.copdfoundation.org/Learn-More/I-am-New-to-COPD/Breathing-Techniques.aspx' },
  { label: 'COPD Foundation · 运动与评估', url: 'https://www.copdfoundation.org/Learn-More/I-am-a-Person-with-COPD/Exercise.aspx' },
  { label: 'CAT · 总分与使用说明', url: 'https://www.catestonline.org/hcp-homepage/clinical-practice.html' },
];
const FLAGS = ['chestPain', 'severeBreathlessness', 'fainting', 'hemoptysis'];
const FLAG_LABELS = { chestPain: '胸痛', severeBreathlessness: '严重呼吸困难', fainting: '晕厥', hemoptysis: '咯血' };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date : null;
}

/** Values are numbers, never numeric strings. Optional measurements may be null. */
function validateProfile(profile) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!isObject(profile)) return { valid: false, errors: [{ field: 'profile', message: '请填写评估资料。' }] };
  if (!hasOwn(DISEASES, profile.disease)) add('disease', '请选择已由医护确认的疾病类别。');
  if (!finite(profile.age) || !Number.isInteger(profile.age) || profile.age < 1 || profile.age > 120) {
    add('age', '年龄须为 1–120 的整数；未成年人需专门评估。');
  }
  const ranges = [
    ['fev1Percent', 0, 200, false, 'FEV₁ 预计值百分比须大于 0 且不超过 200。'],
    ['fev1Fvc', 0, 100, false, 'FEV₁/FVC 须填写百分数，大于 0 且不超过 100。'],
    ['spo2', 0, 100, false, '静息血氧须大于 0 且不超过 100。'],
    ['act', 5, 25, true, 'ACT 仅录入既有总分，须为 5–25 的整数。'],
    ['cat', 0, 40, true, 'CAT 仅录入既有总分，须为 0–40 的整数。'],
  ];
  for (const [field, min, max, integer, message] of ranges) {
    const value = profile[field];
    if (value == null) continue;
    const outside = integer ? value < min || value > max : value <= min || value > max;
    if (!finite(value) || outside || (integer && !Number.isInteger(value))) add(field, message);
  }
  if ((profile.dyspneaScale != null || profile.dyspneaScore != null) && !['mmrc', 'mrc'].includes(profile.dyspneaScale)) {
    add('dyspneaScale', '请区分 mMRC（0–4）与 MRC（1–5）。');
  }
  if (profile.dyspneaScore != null) {
    const min = profile.dyspneaScale === 'mrc' ? 1 : 0;
    if (!finite(profile.dyspneaScore) || !Number.isInteger(profile.dyspneaScore)
      || profile.dyspneaScore < min || profile.dyspneaScore > min + 4) {
      add('dyspneaScore', profile.dyspneaScale === 'mrc' ? 'MRC 总分须为 1–5 的整数。' : 'mMRC 总分须为 0–4 的整数。');
    }
  }
  if (!['stable', 'recovering', 'worse', 'unknown'].includes(profile.stability)) add('stability', '请选择目前是否稳定或处于加重后稳定阶段。');
  if (typeof profile.clinicianCleared !== 'boolean') add('clinicianCleared', '请确认医护是否评估并允许目前的轻量居家训练。');
  if (!isObject(profile.redFlags)) {
    add('redFlags', '请完成危险症状确认。');
  } else {
    for (const field of FLAGS) {
      if (typeof profile.redFlags[field] !== 'boolean') add(`redFlags.${field}`, '请明确确认是否出现此危险症状。');
    }
  }
  if (!parseDay(profile.assessmentDate)) add('assessmentDate', '请填写有效评估日期（YYYY-MM-DD）。');
  if (!['daily', 'endurance', 'breathing'].includes(profile.goal)) add('goal', '请选择本次康复目标。');
  return { valid: errors.length === 0, errors };
}

function dyspnea(profile) {
  if (!finite(profile.dyspneaScore)) return null;
  return profile.dyspneaScale === 'mrc' ? profile.dyspneaScore - 1 : profile.dyspneaScore;
}

function metrics(profile) {
  const percent = value => finite(value) ? `${value}%` : '未提供';
  const score = value => finite(value) ? `${value} 分` : '未提供';
  const mmrc = dyspnea(profile);
  return [
    { label: 'FEV₁ / 预计值', value: percent(profile.fev1Percent), detail: '肺功能资料；不单独判断病种或训练强度' },
    { label: 'FEV₁ / FVC', value: percent(profile.fev1Fvc), detail: '百分数；诊断需医护结合完整肺功能报告' },
    { label: '静息 SpO₂', value: percent(profile.spo2), detail: '单次自报读数；不能代替运动中的监测' },
    { label: '呼吸困难', value: mmrc == null ? '未提供' : `mMRC ${mmrc}`, detail: mmrc != null && profile.dyspneaScale === 'mrc' ? `MRC ${profile.dyspneaScore} → mMRC ${mmrc}（减 1）` : 'mMRC：0–4；分数越高，日常活动受限越多' },
    { label: 'ACT 总分', value: score(profile.act), detail: '5–25；仅哮喘分流使用，需结合当前症状' },
    { label: 'CAT 总分', value: score(profile.cat), detail: '0–40；仅慢阻肺症状负担参考，不能诊断' },
  ];
}

function basePlan(profile) {
  return {
    status: 'incomplete', title: '先完成安全评估', subtitle: '补全或核对资料后再生成康复教育建议。',
    reasons: [], warnings: [
      '这是基于本机规则的康复教育建议，尚未经过临床验证；请遵循医护已确认的康复安排。',
      '训练出现胸痛、严重呼吸困难、晕厥或咯血时，立即停止并寻求急救。',
      '不要根据本页面自行调整药物或氧流量；屏息、强吹和追求更深更快的呼吸均不适合本练习。',
    ],
    metrics: metrics(profile), sessions: [], weekly: [],
    breathing: { inhaleSeconds: 2, exhaleSeconds: 4, cycles: 0 },
    sourceLinks: SOURCES.map(source => ({ ...source })), ruleVersion: RULE_VERSION,
  };
}

/** Urgent symptoms take precedence even when other profile fields are incomplete. */
function createPlan(profile, now = new Date()) {
  const input = isObject(profile) ? profile : {};
  const plan = basePlan(input);
  const urgent = FLAGS.filter(field => input.redFlags?.[field] === true);
  if (urgent.length) {
    return {
      ...plan, status: 'urgent', title: '立即停止训练，寻求急救',
      subtitle: '请让身边的人协助，联系当地急救服务；中国大陆可拨 120。',
      reasons: urgent.map(field => `报告了${FLAG_LABELS[field]}，不适合继续网页训练。`),
    };
  }
  const validation = validateProfile(input);
  if (!validation.valid) return { ...plan, reasons: validation.errors.map(error => error.message) };
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return { ...plan, reasons: ['无法确定当前日期，请核对设备日期。'] };
  // Compare calendar dates so a same-day assessment is not considered future data.
  const today = Date.parse(shanghaiDay(now) + 'T00:00:00.000Z');
  const ageDays = (today - parseDay(input.assessmentDate).getTime()) / DAY_MS;
  if (ageDays < 0) return { ...plan, reasons: ['评估日期不能晚于今天，请核对资料。'] };
  const review = [];
  const mmrc = dyspnea(input);
  if (input.age < 18) review.push('此功能面向成人；未满 18 岁需由专门团队制定训练安排。');
  if (!['stable', 'recovering'].includes(input.stability)) review.push(input.stability === 'worse' ? '目前仍加重或不稳定，请先联系医护；病情稳定后再按医护安排康复。' : '尚未确认目前病情稳定，需先联系医护。');
  if (!input.clinicianCleared) review.push('尚未确认医护已评估并允许目前的轻量居家训练。');
  if (input.disease === 'asthma' && input.act == null) review.push('未提供 ACT 总分；可稍后补充既有评分，或联系医护评估后再开始训练。');
  if (['copd', 'bronchiectasis'].includes(input.disease) && input.dyspneaScore == null) {
    review.push('未提供 MRC / mMRC 呼吸困难评分；可稍后补充既有评分，或联系医护评估后再开始训练。');
  }
  if (finite(input.spo2) && input.spo2 <= 92) review.push('静息血氧不超过 92%，请停止自主训练并尽快联系医护核实；不自行调氧。');
  if (mmrc >= 3) review.push('呼吸困难评分提示明显活动受限，需医护评估并安排有监督的康复。');
  if (input.disease === 'asthma' && finite(input.act) && input.act <= 19) review.push('ACT 不超过 19，提示哮喘控制可能不足；先复核当前症状和行动计划。');
  if (finite(input.fev1Percent) && input.fev1Percent < 30) review.push('FEV₁ 预计值百分比较低，本页面需先由医护核实肺功能与适合的训练方式。');
  if (input.disease === 'copd' && finite(input.cat) && input.cat >= 30) review.push('CAT 症状总分较高，先由医护评估日常活动能力和康复支持需求。');
  if (ageDays > 30) review.push('评估资料超过 30 天，请更新症状与医护允许的训练安排。');
  if (input.disease === 'other') review.push('此疾病类别尚未提供专门的居家训练规则，请让医护制定方案。');
  if (review.length) return { ...plan, status: 'review', title: '先请医护复核，再开始训练', subtitle: '当前信息需要进一步评估。带上以下原因和检查资料咨询医护。', reasons: review };

  const postExacerbation = input.disease === 'copd' && input.stability === 'recovering';
  const limited = postExacerbation || mmrc == null || mmrc >= 2 || (input.disease === 'copd' && finite(input.cat) && input.cat >= 20);
  const walkingMinutes = input.goal === 'endurance' ? (limited ? 6 : 12) : input.goal === 'breathing' ? (limited ? 4 : 8) : (limited ? 5 : 10);
  const cycles = input.goal === 'breathing' ? 30 : 20;
  const breathingTitle = input.disease === 'copd' ? '轻柔缩唇呼吸' : '轻柔呼吸与放松';
  const breathingInstruction = input.disease === 'copd'
    ? '坐稳、放松肩部；轻柔鼻吸约 2 秒，嘴唇轻拢、缓慢呼气约 4 秒。不要憋气或强吹，节拍不舒服时恢复自然呼吸。'
    : '坐稳、放松肩部；自然轻柔地吸气与呼气，可参考 2 秒吸、4 秒呼。不追求深吸，不屏息；节拍不舒服时恢复自然呼吸。';
  const education = input.disease === 'asthma'
    ? '核对医护给你的哮喘行动计划和运动诱发症状应对方式；出现喘鸣或胸闷时先停止。呼吸练习不能替代控制治疗。'
    : input.disease === 'bronchiectasis'
      ? '记录痰量、颜色和症状变化；排痰手法须由医护示范。出现新咯血或明显症状加重时停止训练并就医。'
      : postExacerbation
        ? '急性加重后病情稳定，可在医护评估后进行肺康复；按出院或康复安排训练，不自行调药、调氧。'
        : '核对医护已确认的用药、用氧和肺康复安排；记录活动前后的症状，和医护讨论正式肺康复。';
  const sessions = [
    { id: 'breathing', title: breathingTitle, minutes: cycles / 10, instruction: breathingInstruction, intensity: '轻柔舒适；无需深吸或强吹', kind: 'breathing', frequency: '可在状态稳定时每日 1 次；以医护安排为准' },
    { id: 'walking', title: limited ? '分段缓步活动' : '舒适步行', minutes: walkingMinutes, instruction: input.disease === 'asthma' ? '先慢速热身，再在平地以仍可说完整句子的速度步行；随时可休息。按已确认的哮喘行动计划处理运动诱发症状。' : '在平地以仍可说完整句子的速度缓步；可分成短段并随时休息。活动加重气促时先停止。', intensity: '轻量；仍能说完整句子', kind: 'walking', frequency: '本周选择 3–5 天；无需每天达标' },
    { id: 'strength', title: '轻缓坐姿活动', minutes: 3, instruction: '坐在稳固椅子上，轻缓交替抬脚和活动肩部；缓慢动作、自然呼吸。疼痛、头晕或气促加重时停止。', intensity: '轻量；不屏息用力', kind: 'strength', frequency: '本周选择 2 天，并留出恢复时间' },
    { id: 'education', title: '了解自己的行动计划', minutes: 2, instruction: education, intensity: '健康教育', kind: 'education', frequency: '本周阅读，并记录想咨询医护的问题' },
  ];
  const reasons = [
    postExacerbation ? '慢阻肺急性加重后已稳定，且自报医护已评估允许，可从轻量分段内容开始。' : `依据自报医护诊断「${DISEASES[input.disease]}」、症状稳定状态和已获医护允许，提供轻量起步内容。`,
    postExacerbation ? '加重后恢复阶段先采用短段活动，按医护安排增加。' : limited ? '日常活动受限或活动能力信息不足，因此从较短分段活动开始。' : '现有症状记录支持从舒适步行开始，并按体感及时休息。',
    `目标为${input.goal === 'endurance' ? '改善活动耐力' : input.goal === 'breathing' ? '熟悉舒适呼吸节奏' : '更轻松地完成日常活动'}；时长是保守产品起步值。`,
  ];
  const warnings = [...plan.warnings];
  if (input.spo2 == null) warnings.push('未提供静息血氧，页面无法评估低氧风险；按已确认的医护方案训练，出现不适及时停止。');
  if (input.fev1Percent == null) warnings.push('未提供肺功能结果；这里不对肺功能、疾病严重程度或诊断作判断。');
  if (input.disease === 'asthma') warnings.push('ACT 总分不能排除急性发作风险。呼吸练习是补充措施，不能保证改善肺功能或减少急性发作。');
  return {
    ...plan, status: 'ready', title: `${DISEASES[input.disease]} · ${limited ? '轻量分段起步' : '舒适活动起步'}`,
    subtitle: '把建议与医护确认；身体舒适比完成数字更重要。', reasons, warnings, sessions,
    weekly: [
      { day: '周一', label: '舒适步行 + 呼吸练习' }, { day: '周二', label: '坐姿活动 + 呼吸练习' },
      { day: '周三', label: '舒适步行 + 呼吸练习' }, { day: '周四', label: '休息 / 阅读行动计划' },
      { day: '周五', label: '舒适步行 + 呼吸练习' }, { day: '周六', label: '坐姿活动 / 可选步行' },
      { day: '周日', label: '休息与记录；下周先重新检查状态' },
    ], breathing: { inhaleSeconds: 2, exhaleSeconds: 4, cycles },
  };
}

/** Call immediately before each session; combine with createPlan().status === 'ready'. */
function assessTrainingReadiness(check = {}) {
  if (!isObject(check)) return { allowed: false, status: 'incomplete', message: '请先完成本次训练前的状态确认。' };
  if (check.chestPain === true || check.severeBreathlessness === true) {
    return { allowed: false, status: 'urgent', message: '胸痛或严重呼吸困难时立即停止训练，联系当地急救服务；中国大陆可拨 120。' };
  }
  for (const field of ['chestPain', 'severeBreathlessness', 'dizziness', 'worseSymptoms', 'clinicianCleared']) {
    if (typeof check[field] !== 'boolean') return { allowed: false, status: 'incomplete', message: '请明确确认全部训练前状态。' };
  }
  if (check.spo2 != null && (!finite(check.spo2) || check.spo2 <= 0 || check.spo2 > 100)) {
    return { allowed: false, status: 'incomplete', message: '请核对静息血氧读数；有效范围须大于 0 且不超过 100。' };
  }
  if (check.dizziness || check.worseSymptoms) return { allowed: false, status: 'review', message: '有头晕或症状加重，请停止训练并联系医护评估。' };
  if (!check.clinicianCleared) return { allowed: false, status: 'review', message: '先请医护评估并允许目前的轻量居家训练。' };
  if (finite(check.spo2) && check.spo2 <= 92) return { allowed: false, status: 'review', message: '静息血氧不超过 92%，请停止自主训练并尽快联系医护核实；不要自行调氧。' };
  return { allowed: true, status: 'ready', message: '可按已确认的轻量方案开始；随时暂停，身体舒适比完成数字更重要。' };
}

module.exports={validateProfile,createPlan,assessTrainingReadiness};
