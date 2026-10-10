# 疾病宣教短片生成

每个主题包含四段健康教育：主题介绍、两段日常行动、求助提示。文案来源见 `education.mjs` 及 `education-media.md`，插画见 `chapter-illustrations.md`。文件不含患者资料或虚构检查结果。脚本未经人工临床审核，产品中的个体化治疗仍依个人医嘱。

已生成十二个 MP4，编码为 H.264 与 AAC，960×960 像素、24 fps；每段包含中文讲解和大字画面文本。提供单独的 WebVTT 字幕，默认关闭以避免与画面文本重复遮挡，用户可在播放器开启。视频时长约 60–65 秒，每个约 1 MB。

语音使用本机 Windows WinRT 的 Microsoft Huihui（zh-CN），语速 0.9。图片和文案没有发送到远程语音服务；未下载或复制第三方视频，未使用真人声音克隆。生成工具为 Playwright / Chromium、Windows 内置语音及 FFmpeg 9.0.1。应用和交付包无需这些生成工具即可播放现有 MP4。

在具备本地中文 Windows 声音、FFmpeg/FFprobe 与开发依赖的 Windows 环境运行：

```powershell
node scripts/generate-education-videos.mjs
node scripts/build.mjs
```

生成程序逐帧检查文字边界，并用 FFprobe 核对音视频轨道、时长和分辨率。中间 PNG、WAV、分段 MP4 与机器结果仅保留在不跟踪的 `.qa/content/`，最终 MP4 与 VTT 位于 `assets/education-videos/`。临床文案变更后需重新生成相应媒体，再运行浏览器验收。此流程不代替人工内容和听感审阅。
