# 第三方资源

| 组件 | 版本 / 数据集 | 许可证 | 来源 |
| --- | --- | --- | --- |
| PDF.js | pdfjs-dist 5.6.205 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| Tesseract.js | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js |
| Tesseract.js Core | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js-core |
| 中文和英文识别模型 | @tesseract.js-data/chi_sim、eng，4.0.0_best_int | Apache-2.0 | https://github.com/naptha/tessdata |
| Playwright（开发验证） | 1.62.1 | Apache-2.0 | https://github.com/microsoft/playwright |
| pdf-lib（模拟 PDF 测试） | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| edge-tts（语音生产工具） | 7.2.8 | LGPLv3；SRT composer 为 MIT | https://github.com/rany2/edge-tts |

构建时将运行依赖的许可证复制至 `dist/assets/vendor/`，PDF.js 的字体和字符映射资源保留上游资源文件。语言数据来源：

- https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz
- https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz

构建产物 `build-info.json` 记录语言模型 SHA-256。页面与动作示范插画为程序化 SVG。`assets/hulan-logo.jpg` 使用品牌方提供的正式图片，未重绘或修改；品牌、科室名称及该图片的权利归相应权利人所有。

宣教场景素材为本应用制作的虚构人物画面，不是患者照片或第三方机构官方视频。中文旁白通过 Microsoft Edge 在线神经语音制作，不进行真人声音克隆；生成方法与素材来源见 `docs/education-video-generation.md`、`docs/education-film-design.md`。edge-tts 未随网页运行时分发，播放已封装的 MP4 不依赖该工具或外部语音服务。

## 原版音乐

音乐目录保留原应用列出的 7 首班得瑞曲目：安妮的仙境、初雪、迷雾水珠、清晨、童年记忆、雪之梦、月光水岸。音频从 [原应用](https://niuontheway-ops.github.io/human-breath/) 加载，未复制到本仓库或离线交付包。原应用标注“仅供非商业用途”；这不是开源或转授权证明，正式托管及公开使用应由运营方核实相关播放授权。本应用不授予音频版权。

## 健康教育与量表

疾病宣教保留原应用的主题及日常照护范围，正文经安全核对、改写，并在每张卡片链接具体的官方资料；网页与文档不转载完整指南。MRC 简明中文分级提示注明来源及改写：Used with the permission of the Medical Research Council。未声称是经验证的中文量表或获得 MRC 背书。ACT、CAT、ESS 和 FTND 仅录入既有总分，未复制其问卷题目。
