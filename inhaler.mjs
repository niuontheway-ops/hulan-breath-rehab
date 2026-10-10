const DEVICES = [
  {
    id: 'breztri', name: '布地格福吸入剂', device: '倍择瑞 · 定量气雾剂 pMDI',
    video: 'https://www.bilibili.com/video/BV1TCqhYvEP9', videoTitle: '布地格福吸入气雾剂', videoOwner: '不是超级大会员', duration: 239,
    steps: ['取盖、检查吸嘴，直立握住并摇匀。', '先呼气，双唇包住吸嘴。', '开始缓慢深吸气，同时按下药罐；继续吸气。', '移开吸嘴，舒适地短暂屏气后慢呼气；用后漱口并吐掉。'],
    note: '首次使用、重新试喷与清洁，请按手中产品说明；清洁时药罐不能浸水。每次喷数按个人处方。',
    source: { label: 'AstraZeneca · 装置使用说明', url: 'https://www.breztri.com/using-your-inhaler' },
  },
  {
    id: 'turbuhaler', name: '布地奈德福莫特罗', device: '信必可都保 · Turbuhaler 干粉装置',
    video: 'https://www.bilibili.com/video/BV1DfrYBjEiA', videoTitle: '布地奈德福莫特罗', videoOwner: '呼吸小酥', duration: 215,
    steps: ['旋开盖子，直立握住瓶身。', '底座往返旋到底，听到咔哒声；先远离吸嘴呼气。', '双唇包紧吸嘴，快速而深地吸气，移开后轻柔呼气。', '按处方完成吸入，旋紧盖子；日常含激素剂量用后漱口并吐掉。'],
    note: '勿向装置呼气，吸嘴用干纸巾清洁，不水洗。不能凭药粉的味道判断是否吸入；装药和剂量按说明与处方。',
    source: { label: 'AstraZeneca · 患者说明书', url: 'https://www.medicines.org.uk/emc/product/1327/pil' },
  },
  {
    id: 'ellipta', name: '氟替美维吸入剂', device: '全再乐 · Ellipta 易纳器',
    video: 'https://www.bilibili.com/video/BV1UAreBCE3t', videoTitle: '氟替美维吸入粉雾剂（全再乐）', videoOwner: '呼吸小酥', duration: 196,
    steps: ['用时滑开盖子至咔哒声，核对计数窗；不要摇晃。', '远离吸嘴呼气，再包紧吸嘴，勿堵住通气孔。', '平稳、深长地吸气，移开后在舒适范围短暂屏气。', '缓慢呼气、关闭盖子；漱口并吐掉。'],
    note: '没有吸入前不要反复开关盖子，会浪费药量。吸嘴可用干纸巾擦拭；使用次数按个人处方。',
    source: { label: 'GSK · Ellipta 患者说明书', url: 'https://www.medicines.org.uk/emc/product/8666/pil' },
  },
  {
    id: 'bevespi', name: '格隆溴铵福莫特罗吸入剂', device: '百沃平 · 定量气雾剂 pMDI',
    video: 'https://www.bilibili.com/video/BV1WTraBAEfS', videoTitle: '格隆溴铵福莫特罗', videoOwner: '呼吸小酥', duration: 302,
    steps: ['取下盖子，检查吸嘴，直立握住并摇匀。', '先呼气，双唇包住吸嘴。', '缓慢深吸气，同时按下药罐，继续吸气。', '移开吸嘴，舒适地短暂屏气，再缓慢呼气；按处方完成喷数。'],
    note: '首次使用、重新试喷和清洁按手中产品说明。出现突然的呼吸困难时，按个人急救方案处理，不自行追加维持药。',
    source: { label: 'AstraZeneca · 患者与装置说明', url: 'https://medicalinformation.astrazeneca-us.com/home/prescribing-information/bevespi-aerosphere.html' },
  },
  {
    id: 'capsule', name: '噻托溴铵吸入剂', device: '胶囊型干粉吸入装置',
    video: 'https://www.bilibili.com/video/BV1UAreBCEVS', videoTitle: '噻托溴铵吸入粉剂（天晴速乐）', videoOwner: '呼吸小酥', duration: 214,
    steps: ['用前取出胶囊，放入对应装置的药室；胶囊不能吞服。', '按手中装置说明完成刺破，先远离吸嘴呼气。', '双唇包紧吸嘴，按装置要求深长吸气，舒适地屏气后呼气。', '是否需要同一胶囊再次吸入，按说明确认；吸完倒出胶囊壳，关闭装置。'],
    note: '这个原站视频演示天晴速乐。思力华 HandiHaler 等装置的按键和步骤可能不同，请先核对手中品牌；不要套用其他装置。',
    source: { label: 'DailyMed · HandiHaler 装置说明（供核对）', url: 'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=25a4cb05-64a8-44b6-88c8-4292a5292e92' },
  },
  {
    id: 'accuhaler', name: '沙美特罗氟替卡松', device: '舒利迭 · Accuhaler 准纳器',
    video: 'https://www.bilibili.com/video/BV1UjrhBTE9z', videoTitle: '沙美特罗替卡松', videoOwner: '呼吸小酥', duration: 233,
    steps: ['推开外壳，再推动滑杆至咔哒声，装好一剂。', '远离吸嘴呼气，再双唇包紧吸嘴。', '平稳、深长地吸气；移开吸嘴，舒适地屏气后慢呼气。', '推回外壳关闭；含激素，用后漱口并吐掉。'],
    note: '勿向吸嘴呼气，不玩弄滑杆反复装药。保持装置干燥，吸入次数与剂量按个人处方。',
    source: { label: 'GSK · Accuhaler 产品说明', url: 'https://www.medicines.org.uk/emc/product/5504/smpc' },
  },
];

export const INHALER_DEVICES = Object.freeze(DEVICES.map(({ id, name, device }) => Object.freeze({ id, name, device })));

/** Returns device teaching data without assigning a medication or dose. */
export function getInhaler(id) {
  const data = DEVICES.find(item => item.id === id) || DEVICES[0];
  return { ...data, steps: [...data.steps], source: { ...data.source }, image: { src: 'assets/chapters/inhaler.svg', alt: '吸入器操作教学示意图' }, checked: '2026-10-11' };
}

/** No external request occurs until the patient chooses an external video link. */
export function mountInhaler(container, { initialDevice = 'breztri' } = {}) {
  if (!container || typeof container.replaceChildren !== 'function' || !container.ownerDocument) throw new TypeError('mountInhaler requires a DOM container.');
  const document = container.ownerDocument;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const link = (text, url, className = 'text-link') => {
    const node = element('a', text, className);
    node.href = url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  };
  const picker = element('div', '', 'edu-topic-picker inhaler-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', '选择手上的吸入剂');
  const panel = element('div', '', 'inhaler-panel');
  panel.setAttribute('aria-live', 'polite');
  let currentId = getInhaler(initialDevice).id;
  let disposed = false;
  const buttons = INHALER_DEVICES.map(data => {
    const button = element('button', data.name);
    button.type = 'button';
    button.dataset.inhaler = data.id;
    button.title = data.device;
    picker.append(button);
    return button;
  });
  function render() {
    const data = getInhaler(currentId);
    for (const button of buttons) {
      const active = button.dataset.inhaler === currentId;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    }
    const heading = element('h3', data.name);
    const device = element('p', data.device, 'edu-intro');
    const media = element('article', '', 'inhaler-media-card');
    const picture = element('img', '', 'inhaler-picture');
    picture.src = data.image.src;
    picture.alt = data.image.alt;
    picture.width = 640;
    picture.height = 360;
    picture.loading = 'lazy';
    const mediaBody = element('div', '', 'inhaler-media-body');
    mediaBody.append(element('h4', '看原有操作视频'),
      element('p', data.videoTitle),
      link('▶ 打开操作视频', data.video, 'btn-primary inhaler-video-link'),
      element('p', '在哔哩哔哩打开，需联网。', 'field-help'));
    media.append(picture, mediaBody);
    const list = element('ol', '', 'inhaler-steps');
    data.steps.forEach(text => list.append(element('li', text)));
    const caution = element('aside', '', 'edu-emergency inhaler-caution');
    caution.append(element('h4', '先核对手中的装置'), element('p', data.note));
    const sources = element('details', '', 'edu-more');
    sources.append(element('summary', '装置说明与视频来源'),
      element('p', `原站外部视频 · ${data.videoOwner} · ${Math.floor(data.duration / 60)}分${String(data.duration % 60).padStart(2, '0')}秒。不是已核实的医院官方账号。`),
      link('原站视频页', data.video), element('p', '以下为同类装置的厂家或药品说明。不同地区产品、首次准备、清洁与用法可能不同，以手中说明和医护示范为准。'),
      link(data.source.label, data.source.url), element('p', '核对：2026-10-11。这里只教操作方法，不推荐选药或给出统一剂量。', 'edu-sources'));
    panel.replaceChildren(heading, device, media, element('h4', '记住这 4 步'), list, caution, sources);
  }
  const onClick = event => {
    if (disposed) return;
    const button = event.target?.closest?.('button[data-inhaler]');
    if (!button || !picker.contains(button) || button.dataset.inhaler === currentId) return;
    currentId = getInhaler(button.dataset.inhaler).id;
    render();
  };
  picker.addEventListener('click', onClick);
  container.replaceChildren(picker, panel);
  render();
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      picker.removeEventListener('click', onClick);
      picker.remove();
      panel.remove();
    },
  };
}
