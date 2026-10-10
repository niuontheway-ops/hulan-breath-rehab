param([string]$DestinationDirectory)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if (!$DestinationDirectory) { $DestinationDirectory = [Environment]::GetFolderPath('Desktop') }
$destination = (Resolve-Path -LiteralPath $DestinationDirectory).Path
$launcher = Join-Path $appRoot 'scripts\desktop\launch.ps1'
if (!(Test-Path -LiteralPath $launcher)) { throw '电脑包缺少启动脚本。请先解压完整电脑包。' }
$shortcutPath = Join-Path $destination '壶兰呼吸康复训练.lnk'
$shell = New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $shortcutPath) {
  $existing = $shell.CreateShortcut($shortcutPath)
  if ($existing.Description -ne '壶兰呼吸康复训练：启动本机服务并在默认浏览器打开') { throw '桌面已有同名的其他快捷方式，未覆盖。请先改名后重试。' }
}
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '"'
$shortcut.WorkingDirectory = $appRoot
$shortcut.WindowStyle = 7
$shortcut.Description = '壶兰呼吸康复训练：启动本机服务并在默认浏览器打开'
$shortcut.Save()
Write-Output ('桌面快捷方式已创建：' + $shortcutPath)
