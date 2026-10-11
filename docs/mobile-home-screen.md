# 手机主屏幕入口

患者可以把网页添加到手机主屏幕，之后从“壶兰呼吸”图标打开。网页和视频需要网络；本功能未添加 Service Worker，不预缓存报告识别资源、视频或患者资料。

## 集成

网页 head 引入 `manifest.webmanifest`、`mobile-install.css`，并设置 `apple-touch-icon` 为 `assets/mobile/apple-touch-icon.png`（180×180）。iOS 元数据使用 `apple-mobile-web-app-capable=yes` 和 `apple-mobile-web-app-title=壶兰呼吸`。

```js
import {mountMobileInstall} from './mobile-install.mjs';
const dispose = mountMobileInstall(container);
// 移除入口时清理监听器及其内容。
dispose();
```

入口应在首次页面加载时挂载，以接收浏览器发出的安装事件。同一容器重复挂载会先清理旧实例，返回值为清理函数。它不读取或保存健康资料，不记录安装行为分析数据。

清单的 `id`、`scope` 使用 `./`，`start_url` 使用 `./#home`，支持 GitHub Pages 项目子路径；`display` 为 `standalone`。192×192、512×512 和 Apple 180×180 图标由已有正式品牌图片按比例缩小并加白色留边，未重绘品牌。运行 `node scripts/mobile-assets.mjs` 可重建三张 PNG，依赖可用的 FFmpeg。

## 浏览器行为

- Android 在实际收到 `beforeinstallprompt` 后才提供原生安装流程。用户点击按钮调用该事件一次；取消后显示手动步骤，重新安装须等待新的事件。浏览器菜单仍可提供“添加到主屏幕”或“安装应用”。
- iPhone / iPad 提供 Safari 分享菜单步骤。其他 iOS 浏览器提示先在 Safari 打开；嵌入浏览器提示在外部浏览器打开。
- 用户确认安装后显示“已确认添加”；收到 `appinstalled` 才显示“已添加”；只有 Android 或 iPhone / iPad 平台且 `display-mode: standalone` 或 iOS `navigator.standalone` 为真才显示“已从手机桌面打开”。
- 电脑页面显示在患者手机操作的说明，不主动触发电脑安装；电脑的独立窗口也不会显示手机桌面启动状态。

Chrome 官方当前[安装标准](https://web.dev/articles/install-criteria)列出 HTTPS、用户交互及安装清单等条件，未列 Service Worker 为前置项；是否显示安装提示仍受浏览器状态和交互条件影响。[安装事件说明](https://web.dev/learn/pwa/installation-prompt)明确安装事件并非所有浏览器支持，事件只能调用一次，未收到事件时须提供手动入口。较早的 [Chrome 安装标准调整](https://developer.chrome.com/blog/update-install-criteria)说明菜单安装已去除带 `fetch` 的 Service Worker 前置要求。本功能使用真实事件判断，不保证打开网页就会出现原生安装提示。

iPhone 操作依据 Apple 官方的[添加主屏幕图标说明](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios)及[作为网页 App 打开说明](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)：Safari 页面菜单中的分享（部分布局直接显示分享）→ 添加到主屏幕 → 添加。有“作为网页 App 打开”开关时可保持开启。

## 视觉判断与验证

实际读取 `personal-aesthetic-design` 0.2.0 的知识状态、基础与来源规则、基础模板，以及来源笔记 W174、W175。采用基础模板 T006，保留既有绿色品牌；R003 的颜色区域关系迁移为浅色容器、深绿主要动作和独立文字状态；B002 约束窄屏重排，B003 保留焦点与明确成功状态，B004 控制一个主动作。上述网页迁移是独立设计判断，不表示来源作者提供了安装界面的实现规范。

运行 `node scripts/browser-mobile-install-check.mjs`：16 项检查通过，包括取消后重试、安装确认与桌面启动状态区分、电脑独立窗口不会误报手机桌面状态、异常回退、重复挂载和事件清理、不同浏览器操作说明、键盘焦点、清单子路径和图标尺寸；390 / 320 CSS px 下普通及大字模式共 4 个布局无横向溢出。实际 Chromium 返回清单无解析错误，模块检查无页面错误或远程请求。

结果和截图位于本地忽略目录 `.qa/mobile-home-screen/`。检查使用合成浏览器标识与安装事件，验证网页逻辑和布局；未在真实 Android 或 iPhone 完成系统安装，不能将其描述为真机安装验收。
