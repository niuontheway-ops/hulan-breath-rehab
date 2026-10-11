import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const {chromium} = require('playwright');
const out = path.join(root, '.qa', 'mobile-home-screen');
await mkdir(out, {recursive: true});
const checks = [], layouts = [], errors = [], remote = [];
const resources = ['mobile-install.mjs', 'mobile-install.css', 'styles.css', 'manifest.webmanifest', 'assets/mobile/icon-192.png', 'assets/mobile/icon-512.png', 'assets/mobile/apple-touch-icon.png'];
const fixture = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="manifest" href="manifest.webmanifest"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="mobile-install.css"><style>body{padding:16px;background:#f7faf7}main{max-width:680px;margin:auto}</style><title>手机主屏幕入口检查</title></head><body><main id="fixture"></main><script type="module">import {mountMobileInstall} from './mobile-install.mjs';window.mount=()=>window.dispose=mountMobileInstall(document.querySelector('#fixture'));window.mount();</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/hulan-breath-rehab/fixture.html') {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});res.end(fixture);return;
    }
    const file = pathname.replace(/^\/hulan-breath-rehab\//, '');
    if (!resources.includes(file)) {res.writeHead(404);res.end();return;}
    const mime = file.endsWith('.css') ? 'text/css' : file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'application/manifest+json';
    res.writeHead(200, {'content-type': mime});res.end(await readFile(path.join(root, file)));
  } catch {res.writeHead(500);res.end();}
});
await new Promise((resolve, reject) => {server.once('error', reject);server.listen(0, '127.0.0.1', resolve);});
const base = `http://127.0.0.1:${server.address().port}`;
const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const browser = await chromium.launch({headless: true});
let context, page;

async function fresh(userAgent = androidUA, standalone = false) {
  await context?.close();
  context = await browser.newContext({viewport: {width: 390, height: 900}, locale: 'zh-CN', userAgent});
  await context.addInitScript(({standalone}) => {
    const nativeMatch = window.matchMedia.bind(window);
    let fromHome = standalone;
    const mediaListeners = new Set();
    const media = {get matches() {return fromHome;}, media: '(display-mode: standalone)', addEventListener: (name, listener) => mediaListeners.add(listener), removeEventListener: (name, listener) => mediaListeners.delete(listener)};
    window.matchMedia = query => query === '(display-mode: standalone)' ? media : nativeMatch(query);
    window.setStandalone = value => {fromHome = value;for (const listener of mediaListeners) listener({matches: value});};
    window.mediaListenerCount = () => mediaListeners.size;
    const tracked = new Map([['beforeinstallprompt', new Set()], ['appinstalled', new Set()]]);
    const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, ...args) => {tracked.get(type)?.add(listener);return add(type, listener, ...args);};
    window.removeEventListener = (type, listener, ...args) => {tracked.get(type)?.delete(listener);return remove(type, listener, ...args);};
    window.installListenerCount = () => [...tracked.values()].reduce((total, listeners) => total + listeners.size, 0);
    window.promptCalls = 0;
    window.dispatchPrompt = (outcome, reject = false, pending = false) => {
      const event = new Event('beforeinstallprompt', {cancelable: true});
      event.prompt = () => {window.promptCalls++;return reject ? Promise.reject(new Error('prompt unavailable')) : Promise.resolve();};
      event.userChoice = pending ? new Promise(resolve => window.resolveChoice = resolve) : Promise.resolve({outcome});
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
  }, {standalone});
  page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', request => {if (!request.url().startsWith(base)) remote.push(request.url());});
  await page.goto(`${base}/hulan-breath-rehab/fixture.html`);
  await page.locator('.mobile-install').waitFor();
}
async function check(name, fn) {await fn();checks.push(name);console.log(`PASS ${name}`);}
const state = () => page.locator('.mobile-install').getAttribute('data-install-state');
const action = () => page.locator('[data-mobile-install-action]');

try {
  await fresh();
  await check('manual Android instructions remain usable without an install event', async () => {
    assert.equal(await state(), 'manual');
    await action().click();
    assert.equal(await action().getAttribute('aria-expanded'), 'true');
    assert.match(await page.locator('[data-mobile-install-steps]').innerText(), /添加到主屏幕/);
    assert.equal(await page.evaluate(() => window.promptCalls), 0);
    await action().click();assert.equal(await action().getAttribute('aria-expanded'), 'false');
  });
  await check('native prompt is captured and invoked once by a user click; cancellation gives instructions', async () => {
    assert.equal(await page.evaluate(() => window.dispatchPrompt('dismissed')), true);
    assert.equal(await state(), 'ready');
    assert.equal(await page.evaluate(() => window.promptCalls), 0);
    await action().click();await page.waitForFunction(() => document.querySelector('.mobile-install').dataset.installState === 'manual');
    assert.equal(await page.evaluate(() => window.promptCalls), 1);
    assert.match(await page.locator('[data-mobile-install-status]').innerText(), /已取消/);
    assert.equal(await action().getAttribute('aria-expanded'), 'true');
    await action().click();assert.equal(await page.evaluate(() => window.promptCalls), 1);
  });
  await check('fresh prompt after dismissal can confirm; appinstalled is distinguished from standalone', async () => {
    assert.equal(await page.evaluate(() => window.dispatchPrompt('accepted')), true);
    await action().click();await page.waitForFunction(() => document.querySelector('.mobile-install').dataset.installState === 'confirmed');
    assert.equal(await page.evaluate(() => window.promptCalls), 2);
    assert.match(await page.locator('[data-mobile-install-status]').innerText(), /已确认添加/);
    assert.doesNotMatch(await page.locator('[data-mobile-install-description]').innerText(), /已从手机桌面/);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    assert.equal(await state(), 'installed');assert.equal(await action().isVisible(), false);
    await page.evaluate(() => window.setStandalone(true));
    assert.equal(await state(), 'standalone');assert.match(await page.locator('[data-mobile-install-description]').innerText(), /已从手机桌面/);
  });
  await fresh();
  await check('unavailable prompt gives a manual fallback', async () => {
    await page.evaluate(() => window.dispatchPrompt('dismissed', true));await action().click();
    await page.waitForFunction(() => document.querySelector('.mobile-install').dataset.installState === 'manual');
    assert.match(await page.locator('[data-mobile-install-status]').innerText(), /未能打开安装提示/);
    assert.equal(await action().getAttribute('aria-expanded'), 'true');
  });
  await check('repeat mounts retain one pair of window listeners and one media listener', async () => {
    await page.evaluate(() => {window.previousDispose = window.dispose;window.mount();});
    assert.equal(await page.evaluate(() => window.installListenerCount()), 2);
    assert.equal(await page.evaluate(() => window.mediaListenerCount()), 1);
    await page.evaluate(() => window.previousDispose());assert.equal(await page.locator('.mobile-install').count(), 1);
  });
  await check('pending prompt cannot update a disposed mount or consume a second click', async () => {
    await page.evaluate(() => window.dispatchPrompt('accepted', false, true));await action().click();
    assert.equal(await action().isDisabled(), true);assert.equal(await state(), 'prompting');
    await page.evaluate(() => {window.dispose();window.resolveChoice({outcome: 'accepted'});});
    assert.equal(await page.locator('.mobile-install').count(), 0);
    assert.equal(await page.evaluate(() => window.installListenerCount()), 0);
    assert.equal(await page.evaluate(() => window.mediaListenerCount()), 0);
    assert.equal(await page.evaluate(() => window.dispatchPrompt('accepted')), false);
  });
  await fresh(iphoneUA);
  await check('Safari instructions use the actual Share and Add to Home Screen path', async () => {
    assert.equal(await page.evaluate(() => window.dispatchPrompt('accepted')), false);
    await action().click();
    const text = await page.locator('[data-mobile-install-steps]').innerText();
    assert.match(text, /Safari.*分享/);assert.match(text, /添加到主屏幕/);assert.match(text, /作为网页 App/);
    await page.screenshot({path: path.join(out, 'iphone-390.png'), fullPage: true});
  });
  await fresh(iphoneUA.replace('Version/18.0', 'CriOS/131.0.0.0'));
  await check('iOS third-party browser points to Safari', async () => {
    await action().click();assert.match(await page.locator('[data-mobile-install-steps]').innerText(), /先在 Safari 浏览器中打开本页/);
  });
  await fresh(`${androidUA} MicroMessenger/8.0.50`);
  await check('embedded browser does not capture an install prompt and explains external-browser opening', async () => {
    assert.equal(await page.evaluate(() => window.dispatchPrompt('accepted')), false);
    await action().click();assert.match(await page.locator('[data-mobile-install-steps]').innerText(), /在浏览器打开/);
  });
  await fresh(androidUA, true);
  await check('standalone mode hides add action and display-mode changes clear obsolete state', async () => {
    assert.equal(await state(), 'standalone');assert.equal(await action().isVisible(), false);
    await page.evaluate(() => window.setStandalone(false));
    assert.equal(await state(), 'manual');assert.equal(await action().isVisible(), true);
    assert.equal(await page.locator('[data-mobile-install-status]').innerText(), '');
  });
  await fresh(desktopUA);
  await check('desktop fallback directs patients to their phone rather than installing a computer app', async () => {
    assert.equal(await page.evaluate(() => window.dispatchPrompt('accepted')), false);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));assert.equal(await state(), 'manual');
    await action().click();assert.match(await page.locator('[data-mobile-install-platform]').innerText(), /患者的手机/);
  });
  await fresh(desktopUA, true);
  await check('desktop standalone window remains a phone instruction entry rather than a mobile launch success', async () => {
    assert.equal(await page.evaluate(() => window.matchMedia('(display-mode: standalone)').matches), true);
    assert.equal(await state(), 'manual');assert.equal(await action().isVisible(), true);
    assert.doesNotMatch(await page.locator('[data-mobile-install-description]').innerText(), /已从手机桌面/);
    assert.doesNotMatch(await page.locator('[data-mobile-install-status]').innerText(), /手机桌面模式/);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));assert.equal(await state(), 'manual');
    await action().click();assert.match(await page.locator('[data-mobile-install-platform]').innerText(), /患者的手机/);
  });
  await fresh();
  await check('keyboard focus is visible and guide toggling is announced', async () => {
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(() => document.activeElement.matches('[data-mobile-install-action]')), true);
    assert.equal(await action().evaluate(button => getComputedStyle(button).outlineWidth), '3px');
    await page.keyboard.press('Enter');assert.equal(await action().getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('[data-mobile-install-status]').getAttribute('aria-live'), 'polite');
  });
  await check('phone layouts reflow at 320 and 390 px with large text', async () => {
    for (const width of [390, 320]) for (const large of [false, true]) {
      await page.setViewportSize({width, height: 1000});
      await page.evaluate(large => document.body.classList.toggle('senior-mode', large), large);
      const result = await page.evaluate(() => ({viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, buttonHeight: document.querySelector('[data-mobile-install-action]').getBoundingClientRect().height, listWidth: document.querySelector('[data-mobile-install-steps]').getBoundingClientRect().width}));
      assert.ok(result.pageWidth <= result.viewport, JSON.stringify(result));assert.ok(result.buttonHeight >= 44);assert.ok(result.listWidth > 190);
      layouts.push({width, large, ...result});
      await page.screenshot({path: path.join(out, `android-${width}-${large ? 'large' : 'normal'}.png`), fullPage: true});
    }
  });
  await check('manifest resolves id, start URL and icons under the GitHub Pages project path', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
    const manifestURL = 'https://niuontheway-ops.github.io/hulan-breath-rehab/manifest.webmanifest';
    assert.equal(new URL(manifest.id, manifestURL).href, 'https://niuontheway-ops.github.io/hulan-breath-rehab/');
    assert.equal(new URL(manifest.scope, manifestURL).pathname, '/hulan-breath-rehab/');
    assert.equal(new URL(manifest.start_url, manifestURL).href, 'https://niuontheway-ops.github.io/hulan-breath-rehab/#home');
    assert.equal(manifest.display, 'standalone');assert.equal(manifest.prefer_related_applications, false);
    assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
    for (const [filename, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
      const png = await readFile(path.join(root, 'assets', 'mobile', filename));
      assert.equal(png.readUInt32BE(16), size);assert.equal(png.readUInt32BE(20), size);
    }
    const cdp = await context.newCDPSession(page);const result = await cdp.send('Page.getAppManifest');
    assert.equal(result.url, `${base}/hulan-breath-rehab/manifest.webmanifest`);assert.equal(result.errors.length, 0);assert.ok(result.data.includes('壶兰呼吸'));await cdp.detach();
  });
  await check('no page errors or remote requests occur in module verification', async () => {assert.deepEqual(errors, []);assert.deepEqual(remote, []);});
  const result = {testedAt: new Date().toISOString(), checks, layouts, errors, remote, passed: checks.length, boundaries: 'Chromium DOM/event and manifest verification using synthetic user agents and install events; no physical Android/iPhone install was performed.'};
  await writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed: result.passed, layouts: layouts.length, errors: errors.length}));
} finally {await context?.close();await browser.close();await new Promise(resolve => server.close(resolve));}
