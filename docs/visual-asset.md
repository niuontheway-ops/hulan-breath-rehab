# 呼吸花园主视觉

## 资产

- 文件：`assets/rehab-garden.webp`
- 尺寸：1254 × 1254 px，RGB，无透明背景。
- 文件大小：155,080 字节。
- SHA-256：`a6c43a316915603499e9b36c938abb1edb500b0f6a12325d5854edbc03ccdb6c`
- 日期：2026-10-10。
- 来源：内置图像生成工具创建的原创装饰插画；工具未返回模型名称或版本。生成原稿为 2,179,446 字节的 PNG。使用 Pillow 编码为 WebP，quality=88、method=6；没有裁剪、重绘或改变像素尺寸。

资产用于首页装饰区域。标题、操作按钮和机构信息由 HTML 提供，图片不承担医学说明、健康指标或品牌标识。正式品牌图片仍使用 `assets/hulan-logo.jpg`。

## 方法依据

实际读取用户级 `personal-aesthetic-design` v0.2.0、知识与证据状态、基础规则、来源规则、来源参数模板与应用证据；对应来源笔记为 W179、W177、W167、W174。这些笔记记录的是已观察的微信风格卡画面，不是完整视频或可靠音频学习。

| 规则 | 具体采用 | 来源边界 |
|---|---|---|
| R001 | 山体、叶片、溪岸和基座使用圆润形体与统一青瓷雕塑观感 | W179 提供软陶圆润形体线索；W177 提供青瓷观感。当前选择青瓷为主要路径，未把两种实体材料混称为同一工艺 |
| R004 | 无粗黑描边，以接触阴影、遮挡与局部暖边光分辨形体 | W167 的明确光影关系只用于检查边缘与阴影；没有将 City Pop 全套风格套入医疗界面 |
| R005 | 前景幼苗、中景溪流与层叠山体、后景太阳形成景深 | W177 的层叠与遮挡迁移为新景物；不表达真实尺度或医学关系 |
| R009 | 稳定轮廓、浅白环境、低饱和青绿与小面积暖日光支持平静语气 | W174 的冷林冠与暖日光提供配色和光线线索；没有声称患者情绪或治疗效果已验证 |

首页布局、缩放方式和交互反馈属于独立前端设计，不是来源作者已给出的 UI 技法。

## 最终生成提示词

```text
Use case: stylized-concept.
Asset type: square illustrated hero asset for a Chinese chronic airway disease rehabilitation web application. It sits on the right side of a home page; the page title and actions are HTML outside this image.
Primary request: a serene dimensional miniature breathing garden, rendered as a cohesive softly rounded celadon ceramic diorama. No words or logos.
Scene: pale near-white sage background (#F7FAF7 appearance), a low oval terrace carrying three overlapping rolling hills and a gentle winding stream; a healthy young two-leaf sprout in the foreground, a few broad smooth leaves and small rounded stones; a warm apricot sun disk high behind the back hill with subtle warm rim light. Stable harmonious landscape with open breathing room, not a dense fantasy forest.
Composition: square 1:1, 3/4 slightly elevated view, all elements fully inside frame with a generous 10% quiet margin. Clear front-to-back depth: large foreground sprout lower right, stream leading diagonally from lower center into middle hills, rear hill partially occluded. Main scene centered so a responsive crop does not cut the sprout. Strong rounded silhouettes visible at small size.
Style/material: consistent sculptural celadon ceramic look across hills, leaves, stream banks, sun and stones, softly rounded handmade forms, satin finish, slight surface texture, restrained soft reflections. One coherent material language, no mixed felt/plastic/photo styles. Dimensional and tactile with clear occlusion and contact shadows; not a flat vector illustration.
Lighting/mood: calm reassuring morning. Single soft light from upper left, discernible grounded shadows toward lower right; subtle warm light on leaf edges, no harsh black outlines, no dark dramatic mood.
Palette: predominant deep teal-green #124C46 and celadon #68A899/#CFE5D9 for land and leaves, pale sage-white environment, blue-green stream, small apricot/coral warmth only on sun and tiny near-ground accent. No purple, no neon, no strong saturated rainbow.
Constraints: no text, no letters, no logo, no watermark, no medical symbols or lungs, no health scores or data, no person, no faces, no visual suggestion of treatment efficacy. Do not emulate any identifiable existing image. Produce a polished original raster illustration suitable for a clinical patient interface.
```

## 实际检查

已查看生成原稿和最终 WebP：前景幼苗完整可见，溪流形成视线通道，山体相互遮挡且表面具有体积；未见文字、LOGO、医学指标、人物或水印。主色为青绿，太阳承担少量暖色焦点，背景为浅白。WebP 编码后轮廓和纹理保留。

实际画面比提示词要求更丰富：出现了额外树冠、云和一个小瀑布；部分绿植呈细密表面纹理，统一材质并非逐个物件完全一致。太阳在后景右上方，暖边光主要来自该位置，并未严格实现提示词的左上光向；远景余白充分，左右近景未达到四周均为 10% 空白。保留这些差异，不把提示词全部描述算作已实现。

这些差异仍符合当前插画的主题和用途，主体未被裁切。页面实际尺寸、手机布局和交互反馈需在集成后独立检查；本记录仅证明资产生成、编码和模型视觉检查，不包含患者体验测试。
