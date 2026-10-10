param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$appUrl = 'http://127.0.0.1:4196/'
$healthUrl = $appUrl + '__hulan_health__'
function Read-Health {
  try { return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop } catch { return $null }
}
try {
  $indexPath = Join-Path $appRoot 'dist\index.html'
  $buildPath = Join-Path $appRoot 'dist\build-info.json'
  if (!(Test-Path -LiteralPath $indexPath) -or !(Test-Path -LiteralPath $buildPath)) { throw '请先解压完整电脑包，再打开壶兰呼吸。当前文件夹缺少网页文件。' }
  $expectedFingerprint = (Get-FileHash -LiteralPath $buildPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $health = Read-Health
  if ($health -and ($health.application -ne 'hulan-breath-rehab' -or $health.fingerprint -ne $expectedFingerprint)) { throw '本机端口 4196 被其他应用或旧版占用。请先使用旧版的“停止壶兰呼吸”，再打开新版。' }
  if (!$health) {
    $probe = New-Object System.Net.Sockets.TcpClient
    try { $probe.Connect('127.0.0.1', 4196); $occupied = $true } catch { $occupied = $false } finally { $probe.Dispose() }
    if ($occupied) { throw '本机端口 4196 被其他应用占用。请关闭该服务后再试。' }
    $nodePath = Join-Path $appRoot 'runtime\node.exe'
    if (!(Test-Path -LiteralPath $nodePath)) {
      $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    if (!(Test-Path -LiteralPath $nodePath)) { throw '电脑包缺少自带运行程序。请解压完整电脑包，不需要另行安装 Node.js。' }
    $serverPath = Join-Path $appRoot 'scripts\serve.mjs'
    $previousPort = $env:PORT
    try {
      $env:PORT = '4196'
      $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru
    } finally { $env:PORT = $previousPort }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      Start-Sleep -Milliseconds 500
      $health = Read-Health
      if ($health -and $health.application -eq 'hulan-breath-rehab' -and $health.fingerprint -eq $expectedFingerprint) { break }
      if ($serverProcess.HasExited) { break }
    }
    if (!$health -or $health.application -ne 'hulan-breath-rehab' -or $health.fingerprint -ne $expectedFingerprint) {
      if (!$serverProcess.HasExited) { Stop-Process -InputObject $serverProcess -ErrorAction SilentlyContinue }
      throw '本机服务未能启动。请检查电脑包是否完整，以及端口 4196 是否被占用。'
    }
  }
  if ($NoBrowser) { Write-Output ($health | ConvertTo-Json -Compress) } else { Start-Process -FilePath $appUrl }
} catch {
  if ($NoBrowser) { Write-Error $_; exit 1 }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '壶兰呼吸：启动未完成', 'OK', 'Error') | Out-Null
  exit 1
}
