/** Mainland product evidence; this is not a real-time pharmacy inventory. */
export const INHALER_MARKET_CHECKED_AT = '2026-10-19';

const source = (label, url) => Object.freeze({ label, url });
const GSK = source('GSK 中国 · 当前产品列表', 'https://www.gsk-china.com/zh-cn/products/product-list/');
const AZ = source('阿斯利康中国 · 呼吸及免疫产品', 'https://www.astrazeneca.com.cn/zh/our-focus-areas/respiratory-and-immunology.html');
const BI = source('勃林格殷格翰中国 · 中国呼吸产品合作', 'https://www.boehringer-ingelheim.cn/renleijiankang/bolingeyingehanzhongguohebeijingboruilindachengzhanehezuo');
const TJ = source('天津医保 · 产品与随附装置公示', 'https://ylbz.tj.gov.cn/xwzx/tzgg/202403/W020240301587606682356.pdf');
const GENU = source('国家医保局 · 阿地溴铵上市资料', 'https://www.nhsa.gov.cn/attach/Ypsn2025/YPSW202500332/YPSW202500332.pdf');
const ZJ = source('浙江政务附件 · Genuair 国谈挂网产品', 'https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3190/site/attach/0/4420ed9b1e5a4fc695fd3d95d506dfbc.pdf');
const NEX = source('凯西中国 · 启尔畅易悦达在华商业上市', 'https://www.chiesigroup.cn/media/mediachiesi-china-has-introduced-foster-and-yiyueda-opening-a-new-chapter-in-asthma-treatment/');
const XIHAO = source('正大天晴 · 天晴速乐产品资料', 'https://www.cttq.com/product/huxi-detail-6011.htm');
const PING = source('正大天晴 · 呼吸产品列表', 'https://www.cttq.com/product/hu-xi-list-0.htm');
const PING_IFU = source('正大天晴 · 平适与希好 DPI-C3 官方说明书', 'https://www.cttq.com/upload/file/2025/12/05/30ac99bb3e1e413581589ade7ed30115.pdf');
const JIAN = source('健康元 · 健可畅产品与批准文号', 'https://www.joincare.com/product/160.html');
const JIAN_LAUNCH = source('健康元 · 健可畅中国线上首发', 'https://www.joincare.com/news/490.html');
const SWING = source('国家医保局 · 丙卡特罗舒稳乐装置资料', 'https://www.nhsa.gov.cn/attach/Ypsn2024/YPSN202400066/YPSN202400066.pdf');
const JISHU = source('鲁南制药 · 吉舒布地奈德气雾剂', 'https://www.lunan.com.cn/Product/Product/detail/id/73?l=zh-CN');
const JISHU_IFU = source('鲁南制药 · 吉舒完整说明书及气雾剂使用方法', 'https://www.lunan.com.cn/Product/Product/instruction/id/73.html');
const CIC = source('仙琚制药 · 仙定环索奈德气雾剂', 'https://www.xjpharma.com/pro_desc_34_38_357.html');
const BIDUOYI = source('仙琚制药 · 彼多益噻托溴铵粉雾剂', 'https://www.xjpharma.com/pro_desc_34_38_327.html');
const LIUSHA = source('京卫制药 · 硫沙中国临床与商业使用资料', 'https://www.jewim.com.cn/News_detail/193.html');
const LIUSHA_PRODUCT = source('京卫制药 · 硫沙气雾剂 H20113348', 'https://www.jewim.com.cn/Product_detail/24.html');
const BINGBEI = source('京卫制药 · 丙倍产品与批准文号', 'https://www.jewim.com.cn/Product_detail/8.html');
const XILITUO = source('京卫制药 · 悉立妥 H20263365 当前产品', 'https://www.jewim.com.cn/Product_detail/49.html');
const HELIO = source('南昌弘益 · 2026-09 弘明瑞与 Helioeast 配套产品', 'http://www.helioeast.com/newsinfo.asp?type=2&id=30918');
const BREEZE = source('国家医保局 · 杰润与比斯海乐装置', 'https://www.nhsa.gov.cn/attach/Ypsn2023/YPSN202300160/YPSN202300160-N3.pdf');
const ENMING = source('远大医药 · 恩明润比斯海乐当前产品', 'https://www.grandpharm.com/product/%E6%81%A9%E6%98%8E%E6%B6%A6-%E6%AF%94%E6%96%AF%E6%B5%B7%E4%B9%90%EF%BC%88%E8%8C%9A%E8%BE%BE%E7%89%B9%E7%BD%97%E8%8E%AB%E7%B1%B3%E6%9D%BE%E5%90%B8%E5%85%A5%E7%B2%89%E9%9B%BE%E5%89%82/');
const ENZHUO = source('国家医保局 · 恩卓润大陆上市资料', 'https://www.nhsa.gov.cn/attach/Ypsn/YPSW202200156-W1/YPSW202200156-W1.pdf');
const TRELEGY = source('GSK 中国 · 全再乐与欧乐欣当前商业合作', 'https://www.gsk-china.com/zh-cn/media/press-releases/gsk-and-sbp-group-deepen-strategic-collaboration/');
const FOSTER = source('凯西中国 · 启尔畅气雾剂产品', 'https://www.chiesigroup.cn/foster/');
const TRIMBOW = source('乐活医药 · 泰尔畅中文说明资料', 'https://www.lehuopharm.com/products/%E6%B3%B0%E5%B0%94%E7%95%85');
const HOSPITAL = source('河南省胸科医院 · 吸入装置与储雾罐教学', 'https://www.hnxkyy.com.cn/NewsDetail-39310.html');
const PARI = source('PARI 中国 · 储雾罐和吸入治疗', 'https://www.pari.com/cn-cn/%E9%9B%BE%E5%8C%96%E5%90%B8%E5%85%A5%E6%B2%BB%E7%96%97/');
const common = '已核对大陆产品资料；不代表所有地区、医院或药房当天有货。品牌、剂型与装置须和手中实物一致。';
const confirmed = (label, sources, evidenceLevel, limitations = common) => Object.freeze({ status: 'confirmed', checkedAt: INHALER_MARKET_CHECKED_AT, label, evidenceLevel, sources: Object.freeze(sources), limitations });
const pending = (label, sources, limitations) => Object.freeze({ status: 'pending', checkedAt: INHALER_MARKET_CHECKED_AT, label, evidenceLevel: '大陆可购与具体装置尚未完成核对', sources: Object.freeze(sources), limitations });

export const INHALER_MARKET = Object.freeze({
  breztri: confirmed('倍择瑞令畅 · 布地格福', [AZ], '中国厂商当前产品列表'),
  bevespi: confirmed('百沃平令畅 · 格隆溴铵福莫特罗', [AZ], '中国厂商当前产品列表'),
  turbuhaler: confirmed('信必可都保 · 布地奈德福莫特罗', [AZ], '中国厂商当前产品列表'),
  accuhaler: confirmed('舒利迭 · 沙美特罗替卡松粉雾剂', [GSK, HOSPITAL], '中国厂商当前产品列表与国内医院装置资料', '本条指准纳器粉雾剂；不能用于舒利迭气雾剂或其他厂家仿制装置。' + common),
  ellipta: confirmed('全再乐、欧乐欣 · 易纳器', [TRELEGY, GSK], '2026 年厂商大陆商业运营资料', '全再乐含 ICS；欧乐欣不含 ICS，不能把漱口防激素残留提示或用药适应症互相照搬。' + common),
  capsule: confirmed('天晴速乐 · 噻托溴铵专用胶囊装置', [XIHAO], '中国厂商当前产品资料', '仅核对天晴速乐；本条不覆盖所有噻托溴铵仿制品，胶囊与随附装置不可随意互换。' + common),
  respimat: confirmed('能倍乐 · 思力华喷雾剂、思合华', [BI, source('勃林格殷格翰中国 · 思合华与能倍乐', 'https://www.boehringer-ingelheim.cn/renleijiankang/pinganhaoyishengyubolingeyingehanshenduhezuodazaozhongguoshougexianshangmanzufeiquanfangweiguanlixia')], '厂商中国商业资料与装置映射', '药筒、一次性或可重复使用型号、首次启动和停用后复喷须按大陆盒内说明书。' + common),
  handihaler: confirmed('思力华胶囊 · HandiHaler 吸乐', [TJ, BI], '政府医保产品公示明确 HandiHaler', '本条为思力华胶囊与 HandiHaler；不覆盖同名思力华喷雾剂。' + common),
  breezhaler: confirmed('比斯海乐 · 杰润、恩明润、恩卓润', [BREEZE, ENMING, ENZHUO], '政府上市公示与厂商当前产品资料', '杰润不含 ICS；恩明润、恩卓润含 ICS。昂润、希润等同平台产品须再核对各自胶囊和随附装置，不按药物相近替换。' + common),
  'pmdi-salbutamol': confirmed('万托林 · 硫酸沙丁胺醇气雾剂', [GSK], '中国厂商当前产品列表', '不能用于同品牌雾化溶液；国产硫沙另列，试喷和清洁细节不自动通用。' + common),
  'pmdi-ipratropium': confirmed('爱全乐 · 异丙托溴铵气雾剂', [source('国家人口健康科学数据中心 · 爱全乐 HJ20130498', 'https://pharm.ncmi.cn/zysjk/ypjkyp/202312/t20231205_399700.html'), BI], '国家科学数据注册信息与厂商中国商业资料', '核对气雾剂剂型；爱全乐雾化溶液属于另一给药系统。避免药雾进入眼睛。' + common),
  'pmdi-ics': confirmed('辅舒酮 · 丙酸氟替卡松气雾剂', [GSK], '中国厂商当前产品列表', '本条专指辅舒酮气雾剂，不是所有单药激素气雾剂的通用说明。' + common),
  'pmdi-foster': confirmed('启尔畅 · 倍氯米松福莫特罗气雾剂', [FOSTER, NEX], '中国厂商当前产品和商业资料', '溶液型 pMDI；不能使用启尔畅易悦达粉雾剂的操作。试喷、清洁及摇动要求按手中说明。' + common),
  'pmdi-trimbow': confirmed('泰尔畅 · 倍氯福格气雾剂', [TRIMBOW], '中国经销厂商中文说明资料，HJ20220035', '溶液型 pMDI；不能照搬倍择瑞的共悬浮试喷次数、摇匀要求或保存条件。' + common),
  spacer: confirmed('pMDI 配套储雾罐 · 辅助附件', [HOSPITAL, PARI], '国内医院教学与厂商中国附件资料', '附件不含药物，不把全部储雾罐型号宣称已获同一注册；只连接经医护确认兼容的 pMDI，不能接干粉装置。' + common),
  nexthaler: confirmed('启尔畅易悦达 · NEXThaler', [NEX], '2025-09 中国正式商业上市的一手厂商资料', '国内新增干粉型号，和启尔畅气雾剂分别教学；使用国内盒内说明，不复制海外剂量或适应症。' + common),
  genuair: confirmed('阿地溴铵单方 · Genuair', [GENU, ZJ], 'HJ20240081 大陆上市资料与政府挂网包装明确 Genuair', '已确认阿地溴铵单方，不把海外 Eklira、Tudorza 或阿地溴铵福莫特罗品牌直接当作中国商品名。' + common),
  jiankechang: confirmed('健可畅 · 国产沙美特罗替卡松粉雾剂', [JIAN, JIAN_LAUNCH], 'H20243906 与中国实际商业首发', '已核对产品；本轮尚缺可核查的该具体装置完整操作说明和专属教学视频。不可套用准纳器的推杆、计数及装药细节。' + common),
  pingshi: confirmed('平适 · 希好 DPI-C3 胶囊装置', [PING, PING_IFU], '中国厂商现行产品及专用器具完整图解说明书', '已核对官方 PDF 第 2 页器具说明；本轮尚无平适专属视频。不能因同属胶囊型就套用天晴速乐或比斯海乐。' + common),
  swinghaler: confirmed('佰达图舒稳乐 · 盐酸丙卡特罗粉雾剂', [SWING, source('大冢中国 · 舒稳乐大陆实物项目', 'https://www.otsuka.com.cn/sustainable-development/index.html')], '国家医保公示明确舒稳乐与国内厂商资料', '专用多剂量干粉装置；准备方式不同于都保和易纳器。具体摇动、按钮和计数操作须核对盒内说明。' + common),
  'pmdi-jishu': confirmed('吉舒 · 布地奈德气雾剂', [JISHU, JISHU_IFU], '中国厂商当前产品 H20030987 及完整说明书', '已核对厂商说明书使用与清洁章节；同品牌另有雾化混悬液，不能混淆。说明书未列出的试喷次数不自动补写。' + common),
  'pmdi-ciclesonide': confirmed('仙定 · 环索奈德气雾剂', [CIC], '中国厂商当前产品资料', '已核对具体气雾剂；本轮尚缺该中国产品完整操作说明与专属教学视频，不能写成所有气雾剂均应摇匀。' + common),
  'capsule-biduoyi': confirmed('彼多益 · 噻托溴铵专用胶囊装置', [BIDUOYI], '中国厂商当前产品及配套包装资料', '胶囊型 DPI，非 pMDI；具体刺破方式和清洁要求须核对随盒器具，不能套用思力华或天晴速乐视频。' + common),
  'capsule-helioeast': confirmed('弘明瑞 · 噻托溴铵 Helioeast 装置', [HELIO, TJ], '2026 年厂商配套装置资料与政府医保 H20130110 公示', '已核对产品及专用装置名称；本轮尚缺现行器具完整专用操作说明和教学视频，不用早期专利图替代新版说明。' + common),
  'pmdi-liusha': confirmed('硫沙 · 国产硫酸沙丁胺醇气雾剂', [LIUSHA_PRODUCT, LIUSHA], '中国厂商当前产品 H20113348 与商业使用资料', '已核对具体国产气雾剂；试喷次数、嘴套拆卸和清洁要求不能从万托林自动复制。' + common),
  'pmdi-bingbei': confirmed('丙倍 · 丙酸倍氯米松气雾剂', [BINGBEI], '中国厂商当前产品与批准文号资料', '已核对具体国产气雾剂；本轮尚缺完整专用操作说明和专属视频。' + common),
  'capsule-xilituo': confirmed('悉立妥 · 国产噻托溴铵胶囊粉雾剂', [XILITUO], '中国厂商当前产品资料，H20263365', '已核对具体产品；本轮尚缺器具型号、完整专用说明和专属视频，不按同成分推定器具相同。' + common),
});

/** Search findings that are not labelled as currently purchasable mainland products. */
export const INHALER_UNCONFIRMED_MARKET = Object.freeze({
  'omni-ouaixi': pending('欧爱吸 · 呼吸触发气雾剂平台', [source('欧米尼 · 2023 装置研发资料', 'https://www.omni-pharma.com/lang1-7/81.html')], '厂商技术介绍和共识收载不足以确认具体药品已获批并商业销售，本轮未取得足够大陆可购证明。'),
  'omni-ouxichang': pending('欧吸畅 · 单剂量囊泡装置', [source('欧米尼 · CDE 受理资料', 'https://www.omni-pharma.com/lang1-7/79.html')], '现取得的是 CDE 受理资料；受理不等于批准或商业上市。'),
  easyhaler: pending('Easyhaler', [], '本轮未取得可信的大陆具体产品批准、商业销售与装置映射材料；不据海外视频纳入已核对目录。'),
  spiromax: pending('Spiromax', [], '本轮未取得可信的大陆具体产品批准、商业销售与装置映射材料。'),
  forspiro: pending('Forspiro', [], '本轮未取得可信的大陆具体产品批准、商业销售与装置映射材料。'),
  twisthaler: pending('Twisthaler', [], '未把莫米松鼻喷剂或比斯海乐莫米松复方当作 Twisthaler 上市证据。'),
  'genuair-combination': pending('阿地溴铵福莫特罗复方', [], '2026-04 获批的二手线索尚未完成大陆官方批准与具体商业销售核对；与已确认单方分开。'),
  flutiform: pending('氟替卡松福莫特罗气雾剂', [source('国家科学数据中心 · HJ20230108 注册资料', 'https://pharm.ncmi.cn/zysjk/ypjkyp/202312/t20231205_400906.html')], '有大陆批准线索；本轮尚未确认当前实际商业销售、国内商品名与专用盒内操作资料。'),
});
