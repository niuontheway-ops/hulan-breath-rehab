const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const MAX_IMAGE_PIXELS = 24_000_000;
const MAX_CANVAS_PIXELS = 4_000_000;
const MAX_PDF_PAGES = 20;
const TEXT_PAGE_LIMIT = 5;
const SCAN_PAGE_LIMIT = 3;
const OCR_TIMEOUT_MS = 120_000;
const ASSETS = new URL('./assets/vendor/', import.meta.url);
const LABELS = /\bfev1Percent\b|\bfev1Fvc\b|\bdyspneaScore\b|\bdyspneaScale\b|\bFEV\s*1\s*\/\s*FVC\b|\bFEV\s*1\b|一秒率|\bSpO\s*2\b|血氧饱和度|\bm\s*MRC\b|\bMRC\b|\bACT\b|哮喘控制测试|\bCAT\b|慢阻肺评估测试/gim;
const NUMBERS = /[+-]?(?:\d+(?:[.,]\d+)?|\.\d+)/g;

let scriptPromise;
let pdfPromise;
let activeWorker;
let activeController;
let reportBusy = false;

function unique(values) {
  return [...new Set(values)];
}

function fieldFor(label) {
  const compact = label.replace(/\s+/g, '').toLowerCase();
  if (compact === 'fev1percent') return 'fev1Percent';
  if (compact === 'fev1fvc' || compact === 'fev1/fvc' || compact === '一秒率') return 'fev1Fvc';
  if (compact === 'fev1') return 'fev1';
  if (compact === 'spo2' || compact === '血氧饱和度') return 'spo2';
  if (compact === 'act' || compact === '哮喘控制测试') return 'act';
  if (compact === 'cat' || compact === '慢阻肺评估测试') return 'cat';
  return compact;
}

function evidenceFor(label, body) {
  return `${label}${body}`.trim().slice(0, 240);
}

function headerColumns(header) {
  const tokens = header.match(/%\s*(?:pred(?:icted)?|预计值?|预测值?)|(?:pred(?:icted)?|预计值|预测值)%|占(?:预计|预测)值?|实测值?|测定值?|测量值?|observed|actual|measured|predicted|预计值|预测值/gi) || [];
  return tokens.map((token) => {
    if (/%|占/.test(token)) return 'percent';
    if (/实测|测定|测量|observed|actual|measured/i.test(token)) return 'observed';
    return 'predicted';
  });
}

function tableValue(numbers, header, column) {
  const columns = headerColumns(header);
  if (numbers.length < 2 || numbers.length !== columns.length || !columns.includes('observed')) return null;
  const index = columns.indexOf(column);
  return index < 0 ? null : numbers[index];
}

function singleScore(body, maximum) {
  const values = [...body.matchAll(NUMBERS)].map((match) => Number(match[0].replace(',', '.')));
  if (values.length === 1) return values[0];
  const scored = body.match(/(?:总分|得分|score)\s*["'\s:：=]*([+-]?\d+(?:\.\d+)?)/i)
    || body.match(/[:：=]\s*([+-]?\d+(?:\.\d+)?)\s*(?:分)?\s*[,}"']*\s*$/);
  if (scored) return Number(scored[1]);
  const fraction = body.match(/^\s*["'\s:：=()]*([+-]?\d+)\s*\/\s*(\d+)\s*(?:分)?\s*[,}"']*\s*$/);
  if (fraction && Number(fraction[2]) === maximum) return Number(fraction[1]);
  return null;
}

/** Extract unconfirmed candidates; every value requires checking against the original report. */
export function parseReportText(input) {
  const candidates = [];
  const warnings = [];
  let text = String(input ?? '').normalize('NFKC').replace(/\u0000/g, '').replace(/\r\n?/g, '\n');
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    warnings.push('报告文字过长，仅解析前 200000 个字符；请补充核对未处理的部分。');
  }
  const add = (field, value, evidence, minimum, maximum, integer = false) => {
    if (!Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      warnings.push(`${field} 的数值或范围不正确，请对照原始报告手工录入。`);
      return;
    }
    candidates.push({ field, value, evidence });
  };
  const scaleMatches = [...text.matchAll(/\bdyspneaScale\b["'\s:：=]*(?:["']\s*)?(mmrc|mrc)\b/gi)].map((match) => match[1].toLowerCase());
  const explicitScale = unique(scaleMatches).length === 1 ? scaleMatches[0] : null;
  const lines = text.split('\n');

  lines.forEach((line, lineIndex) => {
    const labels = [...line.matchAll(LABELS)];
    labels.forEach((match, index) => {
      const field = fieldFor(match[0]);
      const body = line.slice(match.index + match[0].length, labels[index + 1]?.index ?? line.length);
      const evidence = evidenceFor(match[0], body);
      const values = [...body.matchAll(NUMBERS)].map((number) => Number(number[0].replace(',', '.')));
      const header = lines.slice(Math.max(0, lineIndex - 4), lineIndex).reverse().find((previous) => {
        const columns = headerColumns(previous);
        return columns.length >= 2 && columns.includes('observed');
      }) || '';
      if (field === 'dyspneascale') {
        const scale = line.slice(match.index + match[0].length).match(/^["'\s:：=]*(mmrc|mrc)\b/i)?.[1]?.toLowerCase();
        if (scale) candidates.push({ field: 'dyspneaScale', value: scale, evidence });
        else warnings.push('呼吸困难量表类型不明确，请选择 mMRC（0–4）或 MRC（1–5）。');
        return;
      }
      if (!values.length) return;

      if (field === 'fev1' || field === 'fev1Percent') {
        let value = null;
        let tableEvidence = '';
        const hasPredPercent = /%\s*(?:pred(?:icted)?|预计|预测)|(?:pred(?:icted)?|预计值|预测值)\s*%|占(?:预计|预测)值?|percent(?:\s+of)?\s+predicted/i.test(body);
        if (field === 'fev1Percent' && values.length === 1) value = values[0];
        else if (hasPredPercent && values.length === 1) value = values[0];
        else if (hasPredPercent) {
          const tagged = body.match(/([+-]?(?:\d+(?:[.,]\d+)?|\.\d+))\s*%\s*(?:pred(?:icted)?|预计|预测)/i)
            || body.match(/(?:占(?:预计|预测)值?|%\s*(?:pred(?:icted)?|预计值?|预测值?))[\s:：=()]*([+-]?(?:\d+(?:[.,]\d+)?|\.\d+))\s*%/i);
          if (tagged) value = Number(tagged[1].replace(',', '.'));
        }
        if (value === null) {
          value = tableValue(values, header, 'percent');
          if (value !== null) tableEvidence = `表头：${header.slice(0, 100)}；`;
        }
        if (value !== null) add('fev1Percent', value, `${tableEvidence}${evidence}`, Number.MIN_VALUE, 200);
        else warnings.push('FEV1 的实测升数、预计升数与占预计值百分比未能可靠区分；请手工核对 FEV1 %pred，不要填入升数。');
        return;
      }

      if (field === 'fev1Fvc' || field === 'spo2') {
        let value = values.length === 1 ? values[0] : tableValue(values, header, 'observed');
        if (value === null) {
          warnings.push(`${field === 'fev1Fvc' ? 'FEV1/FVC' : 'SpO₂'} 附近有多个数值，无法确定实测值，请手工核对。`);
          return;
        }
        if (field === 'fev1Fvc' && value > 0 && value <= 1 && !/%/.test(body)) {
          value = Math.round(value * 10000) / 100;
          warnings.push('FEV1/FVC 的 0–1 小数已换算为百分数；请核对原报告单位（0.70 对应 70%）。');
        }
        add(field, value, values.length > 1 ? `表头：${header.slice(0, 100)}；${evidence}` : evidence, Number.MIN_VALUE, 100);
        return;
      }

      if (field === 'act' || field === 'cat') {
        const maximum = field === 'act' ? 25 : 40;
        const value = singleScore(body, maximum);
        if (value === null) warnings.push(`${field.toUpperCase()} 附近有多个数值，未提取总分，请手工核对。`);
        else add(field, value, evidence, field === 'act' ? 5 : 0, maximum, true);
        return;
      }

      if (field === 'mmrc' || field === 'mrc' || field === 'dyspneascore') {
        const scale = field === 'dyspneascore' ? explicitScale : field;
        if (!scale) {
          warnings.push('呼吸困难分数没有明确量表，不能区分 mMRC（0–4）和 MRC（1–5），请手工选择。');
          return;
        }
        const value = singleScore(body, scale === 'mmrc' ? 4 : 5);
        if (value === null) warnings.push('呼吸困难量表附近有多个数值，未提取分数，请手工核对。');
        else {
          const before = candidates.length;
          add('dyspneaScore', value, evidence, scale === 'mmrc' ? 0 : 1, scale === 'mmrc' ? 4 : 5, true);
          if (candidates.length > before) candidates.push({ field: 'dyspneaScale', value: scale, evidence });
        }
        if (scale === 'mrc') warnings.push('识别到 MRC（1–5）；它与 mMRC（0–4）起点不同，请确认量表，不可直接混用分数。');
      }
    });
  });

  const deduplicated = candidates.filter((candidate, index) => candidates.findIndex((item) => item.field === candidate.field && item.value === candidate.value) === index);
  unique(deduplicated.map((candidate) => candidate.field)).forEach((field) => {
    if (deduplicated.filter((candidate) => candidate.field === field).length > 1) warnings.push(`${field} 出现不同候选值，请根据日期和原始报告选择本次实际数值。`);
  });
  if (deduplicated.length) warnings.unshift('识别结果均为未核对候选；请逐项对照原始报告确认，再用于康复方案。');
  else warnings.push('未识别到可核对的关键指标；请手工录入，不代表报告指标正常。');
  return { candidates: deduplicated, warnings: unique(warnings) };
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function identifyFile(bytes, file) {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  const extensions = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', pdf: 'pdf', txt: 'text', json: 'json' };
  const expected = extensions[extension];
  if (!expected) throw new Error('只接受 PNG、JPG、WebP、PDF、TXT 或 JSON 文件。');
  let actual;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 7) === 'PNG\r\n\x1a\n') actual = 'png';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) actual = 'jpeg';
  else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') actual = 'webp';
  else if (ascii(bytes, 0, 5) === '%PDF-') actual = 'pdf';
  else if (expected === 'text' || expected === 'json') {
    if (bytes.some((byte) => byte === 0 || (byte < 9) || (byte > 13 && byte < 32))) throw new Error('文件包含二进制内容，不能作为 TXT 或 JSON 读取。');
    actual = expected;
  }
  if (actual !== expected) throw new Error('文件扩展名与实际内容不一致，或文件格式已损坏。');
  return actual;
}

function imageDimensions(bytes, type) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'png' && bytes.length >= 24 && ascii(bytes, 12, 4) === 'IHDR') return [view.getUint32(16), view.getUint32(20)];
  if (type === 'jpeg') {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      offset += length;
    }
  }
  if (type === 'webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const chunk = ascii(bytes, offset, 4);
      const length = view.getUint32(offset + 4, true);
      const start = offset + 8;
      if (start + length > bytes.length) break;
      if (chunk === 'VP8X' && length >= 10) {
        const width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
        const height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
        return [width, height];
      }
      if (chunk === 'VP8L' && length >= 5 && bytes[start] === 0x2f) {
        const packed = view.getUint32(start + 1, true);
        return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
      }
      if (chunk === 'VP8 ' && length >= 10 && ascii(bytes, start + 3, 3) === '\x9d\x01\x2a') return [view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff];
      offset = start + length + (length % 2);
    }
  }
  throw new Error('无法读取图片尺寸，文件可能已损坏。');
}

function canvasFor(width, height, maximumScale = 1) {
  const scale = Math.min(maximumScale, 2600 / Math.max(width, height), Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  return canvas;
}

function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('ocr/tesseract.min.js', ASSETS).href;
    script.async = true;
    script.onload = () => globalThis.Tesseract?.createWorker ? resolve(globalThis.Tesseract) : reject(new Error('OCR 组件不可用。'));
    script.onerror = () => { scriptPromise = undefined; script.remove(); reject(new Error('本机 OCR 资源加载失败。')); };
    document.head.append(script);
  });
  return scriptPromise;
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(new Error('本机报告识别已取消。'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('本机报告识别已取消。'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function getWorker(progress, signal) {
  if (!activeWorker) {
    const tesseract = await abortable(loadTesseract(), signal);
    let initializationFailed;
    const failure = new Promise((_, reject) => { initializationFailed = reject; });
    const creation = tesseract.createWorker('chi_sim+eng', 1, {
      workerPath: new URL('ocr/worker.min.js', ASSETS).href,
      corePath: new URL('ocr/core/', ASSETS).href,
      langPath: new URL('ocr/lang/', ASSETS).href,
      cacheMethod: 'none',
      workerBlobURL: false,
      gzip: true,
      logger: (event) => progress({ status: '本机文字识别', progress: Math.max(0, Math.min(1, event.progress || 0)) }),
      errorHandler: () => initializationFailed(new Error('OCR 初始化或识别失败。')),
    });
    // A worker that finishes initialization after cancellation must also be terminated.
    creation.then((worker) => { if (signal.aborted) worker.terminate().catch(() => {}); }, () => {});
    activeWorker = await abortable(Promise.race([creation, failure]), signal);
  }
  return activeWorker;
}

async function recognize(canvas, progress, signal) {
  const worker = await getWorker(progress, signal);
  const { data } = await abortable(worker.recognize(canvas, {}, { text: true }), signal);
  // Tesseract keeps an input image in its memory filesystem until explicitly removed.
  await worker.removeFile('/input').catch(() => {});
  return data?.text?.trim() || '';
}

async function readImage(file, bytes, type, progress, signal) {
  const [width, height] = imageDimensions(bytes, type);
  if (!width || !height || width * height > MAX_IMAGE_PIXELS || Math.max(width, height) > 12000) throw new Error('图片像素过大；请缩小至 2400 万像素以内再导入。');
  let bitmap;
  let canvas;
  try {
    if (typeof createImageBitmap !== 'function') throw new Error('浏览器不支持本机图片解码。');
    bitmap = await abortable(createImageBitmap(file), signal);
    canvas = canvasFor(bitmap.width, bitmap.height);
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const text = await recognize(canvas, progress, signal);
    return { text, method: 'image-ocr', warnings: ['图片由浏览器本机 OCR 识别；数字、小数点和单位可能识别错误，请逐项核对。'] };
  } finally {
    bitmap?.close();
    if (canvas) canvas.width = canvas.height = 0;
  }
}

async function readPdf(bytes, progress, signal) {
  if (!pdfPromise) pdfPromise = import(new URL('pdfjs/pdf.mjs', ASSETS).href).catch((error) => { pdfPromise = undefined; throw error; });
  const pdfjs = await abortable(pdfPromise, signal);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.mjs', ASSETS).href;
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    cMapUrl: new URL('pdfjs/cmaps/', ASSETS).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', ASSETS).href,
    wasmUrl: new URL('pdfjs/wasm/', ASSETS).href,
  });
  let pdf;
  let hadScan = false;
  let scannedPages = 0;
  const pages = [];
  const warnings = [];
  try {
    pdf = await abortable(loadingTask.promise, signal);
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('PDF 超过 20 页；请提取所需报告页后再导入。');
    const limit = Math.min(pdf.numPages, TEXT_PAGE_LIMIT);
    warnings.push(`PDF 共 ${pdf.numPages} 页；仅提取前 ${limit} 页文字，扫描页 OCR 仅处理前 ${SCAN_PAGE_LIMIT} 页内的页面。`);
    for (let number = 1; number <= limit; number += 1) {
      progress({ status: '读取 PDF', progress: (number - 1) / limit, page: number, pages: limit });
      const page = await abortable(pdf.getPage(number), signal);
      let canvas;
      try {
        const content = await abortable(page.getTextContent(), signal);
        const pageText = content.items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('').trim();
        const needsOcr = pageText.replace(/\s/g, '').length < 20 && !parseReportText(pageText).candidates.length;
        let text = pageText;
        if (needsOcr) {
          hadScan = true;
          if (number <= SCAN_PAGE_LIMIT) {
            const base = page.getViewport({ scale: 1 });
            canvas = canvasFor(base.width, base.height, 1.8);
            const viewport = page.getViewport({ scale: canvas.width / base.width });
            await abortable(page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), canvas, viewport }).promise, signal);
            try {
              const ocrText = await recognize(canvas, (event) => progress({ ...event, page: number, pages: limit }), signal);
              text = ocrText || pageText;
              scannedPages += 1;
            } catch (error) {
              if (signal.aborted) throw error;
              warnings.push(`PDF 第 ${number} 页扫描识别失败；请对照原报告手工录入。`);
            }
          } else warnings.push(`PDF 第 ${number} 页需要扫描识别，已超出前 3 页 OCR 范围，请单独导入该页。`);
        }
        if (text) pages.push(`[第 ${number} 页]\n${text}`);
      } finally {
        if (canvas) canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    if (hadScan) warnings.push('扫描页 OCR 的数字和单位可能有误，必须对照原报告核对；未处理页面不能视为正常。');
    return { text: pages.join('\n\n'), method: scannedPages ? 'pdf-text-and-ocr' : 'pdf-text', warnings };
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

/** Terminate the temporary OCR worker and release its in-memory report data. */
export async function disposeReportWorker() {
  activeController?.abort();
  activeController = undefined;
  const worker = activeWorker;
  activeWorker = undefined;
  await worker?.terminate().catch(() => {});
}

/** Read only the selected browser File. No report content is uploaded or persisted. */
export async function readReport(file, { onProgress } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size)) throw new Error('请选择报告文件。');
  if (file.size > MAX_FILE_BYTES) throw new Error('报告文件超过 10 MB，请压缩或提取所需页面后再导入。');
  if (!file.size) throw new Error('报告文件为空。');
  if (reportBusy) throw new Error('已有报告正在识别，请等待完成后再导入。');
  reportBusy = true;
  const progress = (event) => { if (typeof onProgress === 'function') onProgress(event); };
  let timeout;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) throw new Error('报告文件超过 10 MB。');
    const type = identifyFile(bytes, file);
    if (['png', 'jpeg', 'webp'].includes(type)) {
      const [width, height] = imageDimensions(bytes, type);
      if (!width || !height || width * height > MAX_IMAGE_PIXELS || Math.max(width, height) > 12000) throw new Error('图片像素过大；请缩小至 2400 万像素以内再导入。');
    }
    let result;
    if (type === 'text' || type === 'json') {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('TXT / JSON 需使用 UTF-8 编码；请转换编码或手工录入。'); }
      if (type === 'json') {
        try { JSON.parse(text); }
        catch { throw new Error('JSON 格式不正确，请检查文件或改用手工录入。'); }
      }
      result = { text, method: type === 'json' ? 'json' : 'text', warnings: [] };
    } else {
      const controller = new AbortController();
      activeController = controller;
      timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
      try {
        result = await (type === 'pdf' ? readPdf(bytes, progress, controller.signal) : readImage(file, bytes, type, progress, controller.signal));
      } catch (error) {
        if (/超过 20 页/.test(error.message || '')) throw error;
        result = { text: '', method: 'manual-required', warnings: ['本机报告识别未成功，可能是文件损坏、识别组件缺失或浏览器不支持；请手工录入。未生成任何已识别指标。'] };
      }
    }
    if (result.text.length > MAX_TEXT_CHARS) {
      result.text = result.text.slice(0, MAX_TEXT_CHARS);
      result.warnings.push('仅保留前 200000 个文字字符供本次核对。');
    }
    const parsed = parseReportText(result.text);
    progress({ status: result.text ? '识别完成，等待人工核对' : '需要手工录入', progress: 1 });
    return { ...result, candidates: parsed.candidates, warnings: unique([...result.warnings, ...parsed.warnings]) };
  } finally {
    clearTimeout(timeout);
    await disposeReportWorker();
    reportBusy = false;
  }
}
