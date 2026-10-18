param([string]$DestinationDirectory)
$customDestination = $PSBoundParameters.ContainsKey('DestinationDirectory')
. (Join-Path $PSScriptRoot 'common.ps1')
try {
  if (!$DestinationDirectory) { $DestinationDirectory = [Environment]::GetFolderPath('DesktopDirectory') }
  $destination = (Resolve-Path -LiteralPath $DestinationDirectory).Path
  $launcher = Join-Path $appRoot 'scripts\desktop\launch.ps1'
  $iconPath = Join-Path $appRoot 'dist\assets\clinical\desktop.ico'
  if (!(Test-Path -LiteralPath $launcher -PathType Leaf) -or !(Test-Path -LiteralPath $nodePath -PathType Leaf) -or
      !(Test-Path -LiteralPath $iconPath -PathType Leaf)) { throw '电脑包缺少启动程序或图标，请先解压完整电脑包。' }
  $shortcutPath = Join-Path $destination '壶兰呼吸康复训练.lnk'
  $description = '壶兰呼吸康复训练：启动本机服务并在默认浏览器打开'
  $shell = New-Object -ComObject WScript.Shell
  if (Test-Path -LiteralPath $shortcutPath) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.Description -ne $description) { throw '目标文件夹已有同名的其他快捷方式，未覆盖。请先改名后重试。' }
  }
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '"'
  $shortcut.WorkingDirectory = $appRoot
  $shortcut.IconLocation = $iconPath + ',0'
  $shortcut.WindowStyle = 7
  $shortcut.Description = $description
  $shortcut.Save()
  Write-Output ('桌面快捷方式已创建：' + $shortcutPath)
} catch {
  if ($customDestination) { Write-Error $_; exit 1 }
  Show-HulanError $_.Exception.Message '壶兰呼吸：快捷方式未完成'
  exit 1
}
