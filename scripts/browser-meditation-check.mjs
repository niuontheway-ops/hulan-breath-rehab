import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const out = path.join(root, '.qa', 'meditation');
await mkdir(out, { recursive: true });
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>呼吸冥想验证</title><style>body{padding:24px;background:#f4f7ef}#fixture{max-width:1120px;margin:auto}@media(max-width:540px){body{padding:10px}}</style><div id="fixture"></div><script type="module">import {mountGame} from '/game.mjs';window.demo=mountGame(document.querySelector('#fixture'),{initialMode:new URLSearchParams(location.search).get('mode')||'stairs',breathing:{inhaleSeconds:2,exhaleSeconds:4,cycles:2},onComplete:record=>window.result=record});</script></html>`;
let base;
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, base).pathname;
    if (pathname === '/fixture.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fixture); return;
    }
    const file = ['game.mjs', 'meditation.mjs', 'styles.css'].find(name => pathname === `/${name}`);
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8' });
    res.end(await readFile(path.join(root, file)));
  } catch { res.writeHead(500); res.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'zh-CN' });
const page = await context.newPage();
const checks = [], poses = [], layouts = [], errors = [], remote = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', request => { if (!request.url().startsWith(base)) remote.push(request.url()); });
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }
async function fresh(mode = 'stairs') {
  await page.goto(`${base}/fixture.html?mode=${mode}`);
  await page.locator('.game-shell').waitFor();
}
const take = () => page.evaluate(() => {
  const shell = document.querySelector('.game-shell');
  const scene = document.querySelector(`[data-meditation-scene="${shell.dataset.mode}"]`);
  const marker = scene?.querySelector('[data-meditation-marker]');
  const box = marker?.getBoundingClientRect();
  return { state: window.demo.getState(), mode: shell.dataset.mode, position: scene?.dataset.position, motion: scene?.dataset.motion, marker: marker?.getAttribute('transform'), camera: scene?.querySelector('[data-meditation-world]')?.getAttribute('transform'), footprint: scene?.querySelector('[data-meditation-footprints]')?.outerHTML, rendered: box && { x: box.x, y: box.y, width: box.width }, cue: document.querySelector('[data-meditation-cue]').textContent };
});
try {
  await fresh();
  await check('stairs is explicitly a seated or lying imagined journey, with the original timing', async () => {
    assert.equal(await page.locator('[data-game-mode="stairs"]').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('[data-game-meditation]').isVisible());
    assert.equal(await page.locator('.game-demonstration').isVisible(), false);
    assert.match(await page.locator('[data-meditation-summary]').textContent(), /吸气 2 秒想象 1 个台阶，呼气 4 秒想象 2 个台阶/);
    assert.match(await page.locator('[data-game-privacy]').textContent(), /坐位或卧位.*不需要真的爬楼或行走/);
  });
  await check('stairs advances continuously during actual inhalation and exhalation', async () => {
    await page.locator('[data-game-action="primary"]').click();
    await page.waitForTimeout(300); const early = await take();
    await page.waitForTimeout(900); const later = await take();
    assert.equal(early.state.phase, 'inhale'); assert.equal(later.state.phase, 'inhale');
    assert.ok(Number(later.position) > Number(early.position) + .35);
    assert.ok(later.rendered.x > early.rendered.x + 8);
    assert.notEqual(early.marker, later.marker);
    poses.push({ name: 'stairs-early', ...early }, { name: 'stairs-later', ...later });
    await page.locator('.game-shell[data-phase="exhale"]').waitFor();
    const exhale = await take(); assert.ok(Number(exhale.position) >= 1);
    await page.waitForTimeout(600); const exhaleLater = await take();
    assert.ok(Number(exhaleLater.position) > Number(exhale.position) + .2);
    assert.match(exhaleLater.cue, /呼气.*2 个台阶/);
    await page.locator('[data-game-meditation]').screenshot({ path: path.join(out, 'stairs-active-desktop.png') });
  });
  await check('pause freezes the scene, guide, countdown and continuous travel', async () => {
    await page.locator('[data-game-action="pause"]').click(); const paused = await take();
    await page.waitForTimeout(550); assert.deepEqual(await take(), paused);
    assert.equal(paused.motion, 'paused'); poses.push({ name: 'stairs-paused', ...paused });
  });
  await check('changing a running mode pauses without resetting elapsed time or confirmation count', async () => {
    await page.locator('[data-game-action="primary"]').click();
    await page.waitForTimeout(200); const before = await page.evaluate(() => window.demo.getState());
    await page.locator('[data-game-mode="meadow"]').click(); const changed = await take();
    assert.equal(changed.state.status, 'paused'); assert.equal(changed.state.pauseReason, 'mode-change');
    assert.ok(changed.state.roundElapsedMs >= before.roundElapsedMs);
    assert.ok(changed.state.roundElapsedMs - before.roundElapsedMs < 300);
    assert.equal(changed.state.completedCycles, before.completedCycles);
    assert.match(await page.locator('[data-meditation-summary]').textContent(), /吸气 2 秒想象 2 步，呼气 4 秒想象 4 步/);
    await page.waitForTimeout(300); assert.deepEqual(await take(), changed);
  });
  await check('the meadow light and imagined footprints follow actual 2 plus 4 step progress', async () => {
    await fresh('meadow'); await page.locator('[data-game-action="primary"]').click();
    await page.waitForTimeout(250); const early = await take();
    await page.waitForTimeout(1100); const later = await take();
    assert.ok(Number(later.position) > Number(early.position) + .8);
    assert.notEqual(early.marker, later.marker); assert.notEqual(early.footprint, later.footprint);
    assert.ok(Math.hypot(later.rendered.x - early.rendered.x, later.rendered.y - early.rendered.y) > 4, JSON.stringify({early:early.rendered,later:later.rendered}));
    await page.locator('.game-shell[data-phase="exhale"]').waitFor();
    const exhale = await take(); assert.ok(Number(exhale.position) >= 2);
    await page.waitForTimeout(500); const exhaleLater = await take();
    assert.ok(Number(exhaleLater.position) > Number(exhale.position) + .3);
    assert.match(exhaleLater.cue, /呼气.*4 步/);
    poses.push({ name: 'meadow-early', ...early }, { name: 'meadow-later', ...later }, { name: 'meadow-exhale', ...exhaleLater });
    await page.locator('[data-game-meditation]').screenshot({ path: path.join(out, 'meadow-active-desktop.png') });
  });
  await check('travel waits for self confirmation and remains continuous into the next round', async () => {
    await page.locator('.game-shell[data-status="awaiting-confirmation"]').waitFor({ timeout: 7000 });
    const end = await take(); assert.equal(end.position, '6.0000');
    await page.waitForTimeout(500); assert.deepEqual(await take(), end);
    assert.equal(await page.evaluate(() => window.result), undefined);
    await page.locator('[data-game-action="primary"]').click(); const next = await take();
    assert.equal(next.state.completedCycles, 1); assert.ok(Number(next.position) >= 6 && Number(next.position) < 6.2);
    await page.locator('.game-shell[data-status="awaiting-confirmation"]').waitFor({ timeout: 7000 });
    await page.locator('[data-game-action="primary"]').click();
    const record = await page.evaluate(() => window.result);
    assert.equal(record.activityMode, 'meadow'); assert.equal(record.completedCycles, 2);
    assert.equal(record.activeDurationMs, 12000); assert.equal(record.selfReported, true);
    assert.equal((await take()).position, '12.0000');
  });
  await check('reduced motion retains a static scene and legible breathing text', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const mode of ['stairs', 'meadow']) {
      await fresh(mode); await page.locator('[data-game-action="primary"]').click();
      await page.waitForTimeout(200); const early = await take();
      await page.waitForTimeout(2400); const later = await take();
      assert.equal(early.marker, later.marker); assert.equal(early.camera, later.camera);
      assert.equal(early.footprint, later.footprint); assert.equal(later.motion, 'reduced');
      assert.match(later.cue, /呼气/); assert.match(await page.locator('[data-meditation-note]').textContent(), /已减少动效/);
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await check('leaving the page pauses meditation and returning does not silently resume', async () => {
    await fresh('stairs'); await page.locator('[data-game-action="primary"]').click(); await page.waitForTimeout(500);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const paused = await take(); assert.equal(paused.state.pauseReason, 'hidden');
    await page.waitForTimeout(350); assert.deepEqual(await take(), paused);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal((await take()).state.status, 'paused');
  });
  await check('mode return preserves detailed mouth, abdomen and hands, and stop freezes meditation', async () => {
    await page.locator('[data-game-mode="demonstration"]').click();
    assert.ok(await page.locator('.game-demonstration').isVisible()); assert.equal(await page.locator('[data-game-meditation]').isVisible(), false);
    await page.locator('[data-game-pose="exhale"]').click(); assert.equal(await page.locator('[data-game-patient]').getAttribute('data-motion'), 'inspection');
    await page.locator('[data-game-mode="stairs"]').click();
    assert.equal(await page.locator('.game-shell').getAttribute('data-inspection'), 'false');
    await page.locator('[data-game-action="primary"]').click(); await page.waitForTimeout(450);
    await page.locator('[data-game-action="stop"]').click(); const stopped = await take();
    await page.waitForTimeout(400); assert.deepEqual(await take(), stopped);
    assert.equal(stopped.state.status, 'stopped'); assert.equal(stopped.state.completedCycles, 0);
  });
  await check('mode choices, scene, instructions and controls fit desktop and 320px large text', async () => {
    for (const mode of ['stairs', 'meadow']) for (const width of [1440, 390, 320]) for (const large of [false, true]) {
      await page.setViewportSize({ width, height: 1100 }); await fresh(mode);
      await page.evaluate(large => document.body.classList.toggle('senior-mode', large), large);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const buttons = await page.locator('[data-game-mode]').evaluateAll(nodes => nodes.map(n => ({ width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height })));
      assert.ok(buttons.every(button => button.width >= 44 && button.height >= 46));
      layouts.push({ mode, width, large, buttons });
      if (width !== 1440 || !large) await page.screenshot({ path: path.join(out, `${mode}-${width}-${large ? 'large' : 'normal'}.png`), fullPage: true });
    }
  });
  await check('keyboard mode selection has a visible focus, and disposal clears all scene nodes', async () => {
    await fresh(); await page.locator('[data-game-mode="meadow"]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-game-mode="meadow"]').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('[data-game-mode="meadow"]').evaluate(n => getComputedStyle(n).outlineStyle !== 'none'));
    const svgs = await page.locator('[data-meditation-scene]').evaluateAll(nodes => nodes.map(n => n.outerHTML));
    for (let i = 0; i < svgs.length; i++) await writeFile(path.join(out, `scene-${i}.svg`), svgs[i]);
    await page.locator('[data-game-action="primary"]').click(); await page.evaluate(() => window.demo.dispose());
    await page.waitForTimeout(250); assert.equal(await page.locator('.game-shell').count(), 0);
  });
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ passed: checks.length, failed: 0, checks, poses, layouts, scriptErrors: errors, thirdPartyRequests: remote, testedAt: new Date().toISOString(), browser: browser.version(), scope: 'Production game and meditation modules with production styles; synthetic 2/4-second two-round configuration and actual monotonic browser timing. Full app clinical gates remain outside this direct-mount fixture.' }, null, 2));
  console.log(`PASS ${checks.length} meditation checks`);
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
