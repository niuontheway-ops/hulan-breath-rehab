# 宣教短片视觉制作

## 分镜与渲染

每个主题采用四镜头结构：认识与照护、日常方法、生活与恢复、识别与求助。48个镜头的短标题与要点来自现有宣教文稿，完整旁白由视频生成器控制。画面使用960×960像素，场景904×600像素，主标题48像素，底部句字幕32像素；每镜头显示三个简短要点，不铺满旁白全文。

`scripts/education-film-scenes.mjs` 导出 `renderFilmHTML({topic,index,slide,logo,caption})` 和 `FILM_SCENE_SPEC`。返回HTML在Chromium中离线渲染，`window.setFrame(timeSeconds,durationSeconds,caption)` 按指定时间更新镜头移动、柔光、字幕和进度。时间由调用方提供，不依赖CSS动画时钟。正式Logo来自仓库现有图片，未由图像模型重绘。

生成器调用时应等待字体及全部图片解码，再按帧截图。缺失场景文件直接报错。渲染模板只使用本地内嵌图片，不发送患者输入或网络请求。

## 场景资产与边界

12幅场景图存于 `assets/education-scenes/`，每幅768×512像素、WebP格式。另有12个960×960像素主题封面，同目录按疾病ID命名。场景以共享患者形象构成一致系列，部分通用咨询、走动、求助画面跨主题复用；疾病特异内容通过专门情境和文稿说明。

| 场景文件 | 情境 |
| --- | --- |
| clinic.webp | 呼吸照护咨询 |
| medication.webp | 阅读个人用药说明、泛示吸入器 |
| garden.webp | 庭院轻量走动 |
| support-call.webp | 联系照护团队 |
| ventilation.webp | 口罩与居家通风 |
| nutrition.webp | 少量、均衡饮食 |
| sleep-pap.webp | 睡眠时鼻罩与PAP装置 |
| daily-record.webp | 日常记录、计划与提醒 |
| occupational-care.webp | 职业暴露资料咨询 |
| oxygen-care.webp | 按个人处方在家用氧的概念情境 |
| supported-rest.webp | 医护陪伴、舒适休息 |
| travel-planning.webp | 在旅行前咨询医护 |

资产通过内置 `image_gen` 工具生成，共三张1536×1024像素四分格场景；其中睡眠镜头另作两次定向修正，移除睡眠中的眼镜，并补全可见固定头带和鼻罩连接。FFmpeg仅按精确四分格提取并编码WebP。场景人物均为虚构合成人物，不能当作真实患者或本院医护人员照片，不构成官方机构背书。场景中的器械仅为无品牌概念示意，不用于核对具体吸入器操作、氧疗设置或PAP压力。没有开展临床专家人工复核。

## 图像生成参数与提示词记录

执行方式为内置图像生成工具；实际模型版本未返回，不猜测模型名称。全部请求关闭透明背景，要求无文字、无品牌、无水印，四个等大面板无间隙，固定森林绿、鼠尾草绿、奶白和少量杏色；统一65岁左右、灰发、眼镜、绿色衬衫和米色长裤的中国男性虚构患者，真实成人比例和手部，温暖电影照明、布料纹理与前中后景。提出3072×2048规格，实际工具输出1536×1024。

三组场景指令分别为：

1. 呼吸诊室患者与女护士沟通空白照护文件；患者居家阅读空白用药卡、无品牌吸入器放在边桌；患者沿无障碍庭院步道轻量走动；患者坐着通过电话联系团队。不得显示具体吸入动作、用药剂量、诊断数值或解剖切面。
2. 患者佩戴医用口罩开窗通风；患者吃小份多样食物；患者侧卧睡眠、鼻罩连接一根连续软管到无品牌PAP装置；患者在桌前写空白日记、手机和封闭药盒放在旁边。睡眠镜头要求鼻罩和设备清晰、无多余软管，后续定向修正要求摘除患者眼镜，保留其余三幅及设备连接；再单独修正睡眠镜头，明确头顶带、耳上带与耳下颊侧连接带，鼻罩罩住鼻部、嘴部保持开放，保留唯一连续设备软管。
3. 患者与职业健康医生讨论空白暴露资料，防护用品置于桌面而不演示粉尘作业；患者居家鼻导管连接无品牌制氧机，不显示氧流量；患者坐在扶手椅舒适休息、手轻放腹部、护士陪伴；患者与医护咨询空白旅行计划、行李箱旁置，不表示已经获准乘机或潜水。

提示词目标与输出逐项核对，属于本任务模型检查；没有证明所有图像生成指令都被医学级准确实现。

### 实际原始提示词

以下保留提交给内置工具的英文提示词。编辑目标由对应已生成图提供，不含个人照片。全部调用的 `transparent_background` 为 `false`；生成时没有引用外部图片，编辑时仅引用本次生成结果。

原始四场景：

```text
Use case: scientific-educational, stylized-concept. Asset type: one high resolution cinematic storyboard sheet for Chinese older-adult respiratory care education films. Create a single landscape 3:2 image arranged as an EXACT edge-to-edge 2x2 grid of FOUR equal landscape panels, no gutters, no text, no numbers, no borders. Each panel will be cropped into a separate film scene. Premium beautifully crafted semi-realistic 3D editorial render, refined soft material textures, detailed textiles, warm daylight, depth, realistic human body proportions, subtle cinematic lighting, visual sophistication like a high-end public-health short film; NOT flat vector artwork, NOT primitive toy stick people, NOT plastic chibi figures. The same natural-looking older Chinese man around 65 with silver hair, thin glasses, sage-green casual shirt and comfortable beige trousers appears consistently. A caring professional Chinese female nurse around 35, warm expression, clean white clinical coat appears only where appropriate. Panel upper left: warm respiratory clinic consultation; patient seated at left, nurse seated at right explaining a blank care-plan folder on a table. Modern cream-white and deep forest-green interior, soft window light, plant in background, accurate hands. Panel upper right: patient seated comfortably at home by a window, reading a blank personal medication instruction card, generic unbranded small inhaler placed on side table, glass of water, cozy tasteful interior; DO NOT show an inhalation maneuver or brand-specific device technique. Panel lower left: same patient calmly walking along a beautiful accessible garden path, comfortable shoes, natural walking pose with legs and arms, a nearby park bench, layered foliage, morning sunlight, careful perspective. Panel lower right: same patient at home seated making a phone call to his care team, gently serious attentive expression, smartphone held naturally near ear, supportive calm interior, no dramatic medical emergency. Across all four panels maintain identical human appearance, restrained deep forest green / sage / warm cream / subtle apricot palette and believable materials. Compose each scene as a wide medium shot, keep faces and all essential action clear and inside the middle 80% so a small camera pan is safe; no cropping hands. Do not draw visible organ anatomy, anatomical cutaway, oxygen tubing, monitors with medical values, medicine dosage, logos, watermarks, lettering, symbolic numeric readouts or pseudo-text. Highest polished photoreal 3D illustration quality, soft ambient occlusion, realistic material grain, layered foreground-middle-background. Desired size 3072x2048 landscape.
```

日常照护四场景：

```text
Use case: scientific-educational, stylized-concept. Asset type: premium respiratory patient-education storyboard sheet. Single landscape 3:2 image, EXACT edge-to-edge 2x2 grid of four EQUAL landscape panels, each will be cropped independently; no gutters, no border, no text or numbers anywhere. A beautiful high-end semi-realistic 3D/editorial rendering, very realistic human proportions, fine textile/material textures, skin and hair detail, cinematic soft daylight, warm cream, forest green, sage, soft apricot palette, calm reassuring respectful tone for older adults. Use the same older Chinese male patient around 65 with silver swept hair, rectangular thin glasses, sage-green shirt, beige trousers, realistic hands. Top-left panel: patient wearing a properly fitting plain medical face mask in a tasteful bright home, opening a window for ventilation, natural single adult figure, gentle curtains showing air movement, plants and clean surfaces, no visible sputum or particles. Top-right panel: same patient sitting at dining table eating a modest varied meal, small portions, bowl of food, vegetables, fish and water, no excessive banquet, beautiful natural morning light, no mask here. Bottom-left panel: same patient asleep comfortably on his side in a refined calm dark sage bedroom, a correctly fitted generic nasal CPAP mask over his NOSE (nose-only mask), connected by ONE continuous smooth grey corrugated breathing hose to a generic PAP device on the bedside table. Both mask and connected device fully visible, accurate simple setup, no dangling disconnected tubes, no text, no numerical display, do not show mouth tubing, no oxygen cannula. Soft bedside light, moonlight, green bedding and subtle natural cloth texture. Bottom-right panel: same patient seated at a small home desk writing in a blank symptom diary / calendar with a pen, his unbranded smartphone and one small closed generic medicine box on the table, relaxed attentive expression, no inhaler or other devices, no legible text anywhere. Every panel a wide medium shot, high quality quiet scene with foreground, middle-ground and background depth, keep faces hands actions inside middle80%, no cropping essential hands or mask/device. NO chibi toy body, NO flat vector, NO anatomy diagram, NO logos or watermarks, NO medical dosage claims. Desired3072x2048 landscape.
```

摘除睡眠镜头眼镜：

```text
Use case: precise-object-edit. Edit target is the attached 2x2 four-panel respiratory care storyboard. Change only the bottom-left sleeping scene: remove the sleeping man's eyeglasses from his face, and place a single pair of glasses neatly on the bedside table away from the PAP device. Preserve the entire other three panels exactly, preserve all framing and colors. In the sleeping scene preserve his face, closed eyes, fitted nose-only nasal CPAP mask and SINGLE continuous corrugated hose connected to the PAP machine; keep it anatomically believable. No extra hoses, do not cover or obscure the nasal mask or remove it. Keep image exactly four equal panels and retain dimensions. Do not add text, logos, or symbols.
```

专门照护四场景：

```text
Use case: scientific-educational, stylized-concept. Asset: one premium patient-education storyboard sheet. Create a SINGLE landscape3:2 image in an EXACT edge-to-edge2x2 grid of four equal landscape panels, no gutters, no borders, no text or numbers. Cinematic beautifully polished semi-realistic 3D editorial medical lifestyle illustration, very realistic adult proportions and hands, fine skin, silver hair and garment texture, believable interiors, natural ambient occlusion, soft window lighting, calm forest-green/sage/warm cream/soft apricot. The same older Chinese man,65,silver swept hair,thin rectangular glasses, sage-green casual shirt,beige trousers. Top-left: an occupational health consultation in a modern respiratory clinic; man with doctor discussing a BLANK exposure-history folder, a clean unused protective respirator and industrial work helmet on desk as background context, no work inside dusty environment, no airborne particles, no text. Top-right: same patient calmly sitting at home using prescribed supplemental oxygen at rest: a transparent nasal cannula with two nasal prongs sitting correctly just inside nostrils, a SINGLE thin clear oxygen tube that visibly connects from cannula around ears and chest to a generic home oxygen concentrator at side, no mask, no tube in mouth, no numeric settings or flow meter readings, no flame or smoking. Clean accurate simple equipment set-up and gentle breathing, medium shot including patient and connected device, full hands. Bottom-left: same patient comfortably seated upright in an armchair at home, shoulders relaxed, one hand resting gently over upper belly and the other on lap, natural calm neutral lips, nurse nearby observing and providing support; illustrative resting/support scene only, no extreme breath holding, no exercise strain or anatomical cutaway. Bottom-right: same patient and female clinician at a clinic desk discussing a BLANK travel plan, a small suitcase standing on floor beside the patient, calm attentive face, no airplane, no scuba equipment, does not depict actually traveling; warm reassuring professional consultation. Keep faces, hands, equipment and objects all safely inside middle80% of each panel for mild camera pan. NO flat vector, NO simple toy figures, NO logos/watermarks/lettering, NO medicine dosage, no medical graph numbers or anatomy. Desired3072x2048.
```

补全鼻罩可辨头带：

```text
Use case: precise-object-edit. Edit this exact respiratory patient sleep scene. Essential medical correction: the nasal CPAP mask must be correctly visibly secured with real headgear, not appear to be stuck to the nose without straps. Add a clear soft charcoal/light-grey adjustable HEADGEAR: a visible strap over the top/crown of the head, a back-of-head band, and TWO short visible side straps that connect to the nasal mask on each side, one passing above the ear and one along the cheek below the ear. Make the side buckle/attachment visible near the cheek. The nose-only nasal mask stays seated properly over the nose with a believable soft cushion seal; leave mouth uncovered. One single continuous corrugated breathing hose remains connected from the mask to the PAP machine on the bedside table. Preserve the sleeping man without eyeglasses, closed eyes, sage-green shirt, side-lying posture, calm bedroom, lighting, quilt, device and table glasses, and overall photographic 3D quality. Adjust his head a little only if needed so straps are unmistakably visible and the pillow does not push the mask away. No extra tubes, no oxygen cannula, no text, logos, watermarks, flow or pressure readings. Keep landscape3:2. This is a generic educational scenario, not a brand-specific device.
```

## 个人美学方法应用

读取用户级 `personal-aesthetic-design` 的知识状态、基础规则、来源规则、模板与W177/W175/W174等来源笔记。使用T006局部视觉修正；R001统一材质与人物系列，R003明确环境/主体/强调色角色，R005建立前中后景与空间层次，R009采用稳定轮廓及温暖柔光，R010对照实际截图保留未验证边界。B004安排标题、场景、要点、句字幕的阅读顺序；B005把“精美”拆成真实比例、材质、光向、空间与清晰度。影片构图、渲染与字幕时序是独立设计迁移，不声称指定作者提供了临床教育或UI规范。

## 实际检查

`.qa/film-design/results.json` 保存48镜头实际Chromium渲染结果、每个镜头的起止变换及12封面SHA256。已核对图片解码、960像素画面边界、标题/要点/字幕尺寸、全部镜头使用新场景图、起止镜头变换不同；没有脚本错误。实际查看COPD诊室、用药、走动、求助和OSA睡眠截图，修正了旧图的平面视觉、睡眠中佩戴眼镜和鼻罩缺乏可辨固定头带的问题。视频音频、完整播放、字幕同步与发布验收由对应生成和浏览器检查记录承担，不由单帧截图替代。
