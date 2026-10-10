// Patient education based on the original topic coverage. Sources checked 2026-10-10.
// The content is general information; medication, oxygen and activity plans remain individual.
const SOURCE = {
  gold: { label: 'GOLD 2026 · 慢阻肺管理', url: 'https://goldcopd.org/2026-gold-report-and-pocket-guide/' },
  gina: { label: 'GINA 2026 · 哮喘管理', url: 'https://ginasthma.org/2026-gina-strategy-report/' },
  rehab: { label: 'ATS 2023 · 肺康复指南', url: 'https://doi.org/10.1164/rccm.202306-1066ST' },
  breathing: { label: 'COPD Foundation · 呼吸技巧', url: 'https://www.copdfoundation.org/Learn-More/I-am-New-to-COPD/Breathing-Techniques.aspx' },
  vaccines: { label: 'CDC 2026 · 肺炎球菌疫苗', url: 'https://www.cdc.gov/pneumococcal/vaccines/adults.html' },
  oxygen: { label: 'NHS · 家庭氧疗设置与安全', url: 'https://www.nth.nhs.uk/resources/home-oxygen-therapy/' },
  oxygenSafety: { label: 'NHS · 家庭氧疗与防火', url: 'https://www.nhs.uk/tests-and-treatments/home-oxygen-treatment/' },
  bronchiectasis: { label: 'ERS / ELF 2025 · 成人支气管扩张', url: 'https://europeanlung.org/en/information-hub/guidelines/managing-bronchiectasis-in-adults-2025/' },
  blood: { label: 'NHS · 咯血就医提示', url: 'https://www.nhs.uk/symptoms/coughing-up-blood/' },
  cancerSurgery: { label: 'NCI · 肿瘤手术与恢复', url: 'https://www.cancer.gov/about-cancer/treatment/types/surgery' },
  cancerInfection: { label: 'NCI · 治疗期间感染与发热', url: 'https://www.cancer.gov/about-cancer/treatment/side-effects/infection' },
  cancerNutrition: { label: 'NCI · 肿瘤治疗期间的营养', url: 'https://www.cancer.gov/about-cancer/treatment/side-effects/nutrition' },
  cancerRecovery: { label: 'ACS · 肿瘤手术后恢复', url: 'https://www.cancer.org/cancer/treatment-types/surgery/recovering-from-cancer-surgery.html' },
  embolism: { label: 'NHS · 血栓与肺栓塞警示', url: 'https://www.nhs.uk/conditions/pulmonary-embolism/' },
  immunization: { label: 'CDC · 免疫功能受抑制时的接种', url: 'https://www.cdc.gov/vaccines/hcp/imz-best-practices/altered-immunocompetence.html' },
  silica: { label: 'CDC / NIOSH 2026 · 矽尘、症状与监测', url: 'https://www.cdc.gov/niosh/silica/symptoms/index.html' },
  dust: { label: 'CDC / NIOSH 2026 · 职业粉尘防护', url: 'https://www.cdc.gov/niosh/silica/work/index.html' },
  ild: { label: 'ATS / ERS 2022 · IPF 与进展性肺纤维化', url: 'https://doi.org/10.1164/rccm.202202-0399ST' },
  ipf: { label: 'NIH / NHLBI · 肺纤维化治疗', url: 'https://www.nhlbi.nih.gov/health/idiopathic-pulmonary-fibrosis/treatment' },
  pleural: { label: 'BTS 2023 · 气胸与胸膜疾病', url: 'https://www.brit-thoracic.org.uk/document-library/guidelines/pleural-disease/pleural-disease-full-supplement/' },
  flight: { label: 'BTS 2022 · 呼吸疾病与航空旅行', url: 'https://www.brit-thoracic.org.uk/document-library/clinical-statements/air-travel/bts-clinical-statement-on-air-travel' },
  drain: { label: 'NHS · 胸腔引流的照护', url: 'https://www.guysandstthomas.nhs.uk/health-information/chest-drain' },
  tb: { label: 'WHO 2026 · 结核病与感染控制', url: 'https://www.who.int/news-room/fact-sheets/detail/tuberculosis' },
  tbTreatment: { label: 'CDC · 活动性结核治疗', url: 'https://www.cdc.gov/tb/treatment/active-tuberculosis-disease.html' },
  tbSafety: { label: 'CDC · 抗结核药物不良反应', url: 'https://www.cdc.gov/tb/hcp/treatment/adverse-events.html' },
  pulmonaryHeart: { label: 'NHS · 肺动脉高压与右心负担', url: 'https://www.nhs.uk/conditions/pulmonary-hypertension/' },
  heartTreatment: { label: 'NHS · 肺动脉高压治疗', url: 'https://www.nhs.uk/conditions/pulmonary-hypertension/treatment/' },
  heartMonitoring: { label: 'NHS · 心功能与日常监测', url: 'https://www.berkshirehealthcare.nhs.uk/advice/living-with-heart-failure' },
  osa: { label: 'NIH / NHLBI · 睡眠呼吸暂停治疗', url: 'https://www.nhlbi.nih.gov/health/sleep-apnea/treatment' },
  osaDaily: { label: 'NIH / NHLBI · 带着睡眠呼吸暂停生活', url: 'https://www.nhlbi.nih.gov/health/sleep-apnea/living-with' },
  quit: { label: 'WHO 2024 · 成人戒烟治疗', url: 'https://www.who.int/publications/i/item/9789240096431' },
  quitMedicines: { label: 'CDC · 戒烟药物与支持', url: 'https://www.cdc.gov/tobacco/hcp/patient-care-settings/clinical.html' },
  withdrawal: { label: 'CDC · 烟瘾与戒断应对', url: 'https://www.cdc.gov/tobacco/campaign/tips/quit-smoking/7-common-withdrawal-symptoms/' },
};

export const EDUCATION_TOPICS = Object.freeze([
  { id: 'copd', name: '慢性阻塞性肺疾病（慢阻肺）', shortName: '慢阻肺' },
  { id: 'asthma', name: '支气管哮喘', shortName: '哮喘' },
  { id: 'bronchiectasis', name: '支气管扩张', shortName: '支气管扩张' },
  { id: 'lungcancer', name: '肺癌（围手术期与康复）', shortName: '肺癌康复' },
  { id: 'pneumoconiosis', name: '尘肺病', shortName: '尘肺病' },
  { id: 'ild', name: '间质性肺疾病', shortName: '间质性肺病' },
  { id: 'pneumothorax', name: '气胸（恢复期）', shortName: '气胸恢复' },
  { id: 'effusion', name: '胸腔积液', shortName: '胸腔积液' },
  { id: 'tb', name: '肺结核', shortName: '肺结核' },
  { id: 'corpulmonale', name: '慢性肺源性心脏病', shortName: '肺心病' },
  { id: 'osa', name: '阻塞性睡眠呼吸暂停', shortName: '睡眠呼吸暂停' },
  { id: 'quit', name: '戒烟支持', shortName: '戒烟支持' },
].map(topic => Object.freeze(topic)));

const section = (title, items, ...sourceKeys) => ({ title, items, sourceKeys });
const topic = (title, intro, sections, urgent, sourceKeys) => ({ title, intro, sections, urgent, sourceKeys });
const VACCINE_ADVICE = '每年关注流感疫苗；肺炎球菌、新冠及其他适用疫苗，按年龄、疾病风险、接种史和当地接种政策与医护共同确定。';
const OXYGEN_ADVICE = '氧疗是否需要、目标血氧、流量和每天使用时间都按个人医嘱执行；不要因气促或单次读数自行改变氧气设置。';

const DATA = {
  copd: topic('慢阻肺：让每一天的呼吸更从容', '稳定期的规律治疗、戒烟、肺康复和及时识别加重同样重要。呼吸练习可以辅助日常活动，不能代替规范治疗。', [
    section('规范用药', [
      '按医嘱使用长效吸入药物；即使今天症状轻，也不要自行停药或减量。不同患者需要的药物组合不同。',
      '复诊时向医护演示吸入方法；核对吸入器是否还有药。含吸入激素的药物使用后，按说明漱口。',
      '外出带好必要药物和医护联系方式，保存个人加重应对计划。',
    ], 'gold'),
    section('疫苗接种', [VACCINE_ADVICE, '带上既往疫苗记录咨询接种门诊；是否需要后续剂次，取决于已经接种的品种和个人情况。'], 'gold', 'vaccines'),
    section('肺康复与活动', [
      '与医护讨论参加规范肺康复项目，包括运动、呼吸技巧、营养和自我管理指导。',
      '散步或其他合适活动从舒适强度开始，可分段休息；不要为了完成时长忍耐胸痛、头晕或明显气促。',
      '缩唇呼吸可先由医护指导，轻柔吸气、缓慢呼气；腹式呼吸是否适合也应先确认，不强迫深吸或屏息。',
    ], 'rehab', 'breathing'),
    section('氧疗与通气', [OXYGEN_ADVICE, '如已使用无创通气，按个人方案佩戴、清洁和复查；新的嗜睡、头痛或意识变化应及时报告。', '氧气附近不能吸烟或使用明火；设备存放和用电遵循供应商的安全要求。'], 'oxygen', 'oxygenSafety'),
    section('生活方式', [
      '戒烟并远离二手烟、电子烟气溶胶、油烟和粉尘；空气质量差时减少暴露。',
      '保持手卫生和室内通风，呼吸道感染流行时做好防护，减少与明显生病者近距离接触。',
      '均衡饮食，气促影响进食时可少量多餐；明显消瘦、体重增加或食欲差时咨询营养和医疗团队。',
    ], 'gold'),
    section('自我管理', [
      '记录与平时相比的气促、痰量、痰色和活动能力。痰量增多、变脓、发热或气促加重时，尽早联系医护。',
      '如医护要求监测血氧，按示范正确测量并记录个人基线；持续明显下降或伴不适，按行动计划寻求帮助。',
      '症状加重时先暂停训练；没有医生预先写明的计划，不自行加抗生素、激素或改变氧流量。',
    ], 'gold', 'oxygen'),
  ], [
    '静息也明显喘憋、难以说完整句子，或呼吸困难快速加重：立即停止活动，寻求急救。',
    '口唇发紫、嗜睡、意识模糊、晕厥，或胸痛伴呼吸困难：拨打当地急救电话；中国大陆为 120。',
    '咯血明显增多或伴呼吸困难、胸背痛：立即就医；少量血丝也应尽快评估。',
    '发热、脓痰增多、新下肢水肿、尿少或不能平卧：尽快联系医护；严重不适按急救处理。',
  ], ['gold', 'rehab', 'oxygen', 'vaccines', 'blood']),

  asthma: topic('哮喘：规范抗炎，掌握行动计划', '哮喘症状可以波动，感觉良好也不能只凭体感判断风险。知道每天怎么治疗、症状变差时怎么处理，会让生活更安心。', [
    section('规范治疗', [
      '成人哮喘通常需要含吸入糖皮质激素（ICS）的抗炎方案；按照医护确认的处方使用，不自行减停。',
      '缓解药物及是否兼作维持药物，由医护为你选择；不要只依靠频繁使用短效缓解药控制病情。',
      '随身带好个人缓解药，核对吸入器用法和剩余药量；含吸入激素的药物用后按说明漱口。',
    ], 'gina'),
    section('自我监测', [
      '和医护一起制定书面哮喘行动计划，写明平时用药、症状加重时的步骤和何时就医。',
      '记录夜间憋醒、日间症状、活动受限和缓解药使用情况；复诊时带上已有 ACT 总分。',
      '医护建议监测峰流速时，先学会方法并了解个人最佳值；按自己的行动计划解释结果。',
    ], 'gina'),
    section('过敏原与诱因管理', [
      '识别自己的诱因，如花粉、霉菌、宠物、粉尘或刺激性气味；针对明确诱因减少暴露。',
      '戒烟，远离二手烟；运动前热身，在合适的环境活动，运动诱发症状按既有行动计划处理。',
      '告诉医护既往药物过敏或服用阿司匹林、止痛药后喘憋的经历；新增药物前先咨询。',
    ], 'gina'),
    section('生活方式', [
      '规律开展自己喜欢且能耐受的活动；没有一种运动适合所有人，游泳也应留意场地刺激物和个人反应。',
      '均衡饮食、维持适合的体重和规律作息。只回避已确认的食物过敏，不自行大范围忌口。',
      '呼吸与放松练习是补充措施，不能替代抗炎治疗，也不能用来硬扛急性发作。',
    ], 'gina'),
    section('随访与疫苗', [
      '按约定复诊，检查症状控制、发作风险、吸入方法和依从性；发生加重后应尽早随访。',
      VACCINE_ADVICE,
      '控制改善后的药物调整也应由医护决定；准备旅行前，确认药物储备和急救联系方式。',
    ], 'gina', 'vaccines'),
  ], [
    '按个人行动计划使用缓解药后仍不缓解，或症状持续加重：尽快寻求紧急医疗帮助。',
    '只能说单字、明显呼吸费力、口唇发紫、极度疲惫，或出现嗜睡、意识模糊：立即急救。',
    '峰流速进入个人行动计划的危险范围，且处理后没有改善：按计划就医，不继续训练。',
    '有既往重症发作或重症监护经历者，应和医护事先明确更早求助的条件。',
  ], ['gina', 'vaccines']),

  bronchiectasis: topic('支气管扩张：学会排痰，识别加重', '气道廓清、感染管理和个人随访计划是日常照护的核心。适合自己的排痰方法需要专业示范，不能用更强的咳嗽代替。', [
    section('气道廓清', [
      '请呼吸治疗师或熟悉支扩的物理治疗师示范适合你的排痰方法、姿势和频率，例如轻柔哈气咳或辅助装置。',
      '在舒适时练习，不自行增加强度；体位引流、拍背并非人人适合，有反流等问题时尤其需要调整。',
      '饮水量按自己的心肾情况和医嘱安排。新发或增多的咯血时暂停排痰训练，及时就医。',
    ], 'bronchiectasis', 'blood'),
    section('感染与加重管理', [
      '气促、痰量、痰色、疲劳或发热比平时明显变化时，尽早联系医护；按要求留取痰标本。',
      '抗生素根据个人情况和痰培养决定，不自行使用家中剩药或随意延长疗程。',
      '反复加重者可与专科讨论长期预防治疗；口服或吸入抗生素需评估适应证、耐药与不良反应。',
    ], 'bronchiectasis'),
    section('预防与疫苗', [VACCINE_ADVICE, '戒烟，注意口腔卫生、手卫生和设备清洁；排痰装置按说明清洗、干燥，不与他人共用。'], 'bronchiectasis', 'vaccines'),
    section('咯血时的处理', [
      '即使只有少量血丝，也应尽快联系医护了解原因；停止拍背、体位引流和用力呼吸训练。',
      '出血明显、持续增加，或伴气促、胸痛、心跳很快、头晕时立即呼救，不等待达到某个出血量。',
      '不要自行驾车；让身边的人协助，按急救调度指导保持呼吸通畅，不自行尝试强行排血或特殊引流体位。',
    ], 'blood'),
    section('营养与随访', [
      '均衡饮食，明显消瘦或进食困难时咨询营养团队；定期讨论症状、加重次数和活动能力。',
      '肺功能、痰检和影像检查按需要安排，不把反复 CT 当作固定日常项目。',
      '局限病变、反复严重感染或咯血等情况，交由专科评估进一步治疗。',
    ], 'bronchiectasis'),
  ], [
    '咯血明显增多，或咯血伴呼吸困难、胸背痛、心跳很快、晕厥：立即急救。',
    '高热、脓痰明显增多、气促加重或不能正常进食饮水：尽快联系医护。',
    '面色苍白、冷汗、口唇发紫或意识改变：立即拨打急救电话。',
    '突发胸痛或新的明显呼吸困难：停止活动并及时就医。',
  ], ['bronchiectasis', 'blood', 'vaccines']),

  lungcancer: topic('肺癌康复：照顾好治疗中的自己', '不同治疗和恢复阶段的注意事项不同。把症状、营养、活动和复诊安排与肿瘤团队一起管理，比追求统一的训练进度更重要。', [
    section('治疗与随访', [
      '按照肿瘤团队安排完成治疗和复诊；不要因不舒服、短暂好转或网络信息自行中断疗程。',
      '影像、血液检查和随访间隔按病期、治疗方式和个人情况决定；出现新症状不要等到约定复诊日。',
      '告诉医护所有正在使用的药物、保健品和草药，避免相互作用。',
    ], 'cancerSurgery'),
    section('肺康复', [
      '术前尽早戒烟，向团队询问预康复与适合自己的活动。术后下床和活动按医护评估逐步恢复。',
      '若医护安排肺量计、呼吸或有效咳嗽练习，先学会正确方法，并在舒适范围内完成。',
      '切口疼痛、胸管或其他问题会影响活动；不要自行加大吹气、屏息或深呼吸的力度。',
    ], 'cancerRecovery', 'rehab'),
    section('营养支持', [
      '均衡进食，保证适合自己的能量与蛋白质；体重持续下降或吃不下时，尽早联系营养团队。',
      '恶心、呕吐或气味敏感时可少量多餐，选择能接受的食物；补充剂由团队根据需要推荐。',
      '遵守食品安全要求；发热或持续呕吐、不能喝水时，应及时就医。',
    ], 'cancerNutrition', 'cancerInfection'),
    section('血栓预防', [
      '在医护允许下经常改变姿势、逐步走动，可询问是否需要踝泵或其他活动。',
      '如已开具抗凝药或防血栓措施，按个人方案执行；饮水按心肾情况安排。',
      '新发单侧腿肿痛需要及时评估；伴突发气促、胸痛或晕厥时立即急救。',
    ], 'cancerRecovery', 'embolism'),
    section('症状与心理管理', [
      '疼痛、气促、失眠或焦虑应主动告诉团队，不需要硬扛；镇痛和其他药物按个人处方使用。',
      '把家人或信任的人纳入支持计划；需要时咨询心理、康复或症状控制服务。',
      '化疗或其他免疫抑制治疗期间发热可能是紧急情况；达到团队警戒值或 38°C 及以上时，立即联系治疗团队。',
    ], 'cancerInfection', 'cancerSurgery'),
    section('疫苗与感染防护', [
      '接种品种和时间要与肿瘤团队确认，治疗阶段可能影响疫苗效果或适用性。',
      '免疫受抑制时，活疫苗需由专业团队评估，不自行接种；注意手卫生，避开明显感染者。',
    ], 'cancerInfection', 'immunization'),
  ], [
    '治疗期间发热达到团队警戒值，或 38°C 及以上：立即联系团队；不要只用退热药遮盖症状后等待。',
    '突发明显胸痛、呼吸困难、晕厥或咯血明显增多：立即急救。',
    '面颈或上肢突然肿胀，伴吞咽或呼吸困难：立即就医。',
    '新发肢体无力、意识变化、剧烈头痛或反复呕吐：及时紧急评估。',
  ], ['cancerSurgery', 'cancerInfection', 'cancerNutrition', 'cancerRecovery', 'rehab']),

  pneumoconiosis: topic('尘肺病：减少暴露，管理并发症', '脱离或有效控制职业粉尘暴露，是保护肺部的重要一步。康复和日常照护有助于保持活动能力，但不能把已经形成的肺部瘢痕吹开。', [
    section('脱离粉尘与职业防护', [
      '与职业健康和呼吸专科讨论停止进一步有害粉尘暴露，保存工作暴露和体检资料。',
      '工作场所应优先采用湿式作业、局部通风和降尘等措施；需要呼吸防护时使用适合并经过密合性检查的防护用品。',
      '普通口罩不能替代职业粉尘控制，也不能把防护用品当作继续高暴露作业的保证。',
    ], 'dust', 'silica'),
    section('感染与并发症预防', [VACCINE_ADVICE, '戒烟；出现持续咳嗽、发热、盗汗、消瘦或咯血时，尽快评估感染和结核等原因，尤其有矽尘暴露者。'], 'silica', 'vaccines'),
    section('肺康复', [
      '稳定期与医护讨论规范肺康复，选择能耐受的步行、肌力及呼吸技巧训练。',
      '活动应分段、保留休息；出现胸痛、头晕或气促明显加重就停止，不用强吹或屏息锻炼代替康复。',
    ], 'rehab'),
    section('营养与生活', [
      '均衡营养、适量蛋白质和蔬果，维持适合的体重；明显消瘦时寻求营养支持。',
      '规律作息，做好呼吸道感染防护；需要氧疗者按个人处方使用并遵守防火要求。',
    ], 'silica', 'oxygenSafety'),
    section('定期复查', [
      '参加职业健康及呼吸专科随访，按医护安排检查肺功能、影像和其他并发症。',
      '带上历次检查和暴露资料，记录活动能力、血氧变化或水肿等新问题；不要自行反复安排 CT。',
    ], 'silica'),
  ], [
    '突发一侧胸痛伴呼吸困难：立即评估气胸等紧急问题。',
    '新咯血或咯血增多：及时就医；伴明显气促或头晕时立即急救。',
    '高热、明显脓痰或持续症状加重：尽快联系医护。',
    '口唇发紫、嗜睡、意识改变，或水肿伴严重气促：立即急救。',
  ], ['silica', 'dust', 'rehab', 'blood', 'vaccines']),

  ild: topic('间质性肺疾病：按病因治疗，稳妥活动', '间质性肺疾病包含多种病因和亚型，治疗并不相同。明确自己的诊断、药物目的和随访指标，有助于长期管理。', [
    section('规范治疗', [
      '按专科确定的病因和亚型治疗；抗纤维化、抗炎或免疫调节药并非所有患者都需要。',
      '如已使用尼达尼布、吡非尼酮或其他药物，按个人处方及要求检查肝功能、处理胃肠等不良反应。',
      '不自行停药、加量或购买所谓逆转纤维化的产品；持续副作用应联系团队调整。',
    ], 'ild', 'ipf'),
    section('暴露规避与戒烟', [
      '告诉医护接触鸟类、霉菌、粉尘、化学气体和工作环境的情况，针对可疑致病暴露采取措施。',
      '戒烟，减少二手烟和刺激物；不因肺病而自行停用其他处方药，先讨论其是否可能有关。',
    ], 'ild'),
    section('疫苗与感染预防', [VACCINE_ADVICE, '注意手卫生和通风；使用免疫抑制药时，疫苗与感染防护计划需要进一步个体化。'], 'ipf', 'vaccines'),
    section('氧疗与康复', [OXYGEN_ADVICE, '专业肺康复可帮助改善活动能力；运动中的氧需求与静息时可能不同，应由医护评估。', '活动以舒适和安全为准，分段休息；不要依靠放慢呼吸或减少活动来掩盖持续低氧。'], 'rehab', 'oxygen'),
    section('合并症与随访', [
      '按计划评估肺功能、活动耐力和必要影像；记录气促、咳嗽、体重及血氧的变化。',
      '有烧心、反酸等症状时按相应疾病诊治；不要只为了肺纤维化自行服用抑酸药。',
      '需要时与专科讨论营养、心理支持、肺移植评估或症状控制，选择适合个人的目标。',
    ], 'ild', 'ipf'),
  ], [
    '数天到数周内气促明显加重、活动能力骤降，或血氧持续较基线下降：尽快就医，不等待一个月。',
    '静息明显呼吸困难、口唇发紫、胸痛、晕厥或意识改变：立即急救。',
    '新发咯血、发热或快速变化的咳嗽：及时评估感染等原因。',
    '持续食欲差、消瘦或乏力需要尽早联系医护，不继续强行完成训练。',
  ], ['ild', 'ipf', 'rehab', 'oxygen', 'vaccines']),

  pneumothorax: topic('气胸恢复期：先确认恢复，再安排活动', '恢复和复发风险与病因、治疗方式及影像结果有关。活动、旅行和呼吸训练，应与主管团队逐项确认。', [
    section('活动与压力管理', [
      '未确认气胸吸收、仍有胸管或症状时，不自行开始呼吸训练、剧烈运动、负重或屏息用力。',
      '恢复后的步行、工作和运动时间按个人情况安排；避免用强吹气、吹气球等方式检验肺是否恢复。',
      '气胸未在影像上完全吸收时不能乘机；确认完全吸收后，一般仍需至少等待 7 天，并经主管医护评估。',
      '通常应避免使用压缩气瓶潜水；存在特殊治疗后的例外时，也须由胸外科和潜水医学专业人员评估。',
    ], 'pleural', 'flight'),
    section('复发预防', [
      '戒烟并避免烟草暴露；询问自己的复发风险和哪些症状需要马上回医院。',
      '曾经复发、双侧病变或从事高风险职业者，可与专科讨论是否需要进一步预防治疗。',
    ], 'pleural'),
    section('随访', [
      '按出院计划复查胸片或其他检查，以确认吸收和治疗效果；胸管或门诊装置可能需要更早复查。',
      '出现新胸痛、气促或管路异常，不等到复诊日期再求助。',
    ], 'pleural', 'drain'),
    section('营养与日常照护', [
      '均衡饮食，休息与轻量活动按医护安排；有切口时遵循伤口清洁和换药要求。',
      '保持排便通畅，需要药物帮助时先咨询；疼痛影响呼吸或活动时联系团队。',
    ], 'drain'),
    section('训练警示', [
      '目前是否可以进行呼吸或运动训练，需主管团队明确允许；没有允许前以日常照护和随访为主。',
      '新胸痛或呼吸困难时立即停止所有训练，不靠呼吸游戏自行缓解。',
    ], 'pleural'),
  ], [
    '突发一侧尖锐胸痛并出现气促，或气促持续加重：立即就医，警惕复发。',
    '严重呼吸困难、口唇发紫、晕厥、冷汗或意识变化：立即拨打急救电话。',
    '胸管脱落、明显漏气，或颈胸部肿胀伴不适：及时联系团队；伴严重气促时立即急救。',
  ], ['pleural', 'flight', 'drain']),

  effusion: topic('胸腔积液：明确病因，留意呼吸变化', '积液是一种表现，原因可能包括感染、心脏病、肿瘤或其他疾病。治疗重点是病因和症状，并不是单靠呼吸训练把积液排走。', [
    section('病因治疗优先', [
      '按医护安排完成病因检查和治疗，可能需要影像、抽液化验或其他检查。',
      '积液吸收、是否继续引流和复查时间由团队决定；不要自行拔管、夹管或调节引流。',
      '有切口或胸管时，保持敷料和管路按护理要求管理；疼痛、红肿、渗液或发热要及时报告。',
    ], 'pleural', 'drain'),
    section('呼吸与活动', [
      '症状和治疗稳定后，按医护允许逐步恢复轻量步行；需要呼吸练习时先接受指导。',
      '有胸管、积液较多、胸痛或明显气促时，不自行增加深呼吸或吹气练习；不以训练代替病因治疗。',
    ], 'drain', 'pleural'),
    section('营养与饮水', [
      '均衡饮食，根据体重和营养情况咨询是否需要额外支持，不把高蛋白饮食当作所有积液的统一治疗。',
      '有心衰或肾病时，饮水和盐摄入按自己的医嘱安排；不自行大量饮水或严格限水。',
    ], 'heartMonitoring'),
    section('自我监测', [
      '记录气促、胸痛、体温和日常活动能力，带到复诊；如医护要求，也记录体重、尿量和水肿。',
      '管路松动、脱落、出血、敷料异常或呼吸突然变差，及时联系护理或医疗团队。',
    ], 'drain', 'heartMonitoring'),
  ], [
    '呼吸困难突然加重、静息也喘憋或不能平卧：及时紧急评估。',
    '胸痛伴发热、寒战，或引流处明显红肿流脓：尽快联系医护。',
    '咯血明显增多、胸痛伴严重气促、晕厥或意识改变：立即急救。',
    '尿量明显减少、水肿迅速加重或管路脱落：及时联系治疗团队。',
  ], ['pleural', 'drain', 'heartMonitoring', 'blood']),

  tb: topic('肺结核：规律全程治疗，保护自己与家人', '结核通常可以治愈。按个人方案完成治疗、及时报告不良反应和落实感染控制，是康复的关键。', [
    section('规范治疗', [
      '按结核专科确定的药物组合和疗程规律服药；疗程会受耐药检测、病情和所用方案影响，不自行套用固定月份。',
      '使用提醒、药盒或团队安排的督导方式防止漏服；忘记服药时联系医护，不自行双倍补服。',
      '告诉医护其他药物、妊娠或哺乳情况；抗结核药可能发生相互作用。服药期间避免饮酒。',
      '利福平或利福喷汀可使尿液、泪液等变橙色；但伴黄疸、深褐尿或明显不适时不能只当作正常变色。',
    ], 'tbTreatment', 'tbSafety'),
    section('感染控制', [
      '传染性和何时可以恢复工作、上学或聚会，由结核团队根据检查与治疗反应判断，不只看服药天数。',
      '按指导佩戴口罩、保持通风、遮掩咳嗽和喷嚏；不随地吐痰，按当地要求妥善处理痰液和用过的纸巾。',
      '家中或工作中的密切接触者应按公共卫生安排筛查，儿童、免疫功能低下者更需及时评估。',
    ], 'tb'),
    section('不良反应与随访', [
      '按团队安排做临床复查、痰检和必要的血液或影像检查；检查频率随所用药物和个人风险变化。',
      '黄疸、持续明显恶心呕吐、深褐尿、广泛皮疹或视物和色觉改变，应立即联系结核团队，在继续下一剂前确认处理。',
      '手脚持续麻木、耳鸣或听力变化等新问题也要及时报告，不自行增加、替换或长期停用药物。',
    ], 'tbSafety', 'tbTreatment'),
    section('营养与休息', [
      '均衡饮食、规律作息；进食困难、体重下降或经济困难时主动寻求营养和社会支持。',
      '症状稳定、医护评估允许后逐步恢复活动；发热、咯血、明显气促或仍有传播风险时，不参加群体训练。',
    ], 'tb', 'tbTreatment'),
  ], [
    '咯血明显增多或伴气促、胸痛、心跳很快、头晕：立即急救。',
    '突发胸痛、严重呼吸困难或意识变化：立即就医。',
    '黄疸、持续剧烈呕吐、广泛皮疹、面唇肿胀或呼吸困难：紧急联系医护；严重过敏症状立即急救。',
    '新视力或色觉变化、耳鸣、听力下降，或持续高热：立即联系结核团队评估。',
  ], ['tb', 'tbTreatment', 'tbSafety', 'blood']),

  corpulmonale: topic('肺心病：同时关注呼吸与心脏负担', '慢性肺病及低氧可能增加右心负担。日常照护需要兼顾原发肺病、体液变化和氧疗安全，药物不能套用统一方案。', [
    section('氧疗管理', [OXYGEN_ADVICE, '合并二氧化碳潴留或需要无创通气时，按专科安排复查和使用设备。', '新的嗜睡、头痛或意识变化需要及时评估；氧气附近严禁烟火。'], 'oxygen', 'oxygenSafety'),
    section('用药安全', [
      '利尿剂及其他心肺药物按个人处方使用，按要求复查肾功能和电解质；不根据水肿自行加倍。',
      '镇静、安眠、止痛或止咳药使用前，说明自己的呼吸疾病和用氧情况，先咨询医护。',
      '原发肺病的吸入药物也应规范使用，按说明完成吸入后护理。',
    ], 'heartTreatment', 'oxygen'),
    section('饮食与排便', [
      '均衡进食，气促时可少量多餐；盐和饮水限制按心肾功能及个人医嘱安排。',
      '不要自行采用极严格限水、限盐或补钾方案；保持排便通畅，有困难时咨询团队。',
    ], 'heartMonitoring'),
    section('每日监测', [
      '如医护要求，每天在相近条件下称体重并记录，观察尿量、腿部水肿和活动能力。',
      '短期体重明显变化、尿量减少或水肿加重时，按个人警戒范围联系团队，不仅凭某个固定数字调整利尿剂。',
      '家人可帮助留意新的嗜睡、反应变慢、夜间憋醒或无法平卧。',
    ], 'heartMonitoring', 'pulmonaryHeart'),
    section('感染预防', [VACCINE_ADVICE, '戒烟并做好手卫生；气促、痰量、痰色或体温变化要尽早报告，感染可能使心肺负担加重。'], 'pulmonaryHeart', 'vaccines'),
    section('康复与活动', [
      '状态稳定且医护允许后，参加适合自己的心肺康复，活动时可分段休息。',
      '加重、明显水肿、胸痛、头晕或静息气促时先停止训练；不通过屏息或强吹来锻炼心肺。',
    ], 'rehab', 'pulmonaryHeart'),
  ], [
    '嗜睡、意识模糊、昏迷或新的明显反应迟钝：立即急救。',
    '气促快速加重、口唇发紫、胸痛或晕厥：立即拨打急救电话。',
    '尿少、水肿迅速加重、无法平卧或腹胀明显：尽快联系医疗团队。',
    '持续心悸伴气促、胸痛或头晕，或咯血明显增多：紧急评估。',
  ], ['pulmonaryHeart', 'heartTreatment', 'heartMonitoring', 'oxygen', 'rehab']),

  osa: topic('睡眠呼吸暂停：让治疗陪伴每一次睡眠', '打鼾不等于已经诊断睡眠呼吸暂停。确诊后，体重管理、适合的设备治疗和规律随访一起帮助改善睡眠与白天状态。', [
    section('体重管理', [
      '与医护制定适合自己的饮食、活动和体重目标；体重过高者减重可能改善睡眠呼吸暂停。',
      '不要只凭体重下降或不再打鼾就停用设备；是否调整治疗，需要评估睡眠和症状。',
    ], 'osa'),
    section('PAP / CPAP 治疗', [
      '如果医护开具 PAP 或 CPAP，睡眠时按方案佩戴；设备种类、压力和替代治疗由团队选择。',
      '面罩漏气、鼻干、腹胀或难以适应时及时求助，不自行更改压力或放弃治疗。',
      '按厂家说明清洁面罩、管路和湿化器，定期检查耗材；呼吸小游戏不能代替设备或其他规范治疗。',
    ], 'osa', 'osaDaily'),
    section('睡眠卫生', [
      '保持规律作息，给自己足够睡眠时间；适合的患者可按医护建议侧卧睡眠。',
      '避免用酒精帮助入睡，限制饮酒；镇静安眠药或其他可能影响呼吸的药物，先和医护讨论。',
    ], 'osa'),
    section('戒烟与生活方式', [
      '戒烟并减少烟草暴露；规律开展能耐受的活动。',
      '不要用自行购买的止鼾产品替代诊断或治疗；需要口腔矫治器时由专业人员评估和制作。',
    ], 'osa'),
    section('合并症与随访', [
      '定期评估治疗效果和设备使用，告诉医护白天嗜睡、晨起头痛或夜间不适是否改善。',
      '合并高血压、糖尿病、心律失常等，应持续接受相应治疗；需要复查睡眠监测时按团队安排。',
      '手术或麻醉前告知睡眠呼吸暂停及设备使用情况。',
    ], 'osaDaily'),
    section('驾驶与工作安全', [
      '白天明显嗜睡、开车犯困或曾有险情时，先避免驾驶和危险机械、高空作业，及时就医。',
      '不要依赖咖啡、开窗或播放音乐硬撑驾驶；请家人或其他交通方式协助出行。',
    ], 'osaDaily'),
  ], [
    '呼吸异常后难以唤醒、意识恢复差、口唇发紫：立即急救。',
    '胸痛、晕厥或心悸伴严重气促：立即就医。',
    '极度嗜睡造成驾驶或工作险情：立即停止相关活动并尽快评估。',
    '新出现剧烈头痛或意识混乱：及时紧急评估。',
  ], ['osa', 'osaDaily']),

  quit: topic('戒烟支持：每一次尝试都在积累经验', '戒烟可以在任何阶段开始。把行为支持、合适的药物和家人的帮助组合起来，会比独自硬撑更容易坚持。', [
    section('戒烟准备', [
      '选一个可行的戒烟日，告诉家人和同事你需要的支持；清理烟草、烟具和常见的吸烟提示物。',
      '写下自己戒烟的理由，提前识别饭后、喝酒、压力或社交等触发场景，准备替代做法。',
      '向戒烟门诊或基层医护询问可用的行为支持、药物和随访服务。',
    ], 'quit', 'withdrawal'),
    section('戒烟药物', [
      '尼古丁替代、伐尼克兰、安非他酮等是可讨论的治疗选择，需结合疾病、其他药物及当地可及性评估。',
      '药物与咨询支持可以联合使用；使用方法和疗程按医护或药品说明确认，不自行叠加药物。',
      '有妊娠、哺乳、癫痫或精神健康相关病史时，先说明情况，选择适合自己的方案。',
    ], 'quit', 'quitMedicines'),
    section('烟瘾应对', [
      '烟瘾来了先延迟一下，转移注意力：短暂散步、刷牙、联系支持你的人，或做轻柔舒适的呼吸。',
      '可以适量喝水；有心肾疾病者遵循自己的饮水安排。不强迫深吸、屏息或快速连续呼吸。',
      '改变伴烟习惯，尤其留意饮酒、咖啡和聚会场景；烟瘾会起伏，先让这一阵过去。',
    ], 'withdrawal'),
    section('防复吸', [
      '偶尔吸了一支不等于所有努力归零；尽快回到计划，看看当时的触发原因。',
      '定期随访，给无烟的日子设置小奖励；把药物不适、强烈烟瘾和难以坚持的地方告诉团队。',
    ], 'quitMedicines', 'withdrawal'),
    section('生活方式', [
      '规律进食和活动，关注睡眠与情绪，不用极端节食应对可能的食欲或体重变化。',
      '烦躁、注意力下降或睡不好可能出现在戒断期；症状严重、持续不缓解时主动寻求帮助。',
    ], 'withdrawal'),
    section('保护家人', [
      '家中和车内保持无烟，不在儿童、孕妇或其他人身边吸烟；开窗不能完全消除烟草暴露。',
      '邀请家人支持无烟环境和生活习惯；每减少一次暴露，都有助于保护自己和身边的人。',
    ], 'quit'),
  ], [
    '出现持续严重情绪低落或自伤念头：立即寻求医疗帮助，让信任的人陪伴；药物是否调整由医疗人员评估。',
    '戒烟药使用后出现面唇肿胀、严重皮疹或呼吸困难：立即就医；严重症状拨打急救电话。',
    '胸痛伴气促、晕厥或咯血明显增多：立即急救；持续声音嘶哑、吞咽困难等也应及时检查。',
  ], ['quit', 'quitMedicines', 'withdrawal', 'blood']),
};

function resolveTopic(topicId) {
  return typeof topicId === 'string' && Object.hasOwn(DATA, topicId) ? topicId : 'copd';
}

// Short narration is also the visible caption script for the local education videos.
export const EDUCATION_VIDEO_SCRIPTS = Object.freeze({
  copd: [
    { title: '认识慢阻肺', text: '慢阻肺需要长期管理。规律治疗、戒烟和适合自己的康复，能帮助维持日常活动能力。' },
    { title: '先把药用对', text: '吸入药按医嘱使用。复诊时演示吸入方法；含激素的药物用后漱口，不自行减药或停药。' },
    { title: '稳定后再练习', text: '急性加重治疗后，病情稳定并经医护评估，可以开展肺康复；从轻量活动开始，分段休息。' },
    { title: '及时求助', text: '气促、痰量或痰色比平时明显变化，尽快联系医护。严重喘憋、胸痛或意识异常，立即拨打120。' },
  ],
  asthma: [
    { title: '认识哮喘', text: '哮喘症状会波动，感觉好也需要继续规范治疗。呼吸练习只能辅助，不能替代抗炎治疗。' },
    { title: '规律吸入', text: '按个人处方使用吸入药，核对吸入方法与余量。把自己的缓解药和书面行动计划放在身边。' },
    { title: '记录与避开诱因', text: '留意夜间憋醒、活动受限和缓解药使用。远离烟雾及明确诱因；控制变差时尽早复诊。' },
    { title: '发作时别硬撑', text: '按行动计划处理仍不缓解，要紧急就医。只能说单字、口唇发紫或嗜睡，立即拨打120。' },
  ],
  bronchiectasis: [
    { title: '认识支气管扩张', text: '支气管扩张容易反复咳嗽、咳痰或感染。学习适合自己的排痰方法，比用力猛咳更重要。' },
    { title: '学习排痰', text: '请医护示范排痰姿势和方法，按自己的安排轻柔练习。排痰装置要按说明清洁并晾干。' },
    { title: '发现变化就联系', text: '痰量、痰色、气促或体温明显改变，尽快联系医护。抗生素按检查和处方使用，不自行吃剩药。' },
    { title: '咯血时暂停训练', text: '新咯血先停止排痰和训练，及时就医。出血增多并伴喘憋或头晕，立即呼救，不自行驾车。' },
  ],
  lungcancer: [
    { title: '照顾治疗中的自己', text: '肺癌康复安排随治疗和恢复阶段变化。把营养、活动与复诊计划同肿瘤团队一起确定。' },
    { title: '治疗与复诊', text: '按时治疗和复诊，主动报告新症状。药物、保健品和草药都告诉团队，不自行中断疗程。' },
    { title: '吃得下，慢慢活动', text: '按医护允许逐步走动，可分段休息。少量多餐；吃不下或体重持续下降，尽早寻求营养支持。' },
    { title: '出现警示先求助', text: '治疗期间发热达到团队警戒值或38度，立即联系团队。突发胸痛、严重气促或晕厥，立即呼救。' },
  ],
  pneumoconiosis: [
    { title: '认识尘肺病', text: '尘肺病与长期职业粉尘暴露有关。保护肺部要先减少有害暴露，康复不能把肺部瘢痕吹开。' },
    { title: '远离粉尘和烟雾', text: '与职业健康及呼吸专科讨论减少粉尘暴露。按岗位要求做好防护，戒烟并远离二手烟。' },
    { title: '规律随访和活动', text: '保存工作暴露与检查资料，按计划复诊。病情稳定并获允许后，从能耐受的轻量活动开始。' },
    { title: '别忽视新症状', text: '新发咯血、发热或气促加重，及时就医。突然一侧胸痛伴喘憋，立即停止活动并寻求急救。' },
  ],
  ild: [
    { title: '认识间质性肺病', text: '间质性肺病有多种病因，药物并不相同。先明确自己的诊断，再按专科方案治疗和随访。' },
    { title: '用药与避开暴露', text: '按处方用药并完成必要复查。把鸟类、霉菌和粉尘接触告诉医护，不买所谓逆转纤维化产品。' },
    { title: '舒适地活动', text: '在医护评估后开展肺康复，活动可分段休息。氧疗按个人医嘱，运动中的氧需求也要评估。' },
    { title: '呼吸变差别等待', text: '气促明显加重、活动能力骤降或血氧持续下降，尽快就医。严重喘憋、胸痛或晕厥，立即呼救。' },
  ],
  pneumothorax: [
    { title: '气胸恢复要确认', text: '气胸的恢复和复发风险因人而异。先按计划复查，确认吸收及治疗效果，再安排活动和旅行。' },
    { title: '训练先获允许', text: '仍有胸管、胸痛或气促时，不自行练呼吸或剧烈运动。恢复训练前，请主管团队明确允许。' },
    { title: '旅行先咨询', text: '气胸未完全吸收不能乘机；完全吸收后一般仍要等至少7天并评估。压缩气瓶潜水另需专科意见。' },
    { title: '警惕复发', text: '突然一侧胸痛并出现气促，应立即就医。严重喘憋、口唇发紫或晕厥，立即停止活动并呼救。' },
  ],
  effusion: [
    { title: '先明确积液原因', text: '胸腔积液可能与感染、心脏病或肿瘤有关。重点是查清病因并治疗，呼吸训练不能排走积液。' },
    { title: '按计划治疗', text: '按医护安排检查、治疗和复查。有胸管时保持管路与敷料妥善，不自行拔管、夹管或调节引流。' },
    { title: '留意呼吸和管路', text: '记录气促、胸痛和体温。治疗与症状稳定后，按医护允许慢慢走动；饮水量按个人情况安排。' },
    { title: '异常及时报告', text: '管路脱落、胸痛伴发热或呼吸突然变差，及时求助。严重喘憋、晕厥或意识异常，立即呼救。' },
  ],
  tb: [
    { title: '肺结核需要全程治疗', text: '肺结核通常可以治愈。按个人方案规律完成疗程，落实感染防护，是恢复和保护家人的关键。' },
    { title: '规律服药', text: '使用提醒防止漏药，漏服后先联系医护，不双倍补服。按计划复查，不自行缩短或延长疗程。' },
    { title: '通风与接触者筛查', text: '按结核团队要求佩戴口罩、通风和处理痰液。密切接触者接受筛查；能否恢复聚会需团队判断。' },
    { title: '报告药物不适', text: '黄疸、明显呕吐、皮疹或视力变化，立即联系团队。咯血增多伴气促、头晕，立即寻求急救。' },
  ],
  corpulmonale: [
    { title: '兼顾肺和心脏', text: '肺心病照护需要兼顾肺病、低氧和体液变化。用药、用氧与活动都按自己的心肺团队方案。' },
    { title: '按处方用药用氧', text: '氧气设置遵医嘱，远离烟火。利尿药不因水肿自行加倍，按要求复查肾功能和电解质。' },
    { title: '观察体重与水肿', text: '按要求记录体重、尿量、腿部水肿和活动能力。状态稳定并获允许后，轻量活动、分段休息。' },
    { title: '这些变化要求助', text: '水肿加重、尿少或不能平卧，尽快联系医护。嗜睡、意识模糊、严重喘憋或晕厥，立即呼救。' },
  ],
  osa: [
    { title: '认识睡眠呼吸暂停', text: '打鼾不等于确诊。确诊睡眠呼吸暂停后，设备治疗、体重管理和随访共同帮助改善睡眠。' },
    { title: '睡觉时规范佩戴', text: '按方案使用PAP或CPAP，做好清洁。面罩漏气、鼻干或不适及时求助，不自行改压力或停用。' },
    { title: '白天和夜间都照顾', text: '规律作息，按个人目标管理体重。避免借酒助眠；明显犯困时不要驾驶或从事危险操作。' },
    { title: '及时识别危险', text: '难以唤醒、口唇发紫或意识异常，立即呼救。嗜睡影响工作或驾驶时，停止相关活动并就医。' },
  ],
  quit: [
    { title: '从今天准备戒烟', text: '戒烟任何时候都不晚。行为支持、合适的药物和家人的帮助，让你更容易坚持无烟生活。' },
    { title: '定日子，找支持', text: '选一个戒烟日，清理烟具，告诉家人你的计划。向戒烟门诊了解支持与适合自己的药物。' },
    { title: '让这一阵烟瘾过去', text: '烟瘾来了先延迟，短暂走动、刷牙或联系支持者。偶尔吸了一支也别放弃，尽快回到计划。' },
    { title: '不适时及时求助', text: '戒烟药后出现皮疹或面唇肿胀，及时就医；呼吸困难立即呼救。严重情绪低落时主动寻求帮助。' },
  ],
});

const SHORT = {
  copd: ['按医嘱吸入，不自行停药。', '戒烟，记录气促和痰的变化。', '急性加重治疗后，稳定并经医护评估可开展肺康复。'],
  asthma: ['按处方吸入，带好缓解药。', '保留书面行动计划，记录症状。', '避开烟雾和个人诱因，按时复诊。'],
  bronchiectasis: ['跟医护学排痰，不猛咳。', '痰色、痰量或体温改变，及时联系医护。', '装置按说明清洁，抗生素遵医嘱。'],
  lungcancer: ['按时治疗和复诊，报告新症状。', '少量多餐，吃不下及时求助。', '按医护允许走动，分段休息。'],
  pneumoconiosis: ['远离有害粉尘，戒烟。', '按计划复查，带上暴露资料。', '稳定并获允许后，轻量活动。'],
  ild: ['按病因治疗，不自行买药换药。', '避开有害暴露，按计划复查。', '活动和用氧先评估，分段休息。'],
  pneumothorax: ['按计划复查，确认气胸吸收。', '训练和负重前，先获医护允许。', '乘机、潜水前咨询专科。'],
  effusion: ['查清病因，按计划治疗。', '留意气促、胸痛和体温。', '有胸管时，不自行拔管或调节。'],
  tb: ['规律完成疗程，漏药先咨询。', '通风、按指导戴口罩和处理痰液。', '接触者筛查，药物不适及时报告。'],
  corpulmonale: ['用药用氧遵医嘱，氧气远离烟火。', '观察体重、尿量和水肿。', '稳定并获允许后，分段活动。'],
  osa: ['睡觉时按方案使用PAP/CPAP。', '漏气或不适求助，不自行改压力。', '规律作息；犯困时不驾驶。'],
  quit: ['选戒烟日，清理烟具。', '烟瘾来时先延迟，换一件事做。', '找家人或戒烟门诊支持；复吸后回到计划。'],
};

const ALERT = {
  copd: '气促或痰明显改变，尽快联系医护；严重喘憋、胸痛或意识异常，立即呼救。',
  asthma: '按行动计划处理仍不缓解，紧急就医；只能说单字、发紫或嗜睡，立即呼救。',
  bronchiectasis: '新咯血先暂停排痰和训练；出血增多伴喘憋、头晕，立即呼救。',
  lungcancer: '治疗期发热达到团队警戒值或38°C，立即联系团队；突发胸痛、严重气促，立即呼救。',
  pneumoconiosis: '新发咯血、发热或气促加重，及时就医；突发胸痛伴喘憋，立即呼救。',
  ild: '气促或低氧明显加重，尽快就医；严重喘憋、胸痛或晕厥，立即呼救。',
  pneumothorax: '突发胸痛或气促，立即就医；严重喘憋、发紫或晕厥，立即呼救。',
  effusion: '管路脱落或呼吸突然变差，及时求助；严重喘憋、晕厥，立即呼救。',
  tb: '黄疸、皮疹或视力改变，立即联系团队；咯血增多伴气促、头晕，立即呼救。',
  corpulmonale: '尿少、水肿加重或不能平卧，及时联系医护；嗜睡、意识异常或严重喘憋，立即呼救。',
  osa: '难以唤醒、发紫或意识异常，立即呼救；嗜睡影响驾驶，停止驾驶并就医。',
  quit: '药后皮疹、面唇肿胀及时就医；呼吸困难立即呼救，严重情绪低落及时求助。',
};

/** Returns a fresh plain object so callers cannot change shared education text. */
export function getEducation(topicId) {
  const id = resolveTopic(topicId);
  const data = DATA[id];
  const keys = [...new Set([...data.sourceKeys, ...data.sections.flatMap(item => item.sourceKeys)])];
  return {
    id, title: EDUCATION_TOPICS.find(item => item.id === id).shortName, intro: EDUCATION_VIDEO_SCRIPTS[id][0].text,
    image: { src: `assets/chapters/${id}.svg`, alt: `${EDUCATION_TOPICS.find(item => item.id === id).shortName}照护示意图` },
    sections: SHORT[id].map((item, index) => ({ title: `0${index + 1}`, items: [item] })),
    urgent: [ALERT[id]],
    details: data.sections.map(({ title, items }) => ({ title, items: [...items] })),
    additionalAlerts: [...data.urgent], sources: keys.map(key => ({ ...SOURCE[key] })),
    video: { src: `assets/education-videos/${id}.mp4`, captions: `assets/education-videos/${id}.vtt`, poster: `assets/education-scenes/${id}.webp`, title: `${EDUCATION_TOPICS.find(item => item.id === id).shortName} · 日常照护短片`, kind: 'local-captioned', checked: '2026-10-11' },
    videoCards: EDUCATION_VIDEO_SCRIPTS[id].map(item => ({ ...item })),
  };
}

/** Renders read-only education. Local media is loaded only through native playback. */
export function mountEducation(container, { initialTopic = 'copd', onTopicChange } = {}) {
  if (!container || typeof container.replaceChildren !== 'function' || !container.ownerDocument) {
    throw new TypeError('mountEducation requires a DOM container.');
  }
  const document = container.ownerDocument;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const link = source => {
    const node = element('a', source.label);
    node.href = source.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  };
  const picker = element('div', '', 'edu-topic-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', '选择健康宣教主题');
  const panel = element('div');
  panel.setAttribute('aria-live', 'polite');
  let currentId = resolveTopic(initialTopic);
  let disposed = false;
  let activeVideo;
  const pause = () => activeVideo?.pause();
  const buttons = EDUCATION_TOPICS.map(item => {
    const button = element('button', item.shortName);
    button.type = 'button';
    button.dataset.topic = item.id;
    button.title = item.name;
    picker.append(button);
    return button;
  });

  function render() {
    pause();
    const data = getEducation(currentId);
    for (const button of buttons) {
      const active = button.dataset.topic === currentId;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    }
    const heading = element('div', '', 'edu-heading');
    const picture = element('img', '', 'edu-picture');
    picture.src = data.image.src;
    picture.alt = data.image.alt;
    picture.width = 640;
    picture.height = 360;
    picture.loading = 'lazy';
    const headingText = element('div');
    headingText.append(element('h3', data.title), element('p', data.intro, 'edu-intro'));
    heading.append(picture, headingText);
    const videoCard = element('article', '', 'edu-video-card');
    activeVideo = element('video', '', 'edu-video');
    activeVideo.controls = true;
    activeVideo.playsInline = true;
    activeVideo.preload = 'none';
    activeVideo.src = data.video.src;
    activeVideo.poster = data.video.poster;
    activeVideo.setAttribute('aria-label', data.video.title);
    const captions = element('track');
    captions.kind = 'captions';
    captions.srclang = 'zh';
    captions.label = '中文字幕';
    captions.src = data.video.captions;
    // The picture already includes large Chinese text; captions remain optional.
    captions.default = false;
    activeVideo.append(captions, element('p', '浏览器不支持视频时，可打开下方短片链接。'));
    const videoActions = element('div', '', 'edu-video-actions');
    videoActions.append(element('span', '中文讲解 · 点击播放'));
    const directVideo = link({ label: '打开短片', url: data.video.src });
    directVideo.className = 'text-link';
    videoActions.append(directVideo);
    videoCard.append(element('h4', '先看照护视频'), activeVideo, videoActions);
    const actionHeading = element('h4', '日常做好这 3 件事', 'edu-actions-heading');
    const grid = element('div', '', 'edu-grid');
    data.sections.forEach(item => {
      const card = element('article', '', 'edu-card');
      const list = element('ul');
      item.items.forEach(text => list.append(element('li', text)));
      card.append(element('h4', item.title), list);
      grid.append(card);
    });
    const emergency = element('aside', '', 'edu-emergency');
    const emergencyList = element('ul');
    data.urgent.forEach(text => emergencyList.append(element('li', text)));
    emergency.append(element('h4', '这些情况要及时求助'), emergencyList, element('p', '中国大陆急救电话：120。'));
    const sources = element('details', '', 'edu-more');
    sources.append(element('summary', '更多照护细节与依据'));
    const detailGrid = element('div', '', 'edu-detail-grid');
    data.details.forEach(item => {
      const card = element('article', '', 'edu-detail-card');
      const list = element('ul');
      item.items.forEach(text => list.append(element('li', text)));
      card.append(element('h4', item.title), list);
      detailGrid.append(card);
    });
    const extraAlerts = element('ul', '', 'edu-detail-alerts');
    data.additionalAlerts.forEach(text => extraAlerts.append(element('li', text)));
    sources.append(detailGrid, element('h4', '其他需要联系医护的变化'), extraAlerts,
      element('p', '资料核对：2026-10-11。短片为本应用制作的健康教育，不是外部机构官方视频。用药、用氧和活动安排以个人医嘱为准。', 'edu-sources'));
    data.sources.forEach((source, index) => {
      if (index) sources.append(document.createTextNode(' · '));
      sources.append(link(source));
    });
    panel.replaceChildren(heading, videoCard, actionHeading, grid, emergency, sources);
  }

  const handleTopic = event => {
    if (disposed) return;
    const button = event.target?.closest?.('button[data-topic]');
    if (!button || !picker.contains(button)) return;
    const next = resolveTopic(button.dataset.topic);
    if (next === currentId) return;
    currentId = next;
    render();
    if (typeof onTopicChange === 'function') onTopicChange(currentId);
  };
  picker.addEventListener('click', handleTopic);
  const handleVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', handleVisibility);
  document.defaultView?.addEventListener('hashchange', pause);
  container.replaceChildren(picker, panel);
  render();
  return {
    pause,
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      picker.removeEventListener('click', handleTopic);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.defaultView?.removeEventListener('hashchange', pause);
      picker.remove();
      panel.remove();
    },
  };
}
