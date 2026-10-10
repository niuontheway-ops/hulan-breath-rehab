# 健康宣教与吸入装置教学

## 本地宣教短片

12 个宣教主题分别提供中文讲解、画面字幕和独立 WebVTT 字幕。主题为慢阻肺、哮喘、支气管扩张、肺癌康复、尘肺病、间质性肺病、气胸恢复、胸腔积液、肺结核、肺心病、睡眠呼吸暂停和戒烟支持。

脚本在 `education.mjs` 的 `EDUCATION_VIDEO_SCRIPTS` 中维护，每个主题有 4 段：主题介绍、两段日常行动和一段就医提示。脚本依据该模块列出的指南与患者资料编写；这是本应用制作的教育短片，不是医院、学会、指南机构的官方原作，也没有经过人工临床审核。

视频文件为 `assets/education-videos/{topicId}.mp4`，字幕为同名 `.vtt`，海报为 `assets/education-scenes/{topicId}.webp`。使用浏览器原生播放器，`controls`、`playsinline`、`preload="none"`，不自动播放。切换疾病、离开章节或页面进入后台时暂停。患者无需上传任何数据即可观看；媒体由本站或本地包提供，播放不依赖第三方账号。

默认页面只显示 3 条日常行动和 1 条求助提醒。其他疾病照护细节、个体化用氧与用药提醒、参考资料放在默认关闭的折叠区域。慢阻肺明确包含急性加重治疗后病情稳定、经医护评估后的肺康复。

## 原站吸入剂视频

原站快照中保存的 6 个视频网址保持为外部链接，不复制或重新托管视频。点击“打开操作视频”才跳转哔哩哔哩；进入本应用页面不会请求第三方媒体。仅核对视频元数据及公开播放接口，不下载原视频。

2026-10-11 核对结果：6 个公开视频元数据接口和播放接口均 HTTP 200、业务码 0；均返回 MP4 播放地址，其 HEAD 响应均 HTTP 200。这验证了当时的公开播放资源存在，不代表已逐帧审查临床内容，也不保证外部平台未来持续可用。平台可能显示其界面、广告或登录提示。

| 教学项目 | 原站视频 | 核对到的标题 | 发布者 | 时长 |
| --- | --- | --- | --- | --- |
| 布地格福 | [视频页](https://www.bilibili.com/video/BV1TCqhYvEP9) | 布地格福吸入气雾剂 | 不是超级大会员 | 239 秒 |
| 布地奈德福莫特罗 | [视频页](https://www.bilibili.com/video/BV1DfrYBjEiA) | 布地奈德福莫特罗 | 呼吸小酥 | 215 秒 |
| 氟替美维 | [视频页](https://www.bilibili.com/video/BV1UAreBCE3t) | 氟替美维吸入粉雾剂（全再乐） | 呼吸小酥 | 196 秒 |
| 格隆溴铵福莫特罗 | [视频页](https://www.bilibili.com/video/BV1WTraBAEfS) | 格隆溴铵福莫特罗 | 呼吸小酥 | 302 秒 |
| 噻托溴铵 | [视频页](https://www.bilibili.com/video/BV1UAreBCEVS) | 噻托溴铵吸入粉剂（天晴速乐） | 呼吸小酥 | 214 秒 |
| 沙美特罗氟替卡松 | [视频页](https://www.bilibili.com/video/BV1UjrhBTE9z) | 沙美特罗替卡松 | 呼吸小酥 | 233 秒 |

发布者身份未核实为医院官方，页面不赋予“官方”标记。原站噻托溴铵装置描述为思力华 HandiHaler，而对应视频标题明确为天晴速乐；页面保留该视频，同时在显眼位置提示产品差异，不把天晴速乐演示当作所有胶囊型装置的统一操作。

## 装置操作资料

操作要点只说明装药、吸气方式、收尾和产品核对，不给出统一喷数、频次或药物选择。首次准备、重新试喷、清洁与产品差异以患者手中说明书和医护示范为准。以下厂家或药品资料用于核对同类装置；海外说明书不能替代当地产品说明或个人处方。

- [AstraZeneca：Breztri 装置使用](https://www.breztri.com/using-your-inhaler)
- [AstraZeneca：Symbicort Turbohaler 患者说明](https://www.medicines.org.uk/emc/product/1327/pil)
- [GSK：Trelegy Ellipta 患者说明](https://www.medicines.org.uk/emc/product/8666/pil)
- [AstraZeneca：Bevespi 患者与装置说明](https://medicalinformation.astrazeneca-us.com/home/prescribing-information/bevespi-aerosphere.html)
- [DailyMed：Spiriva HandiHaler 装置说明](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=25a4cb05-64a8-44b6-88c8-4292a5292e92)
- [GSK：Seretide Accuhaler 产品说明](https://www.medicines.org.uk/emc/product/5504/smpc)

## 模块接口

`mountEducation(container, options)` 提供 `pause()` 与 `dispose()`；`getEducation(id)` 返回新的纯数据对象、3 条短行动、折叠照护资料以及视频路径。`mountInhaler(container, options)` 提供 `dispose()`；`INHALER_DEVICES` 为 6 项选择列表，`getInhaler(id)` 返回独立操作数据。两个模块不读取患者材料，不存储患者信息，不使用 HTML 字符串插入教育内容。
