import { INHALER_MARKET } from './inhaler-market.mjs';

const checkedAt = '2026-10-19';
const ace = 'https://www.ace-hta.gov.sg/healthcare-professionals/inhaler-technique-videos/';
const source = (label, url) => ({ label, url });
const emc = (product, label) => source(label, `https://www.medicines.org.uk/emc/product/${product}/pil`);
const chineseVideo = (id, title) => ({
  url: `https://www.youtube.com/watch?v=${id}`, title, provider: '新加坡国家哮喘计划 SNAP；新加坡卫生部 ACE 收录', language: '中文', kind: 'external', verifiedAt: checkedAt,
  sourceUrl: ace, verification: 'official-listing', playbackVerified: false,
  availability: 'YouTube；本次网络无法核验播放，中国大陆网络可能无法打开。',
  scope: '同名装置的吸入技巧；首次准备、清洁及具体药物用法仍须核对本盒说明。',
});
const paperVideo = (id, title, scope = '装置日常吸入操作') => ({
  url: `https://www.thepaper.cn/newsDetail_forward_${id}`, title, provider: '复旦中山韦素兰（呼吸科主管技师本人发布）；澎湃号', language: '中文', kind: 'external', verifiedAt: checkedAt,
  sourceUrl: `https://www.thepaper.cn/newsDetail_forward_${id}`, verification: 'browser-playback', playbackVerified: true,
  availability: '国内原站，需联网；未下载转载。', scope,
});
const pmdiVideo = paperVideo('32753253', '吸入治疗——气雾剂装置使用方法', 'pMDI 手口配合示范；不同药物是否摇匀、试喷及清洁方法以本项文字和原说明为准。');
const rinse = '含吸入糖皮质激素（ICS），用后清水漱口并吐掉。';
const nonIcs = '本项药物不含 ICS；不能因此停用处方中的其他含 ICS 药物。';
const dry = ['用干纸巾或干布擦吸嘴，保持干燥；不水洗，不浸泡。'];
const hold = '移开吸嘴，在舒适范围短暂屏气，再缓慢呼气；不勉强憋气。';
const pmdiSteps = prep => [prep, '远离吸嘴缓慢呼气，双唇包紧吸嘴。', '开始缓慢、深长吸气，同时按下药罐一揿，继续吸气。', `${hold}重复喷数只按个人处方。`];
const marketFor = id => INHALER_MARKET[id] || { status: 'pending', checkedAt, label: '大陆产品证据待核', evidenceLevel: 'unconfirmed', limitations: '不凭海外可买推断大陆在售。', sources: [] };

const entries = [
  {
    id: 'breztri', name: '倍择瑞 · 布地格福', aliases: ['布地格福吸入气雾剂', 'BREZTRI', 'AEROSPHERE'], type: 'pmdi', brands: ['倍择瑞'], device: 'Aerosphere 定量气雾剂 · 混悬型',
    steps: pmdiSteps('取盖、检查吸嘴，直立握持；每揿前充分摇匀。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['核对布地格福与计数窗；不要与百沃平混淆。', '不是用于自行处理突发严重气促的替代急救药。'],
    firstUse: ['首次使用要按本盒说明预喷，每次预喷前摇匀。', '久未使用、跌落或清洗后需要重新准备，次数按本盒说明；不把预喷计作吸入治疗。'],
    cleaning: ['取出药罐后，按本品说明用温水清洁塑料外壳；药罐不能进水。', '外壳完全自然晾干后再装回药罐，按说明重新准备。'],
    checkpoints: ['每次按压前摇匀', '慢吸与按压同步', '用后漱口吐掉'], warnings: [rinse, '海外网站可能同时出现不同规格和适应症，不照搬海外剂量。'], mouthRinse: 'required',
    video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')],
    sources: [source('AstraZeneca · BREZTRI 装置使用与清洁说明', 'https://www.breztri.com/using-your-inhaler'), emc('12028', 'AstraZeneca · Trixeo Aerosphere 同装置患者说明（海外，供核对）')],
  },
  {
    id: 'turbuhaler', name: '都保 · Turbuhaler', aliases: ['信必可都保', '布地奈德福莫特罗', 'Turbohaler'], type: 'dpi', brands: ['信必可都保'], device: '旋转装药、多剂量干粉装置',
    steps: ['旋开盖子，吸嘴向上直立握住瓶身。', '底座向一侧旋到底，再转回，听到咔哒声，装入一剂。', '远离吸嘴呼气，包紧吸嘴，快速而深地吸气；不要咬吸嘴。', `${hold}旋紧盖子，核对余量。`], breathCue: '快速、深吸；不用手按喷药',
    preparation: ['核对具体药名和强度：同是都保，药物作用与处方可能不同。', '装药时保持直立，不握着吸嘴旋转；不向吸嘴吹气。'],
    firstUse: ['信必可新装置需按说明完成首次准备的往返旋转，再按每次装药步骤操作。', '不同药品都保的首次步骤以本盒说明为准，不能凭底座颜色判断剂量。'], cleaning: dry,
    checkpoints: ['直立装药', '转到底并听到咔哒', '快速深吸，勿吹气'], warnings: ['信必可含 ICS，用后清水漱口并吐掉。', '吸不到味道不代表没吸到，不因此自行多吸。'], mouthRinse: 'required',
    video: paperVideo('32746774', '吸入治疗一——都保装置使用方法'), videoOptions: [chineseVideo('lpPqqRcDdTs', '如何使用 Turbuhaler（中文）')], sources: [emc('1327', 'AstraZeneca · Symbicort Turbohaler 患者说明')],
  },
  {
    id: 'ellipta', name: '易纳器 · Ellipta', aliases: ['全再乐', '欧乐欣', '乌美溴铵维兰特罗', '氟替美维'], type: 'dpi', brands: ['全再乐', '欧乐欣'], device: '滑盖装药、多剂量干粉装置',
    steps: ['用时将滑盖向下完全推开至咔哒声，计数减一；不要摇晃。', '远离装置呼气，包紧吸嘴，不挡住通气孔。', '平稳、深长地吸气，移开后舒适屏气。', '缓慢呼气，用干纸巾擦吸嘴，滑盖关闭。'], breathCue: '平稳、深长地吸气',
    preparation: ['只在准备吸药时开盖，不反复开关来“试装药”。', '核对药名：全再乐含 ICS；欧乐欣不含 ICS。'],
    firstUse: ['用前打开密封托盘，记录开封日期，按本盒标示的开封有效期使用。', '无需预喷或另外扳滑杆；滑开盖子就准备一剂。'], cleaning: dry,
    checkpoints: ['滑盖完全打开', '不堵通气孔', '不反复开关浪费药'], warnings: ['全再乐用后清水漱口并吐掉；欧乐欣不含 ICS。', '不要套用准纳器的推杆动作；易纳器只需将盖完全滑开。'], mouthRinse: 'conditional',
    video: { url: 'https://videos.gskstatic.com/pharma/GSKpro/Ireland/MP4/ellipta-how-to-video-update-2023-pm-ie-cau-vid-210001.mp4', title: 'How to use Ellipta inhaler · 易纳器动画示范', provider: 'GSK 爱尔兰公开患者教育网站', language: '英语', kind: 'external', verifiedAt: checkedAt, sourceUrl: 'https://public.gsk.ie/products/Ellipta.html', verification: 'browser-playback', playbackVerified: true, availability: '海外厂家公开视频原地址，非 YouTube；本次网络实际播放通过。需联网，医院网络仍需现场核对。', scope: 'Ellipta 专属动画；配合本页中文步骤，不照搬海外药物剂量。' }, videoOptions: [chineseVideo('cz2xh5LLv0A', '如何使用 Ellipta（中文）')], sources: [source('HealthHub · Ellipta 装置说明', 'https://www.healthhub.sg/medication-devices-and-treatment/medications/ellipta-inhaler'), source('GSK · Ellipta 公开示范视频发布页', 'https://public.gsk.ie/products/Ellipta.html')],
  },
  {
    id: 'bevespi', name: '百沃平 · 格隆溴铵福莫特罗', aliases: ['格隆溴铵福莫特罗吸入气雾剂', 'BEVESPI', 'AEROSPHERE'], type: 'pmdi', brands: ['百沃平'], device: 'Aerosphere 定量气雾剂 · 混悬型',
    steps: pmdiSteps('取盖、检查吸嘴，直立握持；每揿前充分摇匀。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['核对百沃平与计数窗；与布地格福不是同一种药。', '不能自行追加维持药来替代急救方案。'], firstUse: ['首次使用、久未使用、跌落或清洗后的试喷，按百沃平本盒说明完成。'],
    cleaning: ['按百沃平说明清洁塑料外壳；金属药罐不能浸水。', '外壳完全自然晾干后组装，并按说明重新准备。'], checkpoints: ['每揿前摇匀', '慢吸与按压同步', '检查剩余量'], warnings: [nonIcs, '通用 pMDI 视频只示范手口配合，清洁和试喷需看百沃平说明。'], mouthRinse: 'conditional',
    video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')], sources: [source('AstraZeneca · BEVESPI 患者装置视频（海外，可能受地区访问限制）', 'https://www.bevespiaerosphere.com/how-to-use-bevespi-inhaler')],
  },
  {
    id: 'capsule', name: '天晴速乐 · 专用胶囊吸入器', aliases: ['噻托溴铵粉吸入剂', '正大天晴', '天晴速乐'], type: 'capsule', brands: ['天晴速乐'], device: '天晴速乐配套胶囊型干粉装置',
    steps: ['临用取出一粒胶囊，打开配套吸入器，将胶囊放入胶囊腔，不能放进吸嘴。', '关闭吸嘴，按本品装置说明完成刺孔，再放开按钮。', '远离装置呼气；双唇包紧吸嘴，按本品要求深长吸气，听胶囊振动声。', `${hold}按说明检查胶囊余粉，必要时再吸同一胶囊；吸完倒出空壳。`], breathCue: '按天晴速乐配套说明深长吸入',
    preparation: ['只配天晴速乐自带吸入器，不与 HandiHaler、比斯海乐或其他国产胶囊器混用。', '干手取胶囊，临用再拆，胶囊不能吞服。'], firstUse: ['先让医护以实物核对胶囊腔、刺针按钮和吸入方式；不要按其他品牌视频猜刺孔动作。'],
    cleaning: ['倒净空胶囊壳与残粉；是否可拆洗及干燥时间严格按天晴速乐吸入器说明。', '不得直接套用 HandiHaler 的水洗方法。'], checkpoints: ['胶囊入药室，不能吞', '刺孔后放开按钮', '吸完取出空壳'], warnings: [nonIcs, '本项只对应天晴速乐，不代表所有噻托溴铵仿制品装置相同。'], mouthRinse: 'conditional',
    video: { url: 'https://www.hlyykp.com/details/525/video', title: '噻托溴铵粉吸入剂——天晴速乐', provider: '药立方；苏州市立医院主管药师徐金慧', language: '中文', kind: 'external', verifiedAt: checkedAt, sourceUrl: 'https://www.hlyykp.com/details/525/video', verification: 'browser-playback', playbackVerified: true, availability: '国内原站，需联网；未下载转载。', scope: '天晴速乐配套装置' },
    videoOptions: [], sources: [source('苏州市立医院药师 · 天晴速乐操作示范', 'https://www.hlyykp.com/details/525/video')],
  },
  {
    id: 'accuhaler', name: '准纳器 · Accuhaler', aliases: ['舒利迭', '沙美特罗替卡松', 'Diskus', 'Seretide'], type: 'dpi', brands: ['舒利迭'], device: '扳杆装药、多剂量干粉装置',
    steps: ['拇指推开外壳到尽头，吸嘴朝向自己；保持水平。', '推动滑杆至咔哒声，装好一剂；远离吸嘴呼气。', '包紧吸嘴，平稳、深长地吸气。', `${hold}将拇指柄推回关闭；用后漱口并吐掉。`], breathCue: '平稳、深长地吸气',
    preparation: ['先推外壳、再推滑杆；不反复玩弄滑杆。', '核对计数窗与药物，不把国产不同装置仅按相同成分归到本项。'], firstUse: ['无需预喷；首次同样打开外壳、推杆准备一剂。'], cleaning: dry,
    checkpoints: ['装一剂只推一次杆', '先呼气再含住', '不朝装置吹气'], warnings: [rinse, '合并视频中易纳器的滑盖动作不能替代准纳器推杆。'], mouthRinse: 'required',
    video: paperVideo('32746782', '吸入治疗三——准纳器或易纳器使用方法', '视频含两种装置；准纳器需推外壳、再推滑杆。'), videoOptions: [chineseVideo('tforgsquZ1E', '如何使用 Accuhaler（中文）')], sources: [source('HealthHub · Accuhaler 装置说明', 'https://www.healthhub.sg/medication-devices-and-treatment/medications/accuhalers'), emc('5504', 'GSK · Seretide Accuhaler 患者说明')],
  },
  {
    id: 'respimat', name: '能倍乐 · Respimat', aliases: ['思力华能倍乐', '思合华能倍乐', '噻托溴铵吸入喷雾剂', '噻托溴铵奥达特罗', '软雾'], type: 'smi', brands: ['思力华能倍乐', '思合华能倍乐'], device: '机械软雾吸入装置',
    steps: ['盖子关闭，按箭头方向将透明底座转半圈至咔哒声。', '完全打开盖子，远离吸嘴缓慢呼气。', '包紧吸嘴，不挡两侧通气孔；缓慢深吸气，同时按下释放按钮，继续吸气。', `${hold}关闭盖子；若处方需另一揿，重新“转、开、按”。`], breathCue: '慢而深吸气，同时按下按钮',
    preparation: ['核对思力华或思合华；同属能倍乐但药物不同。', '不是干粉装置，也不是电子雾化机；吸气仍需与按钮配合。'],
    firstUse: ['按本盒版本装入药筒、装回透明底座；药筒装入前不要空转底座。', '朝地面完成“转、开、按”至喷出可见雾，再按本盒说明追加准备次数。', '久未用后的重新准备，以及一次性/可重复用版本的药筒更换方式，以本盒说明为准。'],
    cleaning: ['至少每周用湿布擦吸嘴内外，包括吸嘴内金属部分；不为清洁拔出药筒。'], checkpoints: ['先转再开', '不堵通气孔', '吸气同时按，持续慢吸'], warnings: [nonIcs, '短视频主要示范日常吸入，完整首次安装仍要看配套说明或医护示范。'], mouthRinse: 'conditional',
    video: paperVideo('32746780', '吸入治疗二——能倍乐装置使用方法'), videoOptions: [chineseVideo('SefxszKlLVM', '如何使用 Respimat（中文）')], sources: [source('HealthHub · Respimat 使用与清洁', 'https://www.healthhub.sg/medication-devices-and-treatment/medications/respimat-inhalers'), source('Boehringer Ingelheim · Spiriva Respimat IFU', 'https://docs.boehringer-ingelheim.com/Prescribing%20Information/PIs/Spiriva%20Respimat/spirivarespimat.pdf')],
  },
  {
    id: 'handihaler', name: '吸乐 · HandiHaler', aliases: ['思力华吸乐', '思力华胶囊', '噻托溴铵粉吸入剂', 'Handihaler'], type: 'capsule', brands: ['思力华吸乐'], device: '思力华专用胶囊型干粉装置',
    steps: ['打开防尘盖和吸嘴，临用取出胶囊放入中央药室，关好吸嘴。', '吸嘴向上，按绿色刺孔按钮一次到底，再完全松开。', '远离吸嘴呼气；包紧吸嘴，缓慢、深长吸气，使胶囊振动，再舒适屏气后呼气。', '同一胶囊再吸一次以吸尽药粉；倒出胶囊壳，关闭吸嘴和盖子。'], breathCue: '缓慢、深长吸气，让胶囊振动',
    preparation: ['只用本品胶囊配 HandiHaler，不吞胶囊，不放入吸嘴。', '不以 Breezhaler 的快速吸法替代本装置慢深吸。'], firstUse: ['首次先认识绿色按钮和中央药室，只有放好胶囊才刺孔；不要反复刺孔。'],
    cleaning: ['按原说明定期打开防尘盖、吸嘴和底座，以温水去除残粉。', '充分自然晾干后才用，通常需约24小时；不要湿着装胶囊。'], checkpoints: ['绿色按钮只刺一次', '慢而深吸', '同一胶囊吸两次'], warnings: [nonIcs, '本项不是天晴速乐、彼多益或其他国产胶囊器的通用说明。'], mouthRinse: 'conditional',
    video: { url: 'https://www.nationalasthma.org.au/how-to-videos/how-to-use-handihaler', title: 'How to use HandiHaler', provider: '澳大利亚国家哮喘委员会', language: '英语', kind: 'external', verifiedAt: checkedAt, sourceUrl: 'https://www.nationalasthma.org.au/how-to-videos/how-to-use-handihaler', verification: 'official-player', playbackVerified: false, availability: '海外原站 Vimeo 播放器；医院网络可能受限。', scope: 'HandiHaler 专属装置示范；本页有中文步骤。' }, videoOptions: [],
    sources: [source('National Asthma Council Australia · HandiHaler 示范', 'https://www.nationalasthma.org.au/how-to-videos/how-to-use-handihaler'), source('National Asthma Council Australia · 装置清洁区别', 'https://www.nationalasthma.org.au/resources/puffer-and-inhaler-care')],
  },
  {
    id: 'breezhaler', name: '比斯海乐 · Breezhaler', aliases: ['杰润', '恩明润', '恩卓润', '茚达特罗格隆溴铵', '茚达格莫', '茚达特罗莫米松'], type: 'capsule', brands: ['杰润', '恩明润', '恩卓润'], device: '双侧按钮刺孔、胶囊型干粉装置',
    steps: ['取盖、掀开吸嘴，干手临用剥出胶囊，放入胶囊腔后关紧。', '吸嘴向上，同时按两侧按钮一次到底，听到刺破声后完全松开。', '远离吸嘴呼气，包紧吸嘴，快速、深长地吸气；吸气时不按按钮。', `${hold}打开检查余粉，有剩余则再吸同一胶囊，不再刺孔；倒出空壳。`], breathCue: '快速、深长吸；两侧按钮必须松开',
    preparation: ['各品牌胶囊只配相应包装的比斯海乐，不跨品牌互换胶囊或器具。', '胶囊只能吸入，不能吞；临用才剥出，不从铝箔强行挤出。'], firstUse: ['新包装使用自带吸入器，无需预喷或加水。', '先让医护确认按钮已完全松开，再练习一次完整动作。'], cleaning: dry,
    checkpoints: ['胶囊配原装器', '只刺一次，完全松钮', '快速深吸后查余粉'], warnings: ['恩明润、恩卓润含莫米松（ICS），用后清水漱口并吐掉；杰润不含 ICS。', '听不到旋转声时轻敲底座松开胶囊再吸，不反复刺孔。'], mouthRinse: 'conditional',
    video: paperVideo('32746783', '吸入治疗四——比斯海乐装置使用方法'), videoOptions: [chineseVideo('caE74BydJmM', '如何使用 Breezhaler（中文）')], sources: [source('Novartis · Seebri Breezhaler 患者说明与清洁', 'https://www.novartis.com/sg-en/sites/novartis_sg/files/Seebri-Feb2020.SINv1-app260422.pdf'), source('HealthHub · Breezhaler 中文视频发布页', 'https://www.healthhub.sg/medication-devices-and-treatment/medications/breezhaler-administration-video')],
  },
  {
    id: 'pmdi-salbutamol', name: '万托林 · 沙丁胺醇气雾剂', aliases: ['硫酸沙丁胺醇吸入气雾剂', 'Ventolin Evohaler', '沙丁胺醇'], type: 'pmdi', brands: ['万托林'], device: '定量气雾剂 · 混悬型', steps: pmdiSteps('取盖、检查吸嘴，直立握住；每喷前摇匀。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['核对个人急救计划和剩余量；无计数器的版本需记录揿数。', '不能凭“还能喷出气体”判断还有足量药物。'], firstUse: ['新瓶或久未使用时，按万托林本盒说明完成摇匀、朝空中试喷。'],
    cleaning: ['按说明每周取出金属药罐，清洗塑料外壳并彻底晾干。', '金属药罐不能放入水中，不能加热、戳破或焚烧。'], checkpoints: ['每喷摇匀', '慢吸同步按压', '注意急救后症状有无缓解'], warnings: ['急救药不按网页统一喷数；症状加重或急救药效果差时依个人方案及时就医。', nonIcs], mouthRinse: 'conditional', video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')], sources: [emc('850', 'GSK · Ventolin Evohaler 患者说明')],
  },
  {
    id: 'pmdi-ipratropium', name: '爱全乐 · 异丙托溴铵气雾剂', aliases: ['异丙托溴铵吸入气雾剂', 'Atrovent', 'SAMA'], type: 'pmdi', brands: ['爱全乐'], device: '定量气雾剂 · 以手中溶液型说明为准', steps: pmdiSteps('取盖、检查吸嘴，直立握持；本品不是把所有 pMDI 都按混悬型摇匀。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['核对气雾剂与雾化吸入溶液，不将雾化药液倒入气雾剂。', '避免雾滴喷入眼睛，尤其有青光眼者。'], firstUse: ['首次或久未用后的试喷按爱全乐本盒说明执行；不要照抄倍择瑞预喷次数。'],
    cleaning: ['本品配套塑料外壳按本盒说明清洁；清洁前取出金属药罐，完全干燥再装回。', '不用针或尖物疏通喷口，不与其他药罐交换外壳。'], checkpoints: ['认准本品气雾剂', '不向眼睛喷', '按压与慢吸同步'], warnings: [nonIcs, '通用视频示范手口配合；是否摇匀和试喷以该产品说明为准。'], mouthRinse: 'conditional', video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')], sources: [emc('61', 'Boehringer Ingelheim · Atrovent Inhaler 患者说明')],
  },
  {
    id: 'pmdi-ics', name: '辅舒酮 · 氟替卡松气雾剂', aliases: ['丙酸氟替卡松吸入气雾剂', 'Flixotide Evohaler', 'ICS'], type: 'pmdi', brands: ['辅舒酮'], device: '定量气雾剂 · 混悬型', steps: pmdiSteps('取盖、检查吸嘴，直立握持；使用前摇匀。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['核对气雾剂与干粉准纳器；同药名的不同剂型操作不同。', '是控制药，不用于自行替代突发气促的急救方案。'], firstUse: ['新瓶与久未用的重新试喷，按辅舒酮本盒说明，不统一为其他气雾剂的次数。'],
    cleaning: ['定期用干布或干纸巾擦吸嘴内外；按辅舒酮说明保持装置干燥。', '不要套用万托林外壳水洗方法，不擅自把整个吸入器浸水。'], checkpoints: ['慢吸同步按压', '按处方规律使用', '漱口并吐掉'], warnings: [rinse, '如需储雾罐，应由医护确认与本品相容并示范。'], mouthRinse: 'required', video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')], sources: [source('National Asthma Council Australia · 氟替卡松气雾剂清洁', 'https://www.nationalasthma.org.au/resources/puffer-and-inhaler-care')],
  },
  {
    id: 'pmdi-foster', name: '启尔畅 · 倍氯米松福莫特罗气雾剂', aliases: ['倍氯米松福莫特罗吸入气雾剂', 'Foster', 'Fostair', 'Modulite'], type: 'pmdi', brands: ['启尔畅'], device: '定量气雾剂 · 溶液型（不是易悦达干粉）', steps: pmdiSteps('取盖、检查吸嘴，直立握持；本溶液型无需套用混悬型摇匀步骤。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['认准气雾剂：启尔畅易悦达 NEXThaler 是另一装置。', '是否用于维持或缓解由医生和国内处方决定，不能照抄海外网站适应症或剂量。'], firstUse: ['首次和久未使用后，按本盒说明向远离脸部方向试喷并核对计数器。'],
    cleaning: ['每周用干布擦吸嘴内外与塑料外壳。', '不水洗；清洁时不取出药罐。'], checkpoints: ['认准溶液型气雾剂', '慢吸时按压', '不用其他装置的水洗法'], warnings: [rinse, '同品牌干粉和气雾剂的吸气速度不同，不互相替代。'], mouthRinse: 'required', video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')], sources: [emc('6318', 'Chiesi · Fostair pMDI 患者说明（仅核对装置）')],
  },
  {
    id: 'pmdi-trimbow', name: '泰尔畅 · 倍氯福格气雾剂', aliases: ['倍氯福格吸入气雾剂', 'Trimbow'], type: 'pmdi', brands: ['泰尔畅'], device: '定量气雾剂 · 溶液型', steps: pmdiSteps('取盖、检查吸嘴与计数窗，直立握持；不套用混悬型摇匀步骤。'), breathCue: '慢而深吸气，同时按压',
    preparation: ['核对泰尔畅与倍择瑞，两种三联不是同一种药和装置。', '不把国外 Trimbow NEXThaler 干粉操作用于此气雾剂。'], firstUse: ['首次使用前按本盒说明试喷，试喷方向远离自己和他人。', '看清计数器；不同规格与版本按配套说明准备。'],
    cleaning: ['每周用干布擦吸嘴内外，清洁时不拆出药罐。', '不得用水或其他液体清洁。'], checkpoints: ['慢吸与按压同步', '只按个人处方喷数', '干擦，不水洗'], warnings: [rinse, '不能自行追加维持三联替代急救药。'], mouthRinse: 'required', video: pmdiVideo, videoOptions: [chineseVideo('6sNTEO68HSs', '如何使用定量吸入器（中文）')], sources: [emc('761', 'Chiesi · Trimbow pMDI 患者说明（仅核对装置）')],
  },
  {
    id: 'spacer', name: '气雾剂配储雾罐', aliases: ['储雾器', '储雾罐', 'Spacer', 'AeroChamber', '面罩'], type: 'accessory', brands: ['按具体储雾罐与气雾剂相容性选择'], device: '仅用于经医护确认相容的 pMDI',
    steps: ['检查相容气雾剂、储雾罐和阀门；按该药说明准备并连接。', '包紧口含式吸嘴，或由照护者使面罩贴合口鼻不漏气。', '每次只喷一揿，立即缓慢深吸；也可按医护示范做多次平静呼吸。', '如需下一揿，按处方逐揿重复；含 ICS 者漱口吐掉，面罩接触部位清洁。'], breathCue: '一揿一吸；按相应储雾罐示范慢吸或平静呼吸',
    preparation: ['不是所有储雾罐与药罐都相容；不连接 DPI 或能倍乐。', '听到哨声常提示吸太快，按该品牌说明放慢。'], firstUse: ['按储雾罐本身说明完成首次清洁/抗静电准备，并由医护选择口含式或面罩式。'],
    cleaning: ['按本品牌说明拆洗、自然晾干；不要统一规定所有储雾罐都擦干或相同洗法。', '检查阀门有无损坏；不与他人共用。'], checkpoints: ['密封不漏', '一次只喷一揿', '喷后立即吸'], warnings: ['成人、儿童及不同储雾罐所需平静呼吸次数不同，不统一为固定次数。', '本页不据年龄自行更换处方或储雾罐。'], mouthRinse: 'conditional', video: chineseVideo('bf9hK7Uvr_0', '成人如何使用定量吸入器与储雾罐（中文）'), videoOptions: [], sources: [source('Asthma + Lung UK · 储雾罐使用、相容性和清洁', 'https://www.asthmaandlung.org.uk/symptoms-tests-treatments/treatments/spacers'), source('新加坡卫生部 ACE · 储雾罐成人与儿童技巧差异', ace)],
  },
  {
    id: 'nexthaler', name: '易悦达 · NEXThaler', aliases: ['启尔畅易悦达', '倍氯米松福莫特罗吸入粉雾剂', 'Foster NEXThaler', 'Fostair NEXThaler'], type: 'dpi', brands: ['启尔畅易悦达'], device: '吸气触发、多剂量干粉装置',
    steps: ['竖直握住吸入器，检查余量，将盖子完全打开。', '远离吸嘴舒适呼气，再双唇包紧吸嘴，不遮通气孔。', '经口用力、深长吸气；听到或感觉咔哒后继续吸，不用鼻吸。', `${hold}完全闭盖，核对计数少一，用后漱口并吐掉。`], breathCue: '用力、深长吸气；与启尔畅气雾剂慢吸不同',
    preparation: ['确认包装为“吸入粉雾剂/易悦达”，不是同品牌气雾剂。', '只在准备吸入时完全打开盖，不拆开装置。'], firstUse: ['使用时才拆开密封袋，检查装置完整与初始计数，记录开封日期。', '无需预喷、摇匀或刺胶囊；药物靠足够吸气触发。'], cleaning: dry,
    checkpoints: ['盖完全打开', '不挡进气孔', '闭盖核对计数'], warnings: [rinse, '计数不确定时不要凭感觉补吸，应咨询医护。', '官方中文视频在 YouTube，本次医院可及性未能验证。'], mouthRinse: 'required', video: chineseVideo('ZjeqbWUEkZ0', '如何使用 NEXThaler（中文）'), videoOptions: [], sources: [emc('3317', 'Chiesi · Fostair NEXThaler 专属装置说明')],
  },
  {
    id: 'genuair', name: 'Genuair · 阿地溴铵干粉装置', aliases: ['阿地溴铵吸入粉雾剂', 'Genuair', 'Aclidinium'], type: 'dpi', brands: ['阿地溴铵吸入粉雾剂（核对本盒生产企业）'], device: '按键备药、颜色窗反馈的多剂量干粉装置',
    steps: ['取盖检查吸嘴，水平握持，彩色按钮朝上。', '按钮按到底再完全松开，检查控制窗从红变绿。', '远离装置呼气；包紧吸嘴，快速、用力而深长吸气，听到咔哒后仍继续吸。', `${hold}确认控制窗变红；若仍绿，检查已松钮，按说明重吸，不再按键加药；盖好。`], breathCue: '用力深吸，咔哒后继续；吸气不按按钮',
    preparation: ['不倒置装置；装药时保持水平、按钮朝上。', '本项中国单方阿地溴铵不能直接冠以国外其他复方商品名。'], firstUse: ['首次使用才拆密封袋，核对计数与装置状态；无需按 pMDI 方式预喷。'], cleaning: dry,
    checkpoints: ['按下后完全松开', '吸前绿窗', '吸后红窗'], warnings: [nonIcs, '主视频为英语，配合本页中文步骤核对；海外适应症和剂量不照搬。'], mouthRinse: 'conditional',
    video: { url: 'https://www.asthmaandlung.org.uk/living-with/inhaler-videos/genuair', title: 'How to use a Genuair inhaler', provider: 'Asthma + Lung UK；UK Inhaler Group 背书', language: '英语', kind: 'external', verifiedAt: checkedAt, sourceUrl: 'https://www.asthmaandlung.org.uk/living-with/inhaler-videos/genuair', verification: 'official-player', playbackVerified: false, availability: '海外原站；医院网络播放待验证。', scope: 'Genuair 装置技巧，药物与剂量按国内说明。' }, videoOptions: [],
    sources: [source('Asthma + Lung UK · Genuair 视频与文字步骤', 'https://www.asthmaandlung.org.uk/living-with/inhaler-videos/genuair'), source('AstraZeneca · Eklira Genuair 装置说明（海外，供核对）', 'https://www.medicines.org.uk/emc/product/14790/smpc')],
  },
];

entries.push({
  id: 'pingshi', name: '平适 · 福莫特罗专用胶囊器', aliases: ['平适', '富马酸福莫特罗粉吸入剂', '希好', 'DPI-C3'], type: 'capsule', brands: ['平适'], device: '希好 DPI-C3 胶囊型干粉装置',
  steps: ['按刺针按钮打开防尘罩，掀开吸嘴；临用取胶囊放入中央胶囊腔。', '关闭吸嘴，保持防尘罩打开；吸嘴向上，刺针按钮按到底一次后松开。', '远离装置充分呼气，头直立，包紧吸嘴深长吸气，流速足以让胶囊振动或转动。', `${hold}按说明再次吸同一胶囊使余粉吸净，打开吸嘴倒出空壳后关闭。`], breathCue: '深长吸气，使胶囊振动；松开按钮再吸',
  preparation: ['吸入胶囊不能吞服，只与平适包装配套的希好 DPI-C3 合用。', '不能把福莫特罗单药擅自替代哮喘抗炎治疗。'], firstUse: ['先以实物确认防尘罩、吸嘴、胶囊腔和刺针按钮；不预喷、不向药室加水。'],
  cleaning: ['DPI-C3 说明建议每使用10次清洗：打开各部件，以温水清洗滤网与胶囊腔。', '完全干燥后再用；本器具说明建议使用60次后更换。不得把此水洗规则套给其他干粉器。'],
  checkpoints: ['原装胶囊与DPI-C3配套', '刺孔一次后松开', '同一胶囊吸净后倒壳'], warnings: [nonIcs, '不同厂家的福莫特罗或胶囊器，不能直接套用本项操作。'], mouthRinse: 'conditional',
  video: null, videoOptions: [], missingReason: '已核对平适专属器具说明；尚未找到并完成播放核验的平适专属视频。',
  sources: [source('正大天晴 · 平适与希好 DPI-C3 配套说明书', 'https://www.cttq.com/upload/file/2025/12/05/30ac99bb3e1e413581589ade7ed30115.pdf')],
}, {
  id: 'pmdi-jishu', name: '吉舒 · 布地奈德气雾剂', aliases: ['吉舒', '布地奈德吸入气雾剂', '鲁南'], type: 'pmdi', brands: ['吉舒'], device: '布地奈德定量气雾剂 · 混悬型',
  steps: pmdiSteps('取下保护盖，充分振摇，检查接口后直立握持。'), breathCue: '缓慢深吸，同时揿压',
  preparation: ['核对气雾剂与吉舒雾化混悬液，不混淆给药系统。', '每次吸入按处方，含 ICS；用后清水漱口并吐掉。'], firstUse: ['首次及停用后需要怎样试喷，以手中吉舒盒内说明为准；不照搬其他品牌次数。'],
  cleaning: ['每周至少一次取下药罐，用温水清洁塑料外壳，不用热水。', '塑料外壳完全干燥后再装回，金属药罐不要浸洗。'],
  checkpoints: ['使用前振摇', '缓慢深吸同步揿压', '用后漱口吐掉'], warnings: [rinse, '厂家页面含产品推广内容；本页只引用操作方法，不将宣传语写作药物推荐。'], mouthRinse: 'required',
  video: { url: 'https://www.lunan.com.cn/Product/Product/detail/id/73?l=zh-CN', title: '吉舒布地奈德吸入气雾剂 · 使用说明视频', provider: '鲁南制药集团官方', language: '中文', kind: 'external', verifiedAt: checkedAt, sourceUrl: 'https://www.lunan.com.cn/Product/Product/detail/id/73?l=zh-CN', verification: 'browser-playback', playbackVerified: true, availability: '国内厂家原站，打开“使用说明视频”；需联网。', scope: '吉舒气雾剂专属示范' }, videoOptions: [],
  sources: [source('鲁南制药 · 吉舒官方完整说明书', 'https://www.lunan.com.cn/Product/Product/instruction/id/73.html')],
});

const unresolved = [
  ['jiankechang', '健可畅 · 沙美特罗替卡松', ['健可畅', '沙美特罗替卡松吸入粉雾剂'], 'dpi', '国产多剂量干粉；尚未取得可核对的专属操作说明'],
  ['pingshi', '平适 · 福莫特罗专用胶囊器', ['平适', '富马酸福莫特罗粉吸入剂'], 'capsule', '平适配套胶囊型干粉装置'],
  ['swinghaler', '舒稳乐 · Swinghaler', ['舒稳乐', '佰达图', '盐酸丙卡特罗粉雾剂'], 'dpi', '舒稳乐专用多剂量干粉装置'],
  ['pmdi-jishu', '吉舒 · 布地奈德气雾剂', ['吉舒', '布地奈德吸入气雾剂'], 'pmdi', '国产布地奈德定量气雾剂'],
  ['pmdi-ciclesonide', '仙定 · 环索奈德气雾剂', ['仙定', '环索奈德吸入气雾剂'], 'pmdi', '国产环索奈德定量气雾剂'],
  ['capsule-biduoyi', '彼多益 · 噻托溴铵专用胶囊器', ['彼多益', '噻托溴铵粉吸入剂', '仙琚'], 'capsule', '彼多益配套胶囊型干粉装置'],
  ['pmdi-liusha', '硫沙 · 沙丁胺醇气雾剂', ['硫沙', '硫酸沙丁胺醇吸入气雾剂', '京卫'], 'pmdi', '京卫沙丁胺醇定量气雾剂'],
  ['pmdi-bingbei', '丙倍 · 倍氯米松气雾剂', ['丙倍', '丙酸倍氯米松气雾剂', '京卫'], 'pmdi', '京卫倍氯米松定量气雾剂'],
  ['capsule-helioeast', '弘明瑞 · 噻托溴铵专用胶囊器', ['弘明瑞', '弘益', '南昌弘益', 'Helioeast', '噻托溴铵粉吸入剂'], 'capsule', '南昌弘益配套胶囊型干粉装置'],
  ['capsule-xilituo', '悉立妥 · 噻托溴铵专用胶囊器', ['悉立妥', '噻托溴铵吸入粉雾剂', '京卫'], 'capsule', '悉立妥配套胶囊型干粉装置'],
].filter(([id]) => !entries.some(item => item.id === id)).map(([id, name, aliases, type, device]) => ({
  id, name, aliases, type, brands: [aliases[0]], device, teachingStatus: 'needs-device-review',
  steps: [], breathCue: '请先由医护核对手中这一品牌的专属吸气方法',
  preparation: ['携带药盒、配套吸入器及装置说明，由药师/护士以实物演示并回授。'],
  firstUse: ['本轮尚未取得可核对的专属首次准备说明；不照抄其他品牌试喷、摇匀或刺孔次数。'],
  cleaning: ['保持装置清洁，具体拆洗/干擦方法待配套说明核对；不要套用其他吸入器的水洗规则。'],
  checkpoints: ['药品名称、厂家、剂型与配套器具一致', '请医护现场示范并检查回授'],
  warnings: [type === 'capsule' ? '吸入胶囊不能吞服，不与其他品牌胶囊装置混用。' : '不能仅按药物成分或外观，套用别家装置。', ...(['jiankechang', 'pmdi-jishu', 'pmdi-ciclesonide', 'pmdi-bingbei'].includes(id) ? [rinse] : []), '已检出大陆产品证据，不代表专属教学已经完成。'],
  mouthRinse: ['jiankechang', 'pmdi-jishu', 'pmdi-ciclesonide', 'pmdi-bingbei'].includes(id) ? 'required' : 'conditional',
  video: null, videoOptions: [], missingReason: '尚未找到并完成播放核验的本品牌专属教学视频，暂不提供替代品牌视频。', sources: [],
}));

const displayVideo = video => video ? { ...video, note: [video.availability, video.scope].filter(Boolean).join(' ') } : null;
export const INHALER_CATALOG = Object.freeze([...entries, ...unresolved].map(item => Object.freeze({
  teachingStatus: 'reviewed-device-method', ...item, checkedAt, market: marketFor(item.id),
  video: displayVideo(item.video), videoOptions: item.videoOptions.map(displayVideo),
  sources: [...item.sources, ...marketFor(item.id).sources],
})));

export const INHALER_CATALOG_INFO = Object.freeze({
  checkedAt, scope: '中国大陆慢性气道疾病相关的手持吸入装置及储雾罐；按装置/品牌区分。',
  message: '这是已检索并逐项标记证据的目录，不是全国全部在售批文或实时库存清单。海外说明只核对装置，不扩展中国适应症或推荐剂量。',
  videoNotice: '视频保留在版权方或原发布平台；需要联网，未下载转载。外网受限时仍可查看中文步骤，专属材料缺失项已明示。',
});
