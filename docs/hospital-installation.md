# 壶兰呼吸康复工作台：医院电脑安装

适用：Windows 11 x64，或仍在医院维护支持范围内的 Windows 10 x64；使用 Windows PowerShell 5.1 和现代 Edge、Chrome 等浏览器。此包不支持 Windows 7、32 位 Windows、macOS 或国产 Linux 系统。医院终端策略可能限制 EXE 或 PowerShell，此时由医院信息科审核放行，不修改安全策略。

## 安装

1. 将 `hulan-breath-rehab-版本号-windows-x64-setup.exe` 复制到需要使用的医院电脑。
2. 双击 EXE，核对来源与发布页 SHA-256，按中文向导选择安装位置。
3. 默认仅安装给当前 Windows 用户，位置为 `%LOCALAPPDATA%\Programs\HulanBreathRehab`，无需另外安装 Node.js，无需管理员权限。
4. 选择是否创建桌面与开始菜单入口。安装完成后从“壶兰呼吸康复工作台”打开；也可使用安装目录内的“打开壶兰呼吸.cmd”。

EXE 提供文件安装、快捷方式与卸载功能；不是 ZIP 或仅解压文件的自解压包。当前发行 EXE 未使用机构代码签名证书，Windows 或医院终端防护可能显示未知发布者。请交医院信息科审核；不要求关闭防护软件。

## 使用与资料

- 使用默认浏览器打开康复工作台；随包的 Node.js v24.19.0 服务只监听 `127.0.0.1:4196`，不开放院内网络端口，不写防火墙规则，不注册 Windows 服务或开机启动。
- 关闭浏览器后本机服务仍可能运行。使用开始菜单“停止本机康复服务”结束，或关机结束。同一安装目录重复打开会复用自己的服务；端口被其他应用或另一个安装目录占用时拒绝接管。
- 网页、图像、本地宣教短片、PDF 与 OCR 运行资源随包提供。外部教学视频、在线音乐和参考网页仍需要联网；外链受医院网络与平台可用性影响。
- 患者资料只按页面保存选项保留在当前浏览器的本机存储中。安装包不含患者资料，不自动上传资料，不提供医护身份认证、服务器备份或跨电脑同步。医护确认代表本机操作记录，不等同于登录授权系统。
- 呼吸肌力、膈肌和器械结果采用手工记录。硬件直连需按实际型号与厂商接口另行核实；本机程序不声称自动连接医院设备。
- 电脑包和手机网页的记录相互独立。应按医院制度使用专门账号、处理患者信息，并在离开共享电脑前关闭页面。

## 更新与卸载

更新前导出需要保留的记录，再运行新安装包，选择相同的程序目录。安装向导只停止归属于该安装目录的康复服务，核验进程路径、服务指纹与启动脚本后再更新；不接管或结束其他服务。

在 Windows 设置的“应用”中卸载“壶兰呼吸康复工作台”，或使用开始菜单中的卸载入口。卸载会停止该目录所属服务，并移除由安装包创建的程序和快捷方式。不会清除其他浏览器资料。需要删除本机健康记录时，请先在应用中关闭本机保存并清空数据，再卸载；卸载不等同于删除浏览器中的健康记录。

## 构建与校验

源码包含安装脚本与固定版本的简体中文安装向导翻译。Inno Setup 编译器从 [官方不可变发布](https://github.com/jrsoftware/issrc/releases/tag/is-6_7_3) 获取，使用官方 `.issig` 中的 SHA-256 和 Windows Authenticode 双重核验；只以官方 `/PORTABLE=1` 模式放在项目 `.qa` 内，不全局安装编译器。

```powershell
pnpm build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/installer/prepare-toolchain.ps1
node scripts/package-delivery.mjs
```

`package-delivery.mjs` 会同时生成医院 EXE、网页 ZIP 与完整源码 ZIP。仅需独立生成 EXE 时，可运行 `node scripts/build-installer.mjs`。

编译器：Inno Setup 6.7.3，原作者 Jordan Russell、Martijn Laan；[官方网站](https://jrsoftware.org/)。中文翻译保留原维护者说明与来源。运行时许可证位于 `runtime/LICENSE.txt`，其他第三方许可见 `THIRD_PARTY_NOTICES.md` 和 `dist/assets/vendor/`。

安装包摘要见 `hospital-installer-manifest.json`；安装目录内的“文件校验清单.json”记录逐文件字节数与 SHA-256。构建脚本只打包验证过的 `dist` 快照和明确列出的运行文件，排除个人资料、临时测试目录、账号、密钥与开发依赖。

隔离软件验收使用 `/ISOLATEDTEST=1 /TESTROOT=项目内测试目录 /DIR=该目录的子目录 /NOICONS`。该模式禁用桌面/开始菜单入口、安装后启动和应用卸载注册，但仍保留真实文件安装与 `unins000.exe` 卸载过程。日常医院安装不使用这些测试参数。本机隔离验收不能代替目标医院电脑的系统、终端安全策略及真实设备联调验收。

兼容性依据：[Node.js v24.19.0 官方平台说明](https://github.com/nodejs/node/blob/v24.19.0/BUILDING.md#platform-list)、[Inno Setup 官方说明](https://jrsoftware.org/isinfo.php)、[官方下载校验方法](https://jrsoftware.org/isdl-verify.php)。
