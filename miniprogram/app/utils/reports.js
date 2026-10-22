const { today } = require('./calendar');
const INDEX_KEY = 'hulan.rehab.wechat.reports.v1';
const MAX_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_DIRECTORY_BYTES = 64 * 1024 * 1024;
const ID = /^r-\d{13}-[a-f0-9]{16}$/;
const FILE = /^(r-\d{13}-[a-f0-9]{16})\.(pdf|png|jpg)$/;
const TYPES = ['pdf', 'png', 'jpg'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const absent = value => value === undefined || value === '';
class ReportError extends Error {}

function invoke(target, method, options = {}) {
  if (!target || typeof target[method] !== 'function') return Promise.reject(new ReportError('当前微信不支持这项本机文件操作，请升级微信后重试。'));
  return new Promise((resolve, reject) => { try { target[method]({ ...options, success: resolve, fail: reject }); } catch (error) { reject(error); } });
}
function missing(error) { return error && (error.code === 'ENOENT' || error.errCode === 1300002 || /no such file|not exist|ENOENT|不存在/i.test(error.errMsg || error.message || '')); }
function cancelled(error) { return error && /cancel|取消/i.test(error.errMsg || error.message || ''); }
function fileType(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
  if (!bytes) return null;
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.length >= 5 && [37,80,68,70,45].every((value, index) => bytes[index] === value)) return 'pdf';
  return null;
}
function safeName(value) {
  if (typeof value !== 'string') return '';
  return value.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 120);
}

function createReports(wxApi, { now = () => new Date(), random = Math.random } = {}) {
  let generation = 0, intent = null, mutation = null, clearing = null;
  const api = () => {
    const value = wxApi || (typeof wx !== 'undefined' ? wx : null);
    if (!value || typeof value.getStorageSync !== 'function' || typeof value.setStorageSync !== 'function' || typeof value.removeStorageSync !== 'function' || typeof value.getFileSystemManager !== 'function') throw new ReportError('当前无法使用手机本地文件，请稍后重试。');
    return value;
  };
  const clock = () => { const value = now(), date = value instanceof Date ? value : new Date(value); if (!Number.isFinite(date.getTime())) throw new ReportError('请核对手机日期后重试。'); return date; };
  const directory = () => {
    const value = api().env && api().env.USER_DATA_PATH;
    if (typeof value !== 'string' || !value || value.length > 2048 || /\x00|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)) throw new ReportError('无法确定本机材料目录，尚未操作文件。');
    return value.replace(/\/+$/, '') + '/hulan-reports';
  };
  const fs = () => api().getFileSystemManager();
  const pathFor = (id, type) => directory() + '/' + id + '.' + type;
  const fail = error => {
    const detail = error && (error.errMsg || error.message || '');
    const message = error instanceof ReportError ? error.message : cancelled(error) ? '已取消选择，没有保存新材料。'
      : /privacy|隐私/i.test(detail) ? '当前小程序的文件隐私声明尚不可用，请联系医院维护人员核对后台配置；可以先跳过材料。'
      : /auth|permission|权限/i.test(detail) ? '尚未取得相册、相机或文件访问权限。可在微信小程序设置中自行决定是否允许，也可以先跳过材料。'
      : '本机材料操作失败，请检查手机空间后重试；可先跳过材料，手工填写已有指标。';
    return { ok: false, message };
  };
  const active = token => { if (token !== generation || clearing) throw new ReportError('操作已取消，没有继续保存材料。'); };

  function readIndex() {
    const raw = api().getStorageSync(INDEX_KEY);
    if (absent(raw)) return [];
    if (!object(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.items) || raw.items.length > MAX_FILES) throw new ReportError('本机材料目录格式异常，未覆盖原资料。请在设置中清除本机材料后重试。');
    const ids = new Set(), paths = new Set();
    return raw.items.map(item => {
      if (!object(item) || typeof item.id !== 'string' || !ID.test(item.id) || !TYPES.includes(item.type) || item.path !== pathFor(item.id, item.type) || typeof item.name !== 'string' || !item.name || item.name.length > 120 || /[\\/\x00-\x1f\x7f]/.test(item.name) || !Number.isInteger(item.size) || item.size < 1 || item.size > MAX_FILE_BYTES || typeof item.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.createdAt) || !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt || Date.parse(item.createdAt) > clock().getTime() + 1000 || ids.has(item.id) || paths.has(item.path)) throw new ReportError('本机材料目录格式异常，未读取或改动其他文件。请在设置中清除本机材料后重试。');
      ids.add(item.id); paths.add(item.path);
      return { id: item.id, name: item.name, type: item.type, size: item.size, path: item.path, createdAt: item.createdAt };
    });
  }
  function list() { try { return { ok: true, items: readIndex() }; } catch (error) { return { ...fail(error), items: [] }; } }
  function writeIndex(items) { api().setStorageSync(INDEX_KEY, { schemaVersion: 1, items }); }
  async function stat(path) {
    const result = await invoke(fs(), 'stat', { path });
    if (!result || !result.stats || !Number.isInteger(result.stats.size) || result.stats.size < 0 || typeof result.stats.isFile !== 'function' || !result.stats.isFile()) throw new ReportError('所选材料不是有效的本机文件。');
    return result.stats.size;
  }
  async function scan() {
    let result;
    try { result = await invoke(fs(), 'readdir', { dirPath: directory() }); } catch (error) { if (missing(error)) return []; throw error; }
    if (!Array.isArray(result.files) || result.files.length > 128 || result.files.some(name => typeof name !== 'string' || !FILE.test(name))) throw new ReportError('本机材料目录有无法识别的内容，尚未覆盖或删除，请联系维护人员核对。');
    const files = [];
    for (const name of result.files) files.push({ name, path: directory() + '/' + name, size: await stat(directory() + '/' + name) });
    return files;
  }
  async function unlink(path) {
    const name = path.slice(directory().length + 1);
    if (path !== directory() + '/' + name || !FILE.test(name)) throw new ReportError('材料路径不属于本应用，未进行删除。');
    try { await invoke(fs(), 'unlink', { filePath: path }); } catch (error) { if (!missing(error)) throw error; }
  }
  async function mutate(token, work) {
    active(token);
    if (mutation) throw new ReportError('另一项本机文件操作尚未结束，请稍后重试。');
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    mutation = barrier;
    try { return await work(); } finally { if (mutation === barrier) mutation = null; release(); }
  }
  function startIntent(work) {
    if (clearing || mutation || intent && intent.token === generation) return Promise.resolve({ ok: false, message: '本机材料操作进行中，请稍后重试。' });
    const current = { token: generation };
    intent = current;
    const task = (async () => { try { return await work(current.token); } catch (error) { return fail(error); } finally { if (intent === current) intent = null; } })();
    return task;
  }
  async function authorize(token) {
    let setting;
    try { setting = await invoke(api(), 'getPrivacySetting'); } catch (_) { throw new ReportError('当前小程序尚不能核对隐私声明。请联系医院维护人员完成微信隐私配置；可以先跳过材料，手工填写指标。'); }
    active(token);
    if (!setting || typeof setting.needAuthorization !== 'boolean') throw new ReportError('微信隐私状态暂不可用，请稍后重试；可以先跳过材料。');
    if (setting.needAuthorization) {
      try { await invoke(api(), 'requirePrivacyAuthorize'); } catch (_) { throw new ReportError('尚未取得微信所需的文件隐私授权。请确认小程序隐私声明已配置并自行选择是否同意；可以先跳过材料。'); }
    }
    active(token);
  }
  async function pick(kind, token) {
    await authorize(token);
    let result;
    if (kind === 'album' || kind === 'camera') result = await invoke(api(), 'chooseMedia', { count: 1, mediaType: ['image'], sourceType: [kind], sizeType: ['original'] });
    else if (kind === 'file') result = await invoke(api(), 'chooseMessageFile', { count: 1, type: 'all' });
    else throw new ReportError('请选择拍照、相册或 PDF 文件。');
    active(token);
    if (!result || !Array.isArray(result.tempFiles) || result.tempFiles.length !== 1) throw new ReportError('请一次选择一份材料。');
    return result.tempFiles[0];
  }
  function chooseAndAdd(kind) {
    return startIntent(async token => {
      const before = readIndex();
      if (before.length >= MAX_FILES) throw new ReportError('最多保存 6 份材料，请先删除不需要的本机材料。');
      const picked = await pick(kind, token);
      const source = picked.tempFilePath || picked.path;
      if (typeof source !== 'string' || !source || source.length > 2048 || /\x00|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(source) || !Number.isInteger(picked.size) || picked.size < 1 || picked.size > MAX_FILE_BYTES) throw new ReportError('请选择不超过 8 MB 的 PDF、PNG 或 JPEG 材料。');
      const size = await stat(source);
      active(token);
      if (size !== picked.size || size > MAX_FILE_BYTES) throw new ReportError('文件大小已变化，或超过 8 MB，请重新选择。');
      const header = await invoke(fs(), 'readFile', { filePath: source, position: 0, length: Math.min(24, size) });
      active(token);
      const type = fileType(header.data);
      const name = kind === 'file' ? safeName(picked.name) : '';
      const extension = name ? name.split('.').pop().toLowerCase().replace('jpeg', 'jpg') : null;
      if (!type || kind !== 'file' && type === 'pdf' || kind === 'file' && (!name || extension !== type)) throw new ReportError('文件内容与类型不匹配。请选择真实的 PDF、PNG 或 JPEG 文件。');
      return mutate(token, async () => {
        let destination = null, attempted = false, committed = false;
        try {
          const files = await scan(); active(token);
          if (files.reduce((total, file) => total + file.size, 0) + size > MAX_DIRECTORY_BYTES) throw new ReportError('本机材料空间已达上限，请先删除不需要的材料。');
          const date = clock(), items = readIndex();
          if (items.length >= MAX_FILES) throw new ReportError('最多保存 6 份材料，请先删除不需要的材料。');
          let id = null;
          for (let attempt = 0; attempt < 8; attempt++) {
            const hex = () => { const value = random(); if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) throw new ReportError('无法建立本机材料标识，请重试。'); return Math.floor(value * 0x100000000).toString(16).padStart(8, '0'); };
            const candidate = 'r-' + date.getTime() + '-' + hex() + hex();
            if (ID.test(candidate) && !items.some(item => item.id === candidate) && !files.some(file => file.name.startsWith(candidate + '.'))) { id = candidate; break; }
          }
          if (!id) throw new ReportError('无法建立新的本机材料标识，请重试。');
          destination = pathFor(id, type);
          active(token);
          try { await invoke(fs(), 'mkdir', { dirPath: directory(), recursive: true }); } catch (error) { if (!/already exists|EEXIST/i.test(error.errMsg || error.message || '')) throw error; }
          active(token); attempted = true;
          await invoke(fs(), 'copyFile', { srcPath: source, destPath: destination });
          active(token);
          if (await stat(destination) !== size) throw new ReportError('本机副本校验失败，尚未保存材料目录。');
          active(token);
          const item = { id, name: name || '检查材料 ' + today(date) + '.' + type, type, size, path: destination, createdAt: date.toISOString() };
          writeIndex([...items, item]); committed = true;
          return { ok: true, item, items: [...items, item] };
        } catch (error) {
          if (attempted && destination && !committed) { try { await unlink(destination); } catch (_) { return { ok: false, message: '材料未保存完成，部分本机副本尚未清理。请在设置中清除本机材料后重试。' }; } }
          throw error;
        }
      });
    });
  }
  function view(id) {
    return startIntent(async token => {
      const item = readIndex().find(value => value.id === id);
      if (!item) throw new ReportError('未找到这份本机材料，请刷新列表。');
      if (await stat(item.path) !== item.size) throw new ReportError('本机材料已变化，请删除此条后重新选择。');
      active(token);
      if (item.type === 'pdf') await invoke(api(), 'openDocument', { filePath: item.path, fileType: 'pdf', showMenu: false });
      else await invoke(api(), 'previewImage', { current: item.path, urls: [item.path], showmenu: false });
      return { ok: true };
    });
  }
  function remove(id) {
    return startIntent(async token => {
      if (!readIndex().some(item => item.id === id)) throw new ReportError('未找到这份本机材料，请刷新列表。');
      const answer = await invoke(api(), 'showModal', { title: '删除本机材料', content: '只删除这份材料在本小程序中的副本，原文件不受影响。', confirmText: '删除', confirmColor: '#8d3428' });
      active(token);
      if (!answer.confirm) return { ok: false, cancelled: true, message: '已取消删除。' };
      return mutate(token, async () => {
        const items = readIndex(), item = items.find(value => value.id === id);
        if (!item) throw new ReportError('这份材料已不在当前列表。');
        await unlink(item.path); active(token);
        const next = items.filter(value => value.id !== id);
        writeIndex(next);
        return { ok: true, items: next };
      });
    });
  }
  function clearAll() {
    if (clearing) return clearing;
    generation++;
    const task = (async () => {
      try {
        if (mutation) await mutation;
        const files = await scan();
        for (const file of files) await unlink(file.path);
        api().removeStorageSync(INDEX_KEY);
        if (!absent(api().getStorageSync(INDEX_KEY))) throw new ReportError('无法确认本机材料目录已清除，请重试。');
        return { ok: true };
      } catch (error) { return { ok: false, message: error instanceof ReportError ? error.message : '本机材料尚未全部清除，请重试；原始文件和其他应用数据未被操作。' }; }
    })();
    clearing = task;
    task.then(() => { if (clearing === task) clearing = null; });
    return task;
  }
  return { list, chooseAndAdd, view, remove, clearAll, cancelPending() { generation++; } };
}

const reports = createReports();
module.exports = { reports, createReports, INDEX_KEY, MAX_FILES, MAX_FILE_BYTES, MAX_DIRECTORY_BYTES };
