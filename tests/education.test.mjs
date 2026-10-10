import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EDUCATION_TOPICS, EDUCATION_VIDEO_SCRIPTS, getEducation, mountEducation } from '../education.mjs';
import { INHALER_DEVICES, getInhaler, mountInhaler } from '../inhaler.mjs';

const expectedCards = {
  copd: 6, asthma: 5, bronchiectasis: 5, lungcancer: 6,
  pneumoconiosis: 5, ild: 5, pneumothorax: 5, effusion: 4,
  tb: 4, corpulmonale: 6, osa: 6, quit: 6,
};
const body = id => {
  const data = getEducation(id);
  return [data.intro, ...data.sections.flatMap(section => [section.title, ...section.items]), ...data.urgent,
    ...data.details.flatMap(section => [section.title, ...section.items]), ...data.additionalAlerts].join('\n');
};

test('all twelve education topics retain care details while showing three short actions', () => {
  assert.deepEqual(EDUCATION_TOPICS.map(topic => topic.id), Object.keys(expectedCards));
  assert.equal(EDUCATION_TOPICS.length, 12);
  assert.equal(EDUCATION_TOPICS.reduce((sum, topic) => sum + getEducation(topic.id).details.length, 0), 63);
  assert.equal(new Set(EDUCATION_TOPICS.map(topic => topic.id)).size, 12);
  assert.ok(EDUCATION_TOPICS.every(topic => topic.name && topic.shortName));
});

test('each topic contains short actions, a local video with captions, care details and direct sources', async t => {
  for (const topic of EDUCATION_TOPICS) {
    await t.test(topic.id, () => {
      const data = getEducation(topic.id);
      assert.equal(data.id, topic.id);
      assert.equal(data.sections.length, 3);
      assert.equal(data.details.length, expectedCards[topic.id]);
      assert.equal(data.title, topic.shortName);
      assert.ok(data.intro.length >= 30);
      assert.ok(data.sections.every(section => section.title && section.items.length === 1));
      assert.ok(data.sections.every(section => section.items.every(item => typeof item === 'string' && item.length <= 50)));
      assert.equal(data.urgent.length, 1);
      assert.ok(data.urgent[0].length <= 80);
      assert.equal(data.image.src, `assets/chapters/${topic.id}.svg`);
      assert.equal(data.video.src, `assets/education-videos/${topic.id}.mp4`);
      assert.equal(data.video.captions, `assets/education-videos/${topic.id}.vtt`);
      assert.equal(data.video.poster, data.image.src);
      assert.equal(data.video.kind, 'local-captioned');
      assert.equal(data.videoCards.length, 4);
      assert.deepEqual(data.videoCards, EDUCATION_VIDEO_SCRIPTS[topic.id]);
      assert.ok(data.videoCards.every(card => card.title && card.text.length > 20 && card.text.length < 65));
      assert.ok(data.additionalAlerts.length >= 3);
      assert.ok(data.sources.length >= 2);
      assert.ok(data.sources.every(source => source.label && new URL(source.url).protocol === 'https:'));
      assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
    });
  }
});

test('unknown, missing and prototype-like topic identifiers have a stable safe fallback', () => {
  for (const id of [undefined, null, '', 'unknown', 'COPD', 'constructor', '__proto__', [], {}, 1]) {
    assert.deepEqual(getEducation(id), getEducation('copd'));
  }
});

test('callers cannot mutate shared topic data or subsequent education reads', () => {
  const data = getEducation('asthma');
  const original = getEducation('asthma');
  data.title = 'changed';
  data.sections[0].items[0] = 'changed';
  data.details[0].items[0] = 'changed';
  data.videoCards[0].text = 'changed';
  data.urgent.push('changed');
  data.sources[0].url = 'https://invalid.example/';
  assert.deepEqual(getEducation('asthma'), original);
  assert.ok(Object.isFrozen(EDUCATION_TOPICS));
  assert.ok(EDUCATION_TOPICS.every(Object.isFrozen));
});

test('oxygen settings remain individual rather than a uniform home prescription', () => {
  for (const id of ['copd', 'ild', 'corpulmonale']) {
    const text = body(id);
    assert.match(text, /目标血氧、流量和每天使用时间都按个人医嘱/);
    assert.match(text, /不要.*自行改变氧气设置/);
    assert.doesNotMatch(text, /1\s*[–-]\s*2\s*L\s*\/\s*min|每日\s*[≥>]\s*15\s*小时/i);
  }
});

test('vaccination is tailored to product, risk and previous vaccination', () => {
  for (const id of ['copd', 'asthma', 'bronchiectasis', 'pneumoconiosis', 'ild', 'corpulmonale']) {
    const text = body(id);
    assert.match(text, /接种史和当地接种政策/);
    assert.doesNotMatch(text, /肺炎球菌.*每\s*5\s*年/);
  }
});

test('pneumothorax travel and activity follow resolution and specialist assessment', () => {
  const text = body('pneumothorax');
  assert.match(text, /影像上完全吸收时不能乘机/);
  assert.match(text, /至少等待 7 天.*医护评估/);
  assert.match(text, /压缩气瓶潜水.*专业人员评估/);
  assert.match(text, /没有允许前/);
  assert.doesNotMatch(text, /1\s*年内.*乘坐飞机|终身禁止.*双侧胸膜/);
});

test('hemoptysis advice does not require unsafe positioning or a fixed blood volume', () => {
  const text = body('bronchiectasis');
  assert.match(text, /停止拍背、体位引流和用力呼吸训练/);
  assert.match(text, /不等待达到某个出血量/);
  assert.match(text, /按急救调度指导/);
  assert.match(text, /不要自行驾车/);
  for (const id of ['bronchiectasis', 'tb', 'lungcancer']) {
    assert.doesNotMatch(body(id), /头低脚高|100\s*m[lL]|500\s*m[lL]/);
  }
});

test('disease-specific care is preserved without replacing treatment with breathing games', () => {
  assert.match(body('asthma'), /书面哮喘行动计划/);
  assert.match(body('asthma'), /不能替代抗炎治疗/);
  assert.match(body('lungcancer'), /38°C/);
  assert.match(body('lungcancer'), /血栓预防/);
  assert.match(body('pneumoconiosis'), /职业健康/);
  assert.match(body('ild'), /并非所有患者都需要/);
  assert.match(body('ild'), /不要只为了肺纤维化自行服用抑酸药/);
  assert.match(body('effusion'), /不要?自行拔管、夹管或调节引流/);
  assert.match(body('tb'), /不自行套用固定月份/);
  assert.match(body('tb'), /密切接触者.*筛查/);
  assert.match(body('corpulmonale'), /不根据水肿自行加倍/);
  assert.match(body('osa'), /不能代替设备/);
  assert.match(body('osa'), /避免驾驶/);
  assert.match(body('quit'), /偶尔吸了一支不等于所有努力归零/);
  assert.match(body('quit'), /药物是否调整由医疗人员评估/);
});

test('education only uses native, opt-in local playback and read-only rendering', async () => {
  const source = await readFile(new URL('../education.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|\.innerHTML\s*=/);
  for (const className of ['edu-topic-picker', 'edu-grid', 'edu-card', 'edu-emergency', 'edu-sources']) assert.ok(source.includes(className));
  assert.ok(source.includes("'aria-pressed'"));
  assert.ok(source.includes("'noopener noreferrer'"));
  assert.ok(source.includes("activeVideo.preload = 'none'"));
  assert.ok(source.includes("captions.kind = 'captions'"));
  assert.ok(source.includes("activeVideo?.pause()"));
  assert.doesNotMatch(source, /autoplay\s*=\s*true/);
  assert.throws(() => mountEducation(null), TypeError);
  assert.throws(() => mountEducation({}), TypeError);
});

test('COPD education includes pulmonary rehabilitation after an exacerbation has stabilized', () => {
  const data = getEducation('copd');
  assert.match(data.sections.map(section => section.items.join('')).join(''), /急性加重治疗后.*稳定.*医护评估.*肺康复/);
  assert.match(data.videoCards[2].text, /急性加重治疗后.*病情稳定.*医护评估.*肺康复/);
});

test('six original inhaler videos are retained without uniform medication doses', () => {
  assert.equal(INHALER_DEVICES.length, 6);
  assert.deepEqual(INHALER_DEVICES.map(item => getInhaler(item.id).video), [
    'https://www.bilibili.com/video/BV1TCqhYvEP9',
    'https://www.bilibili.com/video/BV1DfrYBjEiA',
    'https://www.bilibili.com/video/BV1UAreBCE3t',
    'https://www.bilibili.com/video/BV1WTraBAEfS',
    'https://www.bilibili.com/video/BV1UAreBCEVS',
    'https://www.bilibili.com/video/BV1UjrhBTE9z',
  ]);
  for (const item of INHALER_DEVICES) {
    const data = getInhaler(item.id);
    assert.equal(data.steps.length, 4);
    assert.ok(data.source.url.startsWith('https://'));
    assert.ok(data.duration > 100);
    assert.doesNotMatch(data.device + data.steps.join(''), /每日\s*[12一二两]\s*次|每次\s*[12一二两]\s*[吸喷粒]/);
  }
  assert.match(getInhaler('capsule').note, /天晴速乐.*HandiHaler.*不同/);
  assert.match(getInhaler('capsule').steps[0], /不能吞服/);
  const modified = getInhaler('turbuhaler');
  modified.steps[0] = 'changed';
  modified.source.url = 'https://invalid.example';
  assert.notEqual(getInhaler('turbuhaler').steps[0], 'changed');
  assert.deepEqual(getInhaler('unknown'), getInhaler('breztri'));
});

test('inhaler renderer leaves external video loading to an explicit link', async () => {
  const source = await readFile(new URL('../inhaler.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|\.innerHTML\s*=|createElement\(['"]iframe/);
  assert.ok(source.includes("'noopener noreferrer'"));
  assert.ok(source.includes('打开操作视频'));
  assert.throws(() => mountInhaler(null), TypeError);
});
