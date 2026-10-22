import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createReports, INDEX_KEY, MAX_FILES, MAX_FILE_BYTES, MAX_DIRECTORY_BYTES } = require('../miniprogram/app/utils/reports.js');

const NOW = new Date('2026-10-22T10:00:00.000Z');
const ROOT = 'wxfile://usr/hulan-reports';
const SAMPLE_PDF = Buffer.from('%PDF-1.7\nSIMULATED_TEST_CONTENT\n');
const SAMPLE_PNG = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const SAMPLE_JPG = Buffer.from([255,216,255,224,0,16,74,70,73,70]);
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const resolve = (options, value = {}) => queueMicrotask(() => options.success(value));
const reject = (options, errMsg, code) => queueMicrotask(() => options.fail({ errMsg, code }));

function fixture() {
  const values = new Map(), files = new Map(), directories = new Set(['wxfile://usr']);
  const calls = [], failures = { readIndex: false, writeIndex: false, removeIndex: false, copy: false, unlink: false, preview: false, privacy: false, authorize: false };
  let selected, picker, copied, randomCounter = 1;
  const controls = { deferPicker: false, deferCopy: false, needAuthorization: false, confirm: true };
  const manager = {
    stat(options) { calls.push(['stat', options.path]); const file = files.get(options.path); if (!file) return reject(options, 'stat:fail no such file', 'ENOENT'); resolve(options, { stats: { size: file.size, isFile: () => true } }); },
    readFile(options) { calls.push(['readFile', options.filePath]); const file = files.get(options.filePath); if (!file) return reject(options, 'readFile:fail no such file', 'ENOENT'); const data = file.data.subarray(options.position || 0, (options.position || 0) + options.length); resolve(options, { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }); },
    mkdir(options) { calls.push(['mkdir', options.dirPath]); directories.add(options.dirPath); resolve(options); },
    readdir(options) { calls.push(['readdir', options.dirPath]); if (!directories.has(options.dirPath)) return reject(options, 'readdir:fail no such file', 'ENOENT'); const prefix = options.dirPath + '/'; resolve(options, { files: [...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)) }); },
    copyFile(options) {
      calls.push(['copyFile', options.srcPath, options.destPath]);
      const perform = () => { const source = files.get(options.srcPath); if (!source) return reject(options, 'copyFile:fail no such file', 'ENOENT'); files.set(options.destPath, { data: Buffer.from(source.data), size: source.size }); if (failures.copy) reject(options, 'copyFile:fail simulated partial write'); else resolve(options); };
      if (controls.deferCopy) copied = { options, perform }; else perform();
    },
    unlink(options) { calls.push(['unlink', options.filePath]); if (failures.unlink) return reject(options, 'unlink:fail simulated denial'); if (!files.has(options.filePath)) return reject(options, 'unlink:fail no such file', 'ENOENT'); files.delete(options.filePath); resolve(options); },
  };
  const choose = options => { calls.push(['choose']); if (controls.deferPicker) picker = options; else resolve(options, { tempFiles: [selected] }); };
  const api = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager() { return manager; },
    getStorageSync(key) { calls.push(['get', key]); if (failures.readIndex) throw new Error('simulated storage error'); return values.has(key) ? clone(values.get(key)) : ''; },
    setStorageSync(key, value) { calls.push(['set', key]); if (failures.writeIndex) throw new Error('simulated quota error'); values.set(key, clone(value)); },
    removeStorageSync(key) { calls.push(['removeStorage', key]); if (failures.removeIndex) throw new Error('simulated remove error'); values.delete(key); },
    getPrivacySetting(options) { calls.push(['privacy']); if (failures.privacy) reject(options, 'simulated privacy not configured'); else resolve(options, { needAuthorization: controls.needAuthorization }); },
    requirePrivacyAuthorize(options) { calls.push(['authorize']); if (failures.authorize) reject(options, 'simulated privacy refused'); else resolve(options); },
    chooseMedia: choose,
    chooseMessageFile: choose,
    showModal(options) { calls.push(['confirm']); resolve(options, { confirm: controls.confirm, cancel: !controls.confirm }); },
    openDocument(options) { calls.push(['openDocument', options.filePath, options.showMenu]); if (failures.preview) reject(options, 'simulated preview failure'); else resolve(options); },
    previewImage(options) { calls.push(['previewImage', options.current, options.showmenu]); if (failures.preview) reject(options, 'simulated preview failure'); else resolve(options); },
  };
  const reports = createReports(api, { now: () => NOW, random: () => (randomCounter++ % 1000000) / 1000000 });
  function select(name = 'synthetic.pdf', data = SAMPLE_PDF, size = data.length) {
    const path = 'wxfile://tmp/' + name;
    files.set(path, { data, size });
    selected = { name, path, tempFilePath: path, size, ignoredPatientText: 'SIMULATED_TEST_VALUE' };
    return selected;
  }
  return { reports, api, manager, files, values, calls, controls, failures, select, releasePicker() { const saved = picker; picker = null; resolve(saved, { tempFiles: [selected] }); }, releaseCopy() { const saved = copied; copied = null; saved.perform(); }, get picker() { return picker; }, get copied() { return copied; } };
}

async function waitFor(predicate) {
  for (let count = 0; count < 30; count++) { if (predicate()) return; await tick(); }
  assert.fail('The simulated asynchronous API was not reached.');
}

test('report selection stores a private local copy with a generated path and whitelisted metadata', async () => {
  const f = fixture();
  const source = f.select('synthetic.pdf');
  assert.deepEqual(f.reports.list(), { ok: true, items: [] });
  const result = await f.reports.chooseAndAdd('file');
  assert.equal(result.ok, true);
  assert.match(result.item.path, /^wxfile:\/\/usr\/hulan-reports\/r-\d{13}-[a-f0-9]{16}\.pdf$/);
  assert.equal(result.item.path.includes('synthetic'), false);
  assert.equal(f.files.has(source.path), true);
  assert.equal(f.files.has(result.item.path), true);
  assert.deepEqual(Object.keys(result.item), ['id', 'name', 'type', 'size', 'path', 'createdAt']);
  assert.equal(JSON.stringify(f.values.get(INDEX_KEY)).includes('SIMULATED_TEST_VALUE'), false);
  assert.deepEqual([...f.values.keys()], [INDEX_KEY]);
  const restarted = createReports(f.api, { now: () => NOW }).list();
  assert.equal(restarted.ok, true);
  assert.equal(restarted.items[0].id, result.item.id);
  assert.deepEqual(f.calls.filter(call => call[0] === 'readFile').map(call => call[1]), [source.path]);
});

test('album and camera images are detected by content and opened locally without share menus', async () => {
  const f = fixture();
  f.select('synthetic-photo.jpg', SAMPLE_JPG);
  const photo = await f.reports.chooseAndAdd('camera');
  assert.equal(photo.ok, true);
  assert.equal(photo.item.type, 'jpg');
  assert.equal((await f.reports.view(photo.item.id)).ok, true);
  assert.deepEqual(f.calls.find(call => call[0] === 'previewImage'), ['previewImage', photo.item.path, false]);
  f.select('synthetic-image.png', SAMPLE_PNG);
  const album = await f.reports.chooseAndAdd('album');
  assert.equal(album.ok, true);
  assert.equal(album.item.type, 'png');
  f.select('synthetic.pdf');
  const pdf = await f.reports.chooseAndAdd('file');
  assert.equal((await f.reports.view(pdf.item.id)).ok, true);
  assert.deepEqual(f.calls.find(call => call[0] === 'openDocument'), ['openDocument', pdf.item.path, false]);
});

test('privacy configuration and user authorization failures never open the picker or copy files', async () => {
  const f = fixture(); f.select();
  f.failures.privacy = true;
  let result = await f.reports.chooseAndAdd('file');
  assert.equal(result.ok, false);
  assert.match(result.message, /隐私/);
  f.failures.privacy = false; f.controls.needAuthorization = true; f.failures.authorize = true;
  result = await f.reports.chooseAndAdd('file');
  assert.equal(result.ok, false);
  assert.match(result.message, /授权/);
  assert.equal(f.calls.filter(call => call[0] === 'choose').length, 0);
  assert.equal(f.calls.filter(call => call[0] === 'copyFile').length, 0);
  f.failures.authorize = false;
  assert.equal((await f.reports.chooseAndAdd('file')).ok, true);
  assert.equal(f.calls.filter(call => call[0] === 'authorize').length, 2);
});

test('unsupported, disguised, oversized or changed files are rejected before creating local copies', async () => {
  const f = fixture();
  for (const [name, data, size] of [['synthetic.jpg', SAMPLE_PDF, SAMPLE_PDF.length], ['synthetic.pdf', Buffer.from('not a PDF'), 9], ['synthetic.heic', SAMPLE_JPG, SAMPLE_JPG.length], ['synthetic.pdf', SAMPLE_PDF, MAX_FILE_BYTES + 1]]) {
    f.select(name, data, size);
    assert.equal((await f.reports.chooseAndAdd('file')).ok, false);
  }
  const source = f.select();
  f.files.get(source.path).size++;
  assert.equal((await f.reports.chooseAndAdd('file')).ok, false);
  assert.equal(f.values.has(INDEX_KEY), false);
  assert.equal(f.calls.filter(call => call[0] === 'copyFile').length, 0);
});

test('a cancelled picker saves nothing and displays no raw API path or failure details', async () => {
  const f = fixture(); f.select();
  f.api.chooseMessageFile = options => reject(options, 'chooseMessageFile:fail cancel /private/path');
  const result = await f.reports.chooseAndAdd('file');
  assert.equal(result.ok, false);
  assert.match(result.message, /取消/);
  assert.equal(result.message.includes('/private/path'), false);
  assert.equal(f.values.has(INDEX_KEY), false);
});

test('index save and partial-copy failures roll back only the new copy and retain older materials', async () => {
  const f = fixture(); f.select();
  const first = await f.reports.chooseAndAdd('file');
  const previous = clone(f.values.get(INDEX_KEY));
  f.select('synthetic-second.pdf'); f.failures.writeIndex = true;
  assert.equal((await f.reports.chooseAndAdd('file')).ok, false);
  assert.deepEqual(f.values.get(INDEX_KEY), previous);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith(ROOT + '/')), [first.item.path]);
  f.failures.writeIndex = false; f.failures.copy = true;
  assert.equal((await f.reports.chooseAndAdd('file')).ok, false);
  assert.deepEqual(f.values.get(INDEX_KEY), previous);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith(ROOT + '/')), [first.item.path]);
});

test('file-count and directory-byte limits reject new copies without silently evicting records', async () => {
  const f = fixture();
  for (let index = 0; index < MAX_FILES; index++) { f.select('synthetic-' + index + '.pdf'); assert.equal((await f.reports.chooseAndAdd('file')).ok, true); }
  const previous = clone(f.values.get(INDEX_KEY));
  f.select('synthetic-extra.pdf');
  assert.equal((await f.reports.chooseAndAdd('file')).ok, false);
  assert.deepEqual(f.values.get(INDEX_KEY), previous);
  const other = fixture(); other.select();
  other.files.set(ROOT + '/r-1792663200000-0000000100000002.pdf', { data: SAMPLE_PDF, size: MAX_DIRECTORY_BYTES });
  other.manager.readdir = options => resolve(options, { files: ['r-1792663200000-0000000100000002.pdf'] });
  assert.equal((await other.reports.chooseAndAdd('file')).ok, false);
  assert.equal(other.values.has(INDEX_KEY), false);
  assert.equal(other.calls.filter(call => call[0] === 'copyFile').length, 0);
});

test('invalid report indexes block saving and viewing without reading arbitrary stored paths', async () => {
  const f = fixture(); f.select();
  const added = await f.reports.chooseAndAdd('file');
  const good = clone(f.values.get(INDEX_KEY));
  for (const raw of [{ schemaVersion: 2, items: [] }, { ...good, items: [{ ...good.items[0], path: 'wxfile://usr/unrelated/private.pdf' }] }, { ...good, items: [{ ...good.items[0], id: '../escape' }] }, { ...good, items: [{ ...good.items[0], size: MAX_FILE_BYTES + 1 }] }, { ...good, items: [good.items[0], good.items[0]] }]) {
    f.values.set(INDEX_KEY, raw);
    const callsBefore = f.calls.length;
    assert.equal(f.reports.list().ok, false);
    assert.equal((await f.reports.view(added.item.id)).ok, false);
    assert.equal((await f.reports.chooseAndAdd('file')).ok, false);
    assert.equal(f.calls.slice(callsBefore).filter(call => ['stat', 'readFile', 'copyFile'].includes(call[0])).length, 0);
    assert.deepEqual(f.values.get(INDEX_KEY), raw);
  }
});

test('single removal requires confirmation and retains original picked files', async () => {
  const f = fixture(), source = f.select();
  const added = await f.reports.chooseAndAdd('file');
  f.controls.confirm = false;
  const cancelled = await f.reports.remove(added.item.id);
  assert.equal(cancelled.cancelled, true);
  assert.equal(f.files.has(added.item.path), true);
  f.controls.confirm = true;
  assert.equal((await f.reports.remove(added.item.id)).ok, true);
  assert.equal(f.files.has(added.item.path), false);
  assert.equal(f.files.has(source.path), true);
  assert.deepEqual(f.reports.list().items, []);
});

test('failed file deletion or index update is not reported as successful removal and is recoverable', async () => {
  const f = fixture(); f.select();
  const added = await f.reports.chooseAndAdd('file');
  f.failures.unlink = true;
  assert.equal((await f.reports.remove(added.item.id)).ok, false);
  assert.equal(f.files.has(added.item.path), true);
  f.failures.unlink = false; f.failures.writeIndex = true;
  assert.equal((await f.reports.remove(added.item.id)).ok, false);
  assert.equal(f.values.get(INDEX_KEY).items.length, 1);
  f.failures.writeIndex = false;
  assert.equal((await f.reports.remove(added.item.id)).ok, true);
  assert.deepEqual(f.reports.list().items, []);
});

test('local viewing failures are actionable and never trigger a remote fallback', async () => {
  const f = fixture(); f.select();
  const added = await f.reports.chooseAndAdd('file');
  f.failures.preview = true;
  assert.equal((await f.reports.view(added.item.id)).ok, false);
  f.failures.preview = false; f.files.delete(added.item.path);
  assert.equal((await f.reports.view(added.item.id)).ok, false);
  assert.equal(f.calls.filter(call => call[0] === 'openDocument').length, 1);
});

test('clearing works with a corrupt index but touches only strictly generated application files', async () => {
  const f = fixture(), source = f.select();
  const added = await f.reports.chooseAndAdd('file');
  const unrelated = 'wxfile://usr/unrelated/synthetic.pdf';
  f.files.set(unrelated, { data: SAMPLE_PDF, size: SAMPLE_PDF.length });
  f.values.set('unrelated.key', { keep: true });
  f.values.set(INDEX_KEY, { schemaVersion: 99, items: [{ path: unrelated }] });
  assert.equal((await f.reports.clearAll()).ok, true);
  assert.equal(f.files.has(added.item.path), false);
  assert.equal(f.files.has(source.path), true);
  assert.equal(f.files.has(unrelated), true);
  assert.equal(f.values.has(INDEX_KEY), false);
  assert.deepEqual(f.values.get('unrelated.key'), { keep: true });
  assert.ok(f.calls.filter(call => call[0] === 'unlink').every(call => call[1].startsWith(ROOT + '/')));
});

test('unknown directory content and clear failures do not claim that every report was cleared', async () => {
  const f = fixture(); f.select();
  const added = await f.reports.chooseAndAdd('file');
  const unknown = ROOT + '/not-an-application-file.txt';
  f.files.set(unknown, { data: SAMPLE_PDF, size: SAMPLE_PDF.length });
  assert.equal((await f.reports.clearAll()).ok, false);
  assert.equal(f.files.has(added.item.path), true);
  assert.equal(f.files.has(unknown), true);
  f.files.delete(unknown); f.failures.unlink = true;
  assert.equal((await f.reports.clearAll()).ok, false);
  assert.equal(f.values.has(INDEX_KEY), true);
  f.failures.unlink = false; f.failures.removeIndex = true;
  assert.equal((await f.reports.clearAll()).ok, false);
  assert.equal(f.values.has(INDEX_KEY), true);
  f.failures.removeIndex = false;
  assert.equal((await f.reports.clearAll()).ok, true);
  assert.equal(f.values.has(INDEX_KEY), false);
});

test('clearing invalidates a pending picker without hanging or letting its later callback recreate data', async () => {
  const f = fixture(); f.select(); f.controls.deferPicker = true;
  const saving = f.reports.chooseAndAdd('file');
  await waitFor(() => f.picker);
  assert.equal((await f.reports.clearAll()).ok, true);
  f.releasePicker();
  assert.equal((await saving).ok, false);
  assert.equal(f.values.has(INDEX_KEY), false);
  assert.equal(f.calls.filter(call => call[0] === 'copyFile').length, 0);
  f.controls.deferPicker = false;
  assert.equal((await f.reports.chooseAndAdd('file')).ok, true);
});

test('clearing during a real pending copy waits for rollback and leaves no recreated file or index', async () => {
  const f = fixture(); f.select(); f.controls.deferCopy = true;
  const saving = f.reports.chooseAndAdd('file');
  await waitFor(() => f.copied);
  let cleared = false;
  const clearing = f.reports.clearAll().then(result => { cleared = true; return result; });
  await tick(); assert.equal(cleared, false);
  f.releaseCopy();
  assert.equal((await saving).ok, false);
  assert.equal((await clearing).ok, true);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith(ROOT + '/')), []);
  assert.equal(f.values.has(INDEX_KEY), false);
});

test('leaving the page cancels a pending save and cleans an unindexed local copy', async () => {
  const f = fixture(); f.select(); f.controls.deferCopy = true;
  const saving = f.reports.chooseAndAdd('file');
  await waitFor(() => f.copied);
  f.reports.cancelPending(); f.releaseCopy();
  assert.equal((await saving).ok, false);
  assert.equal(f.values.has(INDEX_KEY), false);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith(ROOT + '/')), []);
});
