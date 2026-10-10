# 第三方资源

| 组件 | 版本 / 数据集 | 许可证 | 来源 |
| --- | --- | --- | --- |
| PDF.js | pdfjs-dist 5.6.205 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| Tesseract.js | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js |
| Tesseract.js Core | 7.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js-core |
| 中文和英文识别模型 | @tesseract.js-data/chi_sim、eng，4.0.0_best_int | Apache-2.0 | https://github.com/naptha/tessdata |
| Playwright（开发验证） | 1.62.1 | Apache-2.0 | https://github.com/microsoft/playwright |
| pdf-lib（模拟 PDF 测试） | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |

构建时将运行依赖的许可证复制至 `dist/assets/vendor/`，PDF.js 的字体和字符映射资源保留上游资源文件。语言数据来源：

- https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz
- https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz

构建产物 `build-info.json` 记录语言模型 SHA-256。页面插画为程序化 SVG；品牌名称和原应用入口保留来源，不把插画用作官方 LOGO。
