@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "HULAN_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "HULAN_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo 请先安装 Node.js 22 或以上版本，再运行本文件。
    pause
    exit /b 1
  )
)
if not exist "dist\index.html" (
  echo 请先运行 pnpm install 和 pnpm build，或使用包含 dist 的完整交付包。
  pause
  exit /b 1
)
echo 壶兰呼吸正在启动。
echo 服务启动后，在浏览器打开 http://127.0.0.1:4173
echo 使用期间保留此窗口；关闭窗口后服务停止。
"%HULAN_NODE%" scripts\serve.mjs
if errorlevel 1 pause
