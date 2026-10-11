const mounted = new WeakMap();
let nextGuideId = 0;

function getPlatform(win) {
  const nav = win.navigator;
  const ua = nav.userAgent || '';
  const ios = /iPad|iPhone|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const embedded = /MicroMessenger|FBAN|FBAV|Instagram|Line\//i.test(ua);
  const safari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|MicroMessenger/i.test(ua);
  return {ios, android, embedded, safari};
}

function instructions(platform) {
  if (platform.ios) return {
    label: platform.safari ? 'iPhone / iPad · Safari' : 'iPhone / iPad',
    steps: [
      platform.safari ? '点 Safari 的“分享”按钮。' : '先在 Safari 浏览器中打开本页，再点“分享”。',
      '选择“添加到主屏幕”。',
      '点“添加”。若有“作为网页 App 打开”，保持开启。'
    ],
    note: '找不到“分享”？先点地址栏旁的页面菜单。'
  };
  if (platform.android) return {
    label: '安卓手机',
    steps: platform.embedded ? [
      '先用菜单中的“在浏览器打开”打开本页。',
      '点浏览器右上角菜单，选择“添加到主屏幕”或“安装应用”。',
      '点“添加”或“安装”。'
    ] : [
      '点浏览器右上角的菜单。',
      '选择“添加到主屏幕”或“安装应用”。',
      '点“添加”或“安装”。'
    ],
    note: '菜单名称可能不同。找不到时，可用 Chrome 打开本页。'
  };
  return {
    label: '请在患者的手机上操作',
    steps: ['用手机扫码打开此网页。', '安卓：浏览器菜单 → 添加到主屏幕。', 'iPhone：Safari 分享 → 添加到主屏幕。'],
    note: '下次轻点手机上的“壶兰呼吸”图标即可打开。'
  };
}

/** Mount one home-screen entry. The returned function removes its listeners and content. */
export function mountMobileInstall(container) {
  if (!container?.ownerDocument) throw new TypeError('A DOM container is required.');
  mounted.get(container)?.();
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const platform = getPlatform(win);
  const guide = instructions(platform);
  const media = win.matchMedia('(display-mode: standalone)');
  const guideId = `mobile-install-guide-${++nextGuideId}`;
  let disposed = false;
  let deferred = null;
  let prompting = false;
  let installed = false;
  let confirmed = false;
  const standalone = () => (platform.android || platform.ios) && (media.matches || win.navigator.standalone === true);

  container.innerHTML = `<section class="mobile-install" aria-label="添加到手机桌面">
    <div class="mobile-install-heading">
      <img class="mobile-install-icon" src="assets/mobile/apple-touch-icon.png" alt="壶兰呼吸" width="64" height="64">
      <div><h2>添加到手机桌面</h2><p data-mobile-install-description>轻点图标，直接打开。</p></div>
    </div>
    <button type="button" class="mobile-install-button" data-mobile-install-action aria-expanded="false" aria-controls="${guideId}">添加到手机桌面<span aria-hidden="true">＋</span></button>
    <p class="mobile-install-status" data-mobile-install-status role="status" aria-live="polite"></p>
    <div class="mobile-install-guide" id="${guideId}" data-mobile-install-guide hidden tabindex="-1">
      <p class="mobile-install-platform" data-mobile-install-platform></p>
      <ol data-mobile-install-steps></ol>
      <p class="mobile-install-note" data-mobile-install-note></p>
    </div>
    <p class="mobile-install-network">打开网页和视频需要网络。</p>
  </section>`;
  const section = container.querySelector('.mobile-install');
  const button = section.querySelector('[data-mobile-install-action]');
  const status = section.querySelector('[data-mobile-install-status]');
  const description = section.querySelector('[data-mobile-install-description]');
  const guidePanel = section.querySelector('[data-mobile-install-guide]');
  section.querySelector('[data-mobile-install-platform]').textContent = guide.label;
  section.querySelector('[data-mobile-install-note]').textContent = guide.note;
  const steps = section.querySelector('[data-mobile-install-steps]');
  for (const text of guide.steps) {
    const item = doc.createElement('li');
    item.textContent = text;
    steps.append(item);
  }

  function setGuide(open, focus = false) {
    guidePanel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && focus) guidePanel.focus({preventScroll: true});
  }

  function render() {
    if (disposed) return;
    const fromHome = standalone();
    section.dataset.installState = fromHome ? 'standalone' : installed ? 'installed' : confirmed ? 'confirmed' : prompting ? 'prompting' : deferred ? 'ready' : 'manual';
    button.hidden = fromHome || installed || confirmed;
    button.disabled = prompting;
    if (fromHome || installed || confirmed) {
      setGuide(false);
      description.textContent = fromHome ? '已从手机桌面打开。' : installed ? '下次从“壶兰呼吸”图标进入。' : '请等待手机完成添加。';
      status.textContent = fromHome ? '手机桌面模式' : installed ? '已添加到手机桌面。' : '已确认添加。';
    } else {
      description.textContent = '轻点图标，直接打开。';
      button.firstChild.textContent = prompting ? '请在手机提示中确认' : !guidePanel.hidden && !deferred ? '收起操作说明' : '添加到手机桌面';
      button.lastElementChild.textContent = guidePanel.hidden ? '＋' : '−';
    }
  }

  function capturePrompt(event) {
    if (disposed || installed || !platform.android || platform.embedded || standalone() || typeof event.prompt !== 'function') return;
    event.preventDefault();
    deferred = event;
    confirmed = false;
    status.textContent = '';
    render();
  }

  async function activate() {
    if (disposed || prompting || installed || confirmed || standalone()) return;
    if (!deferred) {
      setGuide(guidePanel.hidden);
      render();
      return;
    }
    const event = deferred;
    deferred = null;
    prompting = true;
    status.textContent = '';
    render();
    try {
      const promptResult = await event.prompt();
      const choice = event.userChoice ? await event.userChoice : promptResult;
      if (disposed || installed || standalone()) return;
      if (choice?.outcome === 'accepted') {
        confirmed = true;
      } else {
        status.textContent = '已取消。也可以按下面步骤添加。';
        setGuide(true);
      }
    } catch {
      if (!disposed && !installed && !standalone()) {
        status.textContent = '未能打开安装提示，请按下面步骤添加。';
        setGuide(true);
      }
    } finally {
      prompting = false;
      render();
    }
  }

  function onInstalled() {
    if (disposed || (!platform.android && !platform.ios)) return;
    installed = true;
    deferred = null;
    render();
  }
  const onDisplayMode = () => {
    if (!installed && !confirmed) status.textContent = '';
    render();
  };
  win.addEventListener('beforeinstallprompt', capturePrompt);
  win.addEventListener('appinstalled', onInstalled);
  if (media.addEventListener) media.addEventListener('change', onDisplayMode);
  else media.addListener(onDisplayMode);
  button.addEventListener('click', activate);
  render();

  function dispose() {
    if (disposed) return;
    disposed = true;
    deferred = null;
    win.removeEventListener('beforeinstallprompt', capturePrompt);
    win.removeEventListener('appinstalled', onInstalled);
    if (media.removeEventListener) media.removeEventListener('change', onDisplayMode);
    else media.removeListener(onDisplayMode);
    button.removeEventListener('click', activate);
    if (mounted.get(container) === dispose) {
      mounted.delete(container);
      container.replaceChildren();
    }
  }
  mounted.set(container, dispose);
  return dispose;
}
