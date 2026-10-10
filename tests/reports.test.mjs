import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReportText, readReport, disposeReportWorker } from '../reports.mjs';

// All report contents below are explicitly simulated test data, never patient records.
const simulated = (text) => `模拟报告（测试数据）\n${text}`;
const values = (result, field) => result.candidates.filter((item) => item.field === field).map((item) => item.value);
const textFile = (text, name = 'simulated-report.txt', type = 'text/plain') => new File([text], name, { type });

function pngHeader(width = 100, height = 100) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test('extracts explicit predicted percentages, ratios, oxygen and questionnaire totals with evidence', () => {
  const result = parseReportText(simulated('FEV1 %pred: 58%\nFEV1/FVC: 68%\nSpO₂: 95%\nACT 总分: 19\nCAT: 12\nmMRC: 2'));
  assert.deepEqual(values(result, 'fev1Percent'), [58]);
  assert.deepEqual(values(result, 'fev1Fvc'), [68]);
  assert.deepEqual(values(result, 'spo2'), [95]);
  assert.deepEqual(values(result, 'act'), [19]);
  assert.deepEqual(values(result, 'cat'), [12]);
  assert.deepEqual(values(result, 'dyspneaScore'), [2]);
  assert.deepEqual(values(result, 'dyspneaScale'), ['mmrc']);
  assert.ok(result.candidates.every((item) => item.evidence.length > 3));
  assert.match(result.warnings[0], /未核对候选/);
});

test('does not confuse measured or predicted litres with FEV1 percent predicted', () => {
  const result = parseReportText(simulated('FEV1 实测值: 1.32 L 预计值: 2.45 L\nFEV1: 55%'));
  assert.deepEqual(values(result, 'fev1Percent'), []);
  assert.ok(result.warnings.some((warning) => warning.includes('升数')));
});

test('can distinguish litres from an explicitly labelled percent in the same row', () => {
  const result = parseReportText(simulated('FEV1 实测值: 1.18 L; 占预计值: 55%'));
  assert.deepEqual(values(result, 'fev1Percent'), [55]);
});

test('extracts observed ratio and predicted percent from an unambiguous table header', () => {
  const result = parseReportText(simulated('项目 实测值 预计值 %预计值\nFEV1 1.18 2.18 54.1\nFEV1/FVC 0.61 0.80 76.2'));
  assert.deepEqual(values(result, 'fev1Percent'), [54.1]);
  assert.deepEqual(values(result, 'fev1Fvc'), [61]);
  assert.match(result.candidates.find((item) => item.field === 'fev1Percent').evidence, /表头/);
});

test('leaves multi-column FEV1 rows without a clear table header for manual review', () => {
  const result = parseReportText(simulated('FEV1 1.18 2.18 54.1\nFEV1/FVC 66 80 82.5'));
  assert.equal(result.candidates.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('多个数值')));
});

test('normalizes full-width characters and converts ratio decimals to percent with a warning', () => {
  const result = parseReportText(simulated('ＦＥＶ１／ＦＶＣ：０.７０'));
  assert.deepEqual(values(result, 'fev1Fvc'), [70]);
  assert.ok(result.warnings.some((warning) => warning.includes('换算')));
});

test('keeps MRC and mMRC distinct, without silently translating scores', () => {
  const result = parseReportText(simulated('MRC 3/5'));
  assert.deepEqual(values(result, 'dyspneaScore'), [3]);
  assert.deepEqual(values(result, 'dyspneaScale'), ['mrc']);
  assert.ok(result.warnings.some((warning) => warning.includes('起点不同')));
  assert.equal(parseReportText(simulated('mMRC: 5')).candidates.length, 0);
  assert.equal(parseReportText(simulated('MRC: 0')).candidates.length, 0);
});

test('requires a scale for a generic dyspnea score', () => {
  const result = parseReportText(simulated('dyspneaScore: 2'));
  assert.equal(result.candidates.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('没有明确量表')));
});

test('extracts explicitly named JSON values and scale as unconfirmed candidates', () => {
  const result = parseReportText(JSON.stringify({ simulated: true, fev1Percent: 62, fev1Fvc: 0.65, spo2: 96, act: 23, cat: 0, dyspneaScore: 1, dyspneaScale: 'mmrc' }));
  assert.deepEqual(values(result, 'fev1Percent'), [62]);
  assert.deepEqual(values(result, 'fev1Fvc'), [65]);
  assert.deepEqual(values(result, 'cat'), [0]);
  assert.deepEqual(values(result, 'dyspneaScore'), [1]);
  assert.deepEqual(values(result, 'dyspneaScale'), ['mmrc']);
});

test('rejects invalid ranges and non-integer questionnaire scores rather than guessing', () => {
  const result = parseReportText(simulated('FEV1 %pred: 0\nFEV1/FVC: 120%\nSpO2: 104\nACT: 4\nCAT: 41\nmMRC: 2.5'));
  assert.equal(result.candidates.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('范围不正确')));
});

test('does not treat a printed score range as the patient total', () => {
  const result = parseReportText(simulated('ACT: 5–25\nCAT: 0–40\nmMRC: 0–4'));
  assert.equal(result.candidates.length, 0);
});

test('preserves conflicting candidates and asks the user to select the relevant value', () => {
  const result = parseReportText(simulated('ACT: 18\nACT: 22\nACT: 18'));
  assert.deepEqual(values(result, 'act'), [18, 22]);
  assert.ok(result.warnings.some((warning) => warning.includes('不同候选值')));
});

test('missing labelled data is clearly marked as requiring manual entry', () => {
  const result = parseReportText(simulated('这份模拟文本没有任何关键指标。'));
  assert.equal(result.candidates.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('不代表报告指标正常')));
});

test('reads UTF-8 TXT and valid JSON without uploading data or requiring an OCR worker', async () => {
  const progress = [];
  const result = await readReport(textFile(simulated('ACT 总分: 20')), { onProgress: (event) => progress.push(event) });
  assert.equal(result.method, 'text');
  assert.deepEqual(values(result, 'act'), [20]);
  assert.equal(progress.at(-1).progress, 1);
  const json = await readReport(textFile('{"simulated":true,"spo2":95}', 'simulated.json', 'application/json'));
  assert.equal(json.method, 'json');
  assert.deepEqual(values(json, 'spo2'), [95]);
});

test('rejects oversized, empty, corrupt, mismatched and unsupported file types', async () => {
  await assert.rejects(() => readReport({ name: 'simulated.txt', size: 10 * 1024 * 1024 + 1, arrayBuffer: async () => new ArrayBuffer(1) }), /10 MB/);
  await assert.rejects(() => readReport(textFile('')), /为空/);
  await assert.rejects(() => readReport(textFile('simulated', 'simulated.png')), /不一致/);
  await assert.rejects(() => readReport(new File([pngHeader()], 'simulated.jpg')), /不一致/);
  await assert.rejects(() => readReport(textFile('simulated', 'simulated.html')), /只接受/);
  await assert.rejects(() => readReport(new File([new Uint8Array([65, 0, 66])], 'simulated.txt')), /二进制/);
  await assert.rejects(() => readReport(textFile('{bad json}', 'simulated.json')), /JSON 格式/);
  await assert.rejects(() => readReport(new File([new Uint8Array([0xff, 0xff])], 'simulated.txt')), /UTF-8/);
});

test('rejects image decompression bombs before asking the browser to decode them', async () => {
  await assert.rejects(() => readReport(new File([pngHeader(30000, 30000)], 'simulated.png')), /像素过大/);
});

test('OCR uses only local resource paths, no cache, bounded canvas and releases temporary data', async (t) => {
  const original = { document: globalThis.document, Tesseract: globalThis.Tesseract, createImageBitmap: globalThis.createImageBitmap };
  t.after(() => Object.assign(globalThis, original));
  let settings;
  let disposed = false;
  let removed;
  let bitmapClosed = false;
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }) };
  globalThis.document = { createElement: () => canvas };
  globalThis.createImageBitmap = async () => ({ width: 6000, height: 3500, close: () => { bitmapClosed = true; } });
  globalThis.Tesseract = {
    createWorker: async (languages, engine, options) => {
      assert.equal(languages, 'chi_sim+eng');
      assert.equal(engine, 1);
      settings = options;
      return {
        recognize: async (image) => {
          assert.ok(image.width * image.height <= 4_000_000);
          assert.ok(Math.max(image.width, image.height) <= 2600);
          return { data: { text: simulated('ACT: 22') } };
        },
        removeFile: async (name) => { removed = name; },
        terminate: async () => { disposed = true; },
      };
    },
  };
  const result = await readReport(new File([pngHeader(6000, 3500)], 'simulated.png'));
  assert.equal(result.method, 'image-ocr');
  assert.deepEqual(values(result, 'act'), [22]);
  assert.equal(settings.cacheMethod, 'none');
  assert.equal(settings.workerBlobURL, false);
  for (const path of [settings.workerPath, settings.corePath, settings.langPath]) {
    assert.match(path, /assets\/vendor\/ocr\//);
    assert.doesNotMatch(path, /https?:/);
  }
  assert.equal(removed, '/input');
  assert.ok(disposed && bitmapClosed);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('empty OCR never invents recognized values and explicitly requires manual entry', async (t) => {
  const original = { document: globalThis.document, Tesseract: globalThis.Tesseract, createImageBitmap: globalThis.createImageBitmap };
  t.after(() => Object.assign(globalThis, original));
  globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {} }) }) };
  globalThis.createImageBitmap = async () => ({ width: 100, height: 100, close() {} });
  globalThis.Tesseract = { createWorker: async () => ({ recognize: async () => ({ data: { text: '' } }), removeFile: async () => {}, terminate: async () => {} }) };
  const result = await readReport(new File([pngHeader()], 'simulated.png'));
  assert.equal(result.text, '');
  assert.equal(result.candidates.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('手工录入')));
});

test('disposing an active OCR worker cancels recognition and clears the canvas', async (t) => {
  const original = { document: globalThis.document, Tesseract: globalThis.Tesseract, createImageBitmap: globalThis.createImageBitmap };
  t.after(() => Object.assign(globalThis, original));
  const canvas = { width: 1, height: 1, getContext: () => ({ drawImage() {} }) };
  let entered;
  const recognizing = new Promise((resolve) => { entered = resolve; });
  let terminated = false;
  globalThis.document = { createElement: () => canvas };
  globalThis.createImageBitmap = async () => ({ width: 100, height: 100, close() {} });
  globalThis.Tesseract = { createWorker: async () => ({ recognize: () => { entered(); return new Promise(() => {}); }, terminate: async () => { terminated = true; } }) };
  const resultPromise = readReport(new File([pngHeader()], 'simulated.png'));
  await recognizing;
  await assert.rejects(() => readReport(textFile(simulated('ACT: 22'))), /正在识别/);
  await disposeReportWorker();
  const result = await resultPromise;
  assert.equal(result.method, 'manual-required');
  assert.equal(result.candidates.length, 0);
  assert.ok(terminated);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('a worker finishing initialization after cancellation is terminated without seeing report pixels', async (t) => {
  const original = { document: globalThis.document, Tesseract: globalThis.Tesseract, createImageBitmap: globalThis.createImageBitmap };
  t.after(() => Object.assign(globalThis, original));
  let started;
  const starting = new Promise((resolve) => { started = resolve; });
  let finish;
  const initialized = new Promise((resolve) => { finish = resolve; });
  let terminated = false;
  let recognized = false;
  globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {} }) }) };
  globalThis.createImageBitmap = async () => ({ width: 100, height: 100, close() {} });
  globalThis.Tesseract = { createWorker: () => { started(); return initialized; } };
  const pending = readReport(new File([pngHeader()], 'simulated.png'));
  await starting;
  await disposeReportWorker();
  assert.equal((await pending).method, 'manual-required');
  finish({ recognize: async () => { recognized = true; }, terminate: async () => { terminated = true; } });
  await initialized;
  await Promise.resolve();
  assert.ok(terminated);
  assert.equal(recognized, false);
});
