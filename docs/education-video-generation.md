# 疾病宣教短片生成

每个主题包含四段健康教育：主题介绍、两段日常行动、求助提示。文案与医学依据见 `education.mjs`、`education-media.md`。视觉场景见 `education-film-design.md`。素材不含患者资料或虚构检查结果；内容尚未经过人工临床审核。

视频采用960×960像素、H.264/AAC、24 fps。场景以12 fps逐帧渲染，镜头推进、人物动作、物件和短字幕由确定性时间驱动。四段使用不同景别和生活场景，字幕按旁白句段分行。额外WebVTT字幕默认关闭，可由使用者开启。

旁白使用 `zh-CN-XiaoxiaoNeural`，语速为-8%，原始音高。通过项目隔离环境中的 `edge-tts==7.2.8` 调用Microsoft Edge在线语音服务，仅发送公开教育文字；不上传患者材料、个人声音或影像，不进行声音克隆。数字与英文设备简称作口语读法处理，不改变医嘱及安全条件。神经语音仍为合成声音，不描述为真人录音。生成后的声音已封装进MP4，播放无需联网语音服务。

生产环境需要Python、Playwright/Chromium、FFmpeg/FFprobe及edge-tts。应用和电脑交付包无需这些生产依赖即可播放现有媒体。安装在项目隔离环境中：

```powershell
python -m venv .qa/media-venv
.qa/media-venv/Scripts/python.exe -m pip install edge-tts==7.2.8
```

语音制作输入是JSON任务列表，每项包含 `text`（公开旁白文字）与 `output`（项目内MP3路径）。例：

```powershell
node scripts/generate-education-videos.mjs --prepare-audio
.qa/media-venv/Scripts/python.exe scripts/education-neural-speech.py .qa/film/speech-jobs.json
node scripts/generate-education-videos.mjs
node scripts/build.mjs
```

同名 `.jsonl` 文件保存语音服务的句边界时间元数据，不是SRT字幕。MP3和元数据置于 `.qa/film/audio/{topicId}/0`至`3`；最终MP4和VTT位于 `assets/education-videos/`。可向视频生成器传主题ID只重制相关片，如 `node scripts/generate-education-videos.mjs copd`。中间帧和声音仅留在不跟踪的 `.qa/film/`。

来源：[edge-tts项目](https://github.com/rany2/edge-tts)、[Microsoft语音支持说明](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support)。Edge接口可选声音与语速、音高和音量，不支持Azure的自定义SSML情绪风格。本流程未声称使用不存在的情感参数。

生产检查包括图片及文字边界、不同时间帧变化、音视频轨道、可听电平、12个主题的实际播放和跳转。软件检查不能代替人工听感评价或临床审核。
