# 成人呼吸康复教育规则

规则版本：`2026-10-10.1`。资料核对日期：2026-10-10。

本模块在浏览器本机运行，按自报医护诊断、当前症状、既有量表总分和康复目标选择教育内容。它不诊断疾病、不出具医疗处方，不替代正规的肺康复评估和监护，未完成临床验证。上传报告的数值须由使用者对照原报告确认后录入；规则不会把 FEV₁/FVC 或单次血氧当作疾病诊断。

## 输入与分流

`validateProfile(profile)` 返回 `{ valid, errors: [{ field, message }] }`。数字只接受 JavaScript `number`，不把数字字符串、空白、`NaN` 或无穷值转成正常数据。肺功能、血氧、ACT 和 CAT 可为 `null`；哮喘需提供 ACT，总分记录之外不复制 ACT 题目。慢阻肺、支气管扩张需提供呼吸困难总分。年龄须为 1–120 的整数，FEV₁ 预计值百分比须为 `(0,200]`，FEV₁/FVC 和 SpO₂ 须为百分数 `(0,100]`。

`createPlan(profile, now)` 返回固定的数据结构，包括 `status`、理由、警示、指标、训练项目、周安排、呼吸节拍和来源链接。状态优先顺序如下：

| 状态 | 触发条件 | 页面行为 |
| --- | --- | --- |
| `urgent` | 自报胸痛、严重呼吸困难、晕厥或咯血之一 | 停止训练，寻求急救；即使其他资料缺失也先显示此提示 |
| `incomplete` | 必需资料缺失、非法数值、非法或未来日期、无法确定当前日期 | 核对资料，关闭训练 |
| `review` | 未满 18 岁；症状加重或稳定性未知；未确认医护评估和允许；SpO₂≤92%；mMRC≥3；哮喘 ACT≤19；FEV₁ 预计值百分比<30%；慢阻肺 CAT≥30；评估超过 30 天；其他病种 | 联系医护复核，关闭自主训练 |
| `ready` | 上述障碍均不存在 | 提供须与医护确认的轻量起步内容 |

所有非 `ready` 状态均返回 `sessions=[]`、`weekly=[]` 和 `breathing.cycles=0`。低血氧提示为尽快联系医护，并不判定其原因或改变个体既有氧疗目标；伴危险症状时按急救分流。血氧缺失不会假定正常，页面会明确无法评估低氧风险。已有医护允许是自报确认，无法由此证明已完成专业评估。

**产品阈值与指南证据必须区分。** 本模块的血氧门槛、年龄范围、mMRC≥3、FEV₁<30%、CAT≥30、30 天有效期，以及各项起步时长和频率，是为关闭未经监护的高风险使用场景设置的保守产品规则，不是指南给出的定量家庭运动处方，也不能宣称已验证其敏感度、特异度或效果。ACT 的范围与控制分界来自 GINA；本应用据此选择先复核，不直接调整治疗。

评估日期采用 `YYYY-MM-DD`，与界面统一按 `Asia/Shanghai` 日历日期比较；真实日历检查包含闰年，恰好 30 天的资料可继续使用，第 31 天要求更新。每次使用及训练前仍需重新确认当前状态。

## 量表和建议选择

MRC 用 `1–5`，本模块的 mMRC 用 `0–4`。录入前必须选择量表，内部仅以 `mMRC = MRC − 1` 比较相应日常活动受限等级，并在指标中显示转换。此转换不表示两者名称可混用，也不等于重新验证修改版量表。ACT 用 `5–25`，CAT 用 `0–40`；只接收患者已经完成的总分，不在本应用中复制题目。

MRC 来源为 [UKRI MRC Dyspnoea Scale](https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-dyspnoea-scale/)。如界面使用 MRC 等级中文摘述，需注明 `Used with the permission of the Medical Research Council`，声明摘述及翻译的改动，并明确不是经授权或验证的中文版、没有 MRC 背书。UKRI 的许可不覆盖修改版量表的授权或翻译核验。

FEV₁/FVC 仅展示；FEV₁ 不单独决定训练强度或病种。在可以提供建议时，时长按目标、mMRC 和慢阻肺 CAT 选择：mMRC≥2、慢阻肺 CAT≥20 或活动能力资料不足，采用较短分段活动。其余使用较长的轻量起步值。

| 目标 | 较短步行 / 分钟 | 较长步行 / 分钟 | 呼吸节拍循环 |
| --- | --- | --- | --- |
| 日常活动 | 5 | 10 | 20 |
| 活动耐力 | 6 | 12 | 20 |
| 呼吸节奏 | 4 | 8 | 30 |

呼吸节拍为轻柔吸气 2 秒、呼气 4 秒，无屏息阶段；不舒服时恢复自然呼吸。慢阻肺页面说明轻柔缩唇呼气，其他支持病种使用舒适呼吸与放松。哮喘强调热身、运动诱发症状和已确认的行动计划；支气管扩张提示排痰手法须由医护示范。轻缓坐姿活动和步行可随时暂停，不以数字达标要求患者忍耐不适，不因得分高而自动升级强度。肺功能数值、呼吸动画或游戏点击均不能证明实际通气或训练质量。

## 每次训练前的安全确认

`assessTrainingReadiness(check)` 接收当前胸痛、严重呼吸困难、头晕、症状加重、静息血氧与医护允许状态。每项状态须明确为 `boolean`；输入不完整、非法血氧、症状异常或未允许时，`allowed=false`。静息血氧同样使用不超过 92% 的保守产品门槛。

训练入口必须同时满足：

```js
const plan = createPlan(profile);
const readiness = assessTrainingReadiness(currentCheck);
const canTrain = plan.status === 'ready' && readiness.allowed;
```

该检查不独立核实年龄、量表、医护评估日期或病种，不能用于绕开方案分流；回顾性资料也不能覆盖当下新出现的危险症状。

## 官方资料依据

- [ATS 2023 成人慢性呼吸疾病肺康复指南](https://doi.org/10.1164/rccm.202306-1066ST)：支持成人稳定期慢阻肺的专业肺康复；正式康复涉及评估、教育和适配的运动训练。本模块不把远程或居家康复的支持意见解释为未经评估的自动处方。
- [GINA 2026 策略报告](https://ginasthma.org/2026-gina-strategy-report/)：ACT 为 5–25，20–25 为较好控制，16–19 与 5–15 提示控制不足；规律活动及热身需结合运动诱发症状应对。呼吸练习仅为常规哮喘管理的补充，不能保证改善肺功能或减少发作。报告正文第 43、66、70 页；[官方 PDF](https://ginasthma.org/wp-content/uploads/2026/05/GINA-2026-Strategy-Report-WMS.pdf)。本仓库仅链接和简要释义，不存放或转载完整报告。
- [UKRI MRC 量表与使用条件](https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-dyspnoea-scale/)：原始等级为 1–5，用于呼吸困难造成的活动受限，使用需要适当署名并注明改动。
- [COPD Foundation 呼吸技巧](https://www.copdfoundation.org/Learn-More/I-am-New-to-COPD/Breathing-Techniques.aspx)：训练前询问医护是否适合；缩唇呼吸示例为鼻吸约 2 秒、缓慢呼气 4–6 秒。腹式呼吸应先由专业人员指导，因此本模块不提供腹式呼吸自动教程。
- [COPD Foundation 运动与评估](https://www.copdfoundation.org/Learn-More/I-am-a-Person-with-COPD/Exercise.aspx)：开始训练前讨论个人安全的运动范围，运动处方及监护由医护制定。
- [CAT 官方使用说明](https://www.catestonline.org/hcp-homepage/clinical-practice.html)：总分 0–40，不能用作 COPD 诊断。肺功能、症状影响和其他因素需要综合考虑。本模块只记录既有总分。

## 验证与边界

以 Node.js 内置测试运行 `node --test tests/clinical.test.mjs`，覆盖资料校验、非法数字、危险症状优先级、未成年人和未评估场景、低血氧边界、MRC 偏移、ACT 分界、病种分流、日期与闰年、资料过期、非可训练状态和训练前再次确认。

这些测试验证软件分流与输入处理，不验证医学效果、报告识别准确率或患者实际训练安全性。患者使用前需要呼吸专业医护审阅规则、页面提示及适用人群；用于真实诊疗还需要明确的专业监护与相应临床评估。
